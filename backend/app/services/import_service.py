"""
CSV import service for signs and supports.

Design principles:
- Accept messy real-world CSVs (flexible column name matching)
- Validate every row independently (don't fail entire import for one bad row)
- Return detailed results: created count, skipped count, errors per row
- Require latitude/longitude (signs without location are useless on a map)
- Validate MUTCD codes against the sign_type lookup table
- Strip whitespace, normalize empty strings to None
- Auto-detect support columns in flat CSVs and create supports automatically
- Support three import modes: signs-only, flat CSV with supports, two-file upload
"""

import csv
import io
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.sign import Sign, SignSupport, SignType

# Column name aliases — maps common CSV header variations to our field names
COLUMN_ALIASES: dict[str, str] = {
    # Asset identifier
    "assettag": "asset_tag",
    "asset_tag": "asset_tag",
    "assetid": "asset_tag",
    "asset_id": "asset_tag",
    "tag": "asset_tag",
    "barcode": "asset_tag",
    "sticker": "asset_tag",
    "inventoryid": "asset_tag",
    "inventory_id": "asset_tag",
    "signid": "asset_tag",
    "sign_id": "asset_tag",
    # Coordinates
    "latitude": "latitude",
    "lat": "latitude",
    "y": "latitude",
    "longitude": "longitude",
    "long": "longitude",
    "lon": "longitude",
    "lng": "longitude",
    "x": "longitude",
    # MUTCD
    "mutcd_code": "mutcd_code",
    "mutcd": "mutcd_code",
    "sign_code": "mutcd_code",
    "code": "mutcd_code",
    "type_code": "mutcd_code",
    # Description
    "description": "description",
    "desc": "description",
    "sign_description": "description",
    "sign_name": "description",
    # Road / location
    "road_name": "road_name",
    "road": "road_name",
    "street": "road_name",
    "street_name": "road_name",
    "address": "address",
    "location": "address",
    "intersection_with": "intersection_with",
    "intersection": "intersection_with",
    "cross_street": "intersection_with",
    "side_of_road": "side_of_road",
    "side": "side_of_road",
    "location_notes": "location_notes",
    # Sign details
    "sign_category": "sign_category",
    "category": "sign_category",
    "legend_text": "legend_text",
    "legend": "legend_text",
    "shape": "shape",
    "background_color": "background_color",
    "color": "background_color",
    "condition_rating": "condition_rating",
    "condition": "condition_rating",
    "rating": "condition_rating",
    "size_width_inches": "size_width_inches",
    "width": "size_width_inches",
    "width_inches": "size_width_inches",
    "size_height_inches": "size_height_inches",
    "height": "size_height_inches",
    "height_inches": "size_height_inches",
    # Sheeting / retroreflectivity
    "sheeting_type": "sheeting_type",
    "sheeting": "sheeting_type",
    "sheeting_manufacturer": "sheeting_manufacturer",
    "manufacturer": "sheeting_manufacturer",
    "expected_life_years": "expected_life_years",
    "life_years": "expected_life_years",
    # Dates
    "install_date": "install_date",
    "installed": "install_date",
    "date_installed": "install_date",
    # Status
    "status": "status",
    "sign_status": "status",
    # Orientation
    "facing_direction": "facing_direction",
    "facing": "facing_direction",
    "direction": "facing_direction",
    "mount_height_inches": "mount_height_inches",
    "mount_height": "mount_height_inches",
}

# Support column aliases — maps CSV header variations for support fields in flat CSVs
SUPPORT_COLUMN_ALIASES: dict[str, str] = {
    "support_id": "support_id",
    "supportid": "support_id",
    "support_asset_tag": "support_asset_tag",
    "support_tag": "support_asset_tag",
    "support_barcode": "support_asset_tag",
    "post_id": "support_asset_tag",
    "postid": "support_asset_tag",
    "post_tag": "support_asset_tag",
    "pole_id": "support_asset_tag",
    "poleid": "support_asset_tag",
    "support_type": "support_type",
    "post_type": "support_type",
    "pole_type": "support_type",
    "support_material": "support_material",
    "post_material": "support_material",
    "support_condition": "support_condition_rating",
    "support_condition_rating": "support_condition_rating",
    "post_condition": "support_condition_rating",
    "support_height": "support_height_inches",
    "support_height_inches": "support_height_inches",
    "post_height": "support_height_inches",
    "pole_height": "support_height_inches",
    "support_status": "support_status",
    "post_status": "support_status",
    "support_install_date": "support_install_date",
    "post_install_date": "support_install_date",
    "support_notes": "support_notes",
    "post_notes": "support_notes",
}

