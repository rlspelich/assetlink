"""
IDOT Awards Parser — ported from BidParser (archived/parser/bidtabs/idotawdparse.py)

Parses IDOT award CSV files into structured data. These files contain
winning bid data without per-contractor breakdown.

Input format: CSV files with dates in filename (AWD_IL_IDOT_YYYY_MM_DD.csv)
Columns: code, description, unit, quantity, price, contract, item, district, county
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ParsedAwardItem:
    """One parsed award line item."""
    letting_date: date
    pay_item_code: str
    abbreviation: str = ""
    item_number: str = ""
    unit: str = ""
    quantity: Decimal = Decimal(0)
    unit_price: Decimal = Decimal(0)
    contract_number: str = ""
    county: str = ""
    district: str = ""


@dataclass
class ParsedAwards:
    """Complete parse result for one awards file."""
    items: list[ParsedAwardItem] = field(default_factory=list)
    letting_date: date | None = None
    source_file: str = ""
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RE_SCI_DE = re.compile(r"\d\.\de\+\d\d")
RE_SCI_DDE = re.compile(r"(\d\.\d)0E\+(\d\d)")
RE_FILENAME_DATE = re.compile(
    r"AWD_(\w+)_(\w+)_(\d{4})_(\d{2})_(\d{2})"
)


def sci_note_fix(num: str) -> str:
    """
    Fix IDOT contract numbers containing E that get interpreted as
    scientific notation (e.g., '1.2e+02' -> '120E').
    """
    if RE_SCI_DE.match(num):
        return num.replace(".", "").replace("+", "").upper()
    match = RE_SCI_DDE.match(num)
    if match:
        return match.group(1).replace(".", "") + "E" + str(int(match.group(2)) - 1)
    return num.rstrip("0").rstrip(".")


def parse_filename_date(filename: str) -> date | None:
    """Extract letting date from award filename (AWD_IL_IDOT_YYYY_MM_DD.csv)."""
    match = RE_FILENAME_DATE.search(filename)
    if not match:
        return None
    try:
        return date(int(match.group(3)), int(match.group(4)), int(match.group(5)))
    except ValueError:
        return None


def _clean_code(code_str: str) -> str:
    """Strip trailing .0 from numeric codes read as floats."""
    if "." in code_str:
        return code_str.rstrip("0").rstrip(".")
    return code_str


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def parse_idot_awards_file(
    content: str,
    source_file: str = "",
    letting_date_override: date | None = None,
) -> ParsedAwards:
    """
    Parse an IDOT awards CSV file.

    Args:
        content: Raw CSV text content.
        source_file: Filename (used for date extraction and error reporting).
        letting_date_override: If provided, use this instead of parsing from filename.

    Returns:
        ParsedAwards with all structured data.
    """
    result = ParsedAwards(source_file=source_file)

    # Determine letting date
    letting_dt = letting_date_override or parse_filename_date(source_file)
    if not letting_dt:
        result.warnings.append(
            f"{source_file}: Could not determine letting date from filename"
        )
        return result

    result.letting_date = letting_dt

    # Parse CSV
    reader = csv.DictReader(io.StringIO(content))
    for row_num, row in enumerate(reader, start=2):
        try:
            code = _clean_code(row.get("code", "").strip())
            if not code:
                result.warnings.append(f"{source_file} row {row_num}: Empty pay item code")
                continue

            item_number = _clean_code(row.get("item", "").strip())
            district = _clean_code(row.get("district", "").strip())

            try:
                quantity = round(Decimal(row.get("quantity", "0").strip()), 3)
            except InvalidOperation:
                quantity = Decimal(0)
                result.warnings.append(
                    f"{source_file} row {row_num}: Invalid quantity '{row.get('quantity')}'"
                )

            try:
                price = round(Decimal(row.get("price", "0").strip()), 2)
            except InvalidOperation:
                price = Decimal(0)
                result.warnings.append(
                    f"{source_file} row {row_num}: Invalid price '{row.get('price')}'"
                )

            contract = sci_note_fix(row.get("contract", "").strip())

            result.items.append(ParsedAwardItem(
                letting_date=letting_dt,
                pay_item_code=code,
                abbreviation=row.get("description", "").strip(),
                item_number=item_number,
                unit=row.get("unit", "").strip(),
                quantity=quantity,
                unit_price=price,
                contract_number=contract,
                county=row.get("county", "").strip(),
                district=district,
            ))

        except Exception as e:
            result.warnings.append(f"{source_file} row {row_num}: {e}")

    return result
