"""File upload endpoints for IDOT/ISTHA bid tab and award imports."""
import time

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.contract import BidTabImportOut

router = APIRouter()


@router.post("/import/idot-bidtabs", response_model=BidTabImportOut)
async def import_idot_bidtabs(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
) -> BidTabImportOut:
    """Upload and import one or more IDOT bid tab text files (reference data)."""
    from app.services.estimator.parsers.idot_bidtabs import parse_idot_file
    from app.services.estimator.import_service import import_idot_bidtab

    start = time.time()
    totals = BidTabImportOut()

    for upload in files:
        try:
            content = await upload.read()
            text = content.decode("utf-8", errors="replace")
            lines = text.splitlines()

            parsed = parse_idot_file(lines, source_file=upload.filename or "")
            result = await import_idot_bidtab(db, parsed, upload.filename or "")

            if "error" in result:
                totals.errors.append(f"{upload.filename}: {result['error']}")
                totals.files_skipped += 1
            else:
                totals.files_processed += 1
                totals.contracts_created += 1 if result.get("contract_created") else 0
                totals.contracts_updated += 0 if result.get("contract_created") else 1
                totals.contractors_created += result.get("contractors_created", 0)
                totals.bids_created += result.get("bids_created", 0)
                totals.bid_items_created += result.get("bid_items_created", 0)

            totals.warnings.extend(result.get("warnings", []))

        except (ValueError, KeyError, UnicodeDecodeError, SQLAlchemyError, OSError) as e:
            totals.errors.append(f"{upload.filename}: {e}")
            totals.files_skipped += 1

    totals.duration_seconds = round(time.time() - start, 2)
    return totals


@router.post("/import/idot-awards", response_model=BidTabImportOut)
async def import_idot_awards_endpoint(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
) -> BidTabImportOut:
    """Upload and import one or more IDOT award CSV files (reference data, no tenant)."""
    from app.services.estimator.parsers.idot_awards import parse_idot_awards_file
    from app.services.estimator.import_service import import_idot_awards

    start = time.time()
    totals = BidTabImportOut()

    for upload in files:
        try:
            content = await upload.read()
            text = content.decode("utf-8", errors="replace")

            parsed = parse_idot_awards_file(text, source_file=upload.filename or "")
            result = await import_idot_awards(db, parsed)

            if "error" in result:
                totals.errors.append(f"{upload.filename}: {result['error']}")
                totals.files_skipped += 1
            else:
                totals.files_processed += 1
                totals.bid_items_created += result.get("created", 0)

            totals.warnings.extend(result.get("warnings", []))

        except (ValueError, KeyError, UnicodeDecodeError, SQLAlchemyError, OSError) as e:
            totals.errors.append(f"{upload.filename}: {e}")
            totals.files_skipped += 1

    totals.duration_seconds = round(time.time() - start, 2)
    return totals


@router.post("/import/istha-bidtabs", response_model=BidTabImportOut)
async def import_istha_bidtabs_endpoint(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
) -> BidTabImportOut:
    """Upload and import one or more ISTHA bid tab CSV files (reference data)."""
    from app.services.estimator.parsers.istha_bidtabs import parse_istha_file
    from app.services.estimator.import_service import import_istha_bidtabs

    start = time.time()
    totals = BidTabImportOut()

    for upload in files:
        try:
            content = await upload.read()
            text = content.decode("utf-8", errors="replace")

            parsed = parse_istha_file(text, source_file=upload.filename or "")
            result = await import_istha_bidtabs(db, parsed)

            if "error" in result:
                totals.errors.append(f"{upload.filename}: {result['error']}")
                totals.files_skipped += 1
            else:
                totals.files_processed += 1
                totals.contracts_created += 1 if result.get("contract_created") else 0
                totals.contracts_updated += 0 if result.get("contract_created") else 1
                totals.contractors_created += result.get("contractors_created", 0)
                totals.bids_created += result.get("bids_created", 0)
                totals.bid_items_created += result.get("bid_items_created", 0)

            totals.warnings.extend(result.get("warnings", []))

        except (ValueError, KeyError, UnicodeDecodeError, SQLAlchemyError, OSError) as e:
            totals.errors.append(f"{upload.filename}: {e}")
            totals.files_skipped += 1

    totals.duration_seconds = round(time.time() - start, 2)
    return totals
