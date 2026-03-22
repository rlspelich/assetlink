# Cityworks 23.14.1 Schema Analysis
> Extracted from compiled installer — March 18, 2026
> Source: `/Users/robertspelich/Downloads/Cityworks 23.14.1 Host Installer`

---

## Overview

The Cityworks 23.14.1 database schema was extracted from `SqlSchema.dat` — a JSON file containing the complete SQL Server schema definition with every table, column, data type, primary key, and constraint.

- **Total tables: 800**
- **Database version: V20260001**
- **Supports: SQL Server, Oracle, PostgreSQL (Npgsql)**

---

## Table Categories

| Category | Count | Notes |
|----------|-------|-------|
| Cases/Permits | 118 | Largest group — permit lifecycle, fees, payments, licensing |
| Work Orders | 53 | Core operational module |
| Inspections | 52 | Template-driven, includes sewer-specific (CCTV, manhole) |
| Configuration/Admin | 51 | Settings, preferences, roles, templates |
| Employees/Users | 46 | Complex role/permission hierarchy with domain scoping |
| Equipment/Materials | 35 | Inventory, cost tracking, checkout system |
| Billing/Cost | 28 | Fee types, payments, deposits, escrow |
| GIS/Map | 24 | Esri ArcGIS service integration, layer config |
| Notifications | 24 | Event-driven, role-based notification system |
| Assets | 22 | Generic asset registry with history and readings |
| Reporting | 10 | Report templates, data sources, print preferences |
| Sewer (TV/Manhole) | 2 | Observation coding tables (NASSCO) |
| Other | 335 | Contractors, projects, problems, requests, dashboards, etc. |

---

## Key Tables — Full Column Details

### WORKORDER (130+ columns)

```
PK: WORKORDERID (nvarchar(60))

Core Fields:
  WORKORDERSID                bigint        NOT NULL (surrogate key)
  DESCRIPTION                 nvarchar(60)  NULL
  STATUS                      nvarchar(50)  NULL
  PRIORITY                    nvarchar(2)   NULL
  WOCATEGORY                  nvarchar(50)  NULL
  ASSETGROUP                  nvarchar(50)  NULL

Location:
  LOCATION                    nvarchar(256) NULL
  WOADDRESS                   nvarchar(130) NULL
  WOXCOORDINATE               decimal       NULL
  WOYCOORDINATE               decimal       NULL
  WOZCOORDINATE               decimal       NULL
  STREETNAME                  nvarchar(50)  NULL
  MAPPAGE                     nvarchar(100) NULL
  TILENO                      nvarchar(100) NULL
  DISTRICT                    nvarchar(50)  NULL
  FACILITY_ID                 nvarchar(256) NULL
  LEVEL_ID                    nvarchar(256) NULL

People:
  SUPERVISOR                  nvarchar(100) NULL
  SUPERVISORSID               int           NULL
  REQUESTEDBY                 nvarchar(100) NULL
  REQUESTEDBYSID              int           NULL
  INITIATEDBY                 nvarchar(100) NULL
  INITIATEDBYSID              int           NULL
  WORKCOMPLETEDBY             nvarchar(100) NULL
  WORKCOMPLETEDBYSID          int           NULL
  WOCLOSEDBY                  nvarchar(100) NULL
  CLOSEDBYSID                 int           NULL
  CANCELLEDBY                 nvarchar(100) NULL
  CANCELLEDBYSID              int           NULL

Submit-To Workflow:
  SUBMITTO                    nvarchar(100) NULL
  SUBMITTOSID                 int           NULL
  DATESUBMITTO                datetime      NULL
  SUBMITTOOPENBY              nvarchar(100) NULL
  SUBMITTOOPENBYSID           int           NULL
  DATESUBMITTOOPEN            datetime      NULL

Dates:
  INITIATEDATE                datetime      NULL
  PROJSTARTDATE               datetime      NULL
  PROJFINISHDATE              datetime      NULL
  ACTUALSTARTDATE             datetime      NULL
  ACTUALFINISHDATE            datetime      NULL
  DATEWOCLOSED                datetime      NULL
  DATECANCELLED               datetime      NULL
  SCHEDULEDATE                datetime      NULL
  DATETOBEPRINTED             datetime      NULL
  DATEPRINTED                 datetime      NULL

Costs:
  WOCOST                      decimal       NULL (total)
  WOLABORCOST                 decimal       NULL
  WOMATCOST                   decimal       NULL
  WOEQUIPCOST                 decimal       NULL
  WOPERMITCOST                decimal       NULL
  LINEITEMCOST                decimal       NULL
  ACCTNUM                     nvarchar(50)  NULL
  EXPENSETYPE                 nvarchar(20)  NULL

Cycle/Recurring:
  CYCLETYPE                   nvarchar(1)   NULL
  CYCLEINTERVALNUM            decimal       NULL
  CYCLEINTERVALUNIT           nvarchar(1)   NULL
  CYCLEFROM                   nvarchar(30)  NULL
  FROMDATE                    datetime      NULL
  CREATEDBYCYCLE              nvarchar(1)   NULL

Contractor:
  CONTRACTORSID               decimal       NULL
  CONTRACTWOID                nvarchar(30)  NULL
  LEGALBILLABLE               nvarchar(1)   NULL
  CONTRBILLABLE               nvarchar(1)   NULL
  PRIMARYCONTRACTID           int           NULL

Custom Fields:
  TEXT1 through TEXT20        nvarchar(100) NULL
  NUM1 through NUM5           decimal       NULL
  DATE1 through DATE5         datetime      NULL
  CUSTOM1, CUSTOM2            decimal       NULL
  CUSTOM3, CUSTOM4            nvarchar(20)  NULL
  CUSTOM5                     nvarchar(40)  NULL

Other:
  CANCEL                      nvarchar(1)   NULL
  CANCELREASON                nvarchar(100) NULL
  RESOLUTION                  nvarchar(100) NULL
  EFFORT                      decimal       NOT NULL DEFAULT 0.0
  UNITSACCOMPLISHED           decimal       NULL
  UNITSACCOMPDESC             nvarchar(40)  NULL
  ISREACTIVE                  nvarchar(1)   NULL
  ACTIVITYZONE                nvarchar(50)  NULL
  GUID                        nvarchar(50)  NULL
  INITIATEDBYAPP              nvarchar(50)  NOT NULL DEFAULT 'INTERNAL'
  DOMAINID                    decimal       NULL
  PROJECTSID                  decimal       NULL
  PROJECTPHASEID              int           NULL
  PERFORMANCEBUDGETID         int           NULL
  SHOP                        nvarchar(100) NULL
  STAGE                       nvarchar(20)  NULL
  APPLYTOENTITY               nvarchar(50)  NULL
  WOTEMPLATEID                nvarchar(20)  NULL
  SOURCEWOID                  nvarchar(20)  NULL
  UPDATEMAP                   nvarchar(1)   NULL
  UNATTACHED                  nvarchar(1)   NULL
  WOCUSTFIELDCATID            decimal       NULL
```

### WORKORDERENTITY (links work orders to assets)

```
PK: OBJECTID (decimal)
  WORKORDERID                 nvarchar(60)  NOT NULL
  WORKORDERSID                bigint        NOT NULL
  ENTITYUID                   nvarchar(50)  NOT NULL
  ENTITYTYPE                  nvarchar(50)  NOT NULL
  ENTITYSID                   decimal       NULL
  FEATURE_ID                  decimal       NULL
  FEATURE_TYPE                nvarchar(50)  NULL
  FEATUREUID                  nvarchar(50)  NULL
  LOCATION                    nvarchar(256) NULL
  ADDRESS                     nvarchar(256) NULL
  LEGACYID                    nvarchar(50)  NULL
  WARRANTYDATE                datetime      NULL
  WORKCOMPLETED               nvarchar(2)   NULL
  SEQUENCE                    decimal       NULL
  X                           decimal       NULL
  Y                           decimal       NULL
  Z                           decimal       NULL
  TILENO                      nvarchar(100) NULL
  FACILITY_ID                 nvarchar(256) NULL
  LEVEL_ID                    nvarchar(256) NULL
```

