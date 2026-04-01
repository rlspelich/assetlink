"""Contractor listing with search and bid stats."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.bid import Bid
from app.models.contractor import Contractor
from app.schemas.contract import ContractorListOut, ContractorOut

router = APIRouter()


@router.get("/contractors", response_model=ContractorListOut)
async def list_contractors(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
) -> ContractorListOut:
    """List contractors with search. Reference data — no tenant filter."""
    query = select(Contractor)

    if search:
        query = query.where(
            Contractor.name.ilike(f"%{search}%")
            | Contractor.contractor_id_code.ilike(f"%{search}%")
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Contractor.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    contractors = result.scalars().all()

    # Get bid counts and win counts
    contractor_pks = [c.contractor_pk for c in contractors]
    bid_counts: dict[uuid.UUID, int] = {}
    win_counts: dict[uuid.UUID, int] = {}

    if contractor_pks:
        stats = await db.execute(
            select(
                Bid.contractor_pk,
                func.count(Bid.bid_id),
                func.count(Bid.bid_id).filter(Bid.is_low == True),
            )
            .where(Bid.contractor_pk.in_(contractor_pks))
            .group_by(Bid.contractor_pk)
        )
        for row in stats:
            bid_counts[row[0]] = row[1]
            win_counts[row[0]] = row[2]

    return ContractorListOut(
        contractors=[
            ContractorOut(
                contractor_pk=c.contractor_pk,
                contractor_id_code=c.contractor_id_code,
                name=c.name,
                bid_count=bid_counts.get(c.contractor_pk, 0),
                win_count=win_counts.get(c.contractor_pk, 0),
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in contractors
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
