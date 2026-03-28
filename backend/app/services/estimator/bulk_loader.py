"""
Bulk loader for IDOT award data into PostgreSQL.

Designed for high-volume initial load (730K+ rows across 164 CSV files).
Uses batch INSERT with ON CONFLICT DO NOTHING for deduplication.

Usage:
    # From command line:
    python -m app.services.estimator.bulk_loader /path/to/csv/dir

    # Or from GCS:
    python -m app.services.estimator.bulk_loader --gcs gs://il-idot-awards/

    # Programmatic:
    from app.services.estimator.bulk_loader import bulk_load_awards
    stats = await bulk_load_awards(db_url, csv_dir="/path/to/csvs")
"""
from __future__ import annotations

import csv
import logging
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import text

logger = logging.getLogger(__name__)

BATCH_SIZE = 5000

INSERT_SQL = text("""
    INSERT INTO award_item (
        award_item_id, letting_date, pay_item_code, abbreviation,
        item_number, unit, quantity, unit_price,
        contract_number, county, district, source_file
    ) VALUES (
        gen_random_uuid(), :letting_date, :pay_item_code, :abbreviation,
        :item_number, :unit, :quantity, :unit_price,
        :contract_number, :county, :district, :source_file
    )
""")


@dataclass
class LoadStats:
    """Results from a bulk load run."""
    files_processed: int = 0
    files_failed: int = 0
    rows_inserted: int = 0
    rows_skipped: int = 0
    rows_total: int = 0
    duration_seconds: float = 0.0
    errors: list[str] = field(default_factory=list)


def _parse_letting_date_from_filename(filename: str) -> date | None:
    """Extract letting date from AWD_IL_IDOT_YYYY_MM_DD.csv filename."""
    import re
    match = re.search(r"(\d{4})_(\d{2})_(\d{2})", filename)
    if match:
        try:
            return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        except ValueError:
            pass
    return None


def _parse_csv_rows(csv_path: Path) -> list[dict]:
    """Parse a single CSV file into a list of row dicts ready for INSERT."""
    letting_date = _parse_letting_date_from_filename(csv_path.name)
    if not letting_date:
        raise ValueError(f"Cannot parse date from filename: {csv_path.name}")

    rows = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            code = (row.get("code") or "").strip()
            if not code:
                continue

            try:
                quantity = round(Decimal(row.get("quantity", "0").strip() or "0"), 3)
            except (InvalidOperation, ValueError):
                quantity = Decimal(0)

            try:
                price = round(Decimal(row.get("price", "0").strip() or "0"), 2)
            except (InvalidOperation, ValueError):
                price = Decimal(0)

            rows.append({
                "letting_date": letting_date,
                "pay_item_code": code,
                "abbreviation": (row.get("description") or "").strip()[:150],
                "item_number": (row.get("item") or "").strip(),
                "unit": (row.get("unit") or "").strip(),
                "quantity": quantity,
                "unit_price": price,
                "contract_number": (row.get("contract") or "").strip(),
                "county": (row.get("county") or "").strip(),
                "district": (row.get("district") or "").strip(),
                "source_file": csv_path.name,
            })

    return rows


def bulk_load_awards_sync(db_url: str, csv_dir: str | Path) -> LoadStats:
    """
    Synchronous bulk load of all award CSVs into PostgreSQL.

    Uses raw SQL with ON CONFLICT DO NOTHING for maximum throughput.
    Processes files in chronological order, batches of 5000 rows.
    """
    from sqlalchemy import create_engine

    csv_dir = Path(csv_dir)
    csv_files = sorted(csv_dir.glob("AWD_IL_IDOT_*.csv"))

    if not csv_files:
        # Also try the old naming convention
        csv_files = sorted(csv_dir.glob("AWD_*.csv"))

    stats = LoadStats()
    start = time.time()

    logger.info(f"Found {len(csv_files)} CSV files in {csv_dir}")

    engine = create_engine(db_url, echo=False)

    for csv_path in csv_files:
        try:
            rows = _parse_csv_rows(csv_path)
            file_inserted = 0

            # Per-file transaction so one failure doesn't cascade
            with engine.begin() as conn:
                for i in range(0, len(rows), BATCH_SIZE):
                    batch = rows[i:i + BATCH_SIZE]
                    result = conn.execute(INSERT_SQL, batch)
                    file_inserted += result.rowcount

            stats.files_processed += 1
            stats.rows_inserted += file_inserted
            stats.rows_skipped += len(rows) - file_inserted
            stats.rows_total += len(rows)

            logger.info(
                f"  {csv_path.name}: {len(rows)} rows, "
                f"{file_inserted} inserted, {len(rows) - file_inserted} skipped"
            )

        except Exception as e:
            stats.files_failed += 1
            stats.errors.append(f"{csv_path.name}: {e}")
            logger.error(f"  {csv_path.name}: FAILED — {e}")

    engine.dispose()
    stats.duration_seconds = round(time.time() - start, 2)

    logger.info(
        f"Bulk load complete: {stats.files_processed} files, "
        f"{stats.rows_inserted:,} inserted, {stats.rows_skipped:,} skipped, "
        f"{stats.duration_seconds}s"
    )
    return stats


def download_from_gcs(bucket_name: str, local_dir: str | Path) -> Path:
    """Download all CSV files from a GCS bucket to a local directory."""
    from google.cloud import storage

    local_dir = Path(local_dir)
    local_dir.mkdir(parents=True, exist_ok=True)

    client = storage.Client()
    bucket = client.bucket(bucket_name)

    count = 0
    for blob in bucket.list_blobs():
        if blob.name.endswith(".csv"):
            local_path = local_dir / blob.name
            if not local_path.exists():
                blob.download_to_filename(str(local_path))
                count += 1

    logger.info(f"Downloaded {count} CSV files from gs://{bucket_name} to {local_dir}")
    return local_dir


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Bulk load IDOT award data into PostgreSQL")
    parser.add_argument(
        "source",
        help="Local directory with CSVs, or --gcs bucket name",
    )
    parser.add_argument(
        "--gcs", action="store_true",
        help="Source is a GCS bucket name (e.g., il-idot-awards)",
    )
    parser.add_argument(
        "--db-url",
        default=os.environ.get("DATABASE_URL", "postgresql://assetlink:assetlink@localhost:5432/assetlink"),
        help="PostgreSQL connection string",
    )
    parser.add_argument(
        "--tmp-dir", default="/tmp/idot_awards_load",
        help="Temp directory for GCS downloads",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    csv_dir = args.source
    if args.gcs:
        logger.info(f"Downloading from GCS: {args.source}")
        csv_dir = download_from_gcs(args.source, args.tmp_dir)

    stats = bulk_load_awards_sync(args.db_url, csv_dir)

    print(f"\n{'=' * 60}")
    print(f"Files processed: {stats.files_processed}")
    print(f"Files failed:    {stats.files_failed}")
    print(f"Rows total:      {stats.rows_total:,}")
    print(f"Rows inserted:   {stats.rows_inserted:,}")
    print(f"Rows skipped:    {stats.rows_skipped:,} (duplicates)")
    print(f"Duration:        {stats.duration_seconds}s")
    if stats.rows_total > 0:
        print(f"Rate:            {stats.rows_total / stats.duration_seconds:,.0f} rows/sec")
    if stats.errors:
        print(f"\nErrors:")
        for err in stats.errors:
            print(f"  - {err}")
