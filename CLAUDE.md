# CLAUDE.md — AssetLink Platform

> Last updated: 2026-04-01
> Status: Phase 2 complete — Signs, Estimator, Water, Sewer all live

---

## What Is This Project?

A cloud-hosted SaaS platform for the transportation and municipal infrastructure industry. The platform operates as a **single umbrella** serving multiple product modules to different customer types — municipalities, contractors, utility districts, and consulting firms — under one unified account, billing, and auth system.

**Concept doc:** `docs/municipal_asset_platform_concept.md`
**Competitive analysis:** `docs/cityworks_*.md`
**Related project:** `/Users/robertspelich/PycharmProjects/bidparser` (BidParser — contractor cost estimator, Django, to be integrated as a module)

### Platform Architecture Decision (2026-03-20)

**Decision:** One company, shared platform backbone, **separate product identities**.

**Why:** Shared auth, billing, CRM, and database infrastructure — built once, not duplicated across products. But the products themselves (asset management vs cost estimation) serve different users with different workflows, different pain points, and different competitive landscapes. They should not be forced into one UI.

**The rule:** Share the plumbing, not the storefront.

| Layer | Shared or Separate? |
|---|---|
| Business entity / company | Shared |
| Auth / accounts | Shared |
| Stripe billing | Shared |
| CRM / contacts | Shared |
| Database infrastructure | Shared (same Cloud SQL) |
| Product branding & identity | **Separate** |
| UI / frontend experience | **Separate** — different apps, different navigation |
| Marketing / landing pages | **Separate** — different value props, different buyers |
| Sales motion | **Separate** — municipality procurement vs contractor subscriptions |
| API integration between products | Future (Phase 3+) — e.g. WO scope → bid estimate |

**How it works technically:**
- `tenant_type` distinguishes organization types (municipality, contractor, etc.)
- `modules_enabled` controls which features each tenant can access
- Modules are isolated at the code level (separate models, routes, UI) but share the platform backbone
- A DPW superintendent never sees bid estimation tools; a contractor never sees manhole inspection forms

```
tenant_type: "municipality"   modules_enabled: ["signs", "water"]
tenant_type: "contractor"     modules_enabled: ["estimator"]
tenant_type: "contractor"     modules_enabled: ["estimator", "signs"]  ← does municipal work too
```

### Modules (Planned)
| Module | Status | Target User | Description |
|--------|--------|-------------|-------------|
| **Signs** | **Phase 1 — Complete** | Municipalities | Sign inventory, MUTCD compliance, condition tracking |
| **Estimator** | **Phase 1b — Complete** | Contractors | 1.4M awarded prices, inflation-adjusted estimates, confidence scoring, 50-state regional factors |
| **Water** | **Phase 2 — Complete** | Municipalities | Pipes, valves, hydrants, service connections, pressure zones, fittings |
| **Sewer** | **Phase 2 — Complete** | Municipalities | Gravity mains, force mains, manholes, lift stations, laterals, fittings |
| Roads | Future | Municipalities | Pavement management |

### Core Platform (Shared Across All Modules)
- Multi-tenant architecture (tenant_id on every table, tenant_type for org classification)
- Auth system (Auth0/Clerk — single login across all modules)
- Billing (Stripe — one subscription, module-based pricing)
- User management and roles (Admin, Supervisor, Field Worker, Viewer)
- Map interface (MapLibre GL + PostGIS vector tiles) — used by asset modules
- Work order engine — used by asset modules
- Inspection system — used by asset modules
- Photo attachments (Cloud Storage)
- CSV/Shapefile/GeoJSON import and export
- Notification engine
- PDF reports (Jinja2 + WeasyPrint)
- Notifications

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend** | Python 3.12 + FastAPI | Async, auto-docs, Pydantic validation |
| **ORM** | SQLAlchemy 2.0 + GeoAlchemy2 | Spatial-aware, async support |
| **Migrations** | Alembic | Schema version control |
| **Database** | PostgreSQL 16 + PostGIS 3.4 | Open-source spatial database |
| **Cache** | Redis 7 | Session and tile caching |
| **Frontend** | React + TypeScript + Tailwind | (Phase 1 focus is backend/API first) |
| **Map** | MapLibre GL JS | Open-source, Esri-free |
| **Tile Server** | pg_tileserv or martin | Vector tiles direct from PostGIS |
| **Auth** | Clerk | JWT via fastapi-clerk-auth, orgs = tenants |
| **File Storage** | Google Cloud Storage | Photos, exports, imports |
| **Hosting** | Google Cloud Run + Cloud SQL | Shared instance with Options-V2.1 (see GCP section) |
| **CI/CD** | GitHub Actions → Cloud Build | Auto-deploy on git push (same pattern as Options-V2.1) |
| **Reports** | Jinja2 + WeasyPrint | HTML → PDF, $0 licensing |
| **GIS Libraries** | GeoPandas, Shapely, Pyproj, GDAL/Fiona | Import/export, projections |

---

## Project Structure

