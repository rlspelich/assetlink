# AssetLink Scripts & CLI Reference

> Quick reference for all runnable scripts, scrapers, loaders, and data generators.
> All commands assume you're in the project root (`/Users/robertspelich/PycharmProjects/assetlink`).

---

## Estimator — Scrapers

### Scrape IDOT Award Reports (Excel)

Downloads "Pay Item Report with Awarded Prices" `.xlsx` files from the IDOT WCTB portal. These are the **winning prices only** (one price per item per letting).

```bash
cd backend

# List available lettings
python3 -m app.services.estimator.idot_scraper --no-skip --output-dir ./idot_awards

# Download all lettings
python3 -m app.services.estimator.idot_scraper --output-dir ./idot_awards

# Download and upload to GCS
python3 -m app.services.estimator.idot_scraper --output-dir ./idot_awards --upload-gcs --bucket il-idot-awards-new
```

| Flag | Default | Description |
|---|---|---|
| `--output-dir` | `./idot_pay_item_reports` | Where to save downloaded .xlsx files |
| `--letting-id` | — | Scrape a single letting by GUID |
| `--upload-gcs` | off | Upload to GCS after download |
| `--bucket` | `il-idot-awards-new` | GCS bucket for upload |
| `--concurrency` | 3 | Max parallel downloads |
| `--delay` | 1.0 | Seconds between requests |
| `--no-skip` | off | Re-download even if file exists |

---

### Scrape IDOT Bid Tabs (Full Bidder Data)

Downloads "Unit Price Tabulation of Bids" ZIP files from the IDOT WCTB portal. These contain **every bidder's line-item prices** for every contract (the competitive intelligence data).

```bash
cd backend

# List all available lettings (no download)
python3 -m app.services.estimator.idot_bidtab_scraper --list-only

# Download everything from 2020 onward
python3 -m app.services.estimator.idot_bidtab_scraper \
  --min-date 2020-01-01 \
  --output-dir ./bidtab_downloads

# Download all available lettings
python3 -m app.services.estimator.idot_bidtab_scraper --output-dir ./bidtab_downloads

# Download and upload to GCS
python3 -m app.services.estimator.idot_bidtab_scraper \
  --output-dir ./bidtab_downloads \
  --upload-gcs --bucket il-idot-bidtabs

# Download a single letting
python3 -m app.services.estimator.idot_bidtab_scraper \
  --letting-id 17df51b4-6b45-48c2-9dc3-3c1769a35633
```

| Flag | Default | Description |
|---|---|---|
| `--output-dir` | `./idot_bidtab_downloads` | Where to save extracted .txt files |
| `--letting-id` | — | Scrape a single letting by GUID |
| `--min-date` | — | Only download lettings on or after this date (YYYY-MM-DD) |
| `--list-only` | off | List available lettings without downloading |
| `--upload-gcs` | off | Upload extracted .txt files to GCS |
| `--bucket` | `il-idot-bidtabs` | GCS bucket for upload |
| `--concurrency` | 2 | Max parallel downloads |
| `--delay` | 1.5 | Seconds between requests |
| `--no-skip` | off | Re-download even if files exist |

Files are automatically renamed to the standardized format: `{TYPE}{YYYYMMDD}ILTABS{CONTRACT}.txt`

---

## Estimator — Data Loaders

### Convert IDOT Award Excel → CSV

Converts scraped `.xlsx` award files to standardized CSVs ready for the bulk loader.

```bash
cd backend
python3 -m app.services.estimator.file_utils /path/to/xlsx/files --type idot-awards
python3 -m app.services.estimator.file_utils /path/to/xlsx/files --type istha
```

| Flag | Default | Description |
|---|---|---|
| `input_dir` | (required) | Directory containing .xlsx files |
| `--output-dir` | same as input | Output directory for .csv files |
| `--type` | `idot-awards` | File type: `idot-awards` or `istha` |

---

### Bulk Load Award Data (CSV → PostgreSQL)

Loads award CSV files into the `award_item` table. Uses batch INSERT at ~6,500 rows/sec.

```bash
cd backend

# From local directory
python3 -m app.services.estimator.bulk_loader /path/to/csv/dir

# From GCS bucket
python3 -m app.services.estimator.bulk_loader --gcs il-idot-awards
```

| Flag | Default | Description |
|---|---|---|
| `path` | — | Local directory with `AWD_IL_IDOT_*.csv` files |
| `--gcs` | — | GCS bucket name (downloads to temp dir first) |

Uses `DATABASE_URL_SYNC` from environment or `app.config.settings`.

---

### Bulk Load Bid Tab Data (TXT → PostgreSQL)

Loads bid tab text files into `contract`, `contractor`, `bid`, and `bid_item` tables.

```bash
cd backend

# From local directory
python3 -m app.services.estimator.bidtab_bulk_loader /path/to/txt/dir

# From GCS bucket
python3 -m app.services.estimator.bidtab_bulk_loader --gcs il-idot-bidtabs
```

| Flag | Default | Description |
|---|---|---|
| `path` | — | Local directory with .txt bid tab files |
| `--gcs` | — | GCS bucket name (downloads to temp dir first) |

