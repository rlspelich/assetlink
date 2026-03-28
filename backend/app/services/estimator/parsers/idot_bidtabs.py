"""
IDOT Bid Tab Parser — ported from BidParser (apps/biddata/parsers/idot_bidtabs.py)

Parses Illinois DOT mainframe-generated fixed-width bid tabulation text files
into structured data. Pure functions: text in, structured data out.

Three phases:
  1. parse_header()  — contract metadata (letting date, district, county, etc.)
  2. parse_summary() — contractor totals, low bid flags, bad bid flags
  3. parse_line_items() — individual pay item bids per contractor

Main entry point: parse_idot_file(lines) -> ParsedBidTab
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from itertools import pairwise


# ---------------------------------------------------------------------------
# Data classes (plain Python — no Pydantic needed for internal parse output)
# ---------------------------------------------------------------------------

@dataclass
class ContractHeader:
    """Metadata extracted from the document header."""
    letting_date: datetime | None = None
    letting_type: str = ""
    contract_number: str = ""
    district: str = ""
    county: str = ""
    section_no: str = ""
    job_no: str = ""
    project_no: str = ""
    municipality: str = ""
    letting_no: str = ""


@dataclass
class ContractorSummary:
    """One contractor's summary from the top-of-document summary block."""
    contractor_id: str = ""
    doc_total: Decimal = Decimal(0)
    is_low: bool = False
    has_alt: bool = False
    no_omitted: int | None = None


@dataclass
class LineItemBid:
    """One contractor's bid on one pay item line."""
    contractor_id: str = ""
    contractor_name: str = ""
    unit_price: Decimal = Decimal(0)
    was_omitted: bool = False


@dataclass
class LineItem:
    """One pay item line with all contractor bids."""
    item_code: str = ""
    abbreviation: str = ""
    quantity: Decimal = Decimal(0)
    unit: str = ""
    bids: list[LineItemBid] = field(default_factory=list)


@dataclass
class ParsedBidTab:
    """Complete parse result for one bid tab file."""
    header: ContractHeader = field(default_factory=ContractHeader)
    item_count: int = 0
    summaries: list[ContractorSummary] = field(default_factory=list)
    line_items: list[LineItem] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Compiled regexes
# ---------------------------------------------------------------------------

RE_NUMBER = re.compile(r"[0-9]+")
RE_CONTRACTOR_ID = re.compile(r"^[0-9]{4}")


# ---------------------------------------------------------------------------
# Phase 1: Header parsing
# ---------------------------------------------------------------------------

def _parse_attribute(text: str) -> tuple[str, str] | None:
    """Extract a key-value pair from a header attribute line."""
    for prefix, key in [
        ("SECTION", "section_no"),
        ("STATE JOB", "job_no"),
        ("PROJECT", "project_no"),
        ("MUNICIPALITY", "municipality"),
        ("LETTING ITEM", "letting_no"),
    ]:
        if text.startswith(prefix):
            value = text.split(":", 1)[1].strip() if ":" in text else ""
            if value:
                return key, value
            return None
    return None


def parse_header(lines: list[str]) -> ContractHeader:
    """
    Extract contract metadata from the first ~5 lines of the document.
    Handles the leading-space anomaly where some files have an extra space
    at the start of every line.
    """
    header = ContractHeader()

    try:
        header.letting_date = datetime.strptime(
            lines[2][14:25].strip(), "%m/%d/%Y"
        )
    except (ValueError, IndexError):
        pass

    try:
        header.letting_type = lines[2][40:50].strip()
    except IndexError:
        pass

    try:
        header.contract_number = lines[2][99:105].strip()
    except IndexError:
        pass

    try:
        header.district = lines[3][22:25].strip().lstrip("0")
    except IndexError:
        pass

    try:
        header.county = lines[4][58:70].strip()
    except IndexError:
        pass

    return header


# ---------------------------------------------------------------------------
# Phase 2: Summary parsing
# ---------------------------------------------------------------------------