# Support-only file aliases — for standalone support CSV import (no support_ prefix needed)
SUPPORT_FILE_ALIASES: dict[str, str] = {
    "asset_tag": "asset_tag",
    "tag": "asset_tag",
    "barcode": "asset_tag",
    "support_tag": "asset_tag",
    "support_asset_tag": "asset_tag",
    "support_type": "support_type",
    "type": "support_type",
    "post_type": "support_type",
    "pole_type": "support_type",
    "support_material": "support_material",
    "material": "support_material",
    "post_material": "support_material",
    "condition_rating": "condition_rating",
    "condition": "condition_rating",
    "support_condition": "condition_rating",
    "height_inches": "height_inches",
    "height": "height_inches",
    "support_height": "height_inches",
    "support_height_inches": "height_inches",
    "status": "status",
    "support_status": "status",
    "install_date": "install_date",
    "installed": "install_date",
    "date_installed": "install_date",
    "support_install_date": "install_date",
    "notes": "notes",
    "support_notes": "notes",
    "latitude": "latitude",
    "lat": "latitude",
    "y": "latitude",
    "longitude": "longitude",
    "lon": "longitude",
    "long": "longitude",
    "lng": "longitude",
    "x": "longitude",
}

# Fields that are numeric
NUMERIC_FIELDS = {
    "latitude", "longitude", "condition_rating", "size_width_inches",
    "size_height_inches", "expected_life_years", "facing_direction",
    "mount_height_inches",
}

# Fields that are dates
DATE_FIELDS = {"install_date"}

# Valid statuses
VALID_STATUSES = {"active", "damaged", "faded", "missing", "obscured", "replaced", "removed"}

# Valid support types
VALID_SUPPORT_TYPES = {"u_channel", "square_tube", "round_tube", "wood", "mast_arm", "span_wire", "bridge_mount"}

# Valid support statuses
VALID_SUPPORT_STATUSES = {"active", "damaged", "leaning", "missing", "removed"}

# Common support type variations -> normalized name
_SUPPORT_TYPE_MAPPING: dict[str, str] = {
    "uchannel": "u_channel",
    "u_channel": "u_channel",
    "u_post": "u_channel",
    "upost": "u_channel",
    "squaretube": "square_tube",
    "square_tube": "square_tube",
    "square_post": "square_tube",
    "squarepost": "square_tube",
    "roundtube": "round_tube",
    "round_tube": "round_tube",
    "round_post": "round_tube",
    "roundpost": "round_tube",
    "wood": "wood",
    "wooden": "wood",
    "wood_post": "wood",
    "woodpost": "wood",
    "mast_arm": "mast_arm",
    "mastarm": "mast_arm",
    "mast": "mast_arm",
    "span_wire": "span_wire",
    "spanwire": "span_wire",
    "span": "span_wire",
    "cable": "span_wire",
    "bridge_mount": "bridge_mount",
    "bridgemount": "bridge_mount",
    "bridge": "bridge_mount",
    "overhead": "bridge_mount",
}


@dataclass
class RowError:
    row: int
    field: str
    message: str


@dataclass
class ImportResult:
    # Sign counts
    signs_created: int = 0
    signs_skipped: int = 0
    signs_total_rows: int = 0
    # Support counts
    supports_created: int = 0
    supports_skipped: int = 0
    supports_total_rows: int = 0
    # Shared fields
    errors: list[RowError] = field(default_factory=list)
    column_mapping: dict[str, str] = field(default_factory=dict)
    unmapped_columns: list[str] = field(default_factory=list)
    duration_seconds: float | None = None
    rows_per_second: float | None = None
    # Support-specific fields
    import_mode: str = "signs_only"
    support_groups: int = 0
    signs_linked_to_supports: int = 0
    support_column_mapping: dict[str, str] = field(default_factory=dict)

    # Backward compatibility properties
    @property
    def created(self) -> int:
        return self.signs_created

    @created.setter
    def created(self, value: int) -> None:
        self.signs_created = value

    @property
    def skipped(self) -> int:
        return self.signs_skipped

    @skipped.setter
    def skipped(self, value: int) -> None:
        self.signs_skipped = value

    @property
    def total_rows(self) -> int:
        return self.signs_total_rows

    @total_rows.setter
    def total_rows(self, value: int) -> None:
        self.signs_total_rows = value


def _normalize_header(header: str) -> str:
    """Normalize a CSV header to match our aliases."""
    h = header.strip().lower()
    h = re.sub(r"[^a-z0-9]", "_", h)  # Replace non-alphanumeric with underscore
    h = re.sub(r"_+", "_", h).strip("_")  # Collapse multiple underscores
    return h


def _clean_value(value: str | None) -> str | None:
    """Strip whitespace, normalize empty strings to None."""
    if value is None:
        return None
    v = value.strip()
    return v if v else None


def _parse_date(value: str) -> date | None:
    """Try common date formats."""
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%Y/%m/%d"):
        try:
            return date.fromisoformat(value) if fmt == "%Y-%m-%d" else __import__("datetime").datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _normalize_support_type(value: str) -> str | None:
    """Normalize a support type string to a valid enum value."""
    normalized = value.lower().strip().replace("-", "_").replace(" ", "_")
    if normalized in VALID_SUPPORT_TYPES:
        return normalized
    return _SUPPORT_TYPE_MAPPING.get(normalized)


def _decode_csv(file_content: bytes) -> str | None:
    """Decode CSV bytes, handling BOM and fallback encodings. Returns None on failure."""
    try:
        return file_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            return file_content.decode("latin-1")
        except UnicodeDecodeError:
            return None