### WORKORDERIMG (attachments)

```
PK: ID (int)
  WORKORDERID                 nvarchar(60)  NOT NULL
  WORKORDERSID                bigint        NOT NULL
  WOTASKID                    decimal       NULL
  IMAGEPATH                   nvarchar(250) NOT NULL
  ATTACHEDBY                  nvarchar(100) NULL
  ATTACHEDBYSID               int           NULL
  COMMENTS                    nvarchar(256) NULL
  DATETIMEATTACHED            datetime      NULL
  TITLE                       nvarchar(100) NULL
  DESCRIPTION                 nvarchar(256) NULL
  ATTACHMENTTYPE              nvarchar(50)  NOT NULL DEFAULT 'ATTACHMENT'
```

### WORKORDERCOMMENT

```
PK: COMMENTID (int)
  WORKORDERID                 nvarchar(60)  NULL
  WORKORDERSID                bigint        NOT NULL
  AUTHORSID                   int           NOT NULL
  COMMENTS                    nvarchar(MAX) NOT NULL
  DATECREATED                 datetime      NOT NULL
  LASTMODIFIED                datetime      NOT NULL
  LASTMODIFIEDBYSID           int           NOT NULL
  ISPUBLIC                    bit           NOT NULL DEFAULT 0
```

### WORKORDERCOSTSUMMARY

```
PK: ASSETID, ASSETTYPE, WORKORDERID
  WORKORDERSID                bigint        NOT NULL
  ASSETID                     nvarchar(50)  NOT NULL
  ASSETTYPE                   nvarchar(50)  NOT NULL
  ASSETGROUP                  nvarchar(50)  NULL
  WOCATEGORY                  nvarchar(50)  NULL
  ACTIVITYTYPE                nvarchar(60)  NULL
  STARTDATE                   datetime      NULL
  CLOSEDATE                   datetime      NULL
  TOTALHOURS                  decimal       NULL
  LABORCOST                   decimal       NULL
  MATERIALCOST                decimal       NULL
  EQUIPMENTCOST               decimal       NULL
  LINEITEMCOST                decimal       NULL
```

---

### INSPECTION (generic, template-driven)

```
PK: INSPECTIONID (decimal)
  WORKORDERID                 nvarchar(60)  NULL
  INSPTEMPLATEID              decimal       NOT NULL
  INSPTEMPLATENAME            nvarchar(30)  NULL
  ENTITYUID                   nvarchar(50)  NULL
  ENTITYTYPE                  nvarchar(50)  NULL
  ENTITYSID                   int           NULL
  FEATUREUID                  nvarchar(50)  NULL
  FEATUREID                   int           NULL
  FEATURETYPE                 nvarchar(50)  NULL

  STATUS                      nvarchar(50)  NULL
  PRIORITY                    nvarchar(50)  NULL
  CONDRATING                  decimal       NULL
  CONDSCORE                   decimal       NULL
  RESOLUTION                  nvarchar(100) NULL

  INSPDATE                    datetime      NULL
  INSPECTEDBY                 nvarchar(100) NULL
  INSPECTEDBYSID              int           NULL
  LOCATION                    nvarchar(256) NULL
  STREETNAME                  nvarchar(50)  NULL
  INSPX                       decimal       NULL
  INSPY                       decimal       NULL
  INSPZ                       decimal       NULL

  OBSERVATIONSUM              nvarchar(900) NULL
  REPAIRSMADE                 nvarchar(900) NULL
  FOREMANRECOMND              nvarchar(900) NULL

  PRJSTARTDATE                datetime      NULL
  PRJFINISHDATE               datetime      NULL
  ACTFINISHDATE               datetime      NULL
  DATECLOSED                  datetime      NULL
  CLOSEDBY                    nvarchar(100) NULL
  CLOSEDBYSID                 int           NULL

  CANCEL                      bit           NULL
  DATECANCELLED               datetime      NULL
  CANCELLEDBY                 nvarchar(100) NULL
  CANCELLEDBYSID              int           NULL
  CANCELREASON                nvarchar(100) NULL

  INITIATEDBY                 nvarchar(100) NULL
  INITIATEDBYSID              int           NULL
  INITIATEDATE                datetime      NULL
  INITIATEDBYAPP              nvarchar(50)  NOT NULL DEFAULT 'INTERNAL'

  Cycle/Recurring:
  CYCLETYPE                   nvarchar(20)  NULL
  CYCLEFROM                   nvarchar(30)  NULL
  CYCLEINTERVALNUM            int           NULL
  CYCLEINTERVALUNIT           nvarchar(1)   NULL
  CREATEDBYCYCLE              bit           NOT NULL DEFAULT 0
  FROMDATE                    datetime      NULL
  PARENTINSPID                int           NULL

  SUBMITTOEMPLOYEESID         decimal       NULL
  SUBMITTONAME                nvarchar(100) NULL
  DATESUBMITTO                datetime      NULL
  EFFORT                      decimal       NOT NULL DEFAULT 0.0

  DOMAINID                    int           NULL
  SHOP                        nvarchar(100) NULL
  MAPPAGE                     nvarchar(100) NULL
  TILENO                      nvarchar(50)  NULL
  DISTRICT                    nvarchar(50)  NULL

  Custom Fields:
  TEXT1 through TEXT10        nvarchar(100) NULL
  NUM1 through NUM5           decimal       NULL
  DATE1 through DATE5         datetime      NULL

  REQUESTID                   int           NULL
  CLOSESR                     bit           NULL
  UPDATEMAP                   nvarchar(1)   NULL
  FACILITY_ID                 nvarchar(256) NULL
  LEVEL_ID                    nvarchar(256) NULL
  PROJECTSID                  decimal       NULL
  PROJECTPHASEID              int           NULL
  METADATA                    nvarchar(MAX) NULL
```

### STVINSPECTION (CCTV Sewer Pipe Inspection — NASSCO PACP aligned)

