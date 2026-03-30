"""
Bulk loader for IDOT bid tab data into PostgreSQL.

Parses bid tab text files and batch-inserts into contract, contractor, bid,
and bid_item tables. Uses the existing parser (idot_bidtabs.py) for parsing,
then raw SQL for fast batch inserts.

Usage:
    # From local directory:
    python -m app.services.estimator.bidtab_bulk_loader /path/to/bidtab/dir

    # From GCS bucket:
    python -m app.services.estimator.bidtab_bulk_loader --gcs il-idot-bidtabs

    # Programmatic:
    from app.services.estimator.bidtab_bulk_loader import bulk_load_bidtabs
    stats = bulk_load_bidtabs(db_url, "/path/to/files")
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine, text

from app.services.estimator.parsers.idot_bidtabs import (
    parse_idot_file,
    calculate_bid_totals,
    calculate_rankings,
    identify_bad_bidders,
    build_name_to_id_map,
)
from app.services.estimator.data_cleaner import (
    normalize_county,
    normalize_municipality,
    normalize_contractor_name,
)

logger = logging.getLogger(__name__)

BATCH_SIZE = 2000


@dataclass
class BidTabLoadStats:
    """Results from a bid tab bulk load."""
    files_processed: int = 0
    files_failed: int = 0
    contracts_created: int = 0
    contractors_created: int = 0
    bids_created: int = 0
    bid_items_created: int = 0
    duration_seconds: float = 0.0
    errors: list[str] = field(default_factory=list)


# SQL statements for batch insert
CONTRACT_UPSERT = text("""
    INSERT INTO contract (
        contract_id, number, letting_date, letting_type, agency,
        county, district, municipality, section_no, job_no,
        project_no, letting_no, item_count, source_file
    ) VALUES (
        :contract_id, :number, :letting_date, :letting_type, :agency,
        :county, :district, :municipality, :section_no, :job_no,
        :project_no, :letting_no, :item_count, :source_file
    )
    ON CONFLICT (number, agency) DO UPDATE SET
        letting_date = EXCLUDED.letting_date,
        letting_type = EXCLUDED.letting_type,
        county = EXCLUDED.county,
        district = EXCLUDED.district,
        municipality = EXCLUDED.municipality,
        section_no = EXCLUDED.section_no,
        job_no = EXCLUDED.job_no,
        project_no = EXCLUDED.project_no,
        letting_no = EXCLUDED.letting_no,
        item_count = EXCLUDED.item_count,
        source_file = EXCLUDED.source_file
    RETURNING contract_id
