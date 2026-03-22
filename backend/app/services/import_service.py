"""
CSV import service for signs.

Design principles:
- Accept messy real-world CSVs (flexible column name matching)
- Validate every row independently (don't fail entire import for one bad row)
- Return detailed results: created count, skipped count, errors per row
- Require latitude/longitude (signs without location are useless on a map)
- Validate MUTCD codes against the sign_type lookup table
- Strip whitespace, normalize empty strings to None
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
from app.models.sign import Sign, SignType

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


@dataclass
class RowError:
    row: int
    field: str
    message: str


@dataclass
class ImportResult:
    created: int = 0
    skipped: int = 0
    errors: list[RowError] = field(default_factory=list)
    total_rows: int = 0
    column_mapping: dict[str, str] = field(default_factory=dict)
    unmapped_columns: list[str] = field(default_factory=list)
    duration_seconds: float | None = None
    rows_per_second: float | None = None


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


async def import_signs_from_csv(
    file_content: bytes,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ImportResult:
    """
    Import signs from a CSV file.

    Processes rows in batches to keep memory usage manageable for large imports
    (20K+ rows). Each batch is flushed to the database, but the caller controls
    commit/rollback so the entire import remains atomic.

    Returns an ImportResult with counts and per-row errors.
    Does NOT commit — caller is responsible for commit/rollback.
    """
    start_time = time.monotonic()
    result = ImportResult()

    # Decode CSV
    try:
        text = file_content.decode("utf-8-sig")  # Handle BOM from Excel
    except UnicodeDecodeError:
        try:
            text = file_content.decode("latin-1")
        except UnicodeDecodeError:
            result.errors.append(RowError(row=0, field="file", message="Could not decode file. Use UTF-8 or Latin-1 encoding."))
            return result

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        result.errors.append(RowError(row=0, field="file", message="CSV file is empty or has no headers."))
        return result

    # Map CSV columns to our fields
    column_map: dict[str, str] = {}
    unmapped: list[str] = []
    for col in reader.fieldnames:
        normalized = _normalize_header(col)
        if normalized in COLUMN_ALIASES:
            column_map[col] = COLUMN_ALIASES[normalized]
        else:
            unmapped.append(col)

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

    # Load valid MUTCD codes for validation
    mutcd_result = await db.execute(select(SignType.mutcd_code))
    valid_mutcd_codes = {row[0] for row in mutcd_result.all()}

    # Process rows in batches
    batch: list[Sign] = []
    batch_size = settings.import_batch_size

    for row_num, row in enumerate(reader, start=2):  # Row 1 is header
        result.total_rows += 1
        row_errors: list[RowError] = []

        # Extract and clean mapped values
        data: dict[str, str | None] = {}
        for csv_col, our_field in column_map.items():
            data[our_field] = _clean_value(row.get(csv_col))

        # Collect unmapped columns into custom_fields
        custom_fields: dict[str, str] = {}
        for col in unmapped:
            val = _clean_value(row.get(col))
            if val is not None:
                custom_fields[col] = val

        # --- Validate required: latitude/longitude ---
        lat_str = data.get("latitude")
        lon_str = data.get("longitude")

        if not lat_str:
            row_errors.append(RowError(row=row_num, field="latitude", message="Missing latitude"))
        if not lon_str:
            row_errors.append(RowError(row=row_num, field="longitude", message="Missing longitude"))

        lat: float | None = None
        lon: float | None = None

        if lat_str:
            try:
                lat = float(lat_str)
                if not (-90 <= lat <= 90):
                    row_errors.append(RowError(row=row_num, field="latitude", message=f"Latitude {lat} out of range (-90 to 90)"))
                    lat = None
            except ValueError:
                row_errors.append(RowError(row=row_num, field="latitude", message=f"Invalid latitude: {lat_str}"))

        if lon_str:
            try:
                lon = float(lon_str)
                if not (-180 <= lon <= 180):
                    row_errors.append(RowError(row=row_num, field="longitude", message=f"Longitude {lon} out of range (-180 to 180)"))
                    lon = None
            except ValueError:
                row_errors.append(RowError(row=row_num, field="longitude", message=f"Invalid longitude: {lon_str}"))

        # --- Validate MUTCD code ---
        mutcd_code = data.get("mutcd_code")
        if mutcd_code and mutcd_code not in valid_mutcd_codes:
            row_errors.append(RowError(row=row_num, field="mutcd_code", message=f"Unknown MUTCD code: {mutcd_code}. Sign will be imported without code."))
            mutcd_code = None

        # --- Parse numeric fields ---
        condition_rating: int | None = None
        if data.get("condition_rating"):
            try:
                condition_rating = int(float(data["condition_rating"]))
                if not (1 <= condition_rating <= 5):
                    row_errors.append(RowError(row=row_num, field="condition_rating", message=f"Condition rating {condition_rating} must be 1-5"))
                    condition_rating = None
            except ValueError:
                row_errors.append(RowError(row=row_num, field="condition_rating", message=f"Invalid condition rating: {data['condition_rating']}"))

        facing_direction: int | None = None
        if data.get("facing_direction"):
            try:
                facing_direction = int(float(data["facing_direction"]))
                if not (0 <= facing_direction <= 360):
                    row_errors.append(RowError(row=row_num, field="facing_direction", message=f"Facing direction {facing_direction} must be 0-360"))
                    facing_direction = None
            except ValueError:
                row_errors.append(RowError(row=row_num, field="facing_direction", message=f"Invalid facing direction: {data['facing_direction']}"))

        size_width: float | None = None
        if data.get("size_width_inches"):
            try:
                size_width = float(data["size_width_inches"])
            except ValueError:
                row_errors.append(RowError(row=row_num, field="size_width_inches", message=f"Invalid width: {data['size_width_inches']}"))

        size_height: float | None = None
        if data.get("size_height_inches"):
            try:
                size_height = float(data["size_height_inches"])
            except ValueError:
                row_errors.append(RowError(row=row_num, field="size_height_inches", message=f"Invalid height: {data['size_height_inches']}"))

        expected_life: int | None = None
        if data.get("expected_life_years"):
            try:
                expected_life = int(float(data["expected_life_years"]))
            except ValueError:
                row_errors.append(RowError(row=row_num, field="expected_life_years", message=f"Invalid life years: {data['expected_life_years']}"))

        mount_height: float | None = None
        if data.get("mount_height_inches"):
            try:
                mount_height = float(data["mount_height_inches"])
            except ValueError:
                row_errors.append(RowError(row=row_num, field="mount_height_inches", message=f"Invalid mount height: {data['mount_height_inches']}"))

        # --- Parse date fields ---
        install_date: date | None = None
        if data.get("install_date"):
            install_date = _parse_date(data["install_date"])
            if install_date is None:
                row_errors.append(RowError(row=row_num, field="install_date", message=f"Could not parse date: {data['install_date']}. Use YYYY-MM-DD or MM/DD/YYYY."))

        # --- Validate status ---
        status = data.get("status", "active") or "active"
        status = status.lower()
        if status not in VALID_STATUSES:
            row_errors.append(RowError(row=row_num, field="status", message=f"Invalid status: {status}. Valid: {', '.join(sorted(VALID_STATUSES))}. Defaulting to 'active'."))
            status = "active"

        # --- Skip row if missing required coordinates ---
        if lat is None or lon is None:
            result.skipped += 1
            result.errors.extend(row_errors)
            continue

        # Record non-fatal errors but still create the sign
        result.errors.extend(row_errors)

        # Build the sign
        sign = Sign(
            tenant_id=tenant_id,
            mutcd_code=mutcd_code,
            description=data.get("description"),
            legend_text=data.get("legend_text"),
            sign_category=data.get("sign_category"),
            size_width_inches=size_width,
            size_height_inches=size_height,
            shape=data.get("shape"),
            background_color=data.get("background_color"),
            condition_rating=condition_rating,
            road_name=data.get("road_name"),
            address=data.get("address"),
            side_of_road=data.get("side_of_road"),
            intersection_with=data.get("intersection_with"),
            location_notes=data.get("location_notes"),
            sheeting_type=data.get("sheeting_type"),
            sheeting_manufacturer=data.get("sheeting_manufacturer"),
            expected_life_years=expected_life,
            install_date=install_date,
            status=status,
            facing_direction=facing_direction,
            mount_height_inches=mount_height,
            custom_fields=custom_fields if custom_fields else None,
            geometry=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
        )
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