```
assetlink/
├── CLAUDE.md                    # This file — project brain
├── docker-compose.yml           # Local dev: PostGIS, Redis, API
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings (Pydantic Settings)
│   │   ├── api/v1/              # API route modules
│   │   │   ├── signs.py
│   │   │   ├── work_orders.py
│   │   │   ├── inspections.py
│   │   │   ├── imports.py
│   │   │   ├── users.py
│   │   │   ├── water.py
│   │   │   ├── sewer.py
│   │   │   ├── estimator.py
│   │   │   └── estimator_contractors.py
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── base.py          # Base model, shared columns
│   │   │   ├── tenant.py
│   │   │   ├── user.py
│   │   │   ├── sign.py
│   │   │   ├── work_order.py
│   │   │   ├── inspection.py
│   │   │   ├── water.py
│   │   │   └── sewer.py
│   │   ├── schemas/             # Pydantic request/response
│   │   ├── services/            # Business logic
│   │   │   ├── spatial.py       # PostGIS operations
│   │   │   ├── import_service.py
│   │   │   └── compliance.py    # MUTCD calculations
│   │   ├── db/
│   │   │   ├── session.py       # Connection pool, tenant routing
│   │   │   └── seed.py          # MUTCD lookup data
│   │   └── core/
│   │       ├── auth.py
│   │       ├── tenant.py        # Tenant resolution middleware
│   │       └── permissions.py
│   ├── alembic/                 # Database migrations
│   ├── alembic.ini
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                    # React app (Phase 1b)
├── infrastructure/              # Terraform (Phase 1b)
└── docs/                        # Research and analysis
    ├── municipal_asset_platform_concept.md
    ├── cityworks_schema_analysis.md
    ├── cityworks_respond_plugin_analysis.md
    ├── cityworks_admin_config_extracts.md
    └── cityworks_respond_user_guide_extracts.md
```

---

## Database Schema

### Design Principles
- **snake_case** everywhere — no camelCase, no prefixes
- **UUIDs** as primary keys
- **tenant_id** on every data table (multi-tenant from day one)
- **created_at, updated_at, created_by, updated_by** on all tables
- **PostGIS geometry columns** typed and projected (SRID 4326 / WGS84)
- **Constraints enforced at DB level** — not just application layer
- **JSONB for flexible fields** — not TEXT1-TEXT20 like Cityworks

### Core Tables

| Table | Purpose |
|-------|---------|
| `tenant` | Organization accounts (municipality, contractor, etc.), subscription config, tenant_type, isolation model |
| `app_user` | Users within a tenant, role assignment |
| `sign` | Individual sign assets (point geometry) |
| `sign_support` | Physical posts/supports (one support → many signs) |
| `sign_type` | MUTCD code lookup table (seeded, not tenant-specific) |
| `work_order` | Maintenance work tracking (shared across asset types) |
| `inspection` | Condition assessments (shared across asset types) |
| `attachment` | Photos/documents linked to any entity |
| `comment` | Notes/comments on work orders and inspections |
| `notification` | User notifications |

### Water Tables

| Table | Purpose |
|-------|---------|
| `water_main` | Water distribution pipes (LineString geometry) |
| `water_valve` | Valves on water mains (Point geometry) |
| `fire_hydrant` | Fire hydrants (Point geometry) |
| `water_service` | Service connections from main to property (LineString geometry) |
| `water_fitting` | Fittings/connectors on water mains (Point geometry) |
| `pressure_zone` | Pressure zones (Polygon geometry) |
| `water_material_type` | Reference: pipe material lookup |
| `water_valve_type` | Reference: valve type lookup |

### Sewer Tables

| Table | Purpose |
|-------|---------|
| `sewer_main` | Gravity sewer mains (LineString geometry) |
| `force_main` | Pressurized force mains (LineString geometry) |
| `manhole` | Manholes/access points (Point geometry) |
| `lift_station` | Lift/pump stations (Point geometry) |
| `sewer_lateral` | Service laterals from main to property (LineString geometry) |
| `sewer_fitting` | Fittings/connectors on sewer mains (Point geometry) |
| `manhole_pipe` | Junction: manhole-to-pipe connections |
| `sewer_material_type` | Reference: pipe material lookup |
| `sewer_pipe_shape` | Reference: pipe cross-section shapes |
| `manhole_type` | Reference: manhole type lookup |

---

## API Design

- REST API, versioned under `/api/v1/`
- All endpoints require tenant context (resolved from auth token or header)
- JSON responses with GeoJSON for spatial data
- Pagination on list endpoints (cursor-based)
- OpenAPI docs auto-generated at `/docs`

### Key Endpoints (Phase 1)