def parse_summary(
    lines: list[str], star_line_idx: int, header: ContractHeader
) -> list[ContractorSummary]:
    """
    Parse the contractor summary block (everything before the **** line).
    Also extracts header attributes (section, job, project, municipality,
    letting item) that appear in the summary section.
    """
    summaries: list[ContractorSummary] = []

    for line, _ in pairwise(lines[:star_line_idx]):
        project_no_pos = line[0:50].strip()
        muni_pos = line[50:106].strip()
        letting_no_pos = line[106:132].strip()
        contractor_id_pos = line[0:5].strip()
        bid_price_pos = line[89:103].strip().replace(",", "")
        low_bid_pos = line[107:109].strip()
        blank_bid_pos = line[127:132].strip()
        alt_bid_pos = line[25:31]

        # Extract header attributes from summary lines
        for pos_text in [letting_no_pos, project_no_pos, muni_pos]:
            attr = _parse_attribute(pos_text)
            if attr:
                setattr(header, attr[0], attr[1])

        # Detect contractor ID line
        if RE_CONTRACTOR_ID.match(contractor_id_pos):
            summaries.append(ContractorSummary(
                contractor_id=contractor_id_pos,
            ))

        if not summaries:
            continue

        current = summaries[-1]

        if RE_NUMBER.match(bid_price_pos) and low_bid_pos != "*":
            current.doc_total = Decimal(bid_price_pos)
            current.is_low = False
            if RE_NUMBER.match(blank_bid_pos):
                current.no_omitted = int(blank_bid_pos)
            if alt_bid_pos != "NO ALT":
                current.has_alt = True

        elif RE_NUMBER.match(bid_price_pos) and low_bid_pos == "*":
            current.doc_total = Decimal(bid_price_pos)
            current.is_low = True
            if RE_NUMBER.match(blank_bid_pos):
                current.no_omitted = int(blank_bid_pos)
            if alt_bid_pos != "NO ALT":
                current.has_alt = True

        elif (
            RE_NUMBER.match(blank_bid_pos)
            and re.search(r"\s", line[0:1])
            and re.search(r"\w+", alt_bid_pos)
        ):
            current.no_omitted = int(blank_bid_pos)
            if alt_bid_pos != "NO ALT":
                current.has_alt = True

    return summaries


# ---------------------------------------------------------------------------
# Phase 3: Line item parsing
# ---------------------------------------------------------------------------

def _parse_price(text: str) -> Decimal:
    """Parse a price string, stripping commas and trailing zeros."""
    cleaned = text.strip().replace(",", "")
    if not cleaned:
        return Decimal(0)
    try:
        return Decimal(cleaned.rstrip("0").rstrip(".") or "0")
    except InvalidOperation:
        return Decimal(0)


def parse_line_items(lines: list[str], start_idx: int) -> list[LineItem]:
    """
    Parse the detail contractor bids section (everything after **** + 9 lines).
    Handles:
    - Multi-line contractor names (name spans two lines, price on second line)
    - Bad bids (line ends with *)
    - Omitted bids (no price)
    """
    items: list[LineItem] = []
    current_item_code: str = ""

    for line, line2 in pairwise(lines[start_idx:]):
        id_pos = line[0:10].strip()
        bid_pos = line[64:81].strip()
        bid_pos_next = line2[64:81].strip()
        name_part1 = line[10:56].strip()
        name_part2 = line2[10:56].strip()

        # --- Pay item header line ---
        if len(id_pos) > 4 and not id_pos.startswith("*"):
            current_item_code = line[0:11].strip()
            abbreviation = line[13:49].strip()
            try:
                quantity = Decimal(line[48:63].strip().replace(",", ""))
            except InvalidOperation:
                quantity = Decimal(0)
            unit = line[64:72].strip()
            items.append(LineItem(
                item_code=current_item_code,
                abbreviation=abbreviation,
                quantity=quantity,
                unit=unit,
            ))
            continue

        # Everything below requires a 4-digit contractor ID
        if len(id_pos) != 4 or not items:
            continue

        current = items[-1]
        line_ends_with_star = line.rstrip().endswith("*")

        if bid_pos != "" and not line_ends_with_star:
            # Normal single-line bid
            current.bids.append(LineItemBid(
                contractor_id=id_pos,
                contractor_name=name_part1,
                unit_price=_parse_price(bid_pos),
                was_omitted=False,
            ))

        elif bid_pos != "" and line_ends_with_star:
            # Bad bid (asterisk) — price is zeroed out
            current.bids.append(LineItemBid(
                contractor_id=id_pos,
                contractor_name=name_part1,
                unit_price=Decimal(0),
                was_omitted=True,
            ))

        elif bid_pos == "" and not line_ends_with_star:
            # Multi-line name or single-line omitted bid
            next_id_pos = line2[0:10].strip()
            if RE_CONTRACTOR_ID.match(next_id_pos) and len(next_id_pos) == 4:
                # Next line is a new contractor — this is a single-line omitted bid
                current.bids.append(LineItemBid(
                    contractor_id=id_pos,
                    contractor_name=name_part1,
                    unit_price=Decimal(0),
                    was_omitted=True,
                ))
            else:
                # Multi-line contractor name — price is on the next line
                full_name = f"{name_part1} {name_part2}".strip()
                try:
                    price = _parse_price(bid_pos_next)
                    was_omitted = False
                except Exception:
                    price = Decimal(0)
                    was_omitted = True
                current.bids.append(LineItemBid(
                    contractor_id=id_pos,
                    contractor_name=full_name,
                    unit_price=price,
                    was_omitted=was_omitted,
                ))

        elif bid_pos == "" and line_ends_with_star:
            # Bad bid with no price — single-line or multi-line name
            next_id_pos = line2[0:10].strip()
            if RE_CONTRACTOR_ID.match(next_id_pos) and len(next_id_pos) == 4:
                current.bids.append(LineItemBid(
                    contractor_id=id_pos,
                    contractor_name=name_part1,
                    unit_price=Decimal(0),
                    was_omitted=True,
                ))
            elif bid_pos_next == "" and not (
                RE_CONTRACTOR_ID.match(next_id_pos) and len(next_id_pos) == 4
            ):
                full_name = f"{name_part1} {name_part2}".strip()
                current.bids.append(LineItemBid(
                    contractor_id=id_pos,
                    contractor_name=full_name,
                    unit_price=Decimal(0),
                    was_omitted=True,
                ))
            else:
                current.bids.append(LineItemBid(
                    contractor_id=id_pos,
                    contractor_name=name_part1,
                    unit_price=Decimal(0),
                    was_omitted=True,
                ))

    return items


