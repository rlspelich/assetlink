# Cityworks Designer (Admin) Configuration Guide — Key Extracts
> Source: https://help.cityworks.com/Designer/OC/
> Extracted: March 18, 2026

---

## What Admins Configure (vs What's Hardcoded)

This reveals what Cityworks makes configurable per installation — critical for deciding what we hardcode vs make configurable in our platform.

---

## Work Order Templates

### What a Template Defines
- Description (name of the work activity)
- Default Priority, Status, Category
- Default Supervisor, Submit To routing
- Associated asset Group and Type
- Tasks (with estimated labor, materials, equipment)
- Inspection templates (auto-created on WO open or close)
- Map layer fields
- Custom fields (category-specific)
- Predefined comments
- Template security (per-group permissions)
- Audit fields to track
- Print template association

### Template Classes
Template classes group work order templates based on GIS attributes (up to 3 attributes). Example: tree pruning differentiated by tree type/size, pipe flushing by pipe dimensions. Only one asset can be attached when using template classes.

### Custom Fields on Templates
- Admin creates custom fields (text, code, date, numeric types)
- Fields assigned to a Custom Field Category
- Category linked to template
- Fields can be marked as required (blocks WO close until filled)
- Stored as text in database regardless of type
- Searchable

### Template Security
Per-group permissions for each template:
- View, Add, Update, Delete, View Cost (basic)
- Advanced: separate permissions for Work Order, Equipment, Labor, Material, Tasks, Line Items

---

## Inspection Configuration

### Custom Inspections
Admin can:
- Create/clone inspection templates
- Add observation questions (branch or linear)
- Configure asset field updates on close
- Set editable asset fields
- Map layer fields to templates
- Configure template security
- Select audit fields

### Standard Inspections
Admin configures:
- Asset assignment to standard inspection types
- Field mapping for GIS updates on inspection close
- CCTV code configuration (PACP)