```
Auth / Users
POST   /api/v1/auth/login
GET    /api/v1/users/me
GET    /api/v1/users

Signs
GET    /api/v1/signs                    # List/filter signs
POST   /api/v1/signs                    # Create sign
GET    /api/v1/signs/{id}               # Get sign detail
PUT    /api/v1/signs/{id}               # Update sign
DELETE /api/v1/signs/{id}               # Delete sign
GET    /api/v1/signs/geojson            # GeoJSON export for map
POST   /api/v1/signs/import/csv         # CSV import

Work Orders
GET    /api/v1/work-orders
POST   /api/v1/work-orders
GET    /api/v1/work-orders/{id}
PUT    /api/v1/work-orders/{id}

Inspections
GET    /api/v1/inspections
POST   /api/v1/inspections
GET    /api/v1/inspections/{id}

Attachments
POST   /api/v1/attachments              # Upload photo/file
GET    /api/v1/attachments/{id}

Lookups
GET    /api/v1/sign-types               # MUTCD lookup table

Water
GET    /api/v1/water/mains              # List/filter water mains
POST   /api/v1/water/mains              # Create water main
GET    /api/v1/water/mains/{id}         # Get water main detail
PUT    /api/v1/water/mains/{id}         # Update water main
DELETE /api/v1/water/mains/{id}         # Delete water main
GET    /api/v1/water/valves             # List/filter valves
POST   /api/v1/water/valves             # Create valve
GET    /api/v1/water/hydrants           # List/filter hydrants
POST   /api/v1/water/hydrants           # Create hydrant
GET    /api/v1/water/services           # List/filter service connections
GET    /api/v1/water/fittings           # List/filter fittings
GET    /api/v1/water/pressure-zones     # List/filter pressure zones
GET    /api/v1/water/material-types     # Reference lookup
GET    /api/v1/water/valve-types        # Reference lookup

Sewer
GET    /api/v1/sewer/mains             # List/filter sewer mains
POST   /api/v1/sewer/mains             # Create sewer main
GET    /api/v1/sewer/manholes           # List/filter manholes
POST   /api/v1/sewer/manholes           # Create manhole
GET    /api/v1/sewer/force-mains        # List/filter force mains
POST   /api/v1/sewer/force-mains        # Create force main
GET    /api/v1/sewer/lift-stations      # List/filter lift stations
POST   /api/v1/sewer/lift-stations      # Create lift station
GET    /api/v1/sewer/laterals           # List/filter laterals
GET    /api/v1/sewer/fittings           # List/filter fittings
GET    /api/v1/sewer/material-types     # Reference lookup
GET    /api/v1/sewer/pipe-shapes        # Reference lookup
GET    /api/v1/sewer/manhole-types      # Reference lookup
```

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-tenancy | tenant_id on all rows (RLS) | Simplest for MVP; schema isolation available as premium tier later |
| Multi-product umbrella | One platform, separate modules | Shared auth, billing, CRM — avoid duplicate infrastructure across products |
| Tenant types | tenant_type field on tenant table | Distinguishes municipalities, contractors, utility districts — same platform, different module access |
| Primary keys | UUIDs | No sequential ID leakage, safe for multi-tenant |
| Spatial reference | WGS84 (EPSG:4326) | GPS standard, what MapLibre expects |
| Custom fields | JSONB column | Flexible, queryable, no TEXT1-TEXT20 mess |
| Auth | Clerk (JWT + organizations) | Don't roll our own auth; Clerk orgs map 1:1 to tenants via `clerk_org_id` on tenant table |
| File storage | Cloud Storage URLs | Don't store blobs in DB |
| Tile serving | pg_tileserv or martin | Vector tiles direct from PostGIS, zero custom code |
| Reports | Jinja2 + WeasyPrint | $0 licensing, HTML/CSS skills, native to FastAPI |
| Frontend framework | React + TypeScript | Large ecosystem, team familiarity |
| Map library | MapLibre GL JS | Open-source Mapbox fork, no Esri dependency |
| GCP infrastructure | Shared Cloud SQL instance with Options-V2.1 | Cost savings, separate databases on same instance (see below) |
| PostgreSQL version | 15 (match existing instance) | Options-V2.1 instance runs PG 15; all AssetLink features work on 15 |

### GCP Infrastructure Decision (2026-03-21)

**Decision:** Share the existing GCP Cloud SQL instance (`optionsv2-db`) with the Options-V2.1 trading platform. Separate Cloud Run services.

**Why:** Avoids paying for a second Cloud SQL instance (~$7-25/month). The databases are completely isolated — different names, different users, different connection strings. AssetLink just needs PostGIS enabled (`CREATE EXTENSION postgis;`), which doesn't affect existing databases.

**Existing GCP Project:** `bucket6-2025-01`, region `us-central1`

**Shared Cloud SQL instance:** `optionsv2-db` (db-g1-small, PostgreSQL 15)

```
Cloud SQL Instance: optionsv2-db
├── v2_trading          ← Options-V2.1 (existing, do not touch)
├── v2_analytics        ← Options-V2.1 (existing, do not touch)
└── assetlink           ← AssetLink (NEW — PostGIS enabled)

Cloud Run Services:
├── optionsv2-terminal  ← Options-V2.1 (existing)
├── optionsv2-daemon    ← Options-V2.1 (existing)
└── assetlink-api       ← AssetLink (NEW — separate container, separate scaling)
```

**What's shared:** Cloud SQL instance, GCP project, billing account
**What's separate:** databases, Cloud Run services, containers, deploy cycles, scaling, connection credentials

**Connection strategy:** Use `cloud-sql-python-connector` with `asyncpg` driver (same pattern as Options-V2.1 but async). Connection string format:
```
cloudsql://assetlink_user:pass@bucket6-2025-01:us-central1:optionsv2-db/assetlink
```

**Risk:** If the db-g1-small instance becomes resource-constrained under both workloads, upgrade the instance tier — do not split databases. Splitting creates more operational overhead than a tier upgrade.

**Note:** PostgreSQL target version adjusted from 16 to 15 to match the existing instance. No features are lost — everything AssetLink uses (PostGIS 3.4, JSONB, UUIDs, async) works on PG 15.

---

## Development Roadmap

### Phase 1 — Foundation + Signs MVP (Complete)
**Goal:** Deployable sign inventory with map, work orders, CSV import. One pilot municipality live.