def _map_columns(
    fieldnames: list[str],
    aliases: dict[str, str],
) -> tuple[dict[str, str], list[str]]:
    """Map CSV column headers to internal field names using an alias dict.

    Returns (column_map, unmapped_columns).
    """
    column_map: dict[str, str] = {}
    unmapped: list[str] = []
    for col in fieldnames:
        normalized = _normalize_header(col)
        if normalized in aliases:
            column_map[col] = aliases[normalized]
        else:
            unmapped.append(col)
    return column_map, unmapped


def _extract_row_data(
    row: dict[str, str],
    column_map: dict[str, str],
    unmapped: list[str],
) -> tuple[dict[str, str | None], dict[str, str]]:
    """Extract cleaned mapped values and custom fields from a CSV row."""
    data: dict[str, str | None] = {}
    for csv_col, our_field in column_map.items():
        data[our_field] = _clean_value(row.get(csv_col))

    custom_fields: dict[str, str] = {}
    for col in unmapped:
        val = _clean_value(row.get(col))
        if val is not None:
            custom_fields[col] = val

    return data, custom_fields


def _validate_coordinates(
    data: dict[str, str | None],
    row_num: int,
) -> tuple[float | None, float | None, list[RowError]]:
    """Validate and parse latitude/longitude from row data."""
    errors: list[RowError] = []
    lat_str = data.get("latitude")
    lon_str = data.get("longitude")

    if not lat_str:
        errors.append(RowError(row=row_num, field="latitude", message="Missing latitude"))
    if not lon_str:
        errors.append(RowError(row=row_num, field="longitude", message="Missing longitude"))

    lat: float | None = None
    lon: float | None = None

    if lat_str:
        try:
            lat = float(lat_str)
            if not (-90 <= lat <= 90):
                errors.append(RowError(row=row_num, field="latitude", message=f"Latitude {lat} out of range (-90 to 90)"))
                lat = None
        except ValueError:
            errors.append(RowError(row=row_num, field="latitude", message=f"Invalid latitude: {lat_str}"))

    if lon_str:
        try:
            lon = float(lon_str)
            if not (-180 <= lon <= 180):
                errors.append(RowError(row=row_num, field="longitude", message=f"Longitude {lon} out of range (-180 to 180)"))
                lon = None
        except ValueError:
            errors.append(RowError(row=row_num, field="longitude", message=f"Invalid longitude: {lon_str}"))

    return lat, lon, errors


def _validate_sign_fields(
    data: dict[str, str | None],
    row_num: int,
    valid_mutcd_codes: set[str],
) -> tuple[dict, list[RowError]]:
    """Validate and parse sign-specific fields. Returns (parsed_fields, errors)."""
    errors: list[RowError] = []
    parsed: dict = {}

    # MUTCD code
    mutcd_code = data.get("mutcd_code")
    if mutcd_code and mutcd_code not in valid_mutcd_codes:
        errors.append(RowError(row=row_num, field="mutcd_code", message=f"Unknown MUTCD code: {mutcd_code}. Sign will be imported without code."))
        mutcd_code = None
    parsed["mutcd_code"] = mutcd_code

    # Condition rating
    condition_rating: int | None = None
    if data.get("condition_rating"):
        try:
            condition_rating = int(float(data["condition_rating"]))
            if not (1 <= condition_rating <= 5):
                errors.append(RowError(row=row_num, field="condition_rating", message=f"Condition rating {condition_rating} must be 1-5"))
                condition_rating = None
        except ValueError:
            errors.append(RowError(row=row_num, field="condition_rating", message=f"Invalid condition rating: {data['condition_rating']}"))
    parsed["condition_rating"] = condition_rating

    # Facing direction
    facing_direction: int | None = None
    if data.get("facing_direction"):
        try:
            facing_direction = int(float(data["facing_direction"]))
            if not (0 <= facing_direction <= 360):
                errors.append(RowError(row=row_num, field="facing_direction", message=f"Facing direction {facing_direction} must be 0-360"))
                facing_direction = None
        except ValueError:
            errors.append(RowError(row=row_num, field="facing_direction", message=f"Invalid facing direction: {data['facing_direction']}"))
    parsed["facing_direction"] = facing_direction

    # Size fields
    for field_name in ("size_width_inches", "size_height_inches", "mount_height_inches"):
        val: float | None = None
        if data.get(field_name):
            try:
                val = float(data[field_name])
            except ValueError:
                errors.append(RowError(row=row_num, field=field_name, message=f"Invalid {field_name}: {data[field_name]}"))
        parsed[field_name] = val

    # Expected life years
    expected_life: int | None = None
    if data.get("expected_life_years"):
        try:
            expected_life = int(float(data["expected_life_years"]))
        except ValueError:
            errors.append(RowError(row=row_num, field="expected_life_years", message=f"Invalid life years: {data['expected_life_years']}"))
    parsed["expected_life_years"] = expected_life

    # Install date
    install_date: date | None = None
    if data.get("install_date"):
        install_date = _parse_date(data["install_date"])
        if install_date is None:
            errors.append(RowError(row=row_num, field="install_date", message=f"Could not parse date: {data['install_date']}. Use YYYY-MM-DD or MM/DD/YYYY."))
    parsed["install_date"] = install_date

    # Status
    status = data.get("status", "active") or "active"
    status = status.lower()
    if status not in VALID_STATUSES:
        errors.append(RowError(row=row_num, field="status", message=f"Invalid status: {status}. Valid: {', '.join(sorted(VALID_STATUSES))}. Defaulting to 'active'."))
        status = "active"
    parsed["status"] = status

    return parsed, errors


