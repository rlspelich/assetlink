# Municipal Asset Management Platform — Conceptual Plan
> Generated from full conversation thread — March 18, 2026
> Status: Conceptual / Pre-Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Opportunity](#2-market-opportunity)
3. [Product Vision](#3-product-vision)
4. [Product Architecture — Modular Platform](#4-product-architecture--modular-platform)
5. [Module 1 — Sign Inventory](#5-module-1--sign-inventory)
6. [Module 2 — Water System](#6-module-2--water-system)
7. [Module 3 — Sewer System](#7-module-3--sewer-system)
8. [Shared Platform Components](#8-shared-platform-components)
9. [Technology Stack](#9-technology-stack)
10. [Google Cloud Infrastructure](#10-google-cloud-infrastructure)
11. [Multi-Tenant Architecture](#11-multi-tenant-architecture)
12. [Data Import & Export](#12-data-import--export)
13. [Database Design Philosophy](#13-database-design-philosophy)
14. [Pricing & Packaging](#14-pricing--packaging)
15. [Go To Market Strategy](#15-go-to-market-strategy)
16. [Regulatory & Compliance Considerations](#16-regulatory--compliance-considerations)
17. [Legacy Application Assessment](#17-legacy-application-assessment)
18. [Development Roadmap](#18-development-roadmap)
19. [Project Structure](#19-project-structure)
20. [Open Questions & Next Steps](#20-open-questions--next-steps)

---

## 1. Executive Summary

This document captures the full conceptual plan for a cloud-hosted, SaaS municipal asset management platform targeting small and rural municipalities that have been priced out of enterprise GIS-based asset management solutions such as Esri ArcGIS, Trimble Cityworks, and Avolve.

The platform will be built on an open source GIS stack (PostGIS, MapLibre GL) with a Python/FastAPI backend hosted on Google Cloud, eliminating Esri licensing costs entirely. It will be delivered as a fully managed SaaS product requiring zero IT infrastructure from the municipality.

The platform is modular — municipalities can purchase individual modules (Signs, Water, Sewer) as standalone products or as a bundled suite. The Sign Inventory module is identified as the ideal standalone entry product and top-of-funnel offering due to its universal applicability, federal regulatory mandate, and lower complexity relative to utility network management.

The founding team brings deep domain expertise in Esri software, GIS-based asset management, and direct experience with enterprise platforms like Trimble Cityworks prior to their cloud offering.

---

## 2. Market Opportunity

### The Problem

- **Esri** is the dominant GIS platform but is prohibitively expensive for small/rural municipalities
- Asset management platforms built on Esri (Cityworks, Avolve, etc.) **inherit that cost burden**
- Small municipalities have the **same asset management needs** as large cities — roads, water, sewer, signs, stormwater, parks, facilities
- Most small municipalities are currently managing assets with **spreadsheets, paper records, or aging custom systems**
- Self-hosted GIS applications are **not viable** for municipalities without IT staff — server management, GIS dependencies, updates, security patching, and disaster recovery are beyond their capability

### The Gap

- No affordable, modern, GIS-enabled asset management platform exists for the small municipality market
- Small municipalities don't need enterprise-scale complexity — they need something **purpose-built for their scale**
- The market is large — thousands of townships, small cities, rural water districts, road commissions, and counties across the US

### Competitive Landscape

| Competitor | Problem for Small Markets |
|------------|--------------------------|
| Esri ArcGIS + custom development | $50,000–$200,000+/year licensing, requires GIS staff |
| Trimble Cityworks | Enterprise pricing, historically self-hosted, complex |
| Avolve | Built on Esri, inherits licensing cost |
| Cartegraph | Enterprise focus, complex, expensive |
| Excel/Spreadsheets | No spatial capability, no automation, error prone |
| VueScan / SignTracker | Niche, dated UI, limited features |

### Founding Advantage

- Deep domain expertise in Esri software ecosystem
- Direct experience with Cityworks before cloud hosting existed
- Understands the real pain points municipalities face
- Knows what features are used vs what is just complexity
- Understands the data models — feature classes, work orders, inspections
- Knowledge of industry standards (MUTCD, NASSCO PACP/MACP, AWWA, ISO 55000)

---

## 3. Product Vision

### Core Principles

- **SaaS only** — fully hosted, zero IT burden on the municipality
- **Browser based** — works on any device, no software to install
- **Mobile friendly** — field workers can use it from their phone
- **Affordable** — priced for small municipality budgets
- **Simple** — purpose-built, not enterprise-bloated
- **Open standards** — no vendor lock-in, data portability guaranteed
- **Modular** — buy what you need, add modules as you grow

### The Platform Suite Vision

```
Sign Inventory (standalone entry product — universal need)
        ↓
Add Water System Module
        ↓
Add Sewer System Module
        ↓
Full Municipal Asset Management Platform
        ↓ (future)
Roads / Pavement Management
Parks & Facilities
Stormwater
```

Signs serve as the **top of funnel** — low friction, low cost, proves the product. Water and sewer keep them for life.

---

## 4. Product Architecture — Modular Platform

### One Platform, Feature Modules

All modules share the same core platform. A municipality's subscription determines which modules are active.

```
┌─────────────────────────────────────────────┐
│         Municipal Asset Platform             │
│                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │  Signs  │  │  Water  │  │  Sewer  │     │
│  │ Module  │  │ Module  │  │ Module  │     │
│  └─────────┘  └─────────┘  └─────────┘     │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         Shared Core Platform        │    │
│  │  Maps · Work Orders · Users · Auth  │    │
│  │  Photos · Reports · Notifications   │    │
│  │  Mobile · Billing · Multi-tenant    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Shared Components (Built Once, Used by All Modules)

| Component | Description |
|-----------|-------------|
| Map interface | MapLibre GL — same map, different layers per module |
| Work order system | Signs, pipes, valves, manholes all use same WO engine |
| User management | Same field worker account works across all modules |
| Photo storage | Photos attached to any asset type |
| Inspection forms | Configurable per asset type |
| Notification engine | Replacement due, WO assigned, inspection overdue |
| Reporting engine | Different templates per module, same engine |
| Mobile PWA | One app, shows modules the tenant has licensed |
| Billing/subscription | One invoice covers all active modules |
| Multi-tenant system | Municipality = tenant, isolated per configuration |
| Data import/export | Shapefile, GeoJSON, CSV across all asset types |

### Map Layer Architecture

Each module adds layers to the shared map:

```
MAP LAYERS
├── 🪧 Signs (points — color by compliance status)
├── 💧 Water Mains (lines — color by material/age)
├── 🔵 Water Valves (points)
├── 🔴 Fire Hydrants (points)
├── 🟤 Sewer Mains (lines)
├── ⚫ Manholes (points)
├── 🟡 Lift Stations (points)
└── 📋 Work Orders (points — open issues overlay)
```

Municipalities only see layers for modules they have licensed.

---

## 5. Module 1 — Sign Inventory

### Why Signs First

- Every municipality has signs — universal need
- Federal MUTCD compliance mandate creates urgency
- Simpler data model than utility networks (mostly points)
- Faster to build — ideal MVP
- Natural upsell to full platform
- Most municipalities currently have no system or a spreadsheet

### Regulatory Driver — MUTCD

The **Manual on Uniform Traffic Control Devices (MUTCD)** mandates:

| Requirement | Detail |
|-------------|--------|
| Retroreflectivity | Signs must meet minimum reflectivity standards |
| Replacement schedule | Signs degrade, must be replaced proactively |
| Expected sign life | Typically 7–10 years depending on material/sheeting |
| Blanket replacement | Age-based replacement is acceptable method |
| Documentation | Must prove compliance if audited by FHWA |

### Sign Asset Data Model

```
SIGNS (Point geometry)
├── sign_id (UUID)
├── tenant_id (FK → tenant)
│
├── LOCATION
│   ├── geometry (Point — WGS84)
│   ├── address (reverse geocoded)
│   ├── road_name
│   ├── side_of_road (N/S/E/W)
│   ├── intersection_with
│   └── location_notes
│
├── SIGN DETAILS
│   ├── sign_type (regulatory, warning, guide, school, recreation, temporary)
│   ├── mutcd_code (R1-1, W1-1, etc.)
│   ├── description (STOP, YIELD, SPEED LIMIT, etc.)
│   ├── legend_text (e.g. "35" for speed limit)
│   ├── size_width (inches)
│   ├── size_height (inches)
│   ├── shape (octagon, triangle, rectangle, diamond)
│   ├── background_color
│   ├── condition_rating (1–5)
│   └── photo_url (Cloud Storage)
│
├── PHYSICAL SUPPORT
│   ├── support_type (u-channel, square tube, wood, mast arm)
│   ├── support_count (single, double)
│   ├── mount_height (inches)
│   ├── support_condition (1–5)
│   └── support_shared (bool — multiple signs on same post)
│
├── RETROREFLECTIVITY
│   ├── sheeting_type (Type I through XI)
│   ├── sheeting_manufacturer
│   ├── expected_life_years
│   ├── install_date
│   ├── expected_replacement_date (auto-calculated)
│   ├── last_measured_date
│   ├── measured_value (mcd/lux/m²)
│   └── passes_minimum (bool — auto-calculated)
│
├── LIFECYCLE
│   ├── install_date
│   ├── install_year
│   ├── last_inspected_date
│   ├── last_replaced_date
│   ├── replacement_due_date (auto-calculated)
│   ├── replacement_cost_estimate
│   └── status (active, damaged, missing, replaced, removed)
│
└── work_order_id (FK → work_orders)

SIGN_SUPPORTS (Point geometry)
├── support_id (UUID)
├── tenant_id
├── support_type
├── install_date
├── condition_rating
├── geometry (Point)
└── signs[] (FK → signs — one support, many signs)

SIGN_TYPES (Lookup table)
├── mutcd_code (PK)
├── category (regulatory, warning, guide, recreation, temporary)
├── description
├── standard_size
├── standard_sheeting_type
├── expected_life_years
└── thumbnail_url
```

### Sign Module Features

- Map view of all signs — color coded by compliance status, age, condition
- Click any sign on map — see full details and history
- Filter by type, road, condition, replacement due date
- MUTCD compliance dashboard — percentage compliant, upcoming replacements
- Bulk replacement scheduling — generate work orders by road or age range
- Annual replacement plan with cost projections
- Mobile field app — navigate to sign, update condition, take photo
- New sign install — drop pin on map, fill form, done
- Import from Shapefile, GeoJSON, CSV
- Export full inventory for audits
- Pre-built compliance summary report

### MUTCD Sign Categories

| Category | Examples |
|----------|---------|
| Regulatory | Stop, Yield, Speed Limit, No Parking, One Way |
| Warning | Curve, School Zone, Pedestrian, Railroad |
| Guide | Street Name, Route Markers, Distance |
| School | School Speed, School Crossing |
| Recreation | Park, Trail, Campground |
| Temporary | Construction zone signs |

---

## 6. Module 2 — Water System

### Water Asset Data Model

```
WATER PIPES (LineString geometry)
├── pipe_id (UUID)
├── tenant_id
├── material (PVC, DI, CI, AC, CU, HDPE)
├── diameter (inches)
├── length (auto-calculated from geometry)
├── install_year
├── pressure_zone
├── condition_rating (1–5)
├── lining_type
├── flow_direction
└── geometry (LineString — WGS84)

WATER VALVES (Point geometry)
├── valve_id (UUID)
├── tenant_id
├── type (gate, butterfly, ball, check, PRV)
├── diameter (inches)
├── turns_to_close
├── normal_position (open/closed)
├── last_operated_date
├── condition_rating
└── geometry (Point)

FIRE HYDRANTS (Point geometry)
├── hydrant_id (UUID)
├── tenant_id
├── manufacturer
├── install_year
├── last_inspection_date
├── flow_rate (GPM)
├── static_pressure (PSI)
├── condition_rating
├── out_of_service (bool)
└── geometry (Point)

SERVICE CONNECTIONS (Point geometry)
├── service_id (UUID)
├── tenant_id
├── address
├── meter_size
├── tap_size
├── install_year
└── geometry (Point)

WATER FITTINGS (Point geometry)
├── fitting_id (UUID)
├── tenant_id
├── type (tee, cross, reducer, bend)
├── diameter
└── geometry (Point)
```

---

## 7. Module 3 — Sewer System

### Sewer Asset Data Model

```
SEWER GRAVITY MAINS (LineString geometry)
├── pipe_id (UUID)
├── tenant_id
├── material (PVC, VCP, RCP, CI, HDPE)
├── diameter (inches)
├── length (auto-calculated)
├── upstream_invert_elev
├── downstream_invert_elev
├── slope (auto-calculated)
├── install_year
├── condition_rating (1–5 or NASSCO PACP score)
└── geometry (LineString)

MANHOLES (Point geometry)
├── manhole_id (UUID)
├── tenant_id
├── rim_elevation
├── invert_elevation
├── depth (auto-calculated)
├── material (precast, brick, block)
├── diameter (inches)
├── last_inspected_date
├── condition_rating (NASSCO MACP)
├── lid_type
└── geometry (Point)

LIFT STATIONS (Point geometry)
├── station_id (UUID)
├── tenant_id
├── station_name
├── wet_well_capacity (gallons)
├── pump_count
├── design_flow (GPM)
├── install_year
├── last_inspection_date
├── condition_rating
├── telemetry (bool)
└── geometry (Point)

SEWER FORCE MAINS (LineString geometry)
├── pipe_id (UUID)
├── tenant_id
├── material
├── diameter
├── pressure_rating
├── install_year
├── condition_rating
└── geometry (LineString)

CLEANOUTS (Point geometry)
├── cleanout_id (UUID)
├── tenant_id
├── diameter
├── last_cleaned_date
└── geometry (Point)
```

### Industry Standards for Sewer

| Standard | Applies To | Description |
|----------|-----------|-------------|
| NASSCO PACP | Sewer pipes | Pipe Assessment Certification Program — condition coding |
| NASSCO MACP | Manholes | Manhole Assessment Certification Program |
| EPA Clean Water Act | Sewer system | Discharge reporting, SSO reporting |

---

## 8. Shared Platform Components

### Work Orders

```
WORK_ORDERS
├── work_order_id (UUID)
├── tenant_id
├── asset_id (FK → any asset type)
├── asset_type (sign, water_pipe, valve, hydrant, sewer_pipe, manhole, lift_station)
├── work_type (inspection, repair, replacement, flushing, new_install)
├── priority (emergency, urgent, routine, planned)
├── status (open, assigned, in_progress, complete, cancelled)
├── assigned_to (FK → app_user)
├── created_by (FK → app_user)
├── created_date
├── due_date
├── completed_date
├── labor_hours
├── materials_used (JSONB)
├── notes
└── photos[] (Cloud Storage URLs)
```

### Inspections

```
INSPECTIONS
├── inspection_id (UUID)
├── tenant_id
├── asset_id
├── asset_type
├── inspection_date
├── inspector (FK → app_user)
├── condition_rating
├── findings (text)
├── defects (JSONB array)
├── follow_up_required (bool)
├── work_order_id (FK — if follow-up created)
└── photos[] (Cloud Storage URLs)
```

### Base Asset Attributes (Shared Across All Asset Types)

```
ASSET BASE
├── asset_id (UUID)
├── tenant_id
├── module (signs, water, sewer)
├── asset_type (specific type within module)
├── status (active, inactive, abandoned, proposed)
├── ownership (municipal, private, state)
├── install_year
├── estimated_useful_life (years)
├── replacement_cost_estimate
├── last_modified
├── created_by
└── geometry (PostGIS — Point or LineString)
```

### Users & Roles

```
APP_USER
├── user_id (UUID)
├── tenant_id
├── email
├── name
├── role (admin, supervisor, field_worker, viewer, billing)
└── modules_access[] (which modules they can see)

ROLES & PERMISSIONS
├── Admin — full access, user management, billing
├── Supervisor — all assets, work orders, reports
├── Field Worker — assigned work orders, inspections, photos
└── Viewer — read-only map and asset view
```

### Notifications

- Work order assigned to field worker
- Work order past due date
- Sign replacement due within 90/60/30 days
- Hydrant inspection overdue
- Lift station inspection overdue
- Manhole inspection overdue
- System-wide alerts from admin

---

## 9. Technology Stack

### Full Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + TypeScript | Component-based, large ecosystem |
| Map | MapLibre GL | Open source, no Esri licensing |
| Styling | Tailwind CSS | Rapid UI development |
| Backend | Python — FastAPI | Async, modern, auto-docs, team expertise |
| ORM | SQLAlchemy + GeoAlchemy2 | Spatial-aware, Pythonic |
| Migrations | Alembic | Schema version control |
| Validation | Pydantic | Type-safe request/response |
| GIS Operations | GeoPandas + Shapely | Industry standard Python GIS |
| Format Support | GDAL + Fiona | All GIS format import/export |
| Projection | Pyproj | Coordinate system transformations |
| Database | PostgreSQL + PostGIS | Open source, enterprise-grade spatial |
| Caching | Redis (Memorystore) | Session and tile caching |
| File Storage | Google Cloud Storage | Photos, exports, imports |
| Auth | Auth0 or Clerk | Multi-tenant, SSO capable |
| Hosting — API | Google Cloud Run | Managed containers, auto-scale |
| Hosting — Frontend | Firebase Hosting | Global CDN, fast |
| Database Hosting | Google Cloud SQL | Managed PostgreSQL + PostGIS |
| Tile Server | pg_tileserv on Cloud Run | Vector tiles direct from PostGIS |
| CI/CD | Google Cloud Build | Auto-deploy on git push |
| Monitoring | Google Cloud Monitoring | Alerts, dashboards |
| Logging | Google Cloud Logging | Centralized logs |
| Secrets | Google Secret Manager | DB passwords, API keys |
| Security | Google Cloud Armor | WAF, DDoS protection |
| Billing | Stripe | Subscription management, invoicing |
| Email | SendGrid | Notifications, work order alerts |
| Error Tracking | Sentry | Runtime error monitoring |
| Analytics | PostHog | Per-tenant usage analytics |

### Python GIS Ecosystem

```
├── GeoPandas    — Shapefile/GeoJSON import/export, spatial operations
├── Shapely      — Geometry creation and manipulation
├── Pyproj       — Coordinate reference system transformations
├── GDAL/OGR     — All GIS format support (Shapefile, GeoPackage, KML, etc.)
├── Fiona        — Vector data reading/writing
├── GeoAlchemy2  — PostGIS integration with SQLAlchemy
└── Rasterio     — Raster data support (future use)
```

---

## 10. Google Cloud Infrastructure

### Architecture Diagram

```
                    ┌─────────────────┐
                    │  Cloud Armor     │
                    │  WAF + DDoS      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Cloud Load      │
                    │  Balancer        │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼──────┐  ┌─────────▼──────┐  ┌────────▼────────┐
│ Firebase       │  │  Cloud Run     │  │  Cloud Run      │
│ Hosting        │  │  FastAPI API   │  │  Tile Server    │
│ React Frontend │  │                │  │  (pg_tileserv)  │
└───────────────┘  └────────┬───────┘  └────────┬────────┘
                             │                   │
              ┌──────────────┼───────────────────┤
              │              │                   │
     ┌────────▼──────┐ ┌─────▼──────┐ ┌─────────▼──────┐
     │  Cloud SQL     │ │  Cloud     │ │  Memorystore   │
     │  PostgreSQL    │ │  Storage   │ │  Redis         │
     │  + PostGIS     │ │  (files)   │ │  (cache)       │
     └───────────────┘ └────────────┘ └────────────────┘
              │
   ┌──────────┼──────────┐
   │          │          │
┌──▼───┐  ┌──▼───┐  ┌───▼──┐
│Schema│  │Schema│  │Schema│
│ A    │  │ B    │  │ C    │
└──────┘  └──────┘  └──────┘
```

### Google Cloud Services

| Service | Purpose | Notes |
|---------|---------|-------|
| Cloud Run | FastAPI API containers | Auto-scales, pay per request |
| Cloud Run | Tile server (pg_tileserv) | Vector tiles from PostGIS |
| Firebase Hosting | React frontend | Global CDN, free tier available |
| Cloud SQL | PostgreSQL + PostGIS | Managed, auto-backups, PITR |
| Cloud Storage | Photos, exports, imports | S3-equivalent |
| Memorystore | Redis caching | Session, tile cache |
| Cloud Pub/Sub | Async messaging | Import jobs, notifications |
| Cloud Tasks | Background jobs | Scheduled maintenance alerts |
| Secret Manager | Credentials | DB passwords, API keys |
| Cloud Build | CI/CD pipeline | Auto-deploy on git push |
| Cloud Armor | Security | WAF, DDoS protection |
| Cloud DNS | DNS management | Tenant subdomains |
| Cloud Monitoring | Observability | Alerts, dashboards |
| Cloud Logging | Log management | Centralized, searchable |

### Estimated Monthly Infrastructure Cost (Starting)

| Service | Estimated Cost |
|---------|---------------|
| Cloud SQL (small instance) | $50–100 |
| Cloud Run (pay per request) | $10–30 |
| Firebase Hosting | Free tier initially |
| Cloud Storage | $5–20 |
| Memorystore Redis | $30–50 |
| Networking/CDN | $10–20 |
| **Total starting** | **~$100–220/month** |

Scales efficiently — Cloud Run scales to zero for inactive tenants overnight.

### Local Development

Docker Compose mirrors production exactly:

```yaml
services:
  api:        FastAPI backend (Python)
  frontend:   React frontend
  db:         postgis/postgis:15-3.3
  redis:      redis:7-alpine
```

---

## 11. Multi-Tenant Architecture

### The Challenge

Municipalities are cautious about data — they do not want their data stored alongside other municipalities. This is a real and common objection that must be addressed with a clear tiered answer.

### Three Isolation Models

| Model | Description | Cost | Isolation Level |
|-------|-------------|------|-----------------|
| Shared DB (RLS) | Row-level security, tenant_id on all rows | Lowest | Logical only |
| Schema per Tenant | Dedicated schema in shared DB cluster | Low-Medium | Strong logical |
| Dedicated Database | Fully separate PostgreSQL instance | Higher | Physical separation |

### Hybrid Approach — Support All Three

Map isolation model to pricing tier:

```
STANDARD TIER → Shared DB with Row Level Security
"Your data is logically completely separate. No other 
municipality can ever see or access it."

PREMIUM TIER → Schema Isolation
"Your own dedicated schema — data physically separated 
from all other municipalities in its own space."

ENTERPRISE TIER → Dedicated Database
"Your own dedicated database instance. Your data never 
touches any other municipality's data at any level."
```

### Tenant Configuration

```python
class TenantConfig:
    tenant_id: str
    isolation_model: str  # "shared" | "schema" | "dedicated"
    db_schema: str        # for schema isolation
    db_host: str          # for dedicated database
    modules_enabled: list # ["signs", "water", "sewer"]
    subdomain: str        # townofriverdale.platform.com
```

### Tenant Onboarding Flow

1. Municipality signs up or is provisioned
2. Subdomain created → `townname.platform.com`
3. Database schema/instance provisioned per tier
4. Asset type templates applied
5. Users invited via email
6. Data import (if existing data)
7. Live — no IT involvement required

### Addressing Municipality Security Concerns

| Concern | Response |
|---------|----------|
| Who can see our data? | Role-based access, full audit logs |
| What if you go out of business? | Data export anytime, open formats |
| Where is data stored? | US-based Google Cloud data centers |
| Is it backed up? | Automated daily, point-in-time recovery |
| Can we get our data back? | Full export anytime — GeoJSON, Shapefile, CSV |
| Is it encrypted? | Encrypted at rest and in transit (TLS) |
| Who owns the data? | The municipality — stated explicitly in contract |

### Data Portability — A Trust Builder

Offering easy data export actually **reduces churn** by removing fear of lock-in:

```
Export Formats Available
├── CSV / Excel
├── GeoJSON (open standard)
├── Shapefile (Esri compatible)
├── KML (Google Earth)
└── Full database backup (enterprise tier)
```

---

## 12. Data Import & Export

### Why Import Matters

- Removes the biggest barrier to adoption
- County GIS offices often already have sign data in Shapefile format
- Some municipalities paid consultants to inventory their assets
- Nobody wants to manually re-enter hundreds of assets
- First impression — smooth onboarding drives retention

### Supported Import Formats

| Format | Priority | Notes |
|--------|----------|-------|
| Shapefile (.shp/.dbf/.prj as .zip) | High | Most common GIS exchange, county GIS standard |
| GeoJSON (.geojson) | High | Modern open standard |
| CSV with lat/lng columns | High | Most spreadsheet-based municipalities |
| KML/KMZ | Medium | Google Earth format |
| GeoPackage (.gpkg) | Medium | Modern open format, growing adoption |
| Esri File Geodatabase | Lower | Complex, requires special libraries |

### Import Workflow

```
STEP 1 — Upload file (drag and drop)
STEP 2 — Detect format, validate geometry, detect projection
STEP 3 — Auto-reproject to WGS84 if needed
STEP 4 — Field mapping UI (their fields → our schema)
STEP 5 — Value mapping if needed (their codes → our codes)
STEP 6 — Preview — show what will import, flag issues
STEP 7 — Import — show progress, results summary
STEP 8 — View on map — immediate gratification
```

### The Field Mapping Challenge

Every municipality's Shapefile has different field names for the same data:

```
Municipality A    Municipality B    Municipality C
SIGN_TYPE         Type              sign_typ
INSTALL_YR        InstallDate       yr_install
CONDITION         Cond_Rate         condition_r
MUTCD             mutcd_code        MUTCDCode
```

Solution: **Smart field mapping UI** with fuzzy matching auto-suggestions based on common naming patterns.

### Import Templates

After multiple municipalities onboard, save and reuse field mapping templates:

```
SAVED TEMPLATES
├── Generic County GIS Sign Export
├── State DOT Sign Inventory Format
├── Esri ArcFM Water Network Export
└── [State] GIS Clearinghouse Format
```

Templates become a **competitive moat** — platform works with any format.

### Coordinate System Handling

Auto-detect projection from .prj file — never make user figure it out:

```python
# One line reprojection with GeoPandas
gdf = gdf.to_crs("EPSG:4326")  # Convert anything to WGS84
```

Common projections encountered: WGS84, NAD83, State Plane, UTM zones, local custom.

### Export Formats

Match import formats — give data back in any format:
- Shapefile, GeoJSON, CSV, KML, GeoPackage, Full database backup

### MVP vs Future Import

```
MVP → CSV with lat/lng columns
       Gets spreadsheet-based municipalities live immediately

Phase 2 → Full Shapefile + GeoJSON
           Auto projection detection
           Smart field mapping

Phase 3 → KML/KMZ, GeoPackage
           Direct ArcGIS Online connection
           Scheduled sync from external sources
```

---

## 13. Database Design Philosophy

### Legacy Problem

The existing ASP.NET application has a database that grew organically over 25+ years:
- Hundreds of tables, many unused or redundant
- Poor naming conventions
- Inconsistent field naming across tables
- Business logic buried in stored procedures
- No enforced referential integrity in places
- Organic growth through multiple developers over decades

This is a **liability for the old app** but a **learning asset for the new build**.

### Schema Archaeology Process

```
PHASE 1 — Discovery
├── Catalog all tables
├── Identify obvious functional clusters
├── Flag clearly unused tables
└── Identify the core 20% doing 80% of the work

PHASE 2 — Reverse Engineering
├── Map actual relationships
├── Decode naming conventions
├── Identify buried business logic
└── Document what each key table does

PHASE 3 — Clean Schema Design
├── Design PostGIS schema from scratch
├── Informed by legacy but not constrained by it
├── Proper naming conventions throughout
└── Enforced relationships and constraints

PHASE 4 — Migration Mapping
├── Map old columns → new schema
├── Data transformation rules
├── Migration scripts
└── Data validation
```

### New Schema Design Principles

```sql
-- Conventions
-- snake_case throughout
-- No tbl_ prefixes
-- Singular table names
-- UUIDs as primary keys
-- Every table has tenant_id
-- created_at, updated_at, created_by, updated_by on all tables
-- Geometry columns explicitly typed and projected
-- Constraints enforced at database level
-- Nullable only when genuinely optional

-- Example
CREATE TABLE sign (
    sign_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenant(tenant_id),
    mutcd_code       VARCHAR(20) REFERENCES sign_type(mutcd_code),
    install_date     DATE,
    condition_rating SMALLINT CHECK (condition_rating BETWEEN 1 AND 5),
    status           VARCHAR(20) DEFAULT 'active',
    geometry         GEOMETRY(Point, 4326) NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    created_by       UUID REFERENCES app_user(user_id),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_by       UUID REFERENCES app_user(user_id)
);
```

---

## 14. Pricing & Packaging

### Module-Based Pricing Tiers

```
STARTER — Signs Only
├── Sign inventory and map
├── MUTCD compliance tracking
├── Basic work orders
├── Photo attachments
├── Up to X signs
└── $99–199/month

STANDARD — Single Utility (Water or Sewer)
├── Everything in Starter
├── Water OR Sewer network assets
├── Work orders and inspections
├── Basic reporting
└── $299–499/month

PROFESSIONAL — Water + Sewer
├── Both utility networks
├── Advanced reporting
├── Regulatory report templates
├── Capital planning basics
└── $499–999/month

COMPLETE — All Modules
├── Signs + Water + Sewer
├── Full capital planning
├── Priority support
├── Data import assistance
└── $999–1,999/month
```

### Isolation Model Pricing Adder

```
Standard Tier    → Shared DB (included in base price)
Premium Tier     → Schema isolation (+$X/month)
Enterprise Tier  → Dedicated database (+$XX/month)
```

### Population-Based Scaling

| Population | Approximate Range |
|------------|------------------|
| Under 2,500 | $99–300/month |
| 2,500–10,000 | $300–700/month |
| 10,000–25,000 | $700–1,500/month |
| 25,000+ | Custom pricing |

### Comparison to Enterprise Alternatives

| Platform | Annual Cost |
|----------|------------|
| Esri ArcGIS Enterprise | $50,000–$200,000+ |
| Trimble Cityworks | $50,000–$150,000+ |
| This Platform (Complete) | $12,000–$24,000 |

---

## 15. Go To Market Strategy

### Target Customer Profile

- Townships and small cities (under 25,000 population)
- Rural water districts
- County road commissions
- Small DPW (Department of Public Works) departments
- Municipalities with no IT staff
- Currently using spreadsheets or paper records

### Entry Strategy

Signs module as top of funnel:

```
HOOK: "Are your signs MUTCD compliant? Do you know?"
      ↓
Low price point — easy budget approval
      ↓
Prove value — they see compliance status immediately
      ↓
Trust established
      ↓
Upsell Water or Sewer
      ↓
Full platform customer for life
```

### Sales Channels

- State municipal leagues and associations
- County road commissions and associations
- DPW and public works conferences
- State DOT relationships
- Direct outreach to small municipalities
- Word of mouth between neighboring municipalities

### Pilot Strategy

- Offer **free setup** to one municipality in exchange for testimonial and case study
- Use pilot to validate data model against real-world data
- Build import templates from pilot's existing data
- Generate a reference customer before general launch

### Trust Signals for Government Buyers

- US-based data storage (Google Cloud US regions)
- Explicit data ownership in contract
- Easy data export — no lock-in
- Security and compliance documentation page
- Cyber insurance alignment
- References from pilot municipalities

---

## 16. Regulatory & Compliance Considerations

### Federal Standards

| Standard | Domain | Relevance |
|----------|--------|-----------|
| MUTCD | Signs | Retroreflectivity, replacement schedules, FHWA compliance |
| EPA SDWA | Water | Safe Drinking Water Act reporting |
| EPA Clean Water Act | Sewer | Discharge reporting, SSO reporting |
| FHWA | Roads/Signs | Federal Highway Administration oversight |

### Industry Standards

| Standard | Domain | Relevance |
|----------|--------|-----------|
| NASSCO PACP | Sewer pipes | Pipe condition assessment coding |
| NASSCO MACP | Manholes | Manhole condition assessment coding |
| AWWA | Water | Condition rating, materials, inspection standards |
| ISO 55000 | All assets | Asset management framework |

### State-Level Considerations

- State public records laws — data may be subject to FOIA requests
- Data residency requirements — some states require in-state storage
- Cybersecurity frameworks — NIST, CIS controls
- Cyber insurance requirements — increasing for government entities

### Built-In Compliance Features

- Pre-built report templates for common EPA/state reports
- MUTCD compliance dashboard and documentation export
- Audit trail on all data changes
- Role-based access control with logging
- Encrypted at rest and in transit

---

## 17. Legacy Application Assessment

### What Exists

An established ASP.NET application with significant asset management functionality built over approximately 25 years. The application covers much of the functionality discussed in this plan but on a completely different stack.

### Assessment Approach

The legacy application is NOT being directly re-engineered. Instead it is being used as a domain knowledge source:

| Asset | Value |
|-------|-------|
| Database schema | Years of domain knowledge — even if messy |
| Business logic | Rules and calculations proven in real use |
| Feature set | Reveals what municipalities actually need |
| Edge cases | 25 years of real-world exceptions |
| Data | Existing customer data needs migration path |

### Schema Analysis Plan

```
1. Catalog all tables — count, name, row counts
2. Identify functional clusters — assets, work orders, users, lookups
3. Flag unused tables — no recent data, no FK references
4. Map actual relationships — even without formal FK constraints
5. Decode naming conventions — document what fields actually mean
6. Identify buried business logic — stored procedures, triggers
7. Extract the core 20% of tables doing 80% of the work
8. Design clean PostGIS equivalent
9. Build field-by-field migration mapping
10. Write and validate migration scripts
```

### Expected Legacy Anti-Patterns

Based on 25 years of organic growth, expect to find:

- Redundant tables: `assets`, `assets_new`, `assets_v2`, `assets_backup`
- Mystery columns: `field1`, `field2`, `misc_flag`, `temp_value`
- Overloaded tables handling multiple asset types
- Orphaned tables with no application references
- Inconsistent naming: `AssetID`, `asset_id`, `ASSETID`, `iAsset`
- Dates stored as varchar strings
- Critical business rules in stored procedures
- Nullable columns everywhere
- Missing referential integrity enforcement

### Database — SQL Server

The legacy application runs on SQL Server with likely use of SQL Server Spatial types (`geometry`, `geography`). Migration path to PostGIS is well established.

---

## 18. Development Roadmap

### Phase 1 — Foundation & Signs MVP

**Goal:** Deployable product with Sign Inventory module. One pilot municipality live.

```
Infrastructure
├── Google Cloud project setup (Terraform)
├── Cloud SQL — PostgreSQL + PostGIS
├── Cloud Run — FastAPI API
├── Firebase Hosting — React frontend
├── Cloud Storage — file storage
├── Docker Compose — local development
└── Cloud Build — CI/CD pipeline

Core Platform
├── Multi-tenant framework
├── User authentication and roles
├── Base asset model
├── Work order engine (basic)
├── Photo upload and storage
├── Map interface (MapLibre GL)
└── Stripe billing integration

Sign Module
├── Sign data model and PostGIS schema
├── Sign CRUD API endpoints
├── Map layer — signs
├── MUTCD compliance tracking
├── Condition rating
├── Basic work orders for signs
├── CSV import
└── Compliance dashboard

Mobile
└── PWA — basic field worker view
```

### Phase 2 — Water & Sewer + Full Import

```
Water Module
├── Water pipe, valve, hydrant data models
├── Water network map layers
├── Work orders and inspections
├── Basic reporting

Sewer Module
├── Sewer pipe, manhole, lift station data models
├── Sewer network map layers
├── NASSCO condition coding
├── Work orders and inspections

Enhanced Import
├── Shapefile import (.zip bundle)
├── GeoJSON import
├── Auto projection detection
├── Smart field mapping UI
└── Import templates

Enhanced Mobile
└── Full offline-capable PWA
```

### Phase 3 — Scale & Compliance

```
Advanced Features
├── Capital planning module
├── Regulatory report templates (EPA, state)
├── Preventive maintenance scheduling
├── Advanced dashboards
├── GIS data export (Shapefile, GeoPackage)
└── API for third-party integrations

Infrastructure
├── Dedicated database tier (enterprise)
├── Enhanced monitoring
└── SLA and uptime guarantees
```

### Phase 4 — Platform Expansion

```
Additional Modules (future)
├── Roads / Pavement Management
├── Stormwater
├── Parks & Facilities
└── Fleet / Equipment
```

---

## 19. Project Structure

```
municipal-asset-platform/
│
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Settings, env vars (Pydantic Settings)
│   │   │
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── signs.py
│   │   │       ├── water.py
│   │   │       ├── sewer.py
│   │   │       ├── work_orders.py
│   │   │       ├── inspections.py
│   │   │       ├── imports.py
│   │   │       ├── exports.py
│   │   │       ├── reports.py
│   │   │       ├── tenants.py
│   │   │       └── users.py
│   │   │
│   │   ├── models/
│   │   │   ├── base.py             # Base model, shared columns
│   │   │   ├── tenant.py
│   │   │   ├── user.py
│   │   │   ├── sign.py
│   │   │   ├── water.py
│   │   │   ├── sewer.py
│   │   │   └── work_order.py
│   │   │
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   │   ├── sign.py
│   │   │   ├── water.py
│   │   │   ├── sewer.py
│   │   │   └── work_order.py
│   │   │
│   │   ├── services/
│   │   │   ├── spatial.py          # PostGIS operations
│   │   │   ├── import_service.py   # Shapefile/GeoJSON/CSV import
│   │   │   ├── export_service.py   # Data export
│   │   │   ├── tile_service.py     # Vector tile generation
│   │   │   ├── compliance.py       # MUTCD compliance calculations
│   │   │   └── notification.py     # Alerts, emails
│   │   │
│   │   ├── db/
│   │   │   ├── session.py          # Connection pool, tenant routing
│   │   │   ├── migrations/         # Alembic migrations
│   │   │   └── seeds/              # Demo data
│   │   │
│   │   └── core/
│   │       ├── auth.py
│   │       ├── tenant.py           # Tenant resolution middleware
│   │       └── permissions.py
│   │
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/                # MapLibre GL components
│   │   │   ├── signs/              # Sign module UI
│   │   │   ├── water/              # Water module UI
│   │   │   ├── sewer/              # Sewer module UI
│   │   │   ├── work-orders/
│   │   │   ├── inspections/
│   │   │   ├── import/             # Import wizard UI
│   │   │   ├── reports/
│   │   │   └── shared/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/                  # State management
│   │   ├── types/                  # TypeScript types
│   │   └── utils/
│   ├── package.json
│   └── Dockerfile
│
├── infrastructure/
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── cloud_sql.tf
│   │   ├── cloud_run.tf
│   │   ├── firebase.tf
│   │   ├── networking.tf
│   │   └── variables.tf
│   └── docker-compose.yml
│
└── docs/
    ├── architecture.md
    ├── data_model.md
    ├── api_reference.md
    └── onboarding.md
```

---

## 20. Open Questions & Next Steps

### Immediate Next Steps

1. **Review legacy ASP.NET application**
   - Upload codebase or database schema
   - Schema archaeology — catalog tables, identify core models
   - Extract business logic and domain rules
   - Build migration mapping

2. **Validate data models**
   - Confirm sign, water, sewer schemas against real-world experience
   - Identify any missing fields or asset types
   - Confirm industry standard integrations (MUTCD codes, NASSCO, etc.)

3. **Define MVP scope precisely**
   - Confirm Sign module as Phase 1
   - Define minimum feature set for pilot municipality
   - Identify pilot municipality candidate

4. **Product naming**
   - Platform needs a name
   - Should convey municipal focus, simplicity, modern
   - Examples discussed: CivicAsset, MuniTrack, ClearMuni, AssetBridge, TownMapper

5. **Begin technical architecture document (CLAUDE.md)**
   - More focused, developer-facing specification
   - API design, schema DDL, component architecture
   - Based on this conceptual document

### Open Questions

| Question | Status |
|----------|--------|
| Product name | Undecided |
| Pilot municipality identified? | To be determined |
| Priority — Signs only vs Signs + Water/Sewer for MVP? | Signs confirmed for MVP |
| Mobile — PWA vs native app? | PWA preferred |
| Additional asset types beyond Water/Sewer/Signs? | Roads identified as future module |
| State-specific compliance requirements? | Research needed per target states |
| Self-service signup vs sales-assisted? | To be determined |
| Legacy app customer migration path? | Pending schema review |

---

## Appendix A — Key Terminology

| Term | Definition |
|------|-----------|
| MUTCD | Manual on Uniform Traffic Control Devices — federal sign standard |
| FHWA | Federal Highway Administration |
| NASSCO PACP | Pipeline Assessment Certification Program — sewer pipe condition coding |
| NASSCO MACP | Manhole Assessment Certification Program |
| AWWA | American Water Works Association |
| PostGIS | Spatial extension for PostgreSQL |
| GeoJSON | Open standard geographic data format |
| Shapefile | Esri spatial data format — industry standard exchange format |
| WGS84 | World Geodetic System 1984 — standard GPS coordinate system (EPSG:4326) |
| NAD83 | North American Datum 1983 — common US government projection |
| Vector Tiles | Efficient map data delivery format |
| MapLibre GL | Open source map rendering library (Esri-free) |
| Multi-tenant | Single platform serving multiple isolated customers |
| RLS | Row Level Security — PostgreSQL feature for data isolation |
| PWA | Progressive Web App — mobile-capable web application |
| ORM | Object Relational Mapper — SQLAlchemy in this stack |
| GDAL | Geospatial Data Abstraction Library — handles all GIS formats |
| SDE | Esri Spatial Database Engine |
| Retroreflectivity | Sign's ability to reflect light — key MUTCD compliance metric |

---

*Document generated from full conversation thread — March 18, 2026*
*Next document: CLAUDE.md — Focused technical specification for development*
