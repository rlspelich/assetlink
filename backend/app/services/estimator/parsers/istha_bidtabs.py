"""
ISTHA Bid Tab Parser — ported from BidParser (archived/parser/bidtabs/isthabidparse.py)

Parses Illinois State Toll Highway Authority bid tabulation CSV files
into structured data.

Input format: CSV files with dates in filename
  (istha_YYYYMMDD_<projectid>_YYYYMMDD.csv)
Columns: code, abbreviation, unit, quantity, price, bid_total, doc_total,
         contractor, rank, project_no
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ISTHABidRecord:
    """One parsed ISTHA bid line item (flattened: item + contractor in one record)."""
    letting_date: date
    award_date: date
    project_id: str
    pay_item_code: str
    abbreviation: str = ""
    unit: str = ""
    quantity: Decimal = Decimal(0)
    unit_price: Decimal = Decimal(0)
    bid_total: Decimal = Decimal(0)
    doc_total: Decimal = Decimal(0)
    contractor_name: str = ""
    rank: int = 0
    project_no: str = ""
    is_low: bool = False
    total_mismatch: bool = False


@dataclass
class ParsedISTHA:
    """Complete parse result for one ISTHA file."""
    records: list[ISTHABidRecord] = field(default_factory=list)
    letting_date: date | None = None
    award_date: date | None = None
    project_id: str = ""
    item_count: int = 0
    source_file: str = ""
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RE_FILENAME = re.compile(
    r"istha_(\d{4})(\d{2})(\d{2})_([^_]+)_(\d{4})(\d{2})(\d{2})\.csv"
)
RE_IS_NUMBER = re.compile(r"[0-9]+")


def _parse_filename(filename: str) -> tuple[date, date, str] | None:
    """Extract open_date, letting_date, project_id from ISTHA filename."""
    match = RE_FILENAME.search(filename)
    if not match:
        return None
    try:
        open_date = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        letting_date = date(int(match.group(5)), int(match.group(6)), int(match.group(7)))
        project_id = match.group(4)
        return open_date, letting_date, project_id
    except ValueError:
        return None


def _safe_decimal(value: str) -> Decimal | None:
    """Parse a string as Decimal, returning None if not numeric."""
    if not value or not RE_IS_NUMBER.match(value):
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def parse_istha_file(
    content: str,
    source_file: str = "",
) -> ParsedISTHA:
    """
    Parse an ISTHA bid tab CSV file.

    Args:
        content: Raw CSV text content.
        source_file: Filename (used for date/project extraction and error reporting).

    Returns:
        ParsedISTHA with all structured data.
    """
    result = ParsedISTHA(source_file=source_file)

    # Extract dates and project ID from filename
    parsed_name = _parse_filename(source_file)
    if not parsed_name:
        result.warnings.append(
            f"{source_file}: Could not parse filename pattern "
            "(expected istha_YYYYMMDD_projectid_YYYYMMDD.csv)"
        )
        return result

    open_date, letting_date, project_id = parsed_name
    result.letting_date = letting_date
    result.award_date = open_date
    result.project_id = project_id

    # Count unique pay item codes for item_count
    seen_codes: set[str] = set()

    # Parse CSV
    reader = csv.DictReader(io.StringIO(content))
    for row_num, row in enumerate(reader, start=2):
        try:
            code = row.get("code", "").strip()
            if not code:
                result.warnings.append(f"{source_file} row {row_num}: Empty pay item code")
                continue

            seen_codes.add(code)

            quantity = _safe_decimal(row.get("quantity", "").strip()) or Decimal(0)
            price = _safe_decimal(row.get("price", "").strip()) or Decimal(0)
            bid_total = _safe_decimal(row.get("bid_total", "").strip()) or Decimal(0)
            doc_total = _safe_decimal(row.get("doc_total", "").strip()) or Decimal(0)

            rank_str = row.get("rank", "0").strip()
            try:
                rank = int(rank_str)
            except ValueError:
                rank = 0

            result.records.append(ISTHABidRecord(
                letting_date=letting_date,
                award_date=open_date,
                project_id=project_id,
                pay_item_code=code,
                abbreviation=row.get("abbreviation", "").strip(),
                unit=row.get("unit", "").strip(),
                quantity=quantity,
                unit_price=price,
                bid_total=bid_total,
                doc_total=doc_total,
                contractor_name=row.get("contractor", "").strip(),
                rank=rank,
                project_no=row.get("project_no", "").strip(),
                is_low=(rank == 1),
                total_mismatch=(bid_total != doc_total),
            ))

        except Exception as e:
            result.warnings.append(f"{source_file} row {row_num}: {e}")

    result.item_count = len(seen_codes)
    return result
