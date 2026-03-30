"""
Data cleaning module for IDOT bid tab and award data.

Normalizes county names, municipality names, and contractor names
before data is inserted into the database. Applied at import time
so every scrape comes in clean.

The canonical mappings were derived from analyzing 22K+ contracts
and 1.4M award items in the production database.
"""
from __future__ import annotations


# =========================================================================
# County Normalization
# =========================================================================

# Typos, abbreviations, and variants → canonical IL county names
_COUNTY_FIXES: dict[str, str] = {
    # Typos and abbreviations
    "ALEXANDE": "ALEXANDER",
    "CARROL": "CARROLL",
    "CHAMPAIG": "CHAMPAIGN",
    "CUMBERLA": "CUMBERLAND",
    "EFFINGHA": "EFFINGHAM",
    "HAMILTION": "HAMILTON",
    "HENDERSO": "HENDERSON",
    "JEFFERSO": "JEFFERSON",
    "LIVINGST": "LIVINGSTON",
    "MONTGOME": "MONTGOMERY",
    "MOULTIRE": "MOULTRIE",
    "RANDOPLH": "RANDOLPH",
    "SANGMAON": "SANGAMON",
    "TAZWELL": "TAZEWELL",
    "TAZWEWELL": "TAZEWELL",
    "VERMILLION": "VERMILION",
    "VERMILIO": "VERMILION",
    "WOODOFORD": "WOODFORD",
    "WHITESID": "WHITESIDE",
    # Spacing variants
    "LASALLE": "LA SALLE",
    "JODAVIESS": "JO DAVIESS",
    "JODAVIES": "JO DAVIESS",
    "OAKBROOK": "OAK BROOK",
    # ST. CLAIR variants
    "ST CLAIR": "ST. CLAIR",
    "ST.CLAIR": "ST. CLAIR",
    "ST. CLAI": "ST. CLAIR",
    # "GREEN" is Greene County (not Green)
    "GREEN": "GREENE",
}

# Suffixes to strip (state identifiers, trailing punctuation)
_COUNTY_STRIP_SUFFIXES = [
    ", IL", ",IL", " IL", ",IL-", ",I", ",",
]


def normalize_county(raw: str) -> str:
    """
    Normalize an IDOT county name to its canonical form.

    Handles:
    - Mixed case → uppercase
    - Trailing state identifiers (", IL", " IL", etc.)
    - Typos and abbreviations (LASALLE → LA SALLE, etc.)
    - Multi-county values → first county only (e.g., "BUREAU, LA SALLE" → "BUREAU")
    - "CITY OF X" → "X"
    """
    if not raw:
        return raw

    val = raw.strip().upper()

    # Strip state suffixes
    for suffix in _COUNTY_STRIP_SUFFIXES:
        if val.endswith(suffix.upper()):
            val = val[: -len(suffix)].strip()
            break

    # "CITY OF X" → X
    if val.startswith("CITY OF "):
        val = val[8:].strip()

    # Multi-county: take first county (but not "ST. CLAIR" which has a comma-like period)
    if "," in val and not val.startswith("ST."):
        val = val.split(",")[0].strip()

    # Direct mapping fixes
    if val in _COUNTY_FIXES:
        val = _COUNTY_FIXES[val]

    return val


# =========================================================================
# Municipality Normalization
# =========================================================================

_MUNICIPALITY_FIXES: dict[str, str] = {
    "BEDFORK PARK": "BEDFORD PARK",
    "EDWARSVILLE": "EDWARDSVILLE",
    "HAWTHORNE WOODS": "HAWTHORN WOODS",
    "HOMER GLENN": "HOMER GLEN",
    "LAGRANGE": "LA GRANGE",
    "LAGRANGE PARK": "LA GRANGE PARK",
    "LINCONSHIRE": "LINCOLNSHIRE",
    "MT VERNON": "MT. VERNON",
    "OAKBROOK": "OAK BROOK",
    "WO0DRIDGE": "WOODRIDGE",  # zero instead of O
    "LASALLE": "LA SALLE",
    "NORTHERN ILL. UNIVERSITY": "NORTHERN IL UNIVERSITY",
}


def normalize_municipality(raw: str) -> str:
    """
    Normalize a municipality name.

    Handles:
    - Trimming whitespace
    - Uppercase
    - "CITY OF X" → X
    - Known typos
    """
    if not raw:
        return raw

    val = raw.strip().upper()

    # "CITY OF X" → X
    if val.startswith("CITY OF "):
        val = val[8:].strip()

    # Direct mapping fixes
    if val in _MUNICIPALITY_FIXES:
        val = _MUNICIPALITY_FIXES[val]

    return val


# =========================================================================
# Contractor Name Normalization
# =========================================================================


def normalize_contractor_name(raw: str) -> str:
    """
    Light normalization of contractor names.

    Does NOT merge duplicates (that's done by IDOT code matching at import).
    Just cleans whitespace and obvious formatting issues.
    """
    if not raw:
        return raw

    val = raw.strip()

    # Collapse multiple spaces
    while "  " in val:
        val = val.replace("  ", " ")

    # Remove trailing commas/periods
    val = val.rstrip(",").rstrip(".").strip()

    return val


# =========================================================================
# Pay Item Description Enrichment
# =========================================================================

# Cache for pay item catalog (loaded lazily)
_pay_item_cache: dict[str, str] | None = None


def enrich_pay_item_description(code: str, abbreviation: str, catalog: dict[str, str] | None = None) -> str:
    """
    Replace a truncated bid tab abbreviation with the full catalog description
    if available. Falls back to the original abbreviation.

    Args:
        code: IDOT pay item code
        abbreviation: The truncated abbreviation from the bid tab
        catalog: Optional pre-loaded dict of {code: description}
    """
    if catalog and code in catalog:
        return catalog[code]
    return abbreviation


def build_pay_item_catalog(db_cursor) -> dict[str, str]:
    """
    Load the pay_item catalog into a dict for fast lookups during import.

    Args:
        db_cursor: A psycopg2 cursor (sync) or similar

    Returns:
        Dict mapping pay_item_code → full description
    """
    db_cursor.execute(
        "SELECT code, description FROM pay_item WHERE agency = 'IDOT' AND description != ''"
    )
    return {row[0]: row[1] for row in db_cursor.fetchall()}


# =========================================================================
# Batch Cleaning (for use in import pipelines)
# =========================================================================


def clean_contract_record(record: dict) -> dict:
    """Clean a contract record dict before insertion."""
    if "county" in record:
        record["county"] = normalize_county(record["county"])
    if "municipality" in record:
        record["municipality"] = normalize_municipality(record["municipality"])
    return record


def clean_contractor_name_in_record(record: dict) -> dict:
    """Clean a contractor name in a record dict."""
    if "name" in record:
        record["name"] = normalize_contractor_name(record["name"])
    if "contractor_name" in record:
        record["contractor_name"] = normalize_contractor_name(record["contractor_name"])
    return record