```
PK: TVID (decimal)
  WORKORDERID                 nvarchar(60)  NULL
  WORKORDERSID                bigint        NULL

Pipe Identity:
  PIPE_ID                     nvarchar(50)  NULL
  PIPE_TYPE                   nvarchar(50)  NULL
  PIPE_LENGTH                 decimal       NULL
  DIAMETER                    decimal       NULL
  WIDTH                       decimal       NULL
  SHAPE                       nvarchar(15)  NULL
  MATERIAL                    nvarchar(64)  NULL
  JOINT_LENGTH                decimal       NULL
  JOINT_TYPE                  nvarchar(20)  NULL
  LININGMETHOD                nvarchar(30)  NULL
  COATING_METHOD              nvarchar(50)  NULL

Manhole References:
  UP_MH                       nvarchar(50)  NULL
  UP_TYPE                     nvarchar(50)  NULL
  UP_LOCATION                 nvarchar(100) NULL
  UP_DEPTH                    decimal       NULL
  DOWN_MH                     nvarchar(50)  NULL
  DOWN_TYPE                   nvarchar(50)  NULL
  DOWN_LOCATION               nvarchar(100) NULL
  DWN_DEPTH                   decimal       NULL
  RIMTOINVERTU                decimal       NULL
  RIMTOGRADEU                 decimal       NULL
  RIMTOINVERTD                decimal       NULL
  RIMTOGRADED                 decimal       NULL

Elevations/Coordinates:
  UP_EASTING                  nvarchar(50)  NULL
  UP_ELEVATION                nvarchar(50)  NULL
  UP_NORTHING                 nvarchar(50)  NULL
  DOWN_EASTING                nvarchar(50)  NULL
  DOWN_ELEVATION              nvarchar(50)  NULL
  DOWN_NORTHING               nvarchar(50)  NULL
  X                           decimal       NULL
  Y                           decimal       NULL
  Z                           decimal       NULL
  VERTICAL_DATUM              nvarchar(50)  NULL
  MH_COORDINATE_SYSTEM        nvarchar(50)  NULL

Inspection Details:
  TVDATE                      datetime      NULL
  TVREASON                    nvarchar(100) NULL
  INSPECTED_BY                nvarchar(50)  NULL
  INSPECTEDBYSID              int           NULL
  TOTAL_LENGTH                decimal       NULL
  FLOW_DEPTH                  decimal       NULL
  LOCATION                    nvarchar(256) NULL
  MAP_NUMBER                  nvarchar(14)  NULL
  SURFACE_TYPE                nvarchar(20)  NULL
  REVERSESETUP                nvarchar(1)   NULL
  REVERSE_SETUP_FLAG          int           NULL
  OBSERVMETHOD                nvarchar(20)  NULL
  INSPECTION_TECHNOLOGY_USED  nvarchar(50)  NULL
  INSPECTION_STATUS           nvarchar(50)  NULL
  ISIMPERIAL                  nvarchar(1)   NULL
  PRESSURE_VALUE              decimal       NULL

Video/Media:
  MASTERTAPENUM               nvarchar(30)  NULL
  VIDEOTAPENUM                nvarchar(30)  NULL
  TAPELIBRARYNUM              nvarchar(30)  NULL
  VTRFORMAT                   nvarchar(20)  NULL
  COUNTERSTART                nvarchar(20)  NULL
  COUNTERSTOP                 nvarchar(20)  NULL
  VIDEOLOCATION               nvarchar(255) NULL

Conditions/Ratings:
  CONDRATING                  decimal       NULL
  HYDRATING                   decimal       NULL
  STRUCTRATING                decimal       NULL
  OMRATING                    decimal       NULL
  ROOTRATING                  decimal       NULL
  DETERIORATION               nvarchar(30)  NULL
  DETERSCORE                  decimal       NULL
  SPOT                        nvarchar(30)  NULL
  SPOTSCORE                   decimal       NULL
  GROUNDCOND                  nvarchar(30)  NULL
  GROUNDCONDSCORE             decimal       NULL
  PRECIP_TYPE                 nvarchar(30)  NULL
  PRECIP_TYPESCORE            decimal       NULL
  CONSEQUENCE_OF_FAILURE      nvarchar(50)  NULL

Pipe History:
  YEARLAID                    decimal       NULL
  YEARRENEWED                 decimal       NULL
  SEWERCATEGORY               nvarchar(2)   NULL
  SEWERUSE                    nvarchar(15)  NULL
  FLOWCONTROL                 nvarchar(25)  NULL
  PRECLEANING                 nvarchar(15)  NULL
  DATECLEANED                 datetime      NULL
  REHABSTATUS                 nvarchar(50)  NULL
  DRAINAGEAREA                nvarchar(15)  NULL

NASSCO/Certification:
  CERTIFICATENUMBER           nvarchar(15)  NULL
  REVIEWER_CERTIFICATE_NUMBER nvarchar(50)  NULL
  REVIEWEDBYSID               int           NULL

Project/Admin:
  OWNER                       nvarchar(30)  NULL
  CUSTOMER                    nvarchar(30)  NULL
  PONUMBER                    nvarchar(15)  NULL
  PROJECT                     nvarchar(100) NULL
  STREET                      nvarchar(64)  NULL
  CITY                        nvarchar(64)  NULL

Text/Notes:
  OBSERVATIONSUM              nvarchar(250) NULL
  REPAIRSMADE                 nvarchar(250) NULL
  FOREMANRECOMND              nvarchar(250) NULL
  SUPERAPRVLCOMNTS            nvarchar(250) NULL

Custom Fields:
  TEXT1 through TEXT10        nvarchar(100) NULL
  NUM1 through NUM5           decimal       NULL
  DATE1 through DATE5         datetime      NULL

Other:
  INSPCUSTFIELDCATID          decimal       NULL
  UPDATEMAP                   nvarchar(1)   NULL
  DYEID                       decimal       NULL
  SMOKEID                     decimal       NULL
  LOCATION_CODE               nvarchar(1)   NULL
  LOCATION_DETAILS            nvarchar(256) NULL
  WEATHER                     nvarchar(1)   NULL
  GPS_ACCURACY                nvarchar(50)  NULL
  INITIATEDBYAPP              nvarchar(100) NULL DEFAULT 'INTERNAL'
```

### SMANHOLEINSP (Manhole Inspection — NASSCO MACP aligned)

```
PK: INSPECTIONID (decimal)
  WORKORDERID                 nvarchar(60)  NULL
  WORKORDERSID                bigint        NULL
  FACILITY_ID                 nvarchar(50)  NULL
  FEATURE_TYPE                nvarchar(50)  NULL

Inspection:
  INSPDATE                    datetime      NULL
  INSPECTED_BY                nvarchar(50)  NULL
  INSPECTEDBYSID              int           NULL
  MAP_NUMBER                  nvarchar(14)  NULL
  LOCATION                    nvarchar(256) NULL
  XCOORDINATE                 decimal       NULL
  YCOORDINATE                 decimal       NULL
  ZCOORDINATE                 decimal       NULL

Physical Characteristics:
  ACCESS_TYPE                 nvarchar(20)  NULL
  BARREL_DIAM                 decimal       NULL
  LID_DIAMETER                decimal       NULL
  MH_LENGTH                   decimal       NULL
  MH_WIDTH                    decimal       NULL
  DEPTH                       decimal       NULL

Materials (7 separate fields):
  MH_MATERIAL                 nvarchar(20)  NULL
  LID_MATERIAL                nvarchar(20)  NULL
  STEP_MATERIAL               nvarchar(20)  NULL
  BENCH_MATERIAL              nvarchar(20)  NULL
  CHANNEL_MATERIAL            nvarchar(20)  NULL
  RING_MATERIAL               nvarchar(20)  NULL
  FRM_MATERIAL                nvarchar(20)  NULL
  CONE_MATERIAL               nvarchar(20)  NULL
  SUB_TYPE                    nvarchar(20)  NULL

Conditions/Ratings:
  CONDRATING                  decimal       NULL
  HYDRATING                   decimal       NULL
  STRUCTRATING                decimal       NULL
  DISTTOHYDRANT               decimal       NULL
  SPOT                        nvarchar(30)  NULL
  SPOTSCORE                   decimal       NULL
  GROUNDCOND                  nvarchar(30)  NULL
  GROUNDCONDSCORE             decimal       NULL
  PRECIP_TYPE                 nvarchar(30)  NULL
  PRECIP_TYPESCORE            decimal       NULL
  FLOWTYPE                    nvarchar(30)  NULL
  FLOWTYPESCORE               decimal       NULL
  PONDING                     nvarchar(30)  NULL
  PONDINGSCORE                decimal       NULL
  SURFACE_TYPE                nvarchar(20)  NULL

Measurements:
  TRIBAREA                    decimal       NULL
  DEPTHOFSURCHRG              decimal       NULL
  DEPTHOFDEBRIS               decimal       NULL
  DEPTHOFFLOW                 decimal       NULL

Notes:
  OBSERVATIONSUM              nvarchar(250) NULL
  REPAIRSMADE                 nvarchar(250) NULL
  FOREMANRECOMND              nvarchar(250) NULL
  SUPERAPRVLCOMNTS            nvarchar(250) NULL

Custom Fields:
  TEXT1 through TEXT10        nvarchar(100) NULL
  NUM1 through NUM5           decimal       NULL
  DATE1 through DATE5         datetime      NULL
```

### SPIPEINMANHOLE (Pipes entering a manhole)

```
PK: INSPECTIONID, PIPEINMHID
  PIPE_ID                     nvarchar(50)  NULL
  PIPE_TYPE                   nvarchar(50)  NULL
  PIPE_DEPTH                  decimal       NULL
  PIPE_ELEV                   decimal       NULL
  DIAMETER                    decimal       NULL
  PIPE_DIRECTION              nvarchar(20)  NULL
  MATERIAL                    nvarchar(20)  NULL
  INOUT                       nvarchar(1)   NULL
  DROPCONNECTION              nvarchar(1)   NULL
  BYPASSPIPE                  nvarchar(1)   NULL
  FLOW_DEPTH                  decimal       NULL
  PIPECOND                    nvarchar(30)  NULL
  PIPECONDSCORE               decimal       NULL
  ESTPIPEIANDI                decimal       NULL
```