- [x] Concept doc and competitive analysis
- [x] Cityworks schema/plugin/UI research
- [x] Project scaffolding (Docker Compose, FastAPI skeleton, SQLAlchemy models)
- [x] SQLAlchemy models: tenant, app_user, sign, sign_support, sign_type, work_order, work_order_asset, inspection, inspection_asset, attachment, comment
- [x] Pydantic schemas for sign, support, work order, inspection (all with multi-asset junction tables)
- [x] Sign CRUD API (list/create/get/update/delete + MUTCD lookup endpoint)
- [x] Sign support CRUD API (sign count, delete protection, geometry inheritance)
- [x] Work order CRUD API (multi-asset: one WO → multiple signs + support, per-asset tracking)
- [x] Inspection CRUD API (multi-asset, sign auto-update, create-WO-from-inspection with zero dual entry)
- [x] Alembic migrations (7 migrations: initial schema, clerk org, passes_minimum fix, work_order_asset, inspection_asset, asset_tag, inspection_number)
- [x] MUTCD lookup table seed data (76 sign types)
- [x] Multi-tenant middleware (X-Tenant-ID header)
- [x] Database schema (PostGIS, UUIDs, JSONB, junction tables for multi-asset WO/inspections)
- [x] CSV import for signs (fuzzy column matching, per-row validation, asset_tag/barcode support)
- [x] Integration tests (137+ tests, real PostGIS, tenant isolation, multi-asset WO, inspection→WO flow)
- [x] Auth integration (Clerk JWT + organizations, dev fallback via X-Tenant-ID)
- [x] React frontend with MapLibre map — GIS-centric three-panel layout on every page
- [x] Sign map layer (color by condition, auto-fit bounds, home button)
- [x] Signs page: integrated map + list + detail, add/edit/delete, click-to-place, MUTCD code picker
- [x] Support-centric UI: multi-sign support view, drill-down to individual signs
- [x] Work order UI: multi-asset support, knockdown workflow (one WO for support + all signs)
- [x] Inspection UI: multi-asset inspections, per-asset condition/retro, create-WO-from-inspection
- [x] GIS-centric work orders page: map with WO markers by priority + dimmed signs base layer
- [x] GIS-centric inspections page: map with inspection markers by follow-up status + signs base layer
- [x] Toggleable view modes: Map View, Table View, Split View on WO and inspection pages
- [x] Asset tag field (municipality barcode/sticker ID) on signs and supports
- [x] Human-readable IDs: WO-YYYYMMDD-NNN, INS-YYYYMMDD-NNN
- [x] MUTCD compliance dashboard (KPIs, condition/age/sheeting/category charts, replacement planning, priority action table)
- [x] Map clustering (30px radius, condition-color clusters, click-to-expand, tuned for 10K+)
- [x] Dynamic viewport sign count (updates on pan/zoom)
- [x] Print work orders and inspections (preview overlay + iframe print, crew completion fields)
- [x] Email work orders and inspections (SMTP-ready, preview mode when unconfigured)
- [x] Users & Roles management (Admin/Supervisor/Crew Chief, CRUD, user picker on WO/inspections)
- [x] Settings page (Import Data, Users & Roles, with placeholders for Data Management and Notifications)
- [x] Help page placeholder (7 topic cards for future documentation)
- [x] Import template CSV + field reference guide (23 fields documented with aliases)
- [x] Import scalability (batch processing, 50MB limit, 120s timeout, handles 20K+ rows)
- [x] Custom AssetLink icon (blue chain links on navy background)
- [x] Dashboard → sign deep-link (click priority sign → signs page with pre-selected asset)
- [x] 2,000-sign Springfield IL test dataset with generation script
- [x] Smart CSV import: 3 modes (signs auto-detect supports, two-file, supports-only)
- [x] Reports page: 4 KPI reports (Work Orders, Inspections, Inventory, Crew Productivity) with date ranges, presets, print
- [x] Asset selection + location placement for WO/inspection creation from map pages
- [x] Email dialog with user picker from Users & Roles, proper from/reply-to headers
- [x] WO/inspection test data generation script (60 inspections, 27 WOs via API)
- [x] Photo upload
- [x] Deploy to Google Cloud (Cloud Run + Cloud SQL)
- [x] Pilot municipality onboarded (Springfield, IL)

### Phase 1b — Estimator Module (Port from BidParser)
**Goal:** Port the BidParser Django project into AssetLink as a FastAPI module.

**Source:** `/Users/robertspelich/PycharmProjects/bidparser` (Django 6.0, SQLite)

**What BidParser has today:**
- IDOT bid tab parser (fixed-width mainframe format)
- IDOT awards parser (CSV)
- ISTHA bid tab parser (CSV)
- Data models: Contract, Contractor, Bid, BidItem, AwardItem, CostIndex
- Pay item categorization (45 categories, 150+ subcategories)
- Cost adjustment system using FHWA NHCCI + BLS PPI indices
- 23 MB SQLite database with schema

**What needs to happen:**
- [x] Port Django models → SQLAlchemy (add tenant_id, UUIDs, audit fields)
- [x] Port parsers → FastAPI services (IDOT bidtabs, IDOT awards, ISTHA)
- [x] Port pay item categorization (45 divisions, 302 subcategories)
- [x] Create Pydantic schemas for bid data
- [x] Create API endpoints: contracts, contractors, bids, pay items, price history, file import
- [x] Create Alembic migration for all estimator tables
- [x] Create import service (parser → database with upsert/re-import support)
- [x] Port cost index adjustment logic (FHWA NHCCI — quarterly data 2003–2025, division-to-index mappings)
- [x] Estimate builder (create, rename, duplicate, delete, add items, recalculate, CSV export)
- [x] Migrate award data → PostgreSQL (1,385,747 rows from 164 CSV files, 2003–2026)
- [x] React frontend for estimator (pay item search, price history charts, estimate builder, confidence badges)
- [x] IDOT web scraper (downloads Pay Item Award Reports from IDOT Transportation Bulletin)
- [x] Excel→CSV converter (handles 3 IDOT format variants across 2018–2026)
- [x] Bulk loader (batch INSERT at 6,500 rows/sec)
- [x] Pricing engine (recency-weighted averages, inflation adjustment, regional factors)
- [x] Confidence scoring (percentile rank vs historical distribution)
- [x] Regional cost factors (all 50 states + DC, RSMeans-style multipliers)
- [ ] Integration tests for estimator module

