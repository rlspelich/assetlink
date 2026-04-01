import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.schemas.sign import SignImportOut
from app.services.import_service import import_signs_and_supports_two_files

router = APIRouter()


@router.post("/signs-and-supports", response_model=SignImportOut)
async def import_signs_and_supports(
    signs_file: UploadFile = File(...),
    supports_file: UploadFile = File(...),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignImportOut:
    """Import signs and supports from two separate CSV files.

    The supports file is processed first to create SignSupport records.
    Then the signs file is processed, linking each sign to its support
    via the support_asset_tag / post_id column.

    Both files support up to 50 MB. The entire import is atomic.
    """
    # Validate file extensions
    if not signs_file.filename or not signs_file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Signs file must be a .csv")
    if not supports_file.filename or not supports_file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Supports file must be a .csv")

    # Read both files
    signs_content = await signs_file.read()
    supports_content = await supports_file.read()

    max_size = settings.max_import_file_size
    max_mb = max_size // (1024 * 1024)
    if len(signs_content) > max_size:
        raise HTTPException(status_code=400, detail=f"Signs file too large. Maximum {max_mb} MB.")
    if len(supports_content) > max_size:
        raise HTTPException(status_code=400, detail=f"Supports file too large. Maximum {max_mb} MB.")

    result = await import_signs_and_supports_two_files(
        signs_content, supports_content, tenant_id, db
    )

    return SignImportOut(
        created=result.created,
        skipped=result.skipped,
        total_rows=result.total_rows,
        errors=[
            {"row": e.row, "field": e.field, "message": e.message}
            for e in result.errors
        ],
        column_mapping=result.column_mapping,
        unmapped_columns=result.unmapped_columns,
        duration_seconds=result.duration_seconds,
        rows_per_second=result.rows_per_second,
        signs_created=result.signs_created,
        signs_skipped=result.signs_skipped,
        signs_total_rows=result.signs_total_rows,
        supports_created=result.supports_created,
        supports_skipped=result.supports_skipped,
        supports_total_rows=result.supports_total_rows,
        import_mode=result.import_mode,
        support_groups=result.support_groups,
        signs_linked_to_supports=result.signs_linked_to_supports,
        support_column_mapping=result.support_column_mapping,
    )