---

### CWASSET (Generic Asset Registry)

```
PK: ASSETCLASS, ASSETID
  ASSETCLASS                  nvarchar(100) NOT NULL
  ASSETID                     nvarchar(50)  NOT NULL
  ASSETOBJECTID               int           NULL
  FEATURECLASS                nvarchar(200) NULL
  FEATUREASSETID              nvarchar(100) NULL
  FEATUREOBJECTID             int           NULL
  LEGACYID                    nvarchar(200) NULL
  LOCATION                    nvarchar(512) NULL
  WARRANTYDATE                datetime      NULL
  X                           decimal       NULL
  Y                           decimal       NULL
  Z                           decimal       NULL
  CWASSETID                   int           NOT NULL DEFAULT 0
```

### EMPLOYEE

```
PK: EMPLOYEESID (decimal)
  EMPLOYEEID                  nvarchar(15)  NULL
  FIRSTNAME                   nvarchar(50)  NULL
  MIDDLEINITIAL               nvarchar(2)   NULL
  LASTNAME                    nvarchar(50)  NOT NULL
  TITLE                       nvarchar(40)  NULL
  PAGER                       nvarchar(24)  NULL
  WORKPHONE                   nvarchar(24)  NULL
  EMAIL                       nvarchar(256) NULL
  LOGINNAME                   nvarchar(256) NULL

  Cost Rates:
  HOURLYRATE                  decimal       NULL
  OVERTIMEFACTOR/TYPE/RATE    (3 fields)
  HOLIDAYFACTOR/TYPE/RATE     (3 fields)
  BENEFITTYPE/RATE            (2 fields)
  STANDBYTYPE/RATE            (2 fields)
  SHIFTDIFFTYPE/RATE          (2 fields)
  OTHERRATETYPE/RATE          (2 fields)
  OVERHEADTYPE/RATE           (2 fields)

  CUSTOM1-5                   (mixed types)
  ISACTIVE                    nvarchar(1)   NULL
  DOMAINID                    decimal       NULL
  ORGANIZATION                nvarchar(50)  NULL
  PASSWORD                    nvarchar(30)  NULL  ← plaintext password field!
  MAPSERVICEID                int           NULL
  ADDOMAIN                    nvarchar(50)  NULL
  MOBILEMAPCACHEID            int           NULL
  UNIQUENAME                  nvarchar(100) NULL
```

### USERS

```
PK: USER_ID (decimal)
  LOGIN_ID                    nvarchar(80)  NOT NULL
  FIRST_NAME                  nvarchar(40)  NOT NULL
  LAST_NAME                   nvarchar(40)  NULL
  MIDDLE_NAME                 nvarchar(40)  NULL
  EMAIL_ID                    nvarchar(256) NULL
  PHONE_HOME/WORK/MOBILE/FAX  (5 fields)
  ADDRESS_LINE1/2/3           nvarchar(60)  NULL
  CITY_NAME                   nvarchar(60)  NULL
  STATE_CODE                  nvarchar(2)   NULL
  ZIP_CODE                    nvarchar(15)  NULL
  COUNTRY_CODE                nvarchar(3)   NULL
  DATE_START                  datetime      NULL
  DATE_END                    datetime      NULL
  PASSWORD                    nvarchar(256) NULL
  DEPARTMENT_ID               decimal       NULL
  DIVISION_ID                 decimal       NULL
  DEFAULT_ORG_ID              decimal       NULL

  Flags:
  VOID_ALLOWED_FLAG           nvarchar(1)   DEFAULT 'N'
  EXTERNAL_USER_FLAG          nvarchar(1)   DEFAULT 'N'
  EXPIRED_FLAG                nvarchar(1)   DEFAULT 'N'
  INTERNAL_USER_FLAG          nvarchar(1)   DEFAULT 'Y'
  PA_ADMIN_FLAG               nvarchar(1)   DEFAULT 'N'
  CONTRACTOR_ADMIN_FLAG       nvarchar(1)   DEFAULT 'N'

  DATE_EXPIRED                datetime      NULL
  CREATED_BY                  decimal       NOT NULL
  DATE_CREATED                datetime      NOT NULL
  MODIFIED_BY                 decimal       NULL
  DATE_MODIFIED               datetime      NULL
```

---

## Key Patterns Observed

### 1. Custom Fields Pattern (TEXT1-20, NUM1-5, DATE1-5)
Used on WORKORDER, INSPECTION, STVINSPECTION, SMANHOLEINSP. Allows customer-configurable fields without schema changes. **Our approach:** Use JSONB columns instead for flexibility without fixed column limits.

### 2. Template-Driven Inspections
`INSPTEMPLATEID` and `INSPTEMPLATENAME` on INSPECTION table. Inspection types are configurable via templates, not hardcoded. Templates define questions, panels, asset fields, priorities, and group rights.

### 3. Cycle/Recurring Scheduling
Both WORKORDER and INSPECTION support recurring work via:
- `CYCLETYPE` — type of cycle
- `CYCLEINTERVALNUM` — interval count
- `CYCLEINTERVALUNIT` — D/W/M/Y
- `CYCLEFROM` — starting point
- `CREATEDBYCYCLE` — flag if auto-generated

### 4. Dual ID Pattern
Many tables carry both a human-readable ID (e.g., `WORKORDERID nvarchar(60)`) and a surrogate numeric key (e.g., `WORKORDERSID bigint`). This is a legacy migration artifact. **Our approach:** UUID primary keys only.

### 5. Domain-Based Multi-Tenancy
`DOMAINID` appears on many tables — this is Cityworks' tenant isolation mechanism. Similar to our planned `tenant_id` approach.

### 6. Submit-To Workflow
Work orders have a two-stage approval: submit-to (review) and submit-to-open (approve). Tracked with person SID, name, and date for each stage.

### 7. Cost Tracking (6+ tables per cost type)
Labor, material, equipment costs each have ACT (actual), PRJ (projected), and TMP (template) tables, plus detail tables. **Our approach:** Simplify to single cost tracking with type field.

### 8. GIS Integration via Esri Services
`GISSERVICEENDPOINT` stores Esri ArcGIS service URLs with OAuth credentials. `GISSERVICEASSET` maps asset types to GIS layers. **Our approach:** Direct PostGIS + MapLibre, no external GIS dependency.

### 9. NASSCO Compliance Built Into Schema
STVINSPECTION has PACP-aligned fields (structural/hydro/O&M ratings, certificate numbers, reviewer certification). SMANHOLEINSP has MACP-aligned fields. Separate observation coding tables (STVOBSERVATION, STVOBSRV_DCT).

### 10. Separate Employee and User Tables
EMPLOYEE handles operational data (rates, crews, skills). USERS handles authentication/authorization (login, roles, permissions). Many-to-many relationship implied.

---

## Anti-Patterns to Avoid

1. **Plaintext password field** on EMPLOYEE table (`PASSWORD nvarchar(30)`)
2. **Boolean as nvarchar(1)** — 'Y'/'N' instead of bit/boolean
3. **Dual ID columns** — both string and numeric IDs on same table
4. **20 custom text fields** — fixed TEXT1-TEXT20 instead of flexible JSONB
5. **Name duplication** — storing both `SUPERVISORSID` and `SUPERVISOR` (name string) on same row
6. **6 cost tables per cost type** — actual/projected/template × header/detail
7. **No enforced FK constraints** — relationships implied but not enforced at DB level
8. **Decimal for boolean** — using `decimal` for flag values
9. **nvarchar(1) for enums** — single character codes instead of proper enums
10. **Separate XY columns** — `X decimal, Y decimal` instead of geometry type

---

## Relevance to Our Platform