### Inspection Preferences
- Default Inspection Status — New (dropdown)
- Resolution Values — configurable list
- Status Values — configurable (Cancel and Closed mandatory, can't be deleted)
- Use Radio Buttons in Custom Inspection Observations — toggle
- **Use CCTV Codes** — enables PACP coding system for TV inspections
- TV Observation Codes — code/description/score definitions
- Print Templates

---

## Preferences — Configurable Domain Settings

### General Preferences
**Comments:**
- Allow Changes to Initiated Date/Time
- Allow Comments to be Deleted / Edited
- Default Comment Sort Order (Asc/Desc)

**Files:**
- Attachment Root Directory
- Default Office/Tablet Layout

**Search:**
- Include Inactive Employees in Searches
- Include Inactive Templates/Tasks in Searches
- Max Open Work Activities on New Page
- Maximum Records Returned through Search Query
- Paging Rows Per Grid

**System:**
- Holidays (organizational observances)
- Print Output Type (Docx or Crystal)
- **Priority Values** — configurable list
- Use Dynamic Cost Codes

**Hierarchy Display:**
- Request/Equipment/Material/Task Tree Text Display: Code, Code~Description, or Description

### Work Order Preferences
- **Category Values** — configurable list
- **Default Work Order Status — New** — which status new WOs get
- Work Order Entity Count GIS Flag (threshold: 25)
- **Resolution Values** — configurable list
- **Status Values** — configurable list (Cancel + Closed mandatory)
- Print Templates

### Service Request Preferences
- **Caller Type Values** — configurable list
- **Caller Title Values** — configurable list
- **Category Values** — configurable list
- Copy Caller QAs to Request Comments (checkbox)
- Default Request Status — New
- Default Request Caller Type
- **Resolution Values** — configurable list
- **Status Values** — configurable (Cancel + Closed mandatory)
- Print Templates

### Inspection Preferences
- Default Inspection Status — New
- **Resolution Values** — configurable list
- **Status Values** — configurable (Cancel + Closed mandatory)
- Use Radio Buttons in Custom Inspection Observations
- **Use CCTV Codes** — enables PACP interface
- TV Observation Codes
- Print Templates

### Map Preferences
- **WKID (Spatial Reference)** — default 3857 (Web Mercator), read-only after set
- **XY Precision** — 2-8 decimal places (default: 3)
- Map Feature Name / Field Name
- Tile No. Feature Name / Field Name
- Shop / District Feature Names and Fields
- Default District
- Max Records Returned through eURL
- Disable Map Image Generation
- Print Image Map Scale
- Map Image Buffer Distance (default: 2500 units)
- Map Image Output Pixel Size (Small 240x320 / Medium 480x640 / Large 720x960)

---

## Custom Codes

Custom codes populate dropdowns throughout the system. Organized by module:

**Code categories identified from the SDK (PWCodeType enum):**

| Code | Name | Used For |
|------|------|----------|
| WOSTATUS | WO Status | Work order status values |
| WORESO | WO Resolution | Work order resolution values |
| AWOCAT | WO Category | Work order categories |
| APRIORIT | Priority | Priority values (shared) |
| INSPSTAT | Inspection Status | Inspection status values |
| INSPRESO | Inspection Resolution | Inspection resolution values |
| SRSTATUS | SR Status | Service request status values |
| SRRESO | SR Resolution | Service request resolution values |
| SHOP | Shop | Shop/department values |
| ADISTRCT | District | District values |
| GLACCOUNT | GL Account | Accounting codes |
| ACREWCAT | Crew Category | Crew categories |
| AMATCAT | Material Category | Material categories |
| APROBCAT | Problem Category | Problem/request categories |
| ACALLTYP | Caller Type | Service request caller types |
| ACALLTITLE | Caller Title | Caller title values |
| TECHUSED | Technology Used | TV inspection technology |
| FLWCONTRL | Flow Control | TV inspection flow control |
| PACPINSTAT | PACP Inspection Status | PACP status codes |
| PIPEUSE | Pipe Use | Sewer/storm classification |
| SSHAPE | Pipe Shape | Pipe cross-section shape |
| SPIPEMT | Pipe Material | Pipe material types |
| STVREASN | TV Reason | Purpose of TV inspection |
| PRECLEAN | Pre-cleaning | Pre-cleaning status |
| WEATHER | Weather | Weather conditions |
| LOCATIONCODE | Location Code | Ground cover above pipe |
| SDAREA | Drainage Area | Drainage area codes |
| SLMETHOD | Lining Method | Pipe lining methods |
| CTMETHOD | Coating Method | Pipe coating methods |
| SMHPART | MH Part | Manhole structural parts |
| SACCESS | MH Access | Manhole access type |
| SBNCHMT | Bench Material | Manhole bench material |
| SCHANLMT | Channel Material | Manhole channel material |
| SCONEMT | Cone Material | Manhole cone material |
| SFRAMEMT | Frame Material | Manhole frame material |
| SLIDMT | Lid Material | Manhole lid material |
| SBRLMT | Barrel Material | Manhole barrel material |
| SRING | Ring Material | Manhole ring material |
| SSTEPMT | Step Material | Manhole step material |
| SMHTYPE | MH Type | Manhole subtype |
| SSURFC | Surface Type | Surface above asset |

## Description Scores

Description scores assign numeric scores to descriptions for standard inspections. Used for condition ratings.

**Score categories identified from the SDK:**

| Code | Used For |
|------|----------|
| SSPOT | Spot condition scoring |
| SGRNDCND | Ground condition scoring |
| SPRECIP | Precipitation scoring |
| SFLOW | Flow type scoring |
| SPONDCND | Ponding condition scoring |
| SMHCOND | Manhole condition scoring |
| SMHLKTYP | Manhole leak type scoring |
| SMHLKCAT | Manhole leak category scoring |

---

## Employees

Admin configures:
- Employee records (name, email, phone, login)
- Domain assignment
- Menu role assignment
- Group membership
- License assignment (which features they can access)
- Labor rates (hourly, overtime, holiday, benefit, overhead, standby, shift diff, other)
- Employee images

## Groups

- Groups define collections of employees
- Used for: labor assignment, security permissions, GIS access rights
- Employees can belong to multiple groups
- Highest access level wins when multiple group memberships conflict
- Group-level permissions control: View, Add, Update, Delete, View Cost for each entity type

## Domains

- A domain = a distinct organizational group with shared work activities and resources
- Single or multiple domains per installation
- Employees can be in multiple domains
- Each domain has its own: request templates, work order templates, employees, preferences, custom codes
- Domain isolation is their multi-tenancy approach

---

## GIS Configuration

Admin configures:
- Asset Groups and Types (how assets are organized)
- GIS Services (Esri ArcGIS service connections)
- Asset Aliases (alternative names for asset types)
- Spatial Reference (WKID)
- Map Feature/Field mappings

---

## What This Means for Our Platform

### Should Be Configurable (per tenant)
- Work order status values (Open, In Progress, Closed, Cancelled — but let tenants rename/add)
- Priority values
- Resolution values
- Inspection status values
- Custom codes for sewer inspections (pipe material, manhole parts, etc.)
- Description scores for condition ratings

### Can Be Hardcoded for MVP
- Template system — start simple, one "Sign Replacement" template, one "Sign Inspection" template
- Work order fields — fixed set, not per-template customization
- Roles — Admin, Supervisor, Field Worker, Viewer (not per-group granular permissions)
- Map configuration — PostGIS + MapLibre, no Esri service config needed
- Domain/multi-tenancy — tenant_id, not the complex domain system
- Custom fields — JSONB instead of TEXT1-20 with admin-configured labels

### Key Simplification Opportunities
1. **No template classes** — our asset types are purpose-built (signs, pipes, manholes), not generic
2. **No branch/linear question system** — simpler inspection forms
3. **No custom field category mapping** — JSONB handles this natively
4. **No print template system** — PDF export with standard templates
5. **No per-group advanced permissions** — 4 roles with module-level access
6. **No Esri GIS configuration** — direct PostGIS eliminates all map service setup

---

*Extracted from Cityworks Designer Office Companion 23 Guide — March 18, 2026*
