# Cityworks Respond 5.12 Plugin Analysis
> Extracted from: `Respond5.12.cwplugin` (zip archive)
> Version: 5.12.0
> Type: Angular frontend plugin ("A Cityworks app for work activities")
> Compatible with: Cityworks 23.5+

---

## Overview

The Respond plugin is Cityworks' modern frontend for work activity management. It's a compiled Angular application delivered as a `.cwplugin` zip file containing 15,199 files.

### File Composition

| Type | Count | Purpose |
|------|-------|---------|
| JSON | 13,865 | Localization, config, asset definitions |
| JS | 561 | Angular bundles (main: 6.2MB, scripts: 14MB) |
| PNG | 253 | Icons, images |
| SCSS | 130 | Styles (source maps) |
| WOFF2 | 116 | Web fonts |
| JPG | 93 | Images |
| SVG | 39 | Vector icons |
| CSS | 30 | Compiled styles |
| FTL | 28 | Locale/translation templates |

### Plugin Architecture

- **Entry point:** `index.cwhtml` — loads Angular app with Handlebars-style template variables (`<?=server.url=?>`, `<?=plugin.root=?>`)
- **Root component:** `<cw-respond-app>`
- **Routing:** Hash-based Angular routes
- **API communication:** Posts to `{baseUrl}/services/` endpoints (same SDK endpoints as the Python/TypeScript SDK)
- **Plugin system:** Runs inside a sandbox iframe, communicates with host via postMessage
- **Customization:** Profile-based layout system (`.pcp.json` files) allows per-installation UI customization

---

## UI Layouts / Views (353 total)

The profile system (`default.pcp.json`, 16,743 lines) defines every UI screen's control layout. This reveals the complete user-facing feature set.

### Work Order Views

| Layout | Controls | Purpose |
|--------|----------|---------|
| workOrderCreate | 3 | Create new work order — asset selection, template selection, entity type |
| workOrderEdit | 9 | Edit work order — all fields, status, dates, people, custom fields |
| workOrderToolbar | 11 | Action buttons — save, close, cancel, print, link, cycle, costs |
| workOrderAddCosts | 2 | Add labor/material/equipment costs |
| workOrderCostSummary | 5 | View actual vs estimated costs by type |
| workOrderAttachments | 1 | Photo/document attachments with task association |
| workOrderAuditLog | 1 | Change history tracking |
| workOrderReadings | 1 | Asset meter readings |
| workOrderSecurity | 1 | Permission flags display |
| workOrderTasks | 1 | Sub-task management |
| workOrderTaskDetail | 19 | Individual task editing — status, dates, assignee, comments |
| workOrderEquipmentCheckout | 2 | Equipment reservation/checkout |
| workOrderPermitCosts | 3 | Permit-related costs |

### Inspection Views

| Layout | Controls | Purpose |
|--------|----------|---------|
| inspectionCreate | 4 | Create inspection — template, entity, batch creation |
| inspectionEdit | 10 | Edit inspection — condition, observations, Q&A |
| inspectionToolbar | 6 | Actions — save, close, cancel, link, costs |
| inspectionAddCosts | 2 | Labor/equipment costs |
| inspectionCostSummary | 5 | Actual vs estimated costs |
| inspectionAuditLog | 1 | Change history |
| inspectionReadings | 1 | Asset readings |

### TV/CCTV Inspection (PACP)

| Layout | Controls | Purpose |
|--------|----------|---------|
| tvInspectionEdit | 11 | Pipe inspection — all PACP fields, ratings, materials |
| tvInspectionToolbar | 1 | Actions |
| tvObservationsEdit | 2 | Individual defect observation coding |

### Manhole Inspection (MACP)

| Layout | Controls | Purpose |
|--------|----------|---------|
| manholeInspectionEdit | 7 | Manhole inspection — materials, ratings, measurements |
| manholeInspectionToolbar | 2 | Actions |
| manholeObservationsEdit | 1 | Observation coding for manhole defects |
| manholePipesEdit | - | Pipe connections entering/leaving manhole |