### Tables to Learn From
| Cityworks Table | Our Equivalent | Key Learnings |
|----------------|---------------|---------------|
| WORKORDER | work_order | Status workflow, priority, cost tracking, cycle scheduling |
| INSPECTION | inspection | Template-driven, condition ratings, observation/repair/recommendation |
| STVINSPECTION | sewer_pipe_inspection | NASSCO PACP fields, up/down manhole refs, video tracking |
| SMANHOLEINSP | manhole_inspection | NASSCO MACP fields, material tracking (8 material fields) |
| SPIPEINMANHOLE | manhole_pipe | Pipe connections at manholes with depth/elevation/flow |
| CWASSET | asset (base) | Generic asset registry pattern |
| EMPLOYEE | app_user | Role, skills, organizational hierarchy |
| GISSERVICEASSET | (not needed) | We use PostGIS directly, no external GIS service mapping |
| WORKORDERENTITY | work_order_asset | Many-to-many WO↔asset relationship |
| WORKORDERIMG | attachment | Photo/document attachments with metadata |

### What We're Building Differently
1. **PostGIS geometry** instead of X/Y decimal columns
2. **UUID primary keys** instead of dual string/int IDs
3. **JSONB custom fields** instead of TEXT1-20
4. **4 simple roles** instead of complex role/domain/group hierarchy
5. **~30-50 tables** instead of 800
6. **MapLibre + PostGIS** instead of Esri ArcGIS service dependency
7. **Modern auth (Auth0/Clerk)** instead of plaintext passwords
8. **Boolean columns** instead of nvarchar(1) 'Y'/'N'

---

---

## Cityworks 23.14.1 SDK Analysis

> Source: `/Users/robertspelich/Downloads/Cityworks 23.14.1 SDK`
> SDK Version: 19.80.5 (Azteca Systems, LLC / Trimble)
> Available in: Python, TypeScript v1, TypeScript v2, C#

### SDK Architecture

The SDK is auto-generated from the Cityworks API and organized into four service domains:

```
Services
├── AMS (Asset Management System)    — 747 API methods
├── PLL (Permits, Licenses, Land)    — ~200 API methods
├── GIS (Geographic Info Systems)    — ~20 API methods
└── General (Auth, Search, Config)   — ~80 API methods
```

### AMS API — Methods by Controller (747 total)

| Controller | Methods | Description |
|-----------|---------|-------------|
| WorkOrder | 51 | Create, update, close, cancel, search, costs, cycle scheduling |
| Entity | 49 | Asset registry CRUD, hierarchy, configuration, cost history |
| Designer | 45 | Admin: domains, groups, roles, users, codes, CCTV codes |
| ServiceRequest | 39 | Citizen service request lifecycle |
| Inspection | 38 | Generic inspection CRUD, templates, questions, answers |
| Contract | 37 | Contract lifecycle, invoices, line items, subcontractors |
| Relates | 36 | Cross-entity relationships |
| Storeroom | 29 | Inventory management, stock, transactions |
| TvInspection | 27 | CCTV pipe inspection, observations, PACP |
| Search | 22 | Saved searches, definitions, execution |
| ManholeInspection | 22 | Manhole inspection, images, pipe observations |
| Inbox | 21 | User task inbox |
| Security | 20 | Permissions, rights |
| EquipmentChangeOut | 19 | Equipment swap tracking |
| Attachments | 19 | File attachments for all entity types |
| Projects | 18 | Capital project management |
| Material | 15 | Materials catalog |
| PavementInspection | 14 | Pavement condition assessment |
| Employee | 13 | Employee management |
| UniversalCustomField | 12 | Custom field definitions |
| Tasks | 12 | Work order task management |
| LaborCost | 11 | Labor time tracking |
| WorkOrderTemplate | 10 | WO template management |
| WorkOrderEntity | 6 | WO-to-asset linking |
| Reading | 4 | Asset meter readings |
| Condition | 2 | Condition history |

### Key API Patterns

**1. Standard CRUD Pattern:**
Every controller follows: `Create`, `Update`, `Delete`, `ById/ByIds`, `Search`, `All`

**2. Authentication:**
```python
services = cwpy.Services()
services.url = 'https://cityworks.example.com/cityworks'
services.authenticate('username', 'password')
# Token-based auth, token passed with every request
```

**3. Request/Response Pattern:**
```python
# All methods accept a request dict and return a response dict
response = services.ams.WorkOrder_create(request_dict)
# response['Status'] == 0 means success
# response['Value'] contains the result
```

**4. Search Pattern:**
```python
# Paged search with filters
request = {
    'Limit': 50,
    'Offset': 0,
    'SortField': 'DateInitiated',
    'SortDir': 1  # DESC
}
```

### Key Enums (Domain Values)

**Work Order Status Codes (PWCodeType.WOSTATUS):**
Configurable per installation — not hardcoded

**Inspection Types (StandardInspTableName):**
```
SDYETEST          — Dye test
SMANHOLEINSP      — Manhole inspection (MACP)
SSMOKETEST        — Smoke test
STVINSPECTION     — TV/CCTV pipe inspection (PACP)
WFIREHYDFLOWTEST  — Fire hydrant flow test
EQUIPCHANGEOUT    — Equipment changeout
WVALVDEVINSP      — Water valve inspection
WHYDDEVINSP       — Water hydrant inspection
SSTINLETINSP      — Storm inlet inspection
```

**Work Types:**
```
WORKORDER, INSPECTION, REQUEST, ALL
```

**Priority Levels:** Configurable, not enum-constrained

**Cost Types:**
```
Actual, Projected, Template, Reported
```

**Repeat/Cycle:**
```
RepeatType:         NEVER, ONCE, EVERY
RepeatIntervalUnit: D (day), W (week), M (month), Y (year)
RepeatFromDate:     ADATE, PROJSTARTDATE, ACTUALFINISHDATE
```

**Licensed Features (what modules require licenses):**
```
ViewInspections, EditInspections
ViewServiceRequest, EditServiceRequest
ViewWorkOrder, EditWorkOrder
EquipmentCheckOut, Storeroom, Contracts
CCTVInterface, PLL (Permits)
MobileAndroid, MobileiOS
PerformanceBudgeting, Insights
OpX, OpXContracts, OpXProjects
TrimbleUnityMobile, TrimbleVegetationManager
```

### Key Type Classes (388 total)

**Core Work Order:**
- `WorkOrderBase` — 100+ fields including costs, dates, coordinates, custom fields, cycle config
- `WorkOrderEntity` / `WorkOrderEntityBase` — WO-to-asset link
- `WorkOrderSecurity` — permission flags
- `WorkOrderLaborCost` — labor time and cost tracking
- `WOTask` — work order sub-tasks
- `WOTemplateBase` — template definitions

**Core Inspection:**
- `InspectionBase` — template-driven inspection with condition rating, observations
- `InspTemplateBase` — inspection template config
- `InspQuestion` / `InspQuestAnswer` — question/answer system
- `InspectionLaborCost` / `InspectionEquipmentCost` — cost tracking

**Sewer-Specific:**
- `TvInspectionBase` (extends `StandardInspBase`) — CCTV inspection with 100+ PACP fields
- `TvObservation` — individual CCTV observation coding
- `ManholeInspBase` (extends `StandardInspBase`) — MACP-aligned manhole inspection
- `SPipeInManhole` — pipe connections entering manholes
- `SMhiObserv` — manhole observation coding
- `SMhInspImg` — manhole inspection images

**Water-Specific:**
- `WValvDevInsp` — water valve device inspection (via StandardInspTableName)
- `WHydDevInsp` — water hydrant device inspection
- `WFireHydFlowTest` — fire hydrant flow test

**Asset/Entity:**
- `EntityConfiguration` — asset type configuration
- `EntityCostTotal` — lifetime cost tracking
- `EntityHistory` — asset change history
- `EntityReading` — meter/sensor readings
- `AssetSplitRecord` — asset split tracking

**Employee/User:**
- `EmployeeBase` — employee with rates, skills, org
- `CWUser` — system user with roles/permissions
- `EmployeeSecurity` — 40+ permission flags

### Inheritance Hierarchy