def _build_sign(
    tenant_id: uuid.UUID,
    data: dict[str, str | None],
    parsed: dict,
    custom_fields: dict[str, str],
    lat: float,
    lon: float,
    support_id: uuid.UUID | None = None,
) -> Sign:
    """Build a Sign ORM object from parsed data."""
    return Sign(
        tenant_id=tenant_id,
        support_id=support_id,
        mutcd_code=parsed["mutcd_code"],
        description=data.get("description"),
        legend_text=data.get("legend_text"),
        sign_category=data.get("sign_category"),
        size_width_inches=parsed["size_width_inches"],
        size_height_inches=parsed["size_height_inches"],
        shape=data.get("shape"),
        background_color=data.get("background_color"),
        condition_rating=parsed["condition_rating"],
        road_name=data.get("road_name"),
        address=data.get("address"),
        side_of_road=data.get("side_of_road"),
        intersection_with=data.get("intersection_with"),
        location_notes=data.get("location_notes"),
        sheeting_type=data.get("sheeting_type"),
        sheeting_manufacturer=data.get("sheeting_manufacturer"),
        expected_life_years=parsed["expected_life_years"],
        install_date=parsed["install_date"],
        status=parsed["status"],
        facing_direction=parsed["facing_direction"],
        mount_height_inches=parsed["mount_height_inches"],
        custom_fields=custom_fields if custom_fields else None,
        geometry=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
    )