### Hydrant Flow Test

| Layout | Controls | Purpose |
|--------|----------|---------|
| hydrantFlowTestEdit | 8 | Flow rate, pressure, test parameters |

### Service Request

| Layout | Controls | Purpose |
|--------|----------|---------|
| serviceRequestCreate | 3 | Create citizen request |
| serviceRequestEdit | 9 | Edit — problem, location, status, dispatch |
| serviceRequestToolbar | 5 | Actions |
| serviceRequestCallers | 3 | Caller/customer information |
| serviceRequestLabor | 0 | Labor tracking |

### Case/Permit Management (195+ layouts)

Major case layouts include:
- `caseCreate`, `caseEdit` (16 controls), `caseToolbar` (6 controls)
- `caseAddress`, `caseCondition`, `caseContractor`, `caseCorrections`
- `caseDataGroup`, `caseDeposit`, `caseFees` (add/detail/list)
- `caseFlag` (add/detail), `caseInspectionHistory`, `caseInspectionScheduling`
- `caseInstrument` (detail/list/releases), `caseLicenses`
- `caseMakePayment`, `caseNotes`, `caseObject`, `casePayment`
- `casePeople`, `caseRelatedActivities`, `caseTask` (add/edit/comments/chart)
- `caseViolation`, `caseUtility` (10 controls), `caseUtilityActions` (8 controls)

### Map/GIS Views

| Layout | Controls | Purpose |
|--------|----------|---------|
| lib__Map_Map | 29 | Main map — bookmarks, layers, search, tools |
| lib__Map_Selection | 19 | Asset selection on map |
| lib__Map_BaseMaps | - | Basemap switcher |
| lib__Map_Legend | - | Layer legend |
| lib__Map_Measure | - | Distance/area measurement |
| lib__Map_Printing | - | Map print |
| lib__Map_Redline | - | Markup/annotation |
| lib__Map_Routing | - | Navigation routing |
| lib__Map_CoordinateConversion | - | Coordinate system conversion |
| lib__Map_ElevationProfile | - | Terrain profile |
| lib__Map_UtilityNetworkTrace | - | Network tracing |

### Dashboard

| Layout | Controls | Purpose |
|--------|----------|---------|
| lib__Dashboard_dashboardView | - | Dashboard display |
| lib__Dashboard_dashboardEdit | - | Dashboard configuration |
| lib__Dashboard_chartWidgetView/Edit | - | Chart widgets (pie, bar, line) |
| lib__Dashboard_countWidgetEdit | - | Count/KPI widgets |
| lib__Dashboard_mapWidgetView/Edit | - | Embedded map widgets |
| lib__Dashboard_tableWidgetView/Edit | - | Data table widgets |

### Query/Search

| Layout | Controls | Purpose |
|--------|----------|---------|
| quickSearch | - | Universal search |
| quickSearchDetailedSearchWorkOrder | 1 | Work order search |
| quickSearchDetailedSearchInspection | 1 | Inspection search |
| quickSearchDetailedSearchServiceRequest | 1 | Service request search |
| quickSearchDetailedSearchCaseObject | 1 | Case/permit search |
| lib__Query-Editor_queryBuilder | - | Advanced query builder |

### Cost Management (ELM)

| Layout | Controls | Purpose |
|--------|----------|---------|
| elmAddLaborCosts | 17 | Add labor — employee, hours, rate type, dates |
| elmAddEquipmentCosts | 19 | Add equipment — equipment ID, hours, rate |
| elmAddCostMaterial | 12 | Add material — storeroom, quantity, unit cost |
| elmAddCostsLineItemAdd | 9 | Line item costs |
| elmAddCostsContractorAdd | 7 | Contractor costs |
| elmAddCostsCrewAdd | 8 | Crew-based cost entry |
| elmCostSummary | 2 | Overall cost summary |
| elmSummary | 6 | Summary dashboard |

---

## Route Structure (from main.js analysis)