```
UniversalCustomFieldsBase          (TEXT1-10, NUM1-5, DATE1-5)
  └─ UniversalCustomFieldsBase2    (TEXT11-20)
      ├─ WorkOrderBase             (100+ WO-specific fields)
      ├─ RequestBase               (service request fields)
      └─ UniversalCustomFieldsBase3
          └─ PermitBase            (permit fields)
  └─ InspectionBase                (inspection fields)
  └─ ProjectBase                   (project fields)
  └─ StandardInspBase              (standard inspection base)
      ├─ TvInspectionBase          (CCTV/PACP fields)
      ├─ ManholeInspBase           (MACP fields)
      ├─ EquipChangeOutBase        (equipment changeout)
      └─ PavementInspBase          (pavement condition)
```

### What This Tells Us for Our Platform

1. **API complexity is massive** — 747 AMS methods alone. Our MVP should target ~50-80 endpoints covering signs, basic work orders, and inspections.

2. **Their custom field pattern** (TEXT1-20, NUM1-5, DATE1-5) is baked into the inheritance hierarchy. We should use JSONB from day one.

3. **Inspection templates are powerful** — question/answer system with conditional logic, scoring, and panels. We should build a simpler version of this.

4. **Sewer inspections (PACP/MACP)** have dedicated table structures, not just generic inspections. This validates our approach of having specific inspection models per asset type.

5. **The module licensing model** they use (ViewWorkOrder, EditWorkOrder as separate licenses) is something we can simplify to role-based access per module.

6. **Their search system** is configurable with saved search definitions — a good pattern to learn from for our reporting/filtering needs.

7. **Cost tracking granularity** (labor/material/equipment with actual/projected/template) is important for municipalities. We should support at least actual cost tracking.

---

*Analysis performed March 18, 2026*
---

## Complete Type Definitions (cwTypes.py)

### Inheritance Chain

```
object
├─ UniversalCustomFieldsBase     (Text1-10, Num1-5, Date1-5)
│  ├─ InspectionBase             (generic inspection — 65 fields)
│  ├─ StandardInspBase           (empty — marker base for specialized inspections)
│  │  ├─ TvInspectionBase        (CCTV pipe — 95 fields)
│  │  ├─ ManholeInspBase         (manhole — 53 fields)
│  │  ├─ EquipChangeOutBase      (equipment swap)
│  │  └─ PavementInspBase        (pavement condition)
│  ├─ UniversalCustomFieldsBase2 (adds Text11-20)
│  │  ├─ WorkOrderBase           (work order — 90 fields)
│  │  ├─ RequestBase             (service request — 70 fields)
│  │  └─ UniversalCustomFieldsBase3 (adds Num6-10)
│  │     └─ PermitBase           (permit/case)
│  └─ ProjectBase                (capital project)
├─ WorkOrderEntityBase           (WO↔asset link — 21 fields)
│  └─ WorkOrderEntity            (extended with GIS attributes)
├─ AttachmentBase                (5 fields)
│  └─ AttachmentExtendedBase     (adds title, description, attachedBy)
├─ EmployeeBase                  (37 fields)
├─ CWUser                        (33 fields)
├─ CostSummaryBase               (12 fields)
│  └─ WorkOrderCostSummary       (adds WOCategory, WorkOrderId, WorkOrderSid)
├─ WorkOrderLaborCost            (34 fields)
├─ TvObservation                 (22 fields — individual CCTV observation)
├─ SMhiObserv                    (13 fields — manhole observation)
├─ SPipeInManhole                (16 fields — pipe connection at manhole)
├─ WorkOrderSecurity             (34 permission flags)
└─ InspectionSecurity            (19 permission flags)
```

### WorkOrderBase (inherits UniversalCustomFieldsBase2)
Total inherited + own fields: ~110

```python
# From UniversalCustomFieldsBase:
Text1-10 : str, Num1-5 : float, Date1-5 : datetime

# From UniversalCustomFieldsBase2:
Text11-20 : str

# Own fields:
AcctNum : str                    # GL account number
ActivityZone : str
ActualFinishDate : datetime
ActualStartDate : datetime
ApplyToEntity : str
AssetGroup : str
Cancel : bool
CancelledBy : str
CancelledBySid : int
CancelReason : str
ClosedBySid : int
ContractorName : str
ContractorSid : int
ContractWOId : str
ContrBillable : bool
CreatedByCycle : bool            # auto-generated by recurring schedule
CycleFrom : RepeatFromDate       # ADATE, PROJSTARTDATE, ACTUALFINISHDATE
CycleIntervalNum : int           # repeat every N...
CycleIntervalUnit : RepeatIntervalUnit  # D, W, M, Y
CycleType : RepeatType           # NEVER, ONCE, EVERY
DateCancelled : datetime
DatePrinted : datetime
DateSubmitTo : datetime
DateSubmitToOpen : datetime
DateToBePrinted : datetime
DateWOClosed : datetime
Description : str
District : str
DomainId : int                   # tenant ID
Effort : float
ExpenseType : WOExpenseType      # MAINT or CIP
Facility_Id : str
FromDate : datetime
InitiateDate : datetime
InitiatedBy : str
InitiatedByApp : str             # INTERNAL or app name
InitiatedBySid : int
IsClosed : bool
IsReactive : bool
LegalBillable : bool
Level_Id : str
LineItemCost : float
Location : str
MapPage : str
MapTemplateName : str
NumDaysBefore : int
PerformanceBudgetId : int
PrimaryContractId : int
Priority : str
ProjectName : str
ProjectPhaseId : int
ProjectSid : int
ProjFinishDate : datetime
ProjStartDate : datetime
RequestedBy : str
RequestedBySid : int
Resolution : str
ScheduleDate : datetime
Shop : str
SourceWOId : str
Stage : WOStage                  # PROPOSED or ACTUAL
Status : str
StreetName : str
SubmitTo : str
SubmitToOpenBy : str
SubmitToOpenBySid : int
SubmitToSid : int
Supervisor : str
SupervisorSid : int
TileNo : str
TransToWOId : str
Unattached : bool
UnitsAccompDesc : str
UnitsAccompDescLock : bool
UnitsAccomplished : float
UpdateMap : bool
WOAddress : str
WOCategory : str
WOClosedBy : str
WOCost : float                   # total cost
WOCustFieldCatId : int
WOEquipCost : float
WOLaborCost : float
WOMapScale : int
WOMatCost : float
WOOutput : WOOutputType
WOPermitCost : float
WorkCompletedBy : str
WorkCompletedBySid : int
WorkOrderId : str                # human-readable ID
WorkOrderSid : long              # surrogate numeric ID
WOTemplateId : str
WOXCoordinate : float
WOYCoordinate : float
WOZCoordinate : float
```

### InspectionBase (inherits UniversalCustomFieldsBase)
Total fields: ~85

```python
# Inherited: Text1-10, Num1-5, Date1-5

ActFinishDate : datetime
Cancel : bool
CancelledBy : str
CancelledBySid : int
CancelReason : str
ClosedBy : str
ClosedBySid : int
CondRating : float               # overall condition rating
CondScore : int
CreatedByCycle : bool
CycleFrom : RepeatFromDate
CycleIntervalNum : int
CycleIntervalUnit : RepeatIntervalUnit
CycleType : RepeatType
DateCancelled : datetime
DateClosed : datetime
DateSubmitTo : datetime
District : str
DomainId : int
Effort : float
EntitySid : int                  # linked asset SID
EntityType : str                 # linked asset type
EntityUid : str                  # linked asset UID
Facility_Id : str
FeatureId : int
FeatureType : str
FeatureUid : str
ForemanRecomnd : str             # supervisor recommendation
FromDate : datetime
InitiateDate : datetime
InitiatedBy : str
InitiatedByApp : str
InitiatedBySid : int
InspDate : datetime
InspectedBy : str
InspectedBySid : int
InspectionId : int
InspTemplateId : int             # template that defines this inspection
InspTemplateName : str
InspX : float                    # inspection location coordinates
InspY : float
InspZ : float
IsClosed : bool
Level_Id : str
Location : str
MapPage : str
Metadata : str                   # JSON metadata
ObservationSum : str
ParentInspId : int               # parent inspection (for child inspections)
Priority : str
PrjFinishDate : datetime
PrjStartDate : datetime
ProjectPhaseId : int
ProjectSid : int
RepairsMade : str
Resolution : str
Shop : str
Status : str
StreetName : str
SubmitToEmployeeSid : int
SubmitToName : str
TileNo : str
UpdateMap : bool
```

