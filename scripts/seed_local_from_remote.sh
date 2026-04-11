#!/usr/bin/env bash
# seed_local_from_remote.sh
#
# Dump the remote Cloud SQL `assetlink` database and restore it into the
# local Docker Postgres container.
#
# Usage:
#   scripts/seed_local_from_remote.sh [--skip-export] [--fresh]
#
#   --skip-export   Reuse existing local dump at data/dumps/assetlink-latest.sql
#                   (default: export a fresh dump from Cloud SQL)
#   --fresh         Drop+recreate the local DB before restore
#                   (default: wipe the public schema only)

set -euo pipefail

# --- config ---
PROJECT_ID="bucket6-2025-01"
INSTANCE="optionsv2-db"
REMOTE_DB="assetlink"
BUCKET="gs://assetlink-db-dumps"
DUMP_OBJECT="assetlink-latest.sql"
LOCAL_DUMP_DIR="data/dumps"
LOCAL_DUMP="${LOCAL_DUMP_DIR}/${DUMP_OBJECT}"

LOCAL_DB_SERVICE="db"
LOCAL_DB_USER="assetlink"
LOCAL_DB_NAME="assetlink"

# --- locate gcloud ---
if command -v gcloud >/dev/null 2>&1; then
    GCLOUD="gcloud"
    GSUTIL="gsutil"
elif [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
    GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
    GSUTIL="$HOME/google-cloud-sdk/bin/gsutil"
else
    echo "ERROR: gcloud not found. Install it and/or add ~/google-cloud-sdk/bin to PATH." >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker not found. Install Docker Desktop." >&2
    exit 1
fi

# --- args ---
SKIP_EXPORT=0
FRESH=0
for arg in "$@"; do
    case "$arg" in
        --skip-export) SKIP_EXPORT=1 ;;
        --fresh)       FRESH=1 ;;
        -h|--help)
            sed -n '2,15p' "$0"
            exit 0
            ;;
        *)
            echo "unknown argument: $arg" >&2
            exit 2
            ;;
    esac
done

mkdir -p "$LOCAL_DUMP_DIR"

# --- Step 1: export from Cloud SQL to GCS, then download ---
if [ $SKIP_EXPORT -eq 0 ]; then
    echo "==> Ensuring bucket $BUCKET exists"
    if ! $GSUTIL ls "$BUCKET" >/dev/null 2>&1; then
        echo "    creating $BUCKET"
        $GSUTIL mb -p "$PROJECT_ID" -l us-central1 "$BUCKET"
    fi

    echo "==> Granting Cloud SQL service account write access to $BUCKET"
    SA_EMAIL=$($GCLOUD sql instances describe "$INSTANCE" \
        --format='value(serviceAccountEmailAddress)')
    $GSUTIL iam ch "serviceAccount:${SA_EMAIL}:objectAdmin" "$BUCKET" >/dev/null

    echo "==> Removing prior dump object if present"
    $GSUTIL rm "${BUCKET}/${DUMP_OBJECT}" >/dev/null 2>&1 || true

    echo "==> Exporting $REMOTE_DB from $INSTANCE to ${BUCKET}/${DUMP_OBJECT}"
    echo "    (may take several minutes — 1.4M award_item rows)"
    $GCLOUD sql export sql "$INSTANCE" "${BUCKET}/${DUMP_OBJECT}" \
        --database="$REMOTE_DB"

    echo "==> Downloading dump to $LOCAL_DUMP"
    $GSUTIL cp "${BUCKET}/${DUMP_OBJECT}" "$LOCAL_DUMP"

    echo "==> Local dump:"
    ls -lh "$LOCAL_DUMP"
else
    if [ ! -f "$LOCAL_DUMP" ]; then
        echo "ERROR: --skip-export set but $LOCAL_DUMP does not exist" >&2
        exit 1
    fi
    echo "==> Reusing existing $LOCAL_DUMP"
fi

# --- Step 2: bring the local db service up ---
echo "==> Starting local Docker db service"
docker compose up -d "$LOCAL_DB_SERVICE"

echo "==> Waiting for local db to be healthy"
for i in $(seq 1 60); do
    if docker compose exec -T "$LOCAL_DB_SERVICE" pg_isready -U "$LOCAL_DB_USER" >/dev/null 2>&1; then
        echo "    ready"
        break
    fi
    sleep 1
done

# --- Step 3: pre-create roles that the dump references ---
# The Cloud SQL dump references `assetlink_user` and `cloudsqlsuperuser`; create
# them as no-login roles locally so GRANT / ALTER OWNER statements succeed.
echo "==> Ensuring referenced roles exist locally"
docker compose exec -T "$LOCAL_DB_SERVICE" psql -v ON_ERROR_STOP=1 \
    -U "$LOCAL_DB_USER" -d postgres <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'assetlink_user') THEN
        CREATE ROLE assetlink_user;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudsqlsuperuser') THEN
        CREATE ROLE cloudsqlsuperuser;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudsqladmin') THEN
        CREATE ROLE cloudsqladmin;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres;
    END IF;
END
$$;
SQL

# --- Step 4: wipe / recreate target database ---
if [ $FRESH -eq 1 ]; then
    echo "==> Dropping and recreating local database $LOCAL_DB_NAME"
    docker compose exec -T "$LOCAL_DB_SERVICE" psql -v ON_ERROR_STOP=1 \
        -U "$LOCAL_DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $LOCAL_DB_NAME;"
    docker compose exec -T "$LOCAL_DB_SERVICE" psql -v ON_ERROR_STOP=1 \
        -U "$LOCAL_DB_USER" -d postgres -c "CREATE DATABASE $LOCAL_DB_NAME OWNER $LOCAL_DB_USER;"
else
    echo "==> Wiping public schema of local $LOCAL_DB_NAME"
    docker compose exec -T "$LOCAL_DB_SERVICE" psql -v ON_ERROR_STOP=1 \
        -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" \
        -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
fi

# --- Step 5: copy dump into container and restore ---
echo "==> Copying dump into the db container"
docker compose cp "$LOCAL_DUMP" "${LOCAL_DB_SERVICE}:/tmp/dump.sql"

echo "==> Restoring dump into $LOCAL_DB_NAME (this will take a while)"
docker compose exec -T "$LOCAL_DB_SERVICE" psql -v ON_ERROR_STOP=0 \
    -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -f /tmp/dump.sql

docker compose exec -T "$LOCAL_DB_SERVICE" rm /tmp/dump.sql

# --- Step 6: verify ---
echo "==> Row counts (tables that don't exist are silently skipped):"
docker compose exec -T "$LOCAL_DB_SERVICE" psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" <<'SQL' || true
SELECT relname AS tbl, n_live_tup AS rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC
LIMIT 30;
SQL

echo "==> Done. Local $LOCAL_DB_NAME is seeded from $INSTANCE/$REMOTE_DB."