```
/                           → Dashboard / Home
/work-order/create          → Create Work Order
/work-order/edit/:id        → Edit Work Order
/inspection/create          → Create Inspection
/inspection/edit/:id        → Edit Inspection
/tv-inspection/edit/:id     → Edit CCTV Pipe Inspection
/tv-inspection/observations → CCTV Observation Coding
/manhole-inspection/edit/:id → Edit Manhole Inspection
/manhole-inspection/observations → Manhole Observation Coding
/service-request/create     → Create Service Request
/service-request/edit/:id   → Edit Service Request
/service-request/callers    → Caller Management
/case/create                → Create Case/Permit
/case/edit/:id              → Edit Case/Permit
/gis/asset-details          → Asset Detail View (from map)
```

## API Endpoints Used (from main.js analysis)

The Respond plugin calls the same REST API as the SDK:
- `AMS/Inspection/ById`
- `AMS/Attachments/PluginGet`
- `AMS/Comment/ByActivityIds`
- `AMS/Comment/ByActivitySids`
- `AMS/Security/WorkOrderBySid`
- `AMS/Security/Inspection`
- `AMS/Security/ManholeInspection`
- `AMS/Security/TVInspection`
- `AMS/Security/ServiceRequest`
- `AMS/Security/Case`
- `AMS/Security/Contract`
- `AMS/Security/Project`
- `AMS/Storeroom/PrintTransactions`
- `PLL/CaseRelDocs/ByCaObjectId`
- `PLL/CaseRelDocs/ByCaTaskId`

---

## Key UI Patterns to Learn From

### 1. Work Order Create Flow
1. Select assets from map OR choose entity type manually
2. Choose between "Feature" (GIS layer), "Object" (non-spatial), or "Other"
3. Select asset group → asset type → template
4. Option to group entities into individual WOs or one combined WO
5. Shows existing open work activities for selected assets (prevents duplicates)

### 2. Inspection Create Flow
1. Select entity type (Feature/Object/Other)
2. Choose asset group → asset type
3. Select inspection template
4. Batch creation — create multiple inspections at once with progress indicator

### 3. Cost Tracking UI
- Three cost types: Labor, Equipment, Material
- Each has Actual vs Estimated tracking
- Labor supports: Employee, Contractor, Crew-based entry
- Material supports: Storeroom integration, stock tracking
- Equipment supports: Hours, units, operator assignment
- Summary view shows actual vs estimated with difference and percent diff

### 4. Customizable Layout System
Every screen is configurable per installation via the profile JSON:
- Controls can be hidden, reordered, resized
- Responsive widths defined as array `[xs, sm, md, lg, xl]`
- Panels group related controls with collapsible headers
- This is the "enterprise configurability" that small municipalities don't need

### 5. Notification System
- Work order assigned, overdue, status changed
- Inspection created, scheduled, cancelled
- Comment mentions
- Mark as read / remove functionality

---

## What This Tells Us for Our Platform

1. **UI Complexity** — 353 layouts is massive. Our MVP should target ~20-30 views covering the core sign/work order/inspection workflows.

2. **Work Order Create is asset-centric** — they start from the map/asset, then create the WO. We should follow this pattern (click sign on map → create work order).

3. **Cost tracking is a core feature** — labor/material/equipment costs with actual vs estimated. Small municipalities may not need this level of detail initially, but tracking basic costs (labor hours, materials used) is important.

4. **Template-driven inspections work** — the create flow shows template selection is the first step. We need this for configurable inspection types.

5. **Batch operations matter** — creating multiple inspections at once (e.g., "inspect all signs on Main Street") with progress tracking.

6. **Audit logging is built-in** — every entity has an audit log view. Important for government compliance.

7. **The profile/layout customization system is over-engineered for our market** — small municipalities don't need per-control visibility configuration. A simpler role-based approach is better.

8. **Their Esri dependency is deep** — map integration, GIS proxy URLs, utility network tracing all require Esri services. Our MapLibre + PostGIS approach eliminates this entirely.

---

*Analysis performed March 18, 2026*
*Source: Respond5.12.cwplugin (15,199 files, 353 UI layouts, Angular frontend)*
