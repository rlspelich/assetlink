"""Reusable pagination helper for list endpoints."""

from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def paginate(
    db: AsyncSession,
    query: Select,
    page: int = 1,
    page_size: int = 50,
    order_by=None,
    scalars: bool = False,
) -> tuple[list, int]:
    """Execute a paginated query, returning (rows, total_count).

    Parameters
    ----------
    db : AsyncSession
        The database session.
    query : Select
        A fully-filtered SQLAlchemy ``select()`` statement (before ordering/limit).
    page : int
        1-based page number.
    page_size : int
        Number of rows per page.
    order_by
        An ordering clause (e.g. ``Model.created_at.desc()``).  Applied before
        offset/limit.  May be ``None`` to skip ordering.
    scalars : bool
        If ``True``, call ``result.scalars().all()`` (returns ORM model instances).
        If ``False`` (default), call ``result.all()`` (returns Row tuples — useful
        when the select contains extra columns like lon/lat).
    """
    # Count total matching rows
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Apply ordering and pagination
    if order_by is not None:
        query = query.order_by(order_by)
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    rows = result.scalars().all() if scalars else result.all()
    return rows, total