# ---------------------------------------------------------------------------
# Bid totals & ranking
# ---------------------------------------------------------------------------

def calculate_bid_totals(line_items: list[LineItem]) -> dict[str, Decimal]:
    """Sum unit_price * quantity for each contractor across all line items."""
    totals: dict[str, Decimal] = {}
    for item in line_items:
        for bid in item.bids:
            key = bid.contractor_name
            if key not in totals:
                totals[key] = Decimal(0)
            totals[key] += bid.unit_price * item.quantity
    return totals


def identify_bad_bidders(line_items: list[LineItem]) -> set[str]:
    """Find contractors who have any omitted/bad bids."""
    bad: set[str] = set()
    for item in line_items:
        for bid in item.bids:
            if bid.was_omitted:
                bad.add(bid.contractor_name)
    return bad


def calculate_rankings(
    totals: dict[str, Decimal],
    bad_bidders: set[str],
) -> dict[str, int]:
    """Rank contractors by total bid. Bad bidders get rank 0."""
    rankings: dict[str, int] = {}
    valid_totals = sorted(
        {v for k, v in totals.items() if k not in bad_bidders}
    )
    for name, total in totals.items():
        if name in bad_bidders:
            rankings[name] = 0
        else:
            rankings[name] = valid_totals.index(total) + 1
    return rankings


def build_name_to_id_map(line_items: list[LineItem]) -> dict[str, str]:
    """Build a mapping from contractor_name -> contractor_id using line items."""
    name_to_id: dict[str, str] = {}
    for item in line_items:
        for bid in item.bids:
            if bid.contractor_id and bid.contractor_name:
                name_to_id[bid.contractor_name] = bid.contractor_id
    return name_to_id


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def parse_idot_file(raw_lines: list[str], source_file: str = "") -> ParsedBidTab:
    """
    Parse a complete IDOT bid tab text file.

    Args:
        raw_lines: Lines of text from the file (as from readlines()).
        source_file: Filename for error reporting.

    Returns:
        ParsedBidTab with all structured data.
    """
    result = ParsedBidTab()

    # Normalize: strip bytes if needed, ensure strings
    lines = []
    for line in raw_lines:
        if isinstance(line, bytes):
            line = line.decode("utf-8", errors="replace")
        # Don't strip trailing whitespace — we need it for * detection
        lines.append(line.rstrip("\n").rstrip("\r"))

    if len(lines) < 5:
        result.warnings.append(f"{source_file}: File too short ({len(lines)} lines)")
        return result

    # Fix leading-space anomaly: some files have one extra space at start of each line
    if lines[2].startswith(" "):
        lines = [line[1:] if line.startswith(" ") else line for line in lines]

    # Append blank line sentinel (matches original parser behavior)
    lines.append("")

    # Phase 1: Header
    result.header = parse_header(lines)

    # Find the **** separator line
    star_indices = [i for i, s in enumerate(lines) if "****" in s]
    if not star_indices:
        result.warnings.append(f"{source_file}: No **** separator found")
        return result

    star_idx = star_indices[0]

    # Extract item count from the **** line
    try:
        result.item_count = int(lines[star_idx][54:76].strip())
    except (ValueError, IndexError):
        result.warnings.append(
            f"{source_file}: Could not parse item count from **** line"
        )

    # Phase 2: Summary
    result.summaries = parse_summary(lines, star_idx, result.header)

    # Phase 3: Line items (detail section starts 9 lines after ****)
    detail_start = star_idx + 9
    result.line_items = parse_line_items(lines, detail_start)

    # Post-processing: calculate totals and rankings
    totals = calculate_bid_totals(result.line_items)
    bad_bidders = identify_bad_bidders(result.line_items)

    # Validation: compare calculated totals vs document totals
    summary_by_id = {s.contractor_id: s for s in result.summaries}
    name_to_id = build_name_to_id_map(result.line_items)

    for name, calc_total in totals.items():
        cid = name_to_id.get(name)
        if cid and cid in summary_by_id:
            doc_total = summary_by_id[cid].doc_total
            calc_rounded = round(calc_total, 2)
            if doc_total and calc_rounded != doc_total:
                diff = abs(calc_rounded - doc_total)
                result.warnings.append(
                    f"{source_file}: Total mismatch for contractor {cid} ({name}): "
                    f"calculated={calc_rounded}, document={doc_total}, diff={diff}"
                )

    return result