### TvInspectionBase (inherits StandardInspBase → UniversalCustomFieldsBase)
Total fields: ~115 (CCTV/PACP pipe inspection)

```python
# Inherited: Text1-10, Num1-5, Date1-5

# Pipe identity
PipeId : str
PipeType : str
PipeLength : float
Diameter : float
Width : float
Shape : str
Material : str
JointLength : float
JointType : str
LiningMethod : str
Coating_Method : str

# Manhole references (upstream/downstream)
UpMh : str                       # upstream manhole ID
UpType : str
UpLocation : str
UpDepth : float
DownMh : str                     # downstream manhole ID
DownType : str
DownLocation : str
DwnDepth : float
RimToInvertU : float
RimToGradeU : float
RimToInvertD : float
RimToGradeD : float

# Elevations / coordinates
Up_Easting : str
Up_Elevation : str
Up_Northing : str
Down_Easting : str
Down_Elevation : str
Down_Northing : str
X : float
Y : float
Z : float
Vertical_Datum : str
MH_Coordinate_System : str
GPS_Accuracy : str

# Inspection details
TvId : int                       # inspection ID
TvDate : datetime
TvReason : str
InspectedBy : str
InspectedBySid : int
TotalLength : float
FlowDepth : float
Location : str
MapNumber : str
SurfaceType : str
ReverseSetup : bool
Reverse_Setup_Flag : int
ObservMethod : TvObservationMethod  # STANDARD or CCTV
Inspection_Technology_Used : str
Inspection_Status : str
IsImperial : bool
Pressure_Value : float
Location_Code : str
Location_Details : str
Weather : str

# Video/media
MasterTapeNum : str
VideoTapeNum : str
TapeLibraryNum : str
VtrFormat : str
CounterStart : str
CounterStop : str
VideoLocation : str

# Condition ratings (NASSCO PACP)
CondRating : float               # overall condition
HydRating : float                # hydraulic rating
StructRating : float             # structural rating
OmRating : float                 # O&M rating
RootRating : float
Deterioration : str
DeterScore : float
Spot : str
SpotScore : float
GroundCond : str
GroundCondScore : float
PrecipType : str
PrecipTypeScore : float
Consequence_Of_Failure : str

# Pipe history
YearLaid : float
YearRenewed : float
SewerCategory : str
SewerUse : str
FlowControl : str
PreCleaning : str
DateCleaned : datetime
RehabStatus : str
DrainageArea : str

# NASSCO certification
CertificateNumber : str
Reviewer_Certificate_Number : str
ReviewedBySid : int

# Admin
Owner : str
Customer : str
PoNumber : str
Project : str
Street : str
City : str
InitiatedByApp : str
InspCustFieldCatId : int
UpdateMap : bool
WorkOrderId : str
WorkOrderSid : long

# Notes
ObservationSum : str
RepairsMade : str
ForemanRecomnd : str
SuperAprvlComnts : str

# Cross-references
DyeId : int
SmokeId : int
```

### ManholeInspBase (inherits StandardInspBase → UniversalCustomFieldsBase)
Total fields: ~73 (NASSCO MACP manhole inspection)

```python
# Inherited: Text1-10, Num1-5, Date1-5

# Identity
InspectionId : int
FacilityId : str
FeatureType : str
WorkOrderId : str
WorkOrderSid : long

# Inspection
InspDate : datetime
InspectedBy : str
InspectedBySid : int
Location : str
MapNumber : str
Xcoordinate : float
Ycoordinate : float
Zcoordinate : float

# Physical characteristics
AccessType : str
BarrelDiam : float
LidDiameter : float
MhLength : float
MhWidth : float
Depth : float
SubType : str

# Materials (8 separate fields — very detailed)
MhMaterial : str                 # manhole body
LidMaterial : str
StepMaterial : str
BenchMaterial : str
ChannelMaterial : str
RingMaterial : str
FrmMaterial : str                # frame material
ConeMaterial : str

# Condition ratings
CondRating : float               # overall
HydRating : float                # hydraulic
StructRating : float             # structural
Spot : str
SpotScore : float
GroundCond : str
GroundCondScore : float
PrecipType : str
PrecipTypeScore : float
FlowType : str
FlowTypeScore : float
Ponding : str
PondingScore : float
SurfaceType : str
DistToHydrant : float

# Measurements
TribArea : float                 # tributary area
DepthOfSurchrg : float
DepthOfDebris : float
DepthOfFlow : float

# Notes
ObservationSum : str
RepairsMade : str
ForemanRecomnd : str
SuperAprvlComnts : str

InspCustFieldCatId : int
UpdateMap : bool
```

### TvObservation (individual CCTV observation within a pipe inspection)

```python
ObservationId : int
TvId : int                       # parent TvInspection
CctvCode : str                   # NASSCO defect code
ObservDesc : str                 # description
ObservDescScore : float          # severity score
ObservType : str                 # structural, O&M, etc.
ObservPos : str                  # clock position
Cause : TvObservationCause       # S=structural, I=infiltration, R=root, O=other
Grade : float                    # severity grade
DistFromUp : float               # distance from upstream manhole
DistFromDown : float             # distance from downstream manhole
TapeRead : str
Joint : str
Continuous : str
ClockTo : float
ValueDimension1 : float
ValueDimension2 : float
ValuePercent : float
VCR_Time : str
TvImage : str                    # image reference
TvTape : str
ObservRemarks : str
```

### SMhiObserv (manhole observation within a manhole inspection)

```python
MhObservId : int
InspectionId : int               # parent ManholeInsp
MhPart : str                     # which part of manhole (lid, frame, cone, etc.)
Position : str
Condition : str
ConditionScore : float
DistFromRim : float
EstMhIandI : float               # estimated inflow & infiltration
LeakCategory : str
LeakCatScore : float
LeakType : str
LeakTypeScore : float
TestMethod : str
```

### SPipeInManhole (pipe connection at a manhole)

```python
InspectionId : int               # parent ManholeInsp
PipeInMhId : int
PipeId : str
PipeType : str
PipeDepth : float
PipeElev : float
Diameter : float
PipeDirection : str
Material : str
InOut : PipeInOut                 # I=in, O=out
DropConnection : bool
BypassPipe : bool
FlowDepth : float
PipeCond : str
PipeCondScore : float
EstPipeIandI : float             # estimated inflow & infiltration
```

### WorkOrderEntityBase (WO ↔ Asset link)

```python
ObjectId : int
WorkOrderId : str
WorkOrderSid : long
EntityUid : str                  # asset unique ID
EntityType : str                 # asset type name
EntitySid : int
FeatureId : int
FeatureType : str
FeatureUid : str
Location : str
Address : str
LegacyId : str
WarrantyDate : datetime
WorkCompleted : bool
IsBlank : bool
TileNo : str
Facility_Id : str
Level_Id : str
X : float
Y : float
Z : float
```

### EmployeeBase

```python
EmployeeSid : int
EmployeeId : str
FirstName : str
MiddleInitial : str
LastName : str
FullName : str
Title : str
Email : str
Pager : str
WorkPhone : str
LoginName : str
UniqueName : str
IsActive : bool
DomainId : int
Organization : str
AdDomain : str
Password : str
DefaultImgPath : str
MapServiceId : int
MobileMapCacheId : int
StoreroomDomainId : int

# Cost rates (7 rate types)
HourlyRate : float
OvertimeRate : float
OvertimeType : RateAddMethod     # Percent or Fixed
HolidayRate : float
HolidayType : RateAddMethod
BenefitRate : float
BenefitType : RateAddMethod
OverheadRate : float
OverheadType : RateAddMethod
StandbyRate : float
StandbyType : RateAddMethod
ShiftDiffRate : float
ShiftDiffType : RateAddMethod
OtherRate : float
OtherRateType : RateAddMethod
EmailReq : str
```

### WorkOrderLaborCost