""")

CONTRACTOR_UPSERT = text("""
    INSERT INTO contractor (contractor_pk, contractor_id_code, name)
    VALUES (:contractor_pk, :contractor_id_code, :name)
    ON CONFLICT (contractor_id_code, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING contractor_pk
""")

BID_INSERT = text("""
    INSERT INTO bid (
        bid_id, contract_id, contractor_pk, rank, total,
        doc_total, is_low, is_bad, has_alt, no_omitted
    ) VALUES (
        :bid_id, :contract_id, :contractor_pk, :rank, :total,
        :doc_total, :is_low, :is_bad, :has_alt, :no_omitted
    )
    ON CONFLICT (contract_id, contractor_pk) DO UPDATE SET
        rank = EXCLUDED.rank,
        total = EXCLUDED.total,
        doc_total = EXCLUDED.doc_total,
        is_low = EXCLUDED.is_low,
        is_bad = EXCLUDED.is_bad
    RETURNING bid_id
""")

BID_ITEM_INSERT = text("""
    INSERT INTO bid_item (
        bid_item_id, bid_id, pay_item_code, abbreviation,
        unit, quantity, unit_price, was_omitted
    ) VALUES (
        :bid_item_id, :bid_id, :pay_item_code, :abbreviation,
        :unit, :quantity, :unit_price, :was_omitted
    )
""")

DELETE_BID_ITEMS_FOR_CONTRACT = text("""
    DELETE FROM bid_item WHERE bid_id IN (
        SELECT bid_id FROM bid WHERE contract_id = :contract_id
    )
""")

DELETE_BIDS_FOR_CONTRACT = text("""
    DELETE FROM bid WHERE contract_id = :contract_id
""")


def _process_one_file(conn, filepath: Path, stats: BidTabLoadStats):
    """Parse and load a single bid tab file within a transaction."""
    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()

        parsed = parse_idot_file(lines, source_file=filepath.name)
        header = parsed.header

        if not header.contract_number or not header.letting_date:
            stats.errors.append(f"{filepath.name}: Missing contract number or letting date")
            stats.files_failed += 1
            return

        letting_date = header.letting_date.date() if header.letting_date else None

        # Calculate totals, rankings, bad bidders
        totals = calculate_bid_totals(parsed.line_items)
        bad_bidders = identify_bad_bidders(parsed.line_items)
        rankings = calculate_rankings(totals, bad_bidders)
        name_to_id = build_name_to_id_map(parsed.line_items)
        summary_by_id = {s.contractor_id: s for s in parsed.summaries}

        # 1. Upsert contract
        result = conn.execute(CONTRACT_UPSERT, {
            "contract_id": str(uuid.uuid4()),
            "number": header.contract_number,
            "letting_date": letting_date,
            "letting_type": header.letting_type or "",
            "agency": "IDOT",
            "county": normalize_county(header.county or ""),
            "district": header.district or "",
            "municipality": normalize_municipality(header.municipality or ""),
            "section_no": header.section_no or "",
            "job_no": header.job_no or "",
            "project_no": header.project_no or "",
            "letting_no": header.letting_no or "",
            "item_count": parsed.item_count,
            "source_file": filepath.name,
        })
        contract_id = str(result.fetchone()[0])
        stats.contracts_created += 1

        # 2. Delete existing bid items and bids for re-import
        conn.execute(DELETE_BID_ITEMS_FOR_CONTRACT, {"contract_id": contract_id})
        conn.execute(DELETE_BIDS_FOR_CONTRACT, {"contract_id": contract_id})

        # 3. Process each contractor
        bid_item_batch = []

        for raw_contractor_name, calc_total in totals.items():
            cid = name_to_id.get(raw_contractor_name, "")
            contractor_name = normalize_contractor_name(raw_contractor_name)

            # Upsert contractor
            result = conn.execute(CONTRACTOR_UPSERT, {
                "contractor_pk": str(uuid.uuid4()),
                "contractor_id_code": cid,
                "name": contractor_name,
            })
            contractor_pk = str(result.fetchone()[0])
            stats.contractors_created += 1

            # Get summary data
            summary = summary_by_id.get(cid)
            doc_total = float(summary.doc_total) if summary and summary.doc_total else 0

            # Insert bid
            result = conn.execute(BID_INSERT, {
                "bid_id": str(uuid.uuid4()),
                "contract_id": contract_id,
                "contractor_pk": contractor_pk,
                "rank": rankings.get(raw_contractor_name, 0),
                "total": round(float(calc_total), 2),
                "doc_total": doc_total,
                "is_low": bool(summary.is_low) if summary else False,
                "is_bad": raw_contractor_name in bad_bidders,
                "has_alt": bool(summary.has_alt) if summary else False,
                "no_omitted": summary.no_omitted if summary else None,
            })
            bid_id = str(result.fetchone()[0])
            stats.bids_created += 1

            # Collect bid items
            for line_item in parsed.line_items:
                for line_bid in line_item.bids:
                    if line_bid.contractor_name == raw_contractor_name:
                        bid_item_batch.append({
                            "bid_item_id": str(uuid.uuid4()),
                            "bid_id": bid_id,
                            "pay_item_code": line_item.item_code,
                            "abbreviation": line_item.abbreviation[:50],
                            "unit": line_item.unit[:15],
                            "quantity": float(line_item.quantity),
                            "unit_price": float(line_bid.unit_price),
                            "was_omitted": line_bid.was_omitted,
                        })

                        # Flush batch if large
                        if len(bid_item_batch) >= BATCH_SIZE:
                            conn.execute(BID_ITEM_INSERT, bid_item_batch)
                            stats.bid_items_created += len(bid_item_batch)
                            bid_item_batch = []

        # Flush remaining bid items
        if bid_item_batch:
            conn.execute(BID_ITEM_INSERT, bid_item_batch)
            stats.bid_items_created += len(bid_item_batch)

        stats.files_processed += 1

    except Exception as e:
        stats.errors.append(f"{filepath.name}: {e}")
        stats.files_failed += 1
        raise  # Re-raise to trigger transaction rollback


def bulk_load_bidtabs(db_url: str, file_dir: str | None = None, gcs_bucket: str | None = None) -> BidTabLoadStats:
    """
    Bulk-load IDOT bid tab text files into PostgreSQL.

    Args:
        db_url: Sync PostgreSQL connection string
        file_dir: Local directory containing bid tab .txt files
        gcs_bucket: GCS bucket name (downloads to temp dir first)

    Returns:
        BidTabLoadStats with counts and timing.
    """
    stats = BidTabLoadStats()
    start = time.time()

    # Resolve file directory
    if gcs_bucket:
        from app.services.estimator.bulk_loader import download_from_gcs
        file_dir = download_from_gcs(gcs_bucket, "/tmp/bidtab_download")

    if not file_dir:
        stats.errors.append("No file directory or GCS bucket specified")
        return stats

    bid_tab_dir = Path(file_dir)
    files = sorted(bid_tab_dir.glob("*.txt")) + sorted(bid_tab_dir.glob("*.TXT"))

    if not files:
        stats.errors.append(f"No .txt files found in {file_dir}")
        return stats

    logger.info(f"Found {len(files)} bid tab files to process")

    engine = create_engine(db_url, echo=False)

    for filepath in files:
        # Each file gets its own transaction
        with engine.begin() as conn:
            try:
                _process_one_file(conn, filepath, stats)
            except Exception:
                # Transaction auto-rolls back via context manager
                pass  # Error already logged in _process_one_file

        if stats.files_processed % 50 == 0 and stats.files_processed > 0:
            elapsed = time.time() - start
            rate = stats.files_processed / elapsed
            logger.info(
                f"Progress: {stats.files_processed}/{len(files)} files "
                f"({rate:.1f} files/sec), "
                f"{stats.bid_items_created:,} bid items"
            )

    engine.dispose()

    stats.duration_seconds = round(time.time() - start, 2)

    logger.info(
        f"Bulk load complete: {stats.files_processed} files, "
        f"{stats.contracts_created} contracts, "
        f"{stats.contractors_created} contractors (upserted), "
        f"{stats.bids_created} bids, "
        f"{stats.bid_items_created:,} bid items "
        f"in {stats.duration_seconds:.1f}s"
    )

    if stats.errors:
        logger.warning(f"{len(stats.errors)} errors encountered")
        for err in stats.errors[:10]:
            logger.warning(f"  {err}")

    return stats


if __name__ == "__main__":
    import argparse
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    from app.config import settings

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Bulk-load IDOT bid tab files")
    parser.add_argument("path", nargs="?", help="Local directory with .txt bid tab files")
    parser.add_argument("--gcs", help="GCS bucket name (e.g., il-idot-bidtabs)")
    args = parser.parse_args()

    result = bulk_load_bidtabs(
        db_url=settings.database_url_sync,
        file_dir=args.path,
        gcs_bucket=args.gcs,
    )

    print(f"\n{'=' * 60}")
    print(f"Bid Tab Bulk Load Results")
    print(f"{'=' * 60}")
    print(f"  Files processed:    {result.files_processed}")
    print(f"  Files failed:       {result.files_failed}")
    print(f"  Contracts:          {result.contracts_created}")
    print(f"  Contractors:        {result.contractors_created}")
    print(f"  Bids:               {result.bids_created}")
    print(f"  Bid items:          {result.bid_items_created:,}")
    print(f"  Duration:           {result.duration_seconds:.1f}s")
    if result.bid_items_created > 0 and result.duration_seconds > 0:
        rate = result.bid_items_created / result.duration_seconds
        print(f"  Rate:               {rate:,.0f} bid items/sec")
    if result.errors:
        print(f"\n  Errors ({len(result.errors)}):")
        for err in result.errors[:20]:
            print(f"    - {err}")
    print(f"{'=' * 60}")