**Data models:**
| Table | Type | Description |
|---|---|---|
| contract | tenant-scoped | Letting/contract metadata |
| contractor | tenant-scoped | Bidding contractors |
| bid | tenant-scoped | One contractor's bid on one contract |
| bid_item | tenant-scoped | Line items within a bid |
| award_item | **reference** (shared) | 1.4M rows of IDOT awarded prices (2003–2026) |
| pay_item | **reference** (shared) | 36K pay item catalog with descriptions/units |
| cost_index | **reference** (shared) | FHWA NHCCI quarterly inflation indices |
| cost_index_mapping | **reference** (shared) | Maps pay item divisions to index sources |
| estimate | tenant-scoped | Contractor's saved estimate/project |
| estimate_item | tenant-scoped | Line items with auto-priced unit costs |
| regional_factor | **reference** (shared) | State-level cost multipliers (51 entries) |

### Phase 1c — Responsive / Mobile & Tablet Support
**Goal:** Make the app usable on tablets (field crews) and functional on phones (quick status checks). Desktop remains the primary experience.

**Tier 1 — Tablet-usable (do first):**
- [ ] Collapsible sidebar with hamburger button (hidden on `lg:` and above, drawer overlay on mobile)
- [ ] Signs page: stack three-panel layout vertically on `< lg`, one panel at a time with back/forward
- [ ] Estimator tabs: horizontal scroll with overflow fade indicators on narrow screens
- [ ] Touch-friendly tap targets (min 44px on all interactive elements)

**Tier 2 — Phone-functional:**
- [ ] WO / inspection list views: single-column card layout on `< md`
- [ ] Map: full-screen with bottom sheet for detail on mobile
- [ ] Dashboard and Reports already mostly work (grids collapse) — verify and fix gaps

**Tier 3 — Polish:**
- [ ] Responsive data tables (card view on mobile, or horizontal scroll with sticky first column)
- [ ] Estimator: simplified mobile view for price lookup only (skip power-user features)
- [ ] PWA manifest for "add to home screen" on crew tablets

**Current state (2026-03-31):** Viewport meta tag exists. Dashboard/reports have basic responsive grids. Everything else is desktop-only — sidebar hover-expands (no touch), signs page uses fixed-width panels (`w-72`, `w-80`), estimator has `w-[420px]` fixed panels and 8 horizontal tabs.

### Phase 2 — Water & Sewer (Complete)
- [x] Water models: WaterMain, WaterValve, FireHydrant, WaterService, WaterFitting, PressureZone + reference tables (WaterMaterialType, WaterValveType)
- [x] Sewer models: SewerMain, ForceMain, Manhole, LiftStation, SewerLateral, SewerFitting + reference tables (SewerMaterialType, SewerPipeShape, ManholeType) + ManholePipe junction
- [x] Full CRUD API endpoints for all water and sewer asset types under `/api/v1/water/` and `/api/v1/sewer/`
- [x] Pydantic schemas for all asset types with geometry handling (Point, LineString, Polygon)
- [x] Alembic migration for all water/sewer tables with indices and constraints
- [x] React frontend pages: water-page.tsx, sewer-page.tsx with GIS-centric layout
- [x] Frontend components: detail panels, form panels, map components for water and sewer
- [x] React Query hooks and API client layer (use-water.ts, use-sewer.ts, api/water.ts, api/sewer.ts)
- [x] Integration tests: water (1,322 lines), sewer (1,125 lines)
- [ ] Shapefile/GeoJSON import with smart field mapping
- [ ] NASSCO PACP/MACP condition coding
- [ ] Enhanced reporting

### Phase 3 — Scale & Compliance
- Capital planning module
- Regulatory report templates (EPA, state)
- Preventive maintenance scheduling
- Schema isolation (premium tier)
- API for third-party integrations

---

## Conventions

### Code Style
- Python: Black formatter, Ruff linter, type hints everywhere
- SQL: snake_case, singular table names, no prefixes
- API: RESTful, plural resource names in URLs (`/signs` not `/sign`)
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

### File Naming
- Python: snake_case (`sign_service.py`)
- React: PascalCase for components (`SignMap.tsx`), camelCase for utilities

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `SECRET_KEY` — JWT/session signing
- `GCS_BUCKET` — Cloud Storage bucket for files
- `TENANT_ISOLATION_MODEL` — `shared` | `schema` | `dedicated`

---

## Working Rules

- **Never mark tasks complete unless fully done.** If work is partial, say so explicitly with what remains. Do not rationalize skipping work or inflate status to make progress look clean. This includes:
  - **Do not skip tedious or repetitive work.** If a task has 46 instances, do all 46 — not 2 and call it done. "Tedious" is not a reason to stop. If the scope is genuinely too large for one pass, say "I've done N of M, should I continue?" — never silently mark it complete.
  - **Do not rationalize avoiding risky merges.** If work was done (e.g. in a worktree), validate and integrate it rather than abandoning it because merging "feels risky."
  - **Self-reporting must be honest.** When summarizing what was done, report actual counts and actual state. If you fixed 2 of 46, say "2 of 46" — not "done." The user cannot trust the task board if completion status is inflated.
  - **When in doubt, be transparent.** It is always better to say "this is partially done, here's what remains" than to present partial work as finished.
