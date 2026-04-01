# Code Review TODO

> Generated: 2026-04-01
> Scope: Full codebase review (~31K lines Python, ~28K lines TypeScript)

---

## Priority 1 — Critical

### Accessibility (Section 508 Compliance)
- [ ] Add `aria-label` attributes to all interactive elements (buttons, inputs, links)
- [ ] Add keyboard navigation support to custom table components
- [ ] Replace div-based tables with semantic `<table>` HTML elements
- [ ] Add `role="button"`, `tabindex="0"` to clickable non-button elements (e.g., clickable `<tr>` in contractor search)
- [ ] Add `React.memo` error boundaries for graceful failure UI
- [ ] **Context:** Only 1 `aria-` attribute exists in the entire frontend. This is a blocker for municipal procurement (Section 508).

---

## Priority 2 — Maintainability

### Split Oversized Files
- [ ] `backend/app/api/v1/estimator_contractors.py` (1,473 lines) — split by domain (pricing, contractors, market analysis)
- [ ] `backend/app/api/v1/sewer.py` (1,458 lines) — split into separate route modules per asset type (manhole.py, sewer_main.py, etc.)
- [ ] `backend/app/api/v1/water.py` (1,284 lines) — same treatment as sewer
- [ ] `backend/app/api/v1/estimator.py` (1,066 lines) — separate contracts, contractors, bidtabs
- [ ] `frontend/src/routes/reports-page.tsx` (2,042 lines) — extract tab content into separate components
- [ ] `frontend/src/routes/estimator-page.tsx` (1,184 lines) — decompose into smaller components
- [ ] `frontend/src/components/estimator/contractor-search.tsx` (814 lines) — split into smaller components

### Extract Duplicate Backend Patterns
- [ ] Create reusable `PaginatedListService` for list/filter/paginate logic (duplicated across signs.py, work_orders.py, water.py, sewer.py — ~1,000 lines of duplication)
- [ ] Move `_sign_to_out()`, `_wo_to_out()`, and similar converter functions from route files into dedicated service modules
- [ ] Abstract coordinate extraction from geometry (ST_X, ST_Y) — repeated ~30 times across codebase

### Extract Duplicate Frontend Patterns
- [ ] Create shared page hook for common `useState` patterns (filters, search, view mode, flyToCoords, submitError)
- [ ] Consolidate duplicated helper functions (`formatDate`, `formatCurrency`, `formatDateTime`) into `/lib` utilities
- [ ] Create `buildSearchParams` helper to replace repetitive manual URLSearchParams construction in API layer

---

## Priority 3 — Error Handling

### Backend
- [ ] Replace bare `except Exception` in `estimator.py` (lines ~516, 553, 594) with specific exception types (ValueError, FileNotFoundError, DatabaseError)
- [ ] Add logging to session auto-rollback in `db/session.py`
- [ ] Add global error handler for database errors and network failures
- [ ] Add MIME type validation on file uploads (signs.py CSV import only checks extension)

### Frontend
- [ ] Add `onError` callbacks to all mutation hooks in `/hooks/use-*.ts` to surface API errors
- [ ] Add global React error boundary component
- [ ] Add centralized API error interceptor/wrapper in the `ky` client

---

## Priority 4 — Type Safety & Code Quality

### Backend
- [ ] Add explicit return type annotations to all ~50 route handler functions
- [ ] Add audit logging for sensitive operations (deletions, exports)
- [ ] Document why reference data endpoints (estimator.py) intentionally lack tenant filters

### Frontend
- [ ] Remove 37 instances of `any` type (mostly in estimator components — contractor-search.tsx, pay-item-search.tsx)
- [ ] Add `React.memo` / `useMemo` / `useCallback` to detail panels and table rows
- [ ] Lazy-load map components and code-split Recharts in estimator
- [ ] Implement proper pagination for list queries (currently fetching `page_size: 1000`)

---

## Priority 5 — Testing

- [ ] Add integration tests for estimator module
- [ ] Add tests for error paths (bare `except Exception` in estimator.py)
- [ ] Expand auth/Clerk integration test coverage
- [ ] Add tests for concurrent writes / race conditions

---

## Summary

| Area | Status |
|------|--------|
| Architecture | Solid — clean separation of concerns |
| Multi-tenant security | Good — tenant_id filtering consistent |
| TypeScript types | Strong — mirrors backend Pydantic schemas |
| React Query usage | Consistent with proper cache invalidation |
| Test suite | 137+ integration tests on real PostGIS |
| Accessibility | Weak — needs significant work for Section 508 |
| File sizes | Several files >1,000 lines need splitting |
| Code duplication | Moderate — extractable patterns across asset pages |
| Error handling | Inconsistent — silent failures possible |