**Note:** For large loads (10K+ files), the row-by-row approach through Cloud SQL Proxy is slow (~0.2 files/sec). For bulk loads, use the parse-to-TSV + `\COPY` approach instead (see "Fast Bulk Load" below).

---

### Fast Bulk Load (Parse → TSV → COPY)

For loading thousands of bid tab files, parse locally and use PostgreSQL COPY:

```bash
cd backend

# 1. Start Cloud SQL Proxy
cloud-sql-proxy bucket6-2025-01:us-central1:optionsv2-db --port 5433 &

# 2. Parse all files to TSV (takes ~20 seconds for 22K files)
python3 -c "
# [see generate script in project — parses all .txt files to /tmp/bt_all_*.tsv]
"

# 3. Clear and load via COPY
PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U assetlink_user -d assetlink <<'SQL'
TRUNCATE contract CASCADE;
TRUNCATE contractor CASCADE;
\COPY contractor (contractor_pk, contractor_id_code, name) FROM '/tmp/bt_all_contractors.tsv' WITH (FORMAT csv, DELIMITER E'\t');
\COPY contract (contract_id, number, letting_date, letting_type, agency, county, district, municipality, section_no, job_no, project_no, letting_no, item_count, source_file) FROM '/tmp/bt_all_contracts.tsv' WITH (FORMAT csv, DELIMITER E'\t');
\COPY bid (bid_id, contract_id, contractor_pk, rank, total, doc_total, is_low, is_bad, has_alt, no_omitted) FROM '/tmp/bt_all_bids.tsv' WITH (FORMAT csv, DELIMITER E'\t', NULL '');
\COPY bid_item (bid_item_id, bid_id, pay_item_code, abbreviation, unit, quantity, unit_price, was_omitted) FROM '/tmp/bt_all_bid_items.tsv' WITH (FORMAT csv, DELIMITER E'\t');
SQL
```

---

## Estimator — Seed Data

### Seed Cost Indices & Regional Factors

Done via API endpoints (no CLI script needed):

```bash
# Seed NHCCI inflation indices
curl -X POST https://assetlink-api-637582480568.us-central1.run.app/api/v1/estimator/cost-indices/seed

# Seed regional cost factors (50 states + DC)
curl -X POST https://assetlink-api-637582480568.us-central1.run.app/api/v1/estimator/regional-factors/seed
```

---

## Signs Module — Seed & Test Data

### Seed MUTCD Sign Types

Seeds 76 MUTCD sign type codes into the `sign_type` lookup table.

```bash
docker compose exec api python scripts/seed_sign_types.py
```

---

### Generate Sign Test Data (Springfield IL)

Creates ~200 supports with ~500 signs, ~45 work orders, ~65 inspections.

```bash
docker compose exec -e PYTHONPATH=/app api python scripts/generate_signs_wo_insp.py
```

---

## Water & Sewer Module — Seed & Test Data

### Seed Water/Sewer Reference Tables

Seeds material types, valve types, pipe shapes, manhole types (65 records).

```bash
docker compose exec api python scripts/seed_water_sewer.py
```

---

### Generate Water/Sewer Test Data (Springfield IL)

Creates a connected municipal utility network (~1,050 assets).

```bash
docker compose exec -e PYTHONPATH=/app api python scripts/generate_water_sewer.py
```

---

### Generate Water/Sewer Work Orders & Inspections

Creates ~90 WOs and ~110 inspections for water/sewer assets.

```bash
docker compose exec -e PYTHONPATH=/app api python scripts/generate_water_sewer_wo_insp.py
```

---

## Database — Migrations

### Run Migrations (Local)

```bash
docker compose exec api python -m alembic upgrade head
```

### Run Migrations (Production)

```bash
# Start proxy
cloud-sql-proxy bucket6-2025-01:us-central1:optionsv2-db --port 5433 &

# Run migration
cd backend
DATABASE_URL_SYNC="postgresql://assetlink_user:<password>@127.0.0.1:5433/assetlink" \
  python3 -m alembic upgrade head
```

### Check Current Migration

```bash
docker compose exec api python -m alembic current
```

---

## Deployment

### Build & Deploy to Cloud Run

```bash
# Build container
gcloud builds submit --tag gcr.io/bucket6-2025-01/assetlink-api --project bucket6-2025-01

# Deploy
gcloud run deploy assetlink-api \
  --image gcr.io/bucket6-2025-01/assetlink-api:latest \
  --region us-central1 --project bucket6-2025-01 --platform managed
```

### Run Tests Before Push

```bash
# Backend tests
docker compose exec api python -m pytest tests/ -x -q --tb=short

# Frontend build
cd frontend && npm run build
```

---

## GCS Buckets

| Bucket | Contents |
|---|---|
| `gs://il-idot-awards` | 164 award CSVs (2003-2026), 1.4M rows |
| `gs://il-idot-awards-new` | 60 scraped award .xlsx files |
| `gs://il-idot-bidtabs` | 15,864+ bid tab .txt files (2003-2026) |

### Sync local files to GCS

```bash
gsutil -m rsync /local/path/ gs://il-idot-bidtabs/
```