- **Fix all errors encountered, not just the ones related to your task.** Pre-existing bugs are still bugs. If you encounter a broken panel, a failing endpoint, or a misbehaving feature while working on something else, fix it. Do not dismiss issues as "pre-existing" or "not caused by my changes."
- **Verify the full chain, not just the immediate change.** Do not treat tasks as isolated. After any change, verify end-to-end. Check upstream inputs and downstream effects.
- **After adding new features, review test coverage.** Run existing tests to ensure nothing broke, then add tests for new functionality — especially new API endpoints, components, and business logic.
- **Document all decisions.** Update this file when architecture decisions are made, milestones are reached, or direction changes. Every future session should be able to read this file and know exactly where things stand.
- **Ask before accessing files outside this project.** Do not silently read, search, or explore directories outside `/Users/robertspelich/PycharmProjects/assetlink/` without explicitly telling the user first and getting confirmation. This includes other projects in PycharmProjects, home directory files, or any path outside the working directory. State what you intend to access and why before doing it.
- **Be proactive about better approaches.** If you see an opportunity to improve the design, UX, architecture, or code quality — do it. Don't wait for the user to suggest it. If you already know a better way, propose it or just build it. The user should not be the one catching missed opportunities that were already visible to you.
- **Follow through on stated intentions.** If you say "I'll note that" or "I'll add that" or "let me do X" — do it immediately. Do not defer, forget, or assume it was rhetorical. If for some reason you cannot do it now, say so and ask if you should proceed later. The user should never have to ask "did you actually do that?"
- **Never push to remote without explicit approval.** Commits are fine to make locally, but `git push` requires the user to say "push" or equivalent. The user may not be done with changes.
- **Run tests and verify the build before pushing.** Every push triggers CI/CD. A failed build or test in GitHub Actions wastes time and blocks deploys. Before pushing: (1) run `npm run build` in `frontend/` to catch TypeScript errors, (2) run `docker compose exec api python -m pytest tests/ -x -q` to verify backend tests pass. Do not push code that hasn't been validated locally.

---

## What's Been Done (Changelog)

### 2026-03-18 — Research Phase
- Created comprehensive concept document (`docs/municipal_asset_platform_concept.md`)
- Analyzed Cityworks 23.14.1 database schema (800 tables) — extracted key patterns
- Reverse-engineered Cityworks Respond 5.12 plugin (353 UI layouts) — identified core workflows
- Extracted admin configuration patterns — identified what to make configurable vs hardcode
- Extracted user guide workflows — mapped work order, inspection, service request flows

### 2026-03-20 — Phase 1 Kickoff + Umbrella Decision
- Decided on development starting order: schema → Docker → FastAPI skeleton → Sign CRUD → Map
- **Built full project scaffold:**
  - Docker Compose (PostGIS 16, Redis 7, FastAPI with hot-reload)
  - Dockerfile with GDAL, WeasyPrint, PostGIS system deps
  - requirements.txt (25 dependencies pinned)
  - FastAPI app with CORS, lifespan, route mounting
  - Pydantic Settings config
  - Multi-tenant middleware (X-Tenant-ID header)
  - Role-based permission enum
  - Alembic migration infrastructure
- **Built 8 SQLAlchemy models:** tenant, app_user, sign, sign_support, sign_type, work_order, inspection, attachment/comment
- **Built 3 Pydantic schema sets:** sign, work_order, inspection (Create, Update, Out, ListOut)
- **Built 4 API route modules:** signs (full CRUD + MUTCD lookup), work_orders, inspections, users
- **Seeded 76 MUTCD sign types** across regulatory, warning, school, guide, construction categories
- **Decision: Multi-product umbrella platform.** BidParser (contractor cost estimator, currently a separate Django project at `/Users/robertspelich/PycharmProjects/bidparser`) will be integrated as an "estimator" module under the same platform. Rationale: shared auth, billing, CRM, and contacts — avoids duplicate business infrastructure.
- Added `tenant_type` field to Tenant model (municipality, contractor, utility_district, county, consulting_firm)
- Updated `modules_enabled` to include "estimator" as a valid module

### 2026-03-21 — Architecture Decisions
- **Refined umbrella strategy:** "Share the plumbing, not the storefront." One company, shared platform backbone (auth, billing, CRM, database), but separate product identities, UIs, marketing, and sales motions. Products are modules, not merged apps.
- **GCP infrastructure decision:** Share existing Cloud SQL instance (`optionsv2-db` on `bucket6-2025-01`) with Options-V2.1 trading platform. AssetLink gets its own database (`assetlink`) with PostGIS enabled on the same PG 15 instance. Separate Cloud Run service (`assetlink-api`). Saves ~$7-25/month vs a dedicated instance.
- **PostgreSQL version adjusted:** 16 → 15 to match existing Cloud SQL instance. No feature impact.
- **Cross-project access rule established:** Must explicitly ask user before accessing files outside `/Users/robertspelich/PycharmProjects/assetlink/`. Added to Working Rules.
- **Built CSV import for signs:** Fuzzy column name matching (40+ aliases), per-row validation, MUTCD code verification, multi-format date parsing, BOM handling, unmapped columns → custom_fields JSONB. Tested with 16 test cases including 100-row batch import.
- **Built 70 integration tests:** Real PostGIS database, no mocks. Covers signs CRUD, work orders, inspections, CSV import, tenant isolation (security-critical), and health checks. Tests found and fixed: `passes_minimum_retro` NOT NULL bug, work order `updated_at` lazy load bug.
- **Clerk auth integration:** `fastapi-clerk-auth` for JWT validation, Clerk organizations map to tenants via `clerk_org_id` column. Dev mode fallback: when `CLERK_JWKS_URL` is not set, X-Tenant-ID header is used (no auth required). All 70 tests pass with auth changes.