async def import_signs_from_csv(
    file_content: bytes,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ImportResult:
    """
    Import signs from a CSV file. Auto-detects support columns and switches
    to combined import mode when support data is present.

    Processes rows in batches to keep memory usage manageable for large imports
    (20K+ rows). Each batch is flushed to the database, but the caller controls
    commit/rollback so the entire import remains atomic.

    Returns an ImportResult with counts and per-row errors.
    Does NOT commit -- caller is responsible for commit/rollback.
    """
    start_time = time.monotonic()
    result = ImportResult()

    # Decode CSV
    text = _decode_csv(file_content)
    if text is None:
        result.errors.append(RowError(row=0, field="file", message="Could not decode file. Use UTF-8 or Latin-1 encoding."))
        return result

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        result.errors.append(RowError(row=0, field="file", message="CSV file is empty or has no headers."))
        return result

    # Map sign columns
    column_map, unmapped = _map_columns(reader.fieldnames, COLUMN_ALIASES)
    result.column_mapping = {k: v for k, v in column_map.items()}

    # Check for support columns in the unmapped columns
    support_column_map: dict[str, str] = {}
    still_unmapped: list[str] = []
    for col in unmapped:
        normalized = _normalize_header(col)
        if normalized in SUPPORT_COLUMN_ALIASES:
            support_column_map[col] = SUPPORT_COLUMN_ALIASES[normalized]
        else:
            still_unmapped.append(col)

    result.unmapped_columns = still_unmapped

    # If support columns found, switch to combined import mode
    if support_column_map:
        result.support_column_mapping = {k: v for k, v in support_column_map.items()}
        return await _import_signs_and_supports_combined(
            reader, column_map, support_column_map, still_unmapped,
            tenant_id, db, result, start_time,
        )

    # --- Signs-only mode (original behavior) ---

    # Validate required columns
    mapped_fields = set(column_map.values())
    if "latitude" not in mapped_fields or "longitude" not in mapped_fields:
        result.errors.append(RowError(
            row=0, field="file",
            message=f"CSV must contain latitude and longitude columns. Found columns: {', '.join(reader.fieldnames)}",
        ))
        return result

    # Load valid MUTCD codes for validation
    mutcd_result = await db.execute(select(SignType.mutcd_code))
    valid_mutcd_codes = {row[0] for row in mutcd_result.all()}

    # Process rows in batches
    batch: list[Sign] = []
    batch_size = settings.import_batch_size

    for row_num, row in enumerate(reader, start=2):  # Row 1 is header
        result.total_rows += 1

        # Extract and clean mapped values
        data, custom_fields = _extract_row_data(row, column_map, still_unmapped)

        # Validate coordinates
        lat, lon, coord_errors = _validate_coordinates(data, row_num)

        # Skip row if missing required coordinates
        if lat is None or lon is None:
            result.skipped += 1
            result.errors.extend(coord_errors)
            continue

        # Validate sign fields
        parsed, sign_errors = _validate_sign_fields(data, row_num, valid_mutcd_codes)
        result.errors.extend(coord_errors)
        result.errors.extend(sign_errors)

        # Build the sign
        sign = _build_sign(tenant_id, data, parsed, custom_fields, lat, lon)
        batch.append(sign)

        # Flush each batch to keep the session identity map small
        if len(batch) >= batch_size:
            db.add_all(batch)
            await db.flush()
            result.created += len(batch)
            batch = []

    # Flush remaining rows
    if batch:
        db.add_all(batch)
        await db.flush()
        result.created += len(batch)

    # Record timing
    elapsed = time.monotonic() - start_time
    result.duration_seconds = round(elapsed, 2)
    if result.total_rows > 0 and elapsed > 0:
        result.rows_per_second = round(result.total_rows / elapsed, 1)

    return result


async def _import_signs_and_supports_combined(
    reader: csv.DictReader,
    sign_column_map: dict[str, str],
    support_column_map: dict[str, str],
    unmapped: list[str],
    tenant_id: uuid.UUID,
    db: AsyncSession,
    result: ImportResult,
    start_time: float,
) -> ImportResult:
    """
    Import signs and supports from a flat CSV. Rows with support columns
    are grouped by support_asset_tag or by (lat, lon), and one SignSupport
    is created per group.

    Two-pass:
    1. Read all rows, group by support key
    2. Create supports, then create signs with support_id linked
    """
    result.import_mode = "signs_and_supports"

    # Validate required sign columns
    mapped_sign_fields = set(sign_column_map.values())
    if "latitude" not in mapped_sign_fields or "longitude" not in mapped_sign_fields:
        result.errors.append(RowError(
            row=0, field="file",
            message=f"CSV must contain latitude and longitude columns.",
        ))
        return result

    # Load valid MUTCD codes
    mutcd_result = await db.execute(select(SignType.mutcd_code))
    valid_mutcd_codes = {row[0] for row in mutcd_result.all()}

    # Pass 1: Read all rows and group by support key
    # Each entry: (row_num, sign_data, support_data, custom_fields)
    all_rows: list[tuple[int, dict, dict, dict]] = []
    support_mapped_fields = set(support_column_map.values())

    for row_num, row in enumerate(reader, start=2):
        # Extract sign data
        sign_data: dict[str, str | None] = {}
        for csv_col, our_field in sign_column_map.items():
            sign_data[our_field] = _clean_value(row.get(csv_col))

        # Extract support data
        support_data: dict[str, str | None] = {}
        for csv_col, our_field in support_column_map.items():
            support_data[our_field] = _clean_value(row.get(csv_col))

        # Extract unmapped columns into custom_fields
        custom_fields: dict[str, str] = {}
        for col in unmapped:
            val = _clean_value(row.get(col))
            if val is not None:
                custom_fields[col] = val

        all_rows.append((row_num, sign_data, support_data, custom_fields))

    result.signs_total_rows = len(all_rows)

    # Group rows by support key
    # Priority: support_asset_tag > (lat, lon)
    groups: dict[str, list[int]] = {}  # key -> list of indices into all_rows
    for idx, (row_num, sign_data, support_data, _) in enumerate(all_rows):
        support_tag = support_data.get("support_asset_tag")
        if support_tag:
            key = f"tag:{support_tag}"
        else:
            # Group by location
            lat_str = sign_data.get("latitude")
            lon_str = sign_data.get("longitude")
            if lat_str and lon_str:
                try:
                    lat_key = round(float(lat_str), 8)
                    lon_key = round(float(lon_str), 8)
                    key = f"loc:{lat_key},{lon_key}"
                except ValueError:
                    key = f"row:{row_num}"
            else:
                key = f"row:{row_num}"

        if key not in groups:
            groups[key] = []
        groups[key].append(idx)

    result.support_groups = len(groups)

    # Pass 2: Create supports and signs
    batch_size = settings.import_batch_size
    support_batch: list[SignSupport] = []
    sign_batch: list[Sign] = []
    support_id_map: dict[str, uuid.UUID] = {}  # group_key -> support_id

    for group_key, row_indices in groups.items():
        # Use the first row's support data to create the support
        first_idx = row_indices[0]
        first_row_num, first_sign_data, first_support_data, _ = all_rows[first_idx]

        # Parse coordinates from the first row
        lat, lon, coord_errors_first = _validate_coordinates(first_sign_data, first_row_num)

        # Determine support type (default to u_channel if not specified)
        raw_support_type = first_support_data.get("support_type")
        support_type: str | None = None
        if raw_support_type:
            support_type = _normalize_support_type(raw_support_type)
            if support_type is None:
                result.errors.append(RowError(
                    row=first_row_num, field="support_type",
                    message=f"Unknown support type: {raw_support_type}. Defaulting to 'u_channel'.",
                ))
                support_type = "u_channel"
        else:
            support_type = "u_channel"

        # Parse support condition rating
        support_condition: int | None = None
        if first_support_data.get("support_condition_rating"):
            try:
                support_condition = int(float(first_support_data["support_condition_rating"]))
                if not (1 <= support_condition <= 5):
                    result.errors.append(RowError(
                        row=first_row_num, field="support_condition_rating",
                        message=f"Support condition rating {support_condition} must be 1-5",
                    ))
                    support_condition = None
            except ValueError:
                result.errors.append(RowError(
                    row=first_row_num, field="support_condition_rating",
                    message=f"Invalid support condition rating: {first_support_data['support_condition_rating']}",
                ))

        # Parse support height
        support_height: float | None = None
        if first_support_data.get("support_height_inches"):
            try:
                support_height = float(first_support_data["support_height_inches"])
            except ValueError:
                result.errors.append(RowError(
                    row=first_row_num, field="support_height_inches",
                    message=f"Invalid support height: {first_support_data['support_height_inches']}",
                ))

        # Parse support install date
        support_install_date: date | None = None
        if first_support_data.get("support_install_date"):
            support_install_date = _parse_date(first_support_data["support_install_date"])
            if support_install_date is None:
                result.errors.append(RowError(
                    row=first_row_num, field="support_install_date",
                    message=f"Could not parse support install date: {first_support_data['support_install_date']}",
                ))

        # Support status
        support_status = first_support_data.get("support_status", "active") or "active"
        support_status = support_status.lower()
        if support_status not in VALID_SUPPORT_STATUSES:
            result.errors.append(RowError(
                row=first_row_num, field="support_status",
                message=f"Invalid support status: {support_status}. Defaulting to 'active'.",
            ))
            support_status = "active"

        # Create support if we have valid coordinates
        support_id: uuid.UUID | None = None
        if lat is not None and lon is not None:
            support_id = uuid.uuid4()
            support = SignSupport(
                support_id=support_id,
                tenant_id=tenant_id,
                asset_tag=first_support_data.get("support_asset_tag"),
                support_type=support_type,
                support_material=first_support_data.get("support_material"),
                condition_rating=support_condition,
                height_inches=support_height,
                install_date=support_install_date,
                status=support_status,
                notes=first_support_data.get("support_notes"),
                geometry=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
            )
            support_batch.append(support)
            support_id_map[group_key] = support_id
            result.supports_created += 1

            # Flush support batch if needed
            if len(support_batch) >= batch_size:
                db.add_all(support_batch)
                await db.flush()
                support_batch = []
        else:
            result.supports_skipped += 1
            result.errors.extend(coord_errors_first)

    # Flush remaining supports
    if support_batch:
        db.add_all(support_batch)
        await db.flush()
        support_batch = []

    result.supports_total_rows = len(groups)

    # Now create signs
    for group_key, row_indices in groups.items():
        support_id = support_id_map.get(group_key)
        for idx in row_indices:
            row_num, sign_data, support_data, custom_fields = all_rows[idx]

            # Validate coordinates
            lat, lon, coord_errors = _validate_coordinates(sign_data, row_num)
            if lat is None or lon is None:
                result.signs_skipped += 1
                result.errors.extend(coord_errors)
                continue

            # Validate sign fields
            parsed, sign_errors = _validate_sign_fields(sign_data, row_num, valid_mutcd_codes)
            result.errors.extend(coord_errors)
            result.errors.extend(sign_errors)

            # Build sign with support_id linked
            sign = _build_sign(tenant_id, sign_data, parsed, custom_fields, lat, lon, support_id)
            sign_batch.append(sign)

            if support_id:
                result.signs_linked_to_supports += 1

            # Flush sign batch
            if len(sign_batch) >= batch_size:
                db.add_all(sign_batch)
                await db.flush()
                result.signs_created += len(sign_batch)
                sign_batch = []

    # Flush remaining signs
    if sign_batch:
        db.add_all(sign_batch)
        await db.flush()
        result.signs_created += len(sign_batch)

    # Record timing
    elapsed = time.monotonic() - start_time
    result.duration_seconds = round(elapsed, 2)
    total_items = result.signs_total_rows + result.supports_total_rows
    if total_items > 0 and elapsed > 0:
        result.rows_per_second = round(total_items / elapsed, 1)

    return result


async def import_supports_from_csv(
    file_content: bytes,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ImportResult:
    """
    Import supports from a standalone CSV file.

    Uses SUPPORT_FILE_ALIASES for column mapping (no support_ prefix needed
    since the entire file is supports).

    Returns an ImportResult with support counts.
    Does NOT commit -- caller is responsible for commit/rollback.
    """
    start_time = time.monotonic()
    result = ImportResult(import_mode="supports_only")

    # Decode CSV
    text = _decode_csv(file_content)
    if text is None:
        result.errors.append(RowError(row=0, field="file", message="Could not decode file. Use UTF-8 or Latin-1 encoding."))
        return result

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        result.errors.append(RowError(row=0, field="file", message="CSV file is empty or has no headers."))
        return result

    # Map columns
    column_map, unmapped = _map_columns(reader.fieldnames, SUPPORT_FILE_ALIASES)
    result.column_mapping = {k: v for k, v in column_map.items()}
    result.unmapped_columns = unmapped

    # Validate required columns
    mapped_fields = set(column_map.values())
    if "latitude" not in mapped_fields or "longitude" not in mapped_fields:
        result.errors.append(RowError(
            row=0, field="file",
            message=f"CSV must contain latitude and longitude columns. Found columns: {', '.join(reader.fieldnames)}",
        ))
        return result

    # Process rows in batches
    batch: list[SignSupport] = []
    batch_size = settings.import_batch_size

    for row_num, row in enumerate(reader, start=2):
        result.supports_total_rows += 1

        # Extract data
        data: dict[str, str | None] = {}
        for csv_col, our_field in column_map.items():
            data[our_field] = _clean_value(row.get(csv_col))

        # Validate coordinates
        lat, lon, coord_errors = _validate_coordinates(data, row_num)
        if lat is None or lon is None:
            result.supports_skipped += 1
            result.errors.extend(coord_errors)
            continue

        result.errors.extend(coord_errors)

        # Support type
        raw_type = data.get("support_type")
        support_type: str
        if raw_type:
            normalized = _normalize_support_type(raw_type)
            if normalized is None:
                result.errors.append(RowError(
                    row=row_num, field="support_type",
                    message=f"Unknown support type: {raw_type}. Defaulting to 'u_channel'.",
                ))
                support_type = "u_channel"
            else:
                support_type = normalized
        else:
            support_type = "u_channel"

        # Condition rating
        condition_rating: int | None = None
        if data.get("condition_rating"):
            try:
                condition_rating = int(float(data["condition_rating"]))
                if not (1 <= condition_rating <= 5):
                    result.errors.append(RowError(row=row_num, field="condition_rating", message=f"Condition rating {condition_rating} must be 1-5"))
                    condition_rating = None
            except ValueError:
                result.errors.append(RowError(row=row_num, field="condition_rating", message=f"Invalid condition rating: {data['condition_rating']}"))

        # Height
        height: float | None = None
        if data.get("height_inches"):
            try:
                height = float(data["height_inches"])
            except ValueError:
                result.errors.append(RowError(row=row_num, field="height_inches", message=f"Invalid height: {data['height_inches']}"))

        # Install date
        install_date: date | None = None
        if data.get("install_date"):
            install_date = _parse_date(data["install_date"])
            if install_date is None:
                result.errors.append(RowError(row=row_num, field="install_date", message=f"Could not parse date: {data['install_date']}"))

        # Status
        status = data.get("status", "active") or "active"
        status = status.lower()
        if status not in VALID_SUPPORT_STATUSES:
            result.errors.append(RowError(row=row_num, field="status", message=f"Invalid status: {status}. Defaulting to 'active'."))
            status = "active"

        support = SignSupport(
            tenant_id=tenant_id,
            asset_tag=data.get("asset_tag"),
            support_type=support_type,
            support_material=data.get("support_material"),
            condition_rating=condition_rating,
            height_inches=height,
            install_date=install_date,
            status=status,
            notes=data.get("notes"),
            geometry=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
        )
        batch.append(support)

        if len(batch) >= batch_size:
            db.add_all(batch)
            await db.flush()
            result.supports_created += len(batch)
            batch = []

    # Flush remaining
    if batch:
        db.add_all(batch)
        await db.flush()
        result.supports_created += len(batch)

    # Record timing
    elapsed = time.monotonic() - start_time
    result.duration_seconds = round(elapsed, 2)
    if result.supports_total_rows > 0 and elapsed > 0:
        result.rows_per_second = round(result.supports_total_rows / elapsed, 1)

    return result


async def import_signs_and_supports_two_files(
    signs_content: bytes,
    supports_content: bytes,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ImportResult:
    """
    Import signs and supports from two separate CSV files.

    1. Parse supports CSV first, create all SignSupport records, build lookup: asset_tag -> support_id
    2. Parse signs CSV, for each row look up support_asset_tag/post_id to get support_id
    3. Return combined ImportResult

    Does NOT commit -- caller is responsible for commit/rollback.
    """
    start_time = time.monotonic()
    result = ImportResult(import_mode="two_files")

    # --- Step 1: Import supports ---
    supports_text = _decode_csv(supports_content)
    if supports_text is None:
        result.errors.append(RowError(row=0, field="supports_file", message="Could not decode supports file."))
        return result

    supports_reader = csv.DictReader(io.StringIO(supports_text))
    if not supports_reader.fieldnames:
        result.errors.append(RowError(row=0, field="supports_file", message="Supports CSV is empty or has no headers."))
        return result

    support_col_map, support_unmapped = _map_columns(supports_reader.fieldnames, SUPPORT_FILE_ALIASES)
    result.support_column_mapping = {k: v for k, v in support_col_map.items()}

    support_mapped_fields = set(support_col_map.values())
    if "latitude" not in support_mapped_fields or "longitude" not in support_mapped_fields:
        result.errors.append(RowError(
            row=0, field="supports_file",
            message=f"Supports CSV must contain latitude and longitude columns.",
        ))
        return result

    # Build supports and asset_tag -> support_id lookup
    asset_tag_to_support_id: dict[str, uuid.UUID] = {}
    support_batch: list[SignSupport] = []
    batch_size = settings.import_batch_size

    for row_num, row in enumerate(supports_reader, start=2):
        result.supports_total_rows += 1

        data: dict[str, str | None] = {}
        for csv_col, our_field in support_col_map.items():
            data[our_field] = _clean_value(row.get(csv_col))

        lat, lon, coord_errors = _validate_coordinates(data, row_num)
        if lat is None or lon is None:
            result.supports_skipped += 1
            result.errors.extend(coord_errors)
            continue

        result.errors.extend(coord_errors)

        # Support type
        raw_type = data.get("support_type")
        support_type: str
        if raw_type:
            normalized = _normalize_support_type(raw_type)
            if normalized is None:
                result.errors.append(RowError(row=row_num, field="support_type", message=f"Unknown support type: {raw_type}. Defaulting to 'u_channel'."))
                support_type = "u_channel"
            else:
                support_type = normalized
        else:
            support_type = "u_channel"

        # Condition rating
        condition_rating: int | None = None
        if data.get("condition_rating"):
            try:
                condition_rating = int(float(data["condition_rating"]))
                if not (1 <= condition_rating <= 5):
                    condition_rating = None
            except ValueError:
                pass

        # Height
        height: float | None = None
        if data.get("height_inches"):
            try:
                height = float(data["height_inches"])
            except ValueError:
                pass

        # Install date
        install_date: date | None = None
        if data.get("install_date"):
            install_date = _parse_date(data["install_date"])

        # Status
        status = data.get("status", "active") or "active"
        status = status.lower()
        if status not in VALID_SUPPORT_STATUSES:
            status = "active"

        support_id = uuid.uuid4()
        support = SignSupport(
            support_id=support_id,
            tenant_id=tenant_id,
            asset_tag=data.get("asset_tag"),
            support_type=support_type,
            support_material=data.get("support_material"),
            condition_rating=condition_rating,
            height_inches=height,
            install_date=install_date,
            status=status,
            notes=data.get("notes"),
            geometry=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
        )
        support_batch.append(support)

        # Build lookup
        asset_tag = data.get("asset_tag")
        if asset_tag:
            asset_tag_to_support_id[asset_tag] = support_id

        if len(support_batch) >= batch_size:
            db.add_all(support_batch)
            await db.flush()
            result.supports_created += len(support_batch)
            support_batch = []

    if support_batch:
        db.add_all(support_batch)
        await db.flush()
        result.supports_created += len(support_batch)

    # --- Step 2: Import signs ---
    signs_text = _decode_csv(signs_content)
    if signs_text is None:
        result.errors.append(RowError(row=0, field="signs_file", message="Could not decode signs file."))
        return result

    signs_reader = csv.DictReader(io.StringIO(signs_text))
    if not signs_reader.fieldnames:
        result.errors.append(RowError(row=0, field="signs_file", message="Signs CSV is empty or has no headers."))
        return result

    # Map sign columns (include support column aliases to pick up support_asset_tag/post_id references)
    combined_aliases = {**COLUMN_ALIASES, **SUPPORT_COLUMN_ALIASES}
    sign_col_map, sign_unmapped = _map_columns(signs_reader.fieldnames, combined_aliases)
    result.column_mapping = {k: v for k, v in sign_col_map.items()}
    result.unmapped_columns = sign_unmapped

    sign_mapped_fields = set(sign_col_map.values())
    if "latitude" not in sign_mapped_fields or "longitude" not in sign_mapped_fields:
        result.errors.append(RowError(
            row=0, field="signs_file",
            message=f"Signs CSV must contain latitude and longitude columns.",
        ))
        return result

    # Load valid MUTCD codes
    mutcd_result = await db.execute(select(SignType.mutcd_code))
    valid_mutcd_codes = {row[0] for row in mutcd_result.all()}

    sign_batch: list[Sign] = []
    for row_num, row in enumerate(signs_reader, start=2):
        result.signs_total_rows += 1

        data, custom_fields = _extract_row_data(row, sign_col_map, sign_unmapped)

        lat, lon, coord_errors = _validate_coordinates(data, row_num)
        if lat is None or lon is None:
            result.signs_skipped += 1
            result.errors.extend(coord_errors)
            continue

        parsed, sign_errors = _validate_sign_fields(data, row_num, valid_mutcd_codes)
        result.errors.extend(coord_errors)
        result.errors.extend(sign_errors)

        # Look up support by asset_tag reference
        support_id: uuid.UUID | None = None
        support_ref = data.get("support_asset_tag")
        if support_ref and support_ref in asset_tag_to_support_id:
            support_id = asset_tag_to_support_id[support_ref]
            result.signs_linked_to_supports += 1
        elif support_ref:
            result.errors.append(RowError(
                row=row_num, field="support_asset_tag",
                message=f"Support asset tag '{support_ref}' not found in supports file. Sign will be imported without support link.",
            ))

        sign = _build_sign(tenant_id, data, parsed, custom_fields, lat, lon, support_id)
        sign_batch.append(sign)

        if len(sign_batch) >= batch_size:
            db.add_all(sign_batch)
            await db.flush()
            result.signs_created += len(sign_batch)
            sign_batch = []

    if sign_batch:
        db.add_all(sign_batch)
        await db.flush()
        result.signs_created += len(sign_batch)

    result.support_groups = result.supports_created

    # Record timing
    elapsed = time.monotonic() - start_time
    result.duration_seconds = round(elapsed, 2)
    total_items = result.signs_total_rows + result.supports_total_rows
    if total_items > 0 and elapsed > 0:
        result.rows_per_second = round(total_items / elapsed, 1)

    return result