```python
LaborCostId : int
WorkOrderId : str
WorkOrderSid : long
LaborSid : int
LaborName : str
LaborType : LaborCategory        # Employee or Contractor
RateType : LaborRateType         # Hourly, Overtime, Emergency, Fixed, PerUnit
Hours : float
Cost : float
RegularCost : float
OvertimeCost : float
HolidayCost : float
BenefitCost : float
OverheadCost : float
StandbyCost : float
ShiftDiffCost : float
OtherCost : float
AcctNum : str
Description : str
EntityType : str
EntityUid : str
StartDate : datetime
FinishDate : datetime
TransDate : datetime
GroupName : str
OccupationCode : str
OccupationId : int
TaskName : str
WOTaskId : int
TimesheetId : int
ContractorNumber : str
UsageType : CostUsage            # Actual, Projected, Template, Reported
DomainId : int
LaborCostDetails : List[LaborCostDetail]
```

### WorkOrderSecurity (34 permission flags)

```python
WorkOrderId : str
WorkOrderSid : long
CanView : bool
CanUpdate : bool
CanDelete : bool
CanClose : bool
CanCancel : bool
CanAddLabor : bool
CanViewLabor : bool
CanUpdateLabor : bool
CanDeleteLabor : bool
CanViewLaborCost : bool
CanAddMaterial : bool
CanViewMaterial : bool
CanUpdateMaterial : bool
CanDeleteMaterial : bool
CanViewMaterialCost : bool
CanAddEquipment : bool
CanViewEquipment : bool
CanUpdateEquipment : bool
CanDeleteEquipment : bool
CanViewEquipmentCost : bool
CanAddLineItems : bool
CanViewLineItems : bool
CanUpdateLineItems : bool
CanDeleteLineItems : bool
CanViewLineItemsCost : bool
CanAddTasks : bool
CanViewTasks : bool
CanUpdateTasks : bool
CanDeleteTasks : bool
CanViewCosts : bool
CanAddComment : bool (implied)
CanUpdateComment : bool
CanDeleteComment : bool
```

### CWUser

```python
UserId : long
LoginId : str
LoginName : str
UserName : str
FullName : str
UniqueName : str
UserPwd : str
UserType : str
ADDomain : str
DomainId : int
EmployeeSid : int
OrgId : long
GroupId : int
GroupIds : str
Groups : List[int]
RoleId : str
Roles : str
Domains : List[CWDomain]
Districts : List[str]
GISRight : GISRight
TableName : str
IsApiUser : bool
IsCwdba : bool
IsDomainSuperuser : bool
IsPAGuestUser : bool
IsPARegisteredUser : bool
IsWindowsIdentity : bool
StoreDomainId : int
StoreDomainsWhereAdmin : List[StoreDomainBase]
MembershipId : int
MembershipEmail : str
MembershipEmailVerified : bool
MembershipDateEmailVerified : datetime
```

---

## Complete API Request Definitions (cwMessagesAMS.py)

### WorkOrderService API

**CreateBase** (fields sent when creating a work order):
```
ActivityZone, Address, Comments, ContractId, CustomFieldDateValues,
CustomFieldValues, Date1-5, District, DomainId, Entities (List[WorkOrderEntity]),
EntityType, ExpenseType, Facility_Id, GetGisData, GroupEntities,
InitiateDate, InitiatedByApp, InitiatedBySid, Instructions, Level_Id,
Location, MapPage, Num1-5, PerformanceBudgetId, Priority,
ProjectedStartDate, ProjectSid, Reactive, RequestedBySid, Shop,
Stage, Status, SubmitToSid, SupervisorSid, Text1-20, TileNo,
WOCategory, WOCustFieldCatId, WOTemplateId
```

**ManholeInspectionService.Create** (68 fields):
```
AccessType, BarrelDiam, BenchMaterial, ChannelMaterial, CondRating,
ConeMaterial, CustomFieldDateValues, CustomFieldValues, Date1-5,
Depth, DepthOfDebris, DepthOfFlow, DepthOfSurchrg, DistToHydrant,
FacilityId, FeatureType, FlowType, FlowTypeScore, ForemanRecomnd,
FrmMaterial, GetGisData, GroundCond, GroundCondScore, HydRating,
InspCustFieldCatId, InspDate, InspectedBy, InspectedBySid,
LidDiameter, LidMaterial, Location, MapNumber, MhLength, MhMaterial,
MhWidth, Num1-5, ObservationSum, Ponding, PondingScore, PrecipType,
PrecipTypeScore, RepairsMade, RingMaterial, Spot, SpotScore,
StepMaterial, StructRating, SubType, SuperAprvlComnts, SurfaceType,
Text1-10, TribArea, UpdateMap, VcsWKID, WKID, WKT, WorkOrderId,
WorkOrderSid, X, Y, Z
```

**ManholeInspectionService.AddObservation**:
```
Condition, ConditionScore, DistFromRim, EstMhIandI, InspectionId,
LeakCategory, LeakCatScore, LeakType, LeakTypeScore, MhPart,
Position, TestMethod
```

**ManholeInspectionService.AddPipeObservation**:
```
BypassPipe, Diameter, DropConnection, EstPipeIandI, FlowDepth,
GetGisData, InOut, InspectionId, Material, PipeCond, PipeCondScore,
PipeDepth, PipeDirection, PipeElev, PipeId, PipeType
```

**TvInspectionService.CreateUpdateBase** (131 fields):
```
CertificateNumber, City, Coating_Method, CondRating,
Consequence_Of_Failure, CounterStart, CounterStop, Customer,
CustomFieldDateValues, CustomFieldValues, Date1-5, DateCleaned,
Deterioration, DeterScore, Diameter, Down_Easting, Down_Northing,
Down_Elevation, DownLocation, DownMh, DownType, DrainageArea, ...
(and 100+ additional fields matching TvInspectionBase)
```

**TvInspectionService.AddObservation**:
```
CctvCode, Cause, ClockTo, Continuous, DistFromDown, DistFromUp,
Grade, Joint, ObservDesc, ObservDescScore, ObservPos, ObservRemarks,
ObservType, TapeRead, TvId, TvImage, TvTape, ValueDimension1,
ValueDimension2, ValuePercent, VCR_Time
```

### Cost Tracking APIs

**LaborCostService.AddCostsBase**:
```
AcctNum, Description, EmployeeBenefit, EmployeeCostCodes,
EmployeeGroupId, EmployeeHoliday, EmployeeJobCode, EmployeeOther,
EmployeeOverhead, EmployeeOvertime, EmployeeRegular, EmployeeShiftDiff,
EmployeeSids, EmployeeStandby, FinishDate, Hours, StartDate
```

**MaterialCostService.AddMaterialCostsBase**:
```
AcctNum, Description, FinishDate, MaterialCostCodes, MaterialGroupId,
MaterialSids, Quantity, StartDate, UnitCost
```

**EquipmentCostService.AddEquipmentCostsBase**:
```
AcctNum, Description, EquipmentCostCodes, EquipmentGroupId,
EquipmentSids, FinishDate, HourlyRate, Hours, StartDate
```

### Other Key APIs

**EmployeeService.Add** (40 fields):
```
AdDomain, BenefitRate, BenefitType, CustomFieldValues, DomainId,
Email, EmployeeId, FirstName, GroupIds, HolidayRate, HourlyRate,
IsActive, IsDomainAdmin, LastName, LoginName, MapServiceId,
MiddleInitial, Organization, OvertimeRate, Title, UniqueName, WorkPhone, ...
```

**ReadingService.Add**: `EntitySid, EntityType, ReadingType, Value, ReadingDate`

**ConditionService.Current**: `EntityType, EntityUids`
**ConditionService.History**: `EntityType, EntityUids, IncludeConditionScore, IncludeCustomScore, IncludeMaintenanceScore`

---

*Analysis performed March 18, 2026*
*Sources:*
- *Cityworks 23.14.1 Host Installer — SqlSchema.dat (153,864 lines, 800 tables)*
- *Cityworks 23.14.1 SDK — Python, TypeScript v1/v2, C# (4,722 files, 747+ API methods, 388 type classes)*