### 2026-03-22 — Signs MVP Feature Complete
- **Full React frontend built:** Three-panel GIS-centric layout (list | map | detail) on every page. MapLibre GL JS with CARTO basemap. React Query for data fetching. Tailwind CSS.
- **Signs page:** Integrated map + list + detail panel. Click-to-place sign creation. MUTCD code searchable picker with auto-fill. Edit/delete. Condition color coding. Co-location badges for multi-sign supports.
- **Support-centric UI:** Click a support → see all signs on the post. Drill into individual signs with "Back to Support" navigation. Per-asset inspection and work order creation.
- **Multi-asset work orders:** `work_order_asset` junction table. One WO references multiple signs + support. Knockdown workflow: click "Report Issue" on a support → one WO with all assets pre-attached, per-asset action tracking (replace/reinstall/repair/remove).
- **Multi-asset inspections:** `inspection_asset` junction table. One inspection covers a support + all its signs. Per-asset condition ratings, retroreflectivity readings, action recommendations. Sign auto-update from inspection data (condition, retro, last_inspected_date).
- **Inspection → Work Order with zero dual entry:** `POST /inspections/{id}/create-work-order` copies findings, assets, sets priority from condition severity, links bidirectionally. No re-typing.
- **GIS-centric work orders and inspections:** Every page has a persistent map. Signs always visible as a dimmed base layer. WO markers colored by priority. Inspection markers colored by follow-up status. Click list → map flies. Click map → list scrolls. Linked signs highlight when WO/inspection selected.
- **Toggleable view modes:** Map View (field crew), Table View (operations supervisor), Split View (director). Full sortable tables with all operational columns. Selection/filters persist across mode switches.
- **Asset tag field:** Municipality-assigned identifier (sticker/barcode) on signs and supports. CSV import fuzzy matches asset_tag/asset_id/barcode/tag columns.
- **Human-readable IDs:** WO-YYYYMMDD-NNN and INS-YYYYMMDD-NNN auto-generated per tenant per day.
- **MUTCD Compliance Dashboard:** Executive dashboard with 6 KPI cards (color-coded thresholds), condition/age/sheeting/category distribution charts (pure CSS), replacement planning with cost estimates, priority action table (top 20 signs ranked by composite risk score). Click priority sign → navigates to signs page with asset pre-selected.
- **Map clustering:** MapLibre native clustering (30px radius, clusterMaxZoom 14). Cluster color = worst condition in group. Click to expand. Handles 10K+ signs on GPU. Dynamic viewport sign counter updates on pan/zoom.
- **Print & Email:** Print preview overlay with crew completion fields (checkboxes, signature line, notes). Email via SMTP (configurable, preview mode when unconfigured). Print/email buttons on WO and inspection detail panels.
- **Users & Roles:** 3 roles (Admin/Supervisor/Crew Chief). User CRUD with first_name, last_name, employee_id, email, phone. Soft-delete/reactivate. Email + employee_id uniqueness per tenant. User picker dropdown replaces text "Assigned To" on work orders and "Inspector" on inspections. 18 tests.
- **Settings page:** Tabbed layout — Import Data (with template CSV download + field reference guide), Users & Roles, Data Management (coming soon), Notifications (coming soon). Help page placeholder with 7 topic cards.
- **Import scalability:** Batch processing (500 rows/flush), 50MB file limit, 120s timeout, file size validation, progress messaging, timing stats (rows/sec), unmapped column tracking. Handles 20K+ rows.
- **Custom branding:** AssetLink icon (blue chain links on navy). Browser tab title "AssetLink — Municipal Asset Management". Sidebar icon.
- **Smart CSV import:** Three import modes — signs with auto-support detection (groups by support tag or matching lat/lon), two-file upload (supports + signs with shared key), supports-only. 28 support column aliases with type normalization. All modes use batch processing.
- **Reports page:** 4 tabbed KPI reports — Work Orders (created/completed/backlog, by priority/type/assignee/month), Inspections (coverage rate, follow-up rate, retro pass rate, by type/inspector), Inventory (condition/status/age/sheeting distributions, compliance, replacement forecast), Crew Productivity (per-member WOs/inspections stats). Date range picker with quick presets. Print Report button.
- **Asset selection for WO/inspection creation:** When creating from WO or inspection page, user chooses "Select Existing Sign" (auto-zooms to street level, click sign to attach) or "Drop Location Pin" (crosshair, click for coordinates) or "Skip" (no location). Replaces old single-mode crosshair.
- **Email improvements:** User picker dropdown from Users & Roles for To/CC fields. From header: "Name via AssetLink <workorders@assetlink.us>". Reply-To set to sender's actual email.
- **Test data generation:** Scripts for both signs (2,000 CSV) and WOs/inspections (60 inspections + 27 WOs via API). Run anytime after database wipe.
- **2,000-sign test dataset:** Realistic Springfield IL inventory. All MUTCD codes, age/condition/sheeting correlations, real street names.
- **162+ integration tests passing.** All backend and frontend TypeScript compile clean.
- **Fixed:** work_order_number and inspection_number unique constraints are now per-tenant (composite unique on number + tenant_id).
- **Phase 1 complete.** Photo upload, GCP deployment done. Springfield IL pilot live.

### 2026-03-27 — Phase 1b Kickoff: Estimator Module Port
- **Ported 8 SQLAlchemy models from BidParser:** Contract, Contractor, Bid, BidItem, AwardItem, PayItem, CostIndex, CostIndexMapping. All tenant-scoped data tables have tenant_id, UUIDs, audit fields. PayItem/CostIndex/CostIndexMapping are reference tables (no tenant_id).
- **Ported 3 parsers from BidParser:**
  - IDOT bid tabs parser (fixed-width mainframe format, 489 lines of parsing logic — handles multi-line contractor names, bad bids, omitted bids, leading-space anomaly, scientific notation)
  - IDOT awards parser (CSV with date-in-filename, scientific notation fix for contract numbers)
  - ISTHA bid tabs parser (CSV with dual dates in filename, flattened record → grouped by contractor)
- **Ported pay item categorization system:** 45 IDOT divisions with code ranges, 302 subcategories, landscaping letter prefix mapping. `categorize_pay_item("40600105")` → `("BITUMINOUS SURFACES AND HOT-MIX ASPHALT PAVEMENTS", "HOT-MIX ASPHALT BINDER AND SURFACE COURSE")`.
- **Created Pydantic schemas:** Contract, Contractor, Bid, BidItem, AwardItem, PayItem (Create/Update/Out/List), PriceHistory, BidTabImportOut.
- **Created import service:** Parser → database layer with upsert support. Contracts upsert (re-import deletes existing bids). Contractors get-or-create. Handles all three file formats.
- **Created 12 API endpoints** under `/api/v1/estimator/`:
  - `GET /contracts` — list/filter/search with bid counts and low bid totals
  - `GET /contracts/{id}` — detail with nested bids
  - `GET /bids/{id}` — detail with all line items and extensions
  - `GET /contractors` — list/search with bid count and win count
  - `GET /pay-items` — catalog search by code, description, division
  - `GET /pay-items/{code}/price-history` — full price history with stats (avg, median, min, max)
  - `POST /import/idot-bidtabs` — multi-file upload for IDOT bid tab text files
  - `POST /import/idot-awards` — multi-file upload for IDOT award CSVs
  - `POST /import/istha-bidtabs` — multi-file upload for ISTHA bid tab CSVs
- **Created Alembic migration** for all 8 new tables (pay_item, cost_index, cost_index_mapping, contract, contractor, bid, bid_item, award_item).
- **Refactored award_item to reference table** (no tenant_id) — shared public IDOT data, access gated by modules_enabled.
- **Built IDOT web scraper** (`idot_scraper.py`): Scrapes IDOT Transportation Bulletin for "Pay Item Report with Awarded Prices" Excel files. Discovers 62 lettings (Jan 2018–Apr 2026) from home page archive dropdown. Downloads .xlsx files with polite concurrency. 60 of 62 downloaded (2 future lettings have no report yet).
- **Built Excel→CSV converter** (`file_utils.py`): Handles 3 different IDOT Excel format variants (9-col 2018 era, 11-col 2021 era, 10-col 2023+ era with swapped county/district and Awarded column). Auto-detects format. Standardizes to `AWD_IL_IDOT_YYYY_MM_DD.csv` with headers: code, description, unit, quantity, county, district, contract, item, price.
- **Built bulk loader** (`bulk_loader.py`): Batch INSERT at 6,500 rows/sec with per-file transactions. Loaded 1,385,747 award rows (164 files, 2003–2026) into PostgreSQL in ~3.5 minutes.
- **GCS buckets created** for bid data: `gs://il-idot-awards` (164 CSVs, 2003–2026), `gs://il-idot-awards-new` (60 scraped .xlsx files), `gs://il-idot-bidtabs` (850 bid tab text files).
- **Built pricing engine** (`pricing_engine.py`): Queries 1.4M-row award_item table with recency-weighted pricing (exponential decay: 0-2yr=1.0, 2-5yr=0.5, 5-10yr=0.25, 10+yr=0.1). Computes weighted avg, percentiles (p10/p25/p50/p75/p90), min/max. Integrates inflation adjustment and regional factors.
- **Built inflation service** (`inflation_service.py`): FHWA NHCCI quarterly index data (2003–2025). Maps pay item divisions to index sources via cost_index_mapping. Computes adjustment factor: `adjusted = nominal × (target_index / source_index)`. Seed data bundled.
- **Built regional service** (`regional_service.py`): State-level cost multipliers (51 states/DC). Illinois = 1.0 baseline. RSMeans-style factors. Seed CSV bundled.
- **Built estimate service** (`estimate_service.py`): Full CRUD for estimates and items. Auto-prices items from historical data. Recalculate all items on settings change. Duplicate estimates. Confidence scoring per item (percentile rank vs historical distribution).
- **Created 3 new models:** Estimate (tenant-scoped), EstimateItem (tenant-scoped), RegionalFactor (reference table).
- **Created Alembic migration** for estimate, estimate_item, regional_factor tables + composite index on award_item(pay_item_code, letting_date).
- **Data in PostgreSQL:** 1,385,747 award rows, 36,102 unique pay items, 21,029 contracts, 24 years (2003–2026).
- **Remaining for Phase 1b:** Add new API endpoints (estimate CRUD, price stats, confidence, seed endpoints), integration tests, React frontend for estimator.

### 2026-04-01 — Phase 2 Complete: Water & Sewer Modules
- **Built 6 Water SQLAlchemy models:** WaterMain (LineString), WaterValve (Point), FireHydrant (Point), WaterService (LineString), WaterFitting (Point), PressureZone (Polygon) + 2 reference tables (WaterMaterialType, WaterValveType). Total: 412 lines.
- **Built 6 Sewer SQLAlchemy models:** SewerMain (LineString), ForceMain (LineString), Manhole (Point), LiftStation (Point), SewerLateral (LineString), SewerFitting (Point) + 3 reference tables (SewerMaterialType, SewerPipeShape, ManholeType) + ManholePipe junction table. Total: 509 lines.
- **Full CRUD API routes:** water.py (1,284 lines) and sewer.py (1,458 lines) with endpoints for all asset types, reference lookups, tenant-scoped queries.
- **Pydantic schemas:** water.py (614 lines) and sewer.py (722 lines) with geometry serialization for Point, LineString, and Polygon types.
- **Alembic migration:** Single comprehensive migration for all water/sewer tables with proper indices and constraints.
- **React frontend:** water-page.tsx (745 lines) and sewer-page.tsx (698 lines) with GIS-centric three-panel layout. Detail panels, form panels, and map components for both modules.
- **React Query hooks and API layer:** use-water.ts (368 lines), use-sewer.ts (322 lines), api/water.ts (239 lines), api/sewer.ts (209 lines).
- **Integration tests:** test_water.py (1,322 lines) and test_sewer.py (1,125 lines) with real PostGIS database.
- **Phase 2 complete.** Remaining future work: Shapefile/GeoJSON import, NASSCO PACP/MACP condition coding, enhanced reporting.
