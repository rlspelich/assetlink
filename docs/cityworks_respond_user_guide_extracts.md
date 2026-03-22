# Cityworks Respond 5.12 User Guide — Key Extracts
> Source: https://help.cityworks.com/Respond/5-12/
> Extracted: March 18, 2026

---

## Table of Contents (Full Guide)

1. Introduction
2. Respond Compatibility
3. Manage the Respond Plugin
4. Get Started with Respond
5. Map
6. Audit Trace
7. Search
8. Queries
9. Dashboard Management
10. Asset Details
11. **Work Order** (Create, Edit, Close, Tasks, Costs, Assets, Readings, Permits, Security)
12. **ELM** (Equipment, Labor, Material cost management)
13. **Custom Inspection** (Template-driven inspections)
14. **Standard Inspection** (TV/CCTV, Manhole, Hydrant Flow Test, Pavement)
15. **Service Requests** (Create, Edit, Callers)
16. eURL Configuration
17. Permit, License, and Case Management
18. Task Manager
19. Corrections
20. Time Accounting
21. PLL Utilities
22. License Management Tool
23. Payment Manager Tool
24. Escrow Payment Tool
25. Comments
26. Projects
27. Reports
28. Attachments

---

## Work Order

### Overview
A work order is designed for tracking maintenance activities performed by individuals or crews and detailing the tasks to be done and the costs incurred. Templates are created by the domain administrator for each work activity and stored with default values, such as category, priority, duration, print template, comments, instructions, etc.

### Create an Attached Work Order
Work orders can be created from:
- The map (select assets, then create)
- A service request
- A custom inspection
- A PLL case
- The Asset Details page

Workflow:
1. Select assets on the map or from Asset Details
2. Choose entity type (Feature/Object/Other)
3. Select asset group and asset type
4. Choose work order template
5. Option: Create individual WO per asset OR single WO for all assets
6. Fill in details (Address, Location, Status, Priority, Supervisor, etc.)
7. Create

### Create an Unattached Work Order
Work orders can be created without assets attached by selecting the Unattached Work Order option.

### Work Order Panel Fields (Edit View)

**Work Order Panel:**
- Description — auto-populated from template, editable
- Number — auto-generated WO ID, read-only
- Sid — surrogate ID
- Entity Type — from creation, changeable
- Category — classification
- Initiated By/Date — auto-populated, date editable if allowed
- Status — configurable states
- Priority — order of importance
- Requested By — who requested the work
- Supervisor — assigned supervisor
- Submit To/Date — approval workflow
- Projected Start/Finish — planned dates
- Open By/Date — auto-populated when Submit To user opens
- Closed By/Date — auto-populated on close
- Completed By — who finished the work
- Actual Start/Finish — real dates
- Stage — Actual (default) or Proposed (planning/estimation mode)
- Expense Type — classification
- Reactive? — reactive vs preventive maintenance flag
- Instructions — free text
- Resolution — final outcome
- Related — link to related work activities
- Equipment Reservations / Checked Out Equipment

**Details Panel Fields (Create View):**
- Address, Location
- Status, Priority
- Supervisor, Requested By
- Projected Start Date
- Stage (Actual/Proposed)
- Expense Type (Maintenance/CIP)
- Shop, District
- Instructions
- Contract, Project
- Comments

**Location Information Panel:**
- Map Page, Tile Number
- X, Y, Z coordinates

**Work Cycle Panel (Recurring Work):**
- Repeat: Never, Once, Every
- Interval + Unit (Day/Week/Month/Year)
- Cycle From: Date, Projected Start Date, or Actual Finish Date

### Close a Work Order
1. Complete "Completed By" field
2. Set "Actual Finish" date
3. Complete all tasks (if required)
4. Click Close
5. System auto-fills Close Date and Closed By
6. Prompted to create next cyclical WO if cycle is configured

### Cost Summary
Users with permission can view and manage costs for:
- **Labor** — employee/contractor hours with rate types
- **Materials** — storeroom items with quantities
- **Equipment** — equipment hours with operators
- **Line Items** — contract line item costs
- **Permits** — permit-related costs

Each cost type has Actual vs Estimated tracking with difference/percentage comparison.

### Tasks
Tasks track work completed as part of work orders. Each task has:
- Name, Description, Status
- Assigned To, Shop
- Projected/Actual Start and Finish dates
- Sequence ID
- Response, Proceed, Rework flags
- Comments

### Asset Readings
Asset readings can automatically generate work orders based on entered information. Supports:
- Reading types: Interval, Milestone, Threshold
- Reading value, date, comments

---

## Custom Inspection

Custom inspections record asset condition observations and simple repair work. They are configured by administrators using templates that define:
- Observation questions and panels
- Condition ratings
- Required fields for closing

**Inspection Edit Fields:**
- Inspection ID, Template Name
- Inspected By, Inspection Date
- Status, Priority
- Condition Score
- Submit To
- District, Shop, Map Page
- Location, X/Y/Z coordinates
- Projected Start/Finish, Actual Finish
- Observations (question/answer panels)
- Recommendations, Repairs Made
- Work Cycle (same as WO: Never/Once/Every)
- Comments, Attachments
- Universal Custom Fields (Text 1-10, Num 1-5, Date 1-5)

---

## Standard Inspections

Standard inspections can only be created from a work order. Four types:
1. **TV Inspection** (CCTV pipe inspection — PACP)
2. **Manhole Inspection** (MACP)
3. **Hydrant Flow Test**
4. **Pavement Inspection**

### Create a Standard Inspection
1. Open a work order attached to desired assets
2. Tap Related Activities from the activity toolbar
3. Tap Create Linked Activity
4. Assets from the WO appear in Select Assets panel
5. Select asset, choose template
6. Tap Create Inspection

---

## TV Inspection Fields (CCTV/PACP)

### General Panel
- Inspection Id, Work Order Id (auto)
- Pipe Id, Pipe Type (auto from asset)
- Inspected By, Certificate Number (PACP cert)
- Reviewed By, Reviewer Certificate Number
- Owner, Customer, PO Number
- Media Label, Project
- Date Inspected, Sheet Number
- Weather, Pre-cleaning, Date Cleaned
- Flow Control, Purpose (reason for inspection)
- Upstream Setup (checkbox), Rev. Setup Insp
- Technology Used, Inspection Status
- Consequence of Failure, Pressure Value
- Rehab Status, Update Map
- X/Y/Z coordinates

### Location Panel
- Drainage Area, Street, City
- Location Code (ground cover above pipe)
- Location Details

### Pipe Panel
- Pipe Use (sewer/storm), Pipe Category
- Diameter, Width, Shape, Material
- Lining Method, Coating Method
- Pipe Joint Length, Length Surveyed
- Year Constructed, Total Length, Year Renewed
- Joint Type, Flow Depth

### Upstream Measurements Panel
- Up MH No, Up MH Type, Up Pipe Location
- Up MH Rim to Invert, Rim to Grade, Grade to Invert
- Up MH Northing, Easting, Elevation

### Downstream Measurements Panel
- Down MH No, Down MH Type, Down Pipe Location
- Down MH Rim to Invert, Rim to Grade, Grade to Invert
- Down MH Northing, Easting, Elevation

### Coordinates Panel
- MH Coordinate System, MH Vertical Datum
- GPS Accuracy
- O&M Rating (PACP CCTV codes only)
- Overall Rating, Structural, Hydraulic, Root
- Is Imperial (checkbox)

### Comments Panel
- Inspection Comments, Repairs Made
- Recommendations, Supervisor Approval/Comments

### Observations Panel (CCTV defect coding)
- Dist. from Upstream / Downstream
- Video Reference (counter in video)
- Percent (of pipe affected)
- Clock Start / Clock Finish (position)
- Joint (Yes/No), Continuous (extent)
- Dimension 1, Dimension 2
- Type (defect type), Description (varies by type)
- Description Rating (auto-scored)
- Cause: STRUCTURAL or O&M (PACP) / STRUCTURAL, I/I, ROOT (non-PACP)
- VCR Time, Grade, Comments

*Field descriptions from NASSCO PACP Version 7.0.3 (January 2018)*

---

## Manhole Inspection Fields (MACP)

### General Panel
- Manhole Inspection Id, Work Order Id (auto)
- Facility Id (auto), Inspected By
- Date Inspected, Location, Map Number
- Surface type, Tributary Area
- X/Y coordinates, Update Map

### Ratings Panel
- Structural, Hydraulic, Overall ratings
- Spot / Spot Score
- Ground Condition / Score
- Precipitation / Score
- Flow Type / Score
- Ponding / Score

### Manhole Panel
- Length, Width
- Access type
- Lid Diameter, Barrel Diameter
- Sub Type (manhole category)

### Material Panel (8 material fields)
- Lid, Steps, Bench, Ring
- Cone, Channel, Frame, Barrel

### Depth Panel
- Depth, Surcharge, Flow, Debris

### Observation Panel
- Structural Parts (which part needs repair)
- Dist. from Rim
- Position (clock/quadrant)
- Test Method
- Estimated I/I (gallons per minute)
- Condition / Condition Score
- Leak Type / Leak Type Score
- Leak Category / Leak Category Score

### Comments Panel
- Inspection Comments, Repairs Made
- Recommendations, Supervisor Approval/Comments

---

## Hydrant Flow Test Fields

### General Panel
- Inspection Id, Work Order Id (auto)
- Asset Type, Facility Id (auto)
- Inspected By, Date Inspected
- Update Map, Location

### Hydrant Panels (up to 3 hydrants)
- Id (hydrant control ID)
- Pitot Pressure (PSI at outlet)
- Diameter (outlet inches)
- Flow Coefficient
- Total Flow (auto-calculated)

### Additional Details Panel
- Test Duration (minutes)
- Static Pressure (before opening)
- Residual Pressure (after opening valves)
- Plant Pressure, Plant Flow (GPD)
- Flushing Flow (auto-calculated)

### Water Tank Panel
- Elevation, Tank Name
- 20 PSI Flow, 30 PSI Flow

### Comments Panel
- Comments, Supervisor Comments

---

## Service Request

A service request (also referred to as a customer call or citizen request) is a request for service initiated by a citizen or internal staff. It tracks the initial contact, dispatch, investigation, and recommendation.

### Create a Service Request
Can be created from: Menu, Inspection, Work Order, PLL Case

Workflow:
1. Select Request Type (template-driven, question/answer flow)
2. Enter Caller Information (name, phone, address, callback flag)
3. Enter Incident Information (address, location, map page, details)
4. Select assets from map (optional)
5. Set Dispatch To, Submit To, Priority, Shop, District, Project
6. Create

### Service Request Edit Fields
- Service Request Id, Description
- Status, Priority, Category
- Initiated By/Date
- Dispatch To / Open By / Dates
- Submit To / Open By / Dates
- Projected Complete Date
- Closed By/Date, Cancel/Cancel Date
- Location, Address, City, State, Zip
- Map Page, Tile Number, District
- X/Y/Z coordinates
- Emergency?, Investigation?, Work Order Needed?
- Resolution
- Universal Custom Fields (Text 1-10, Num 1-5, Date 1-5)
- Callers (multiple callers per request)
- Comments, Attachments

---

## ELM (Equipment, Labor, Material)

ELM provides a centralized interface for adding and managing costs across multiple work activities at once. Cost types:

**Standard costs:**
- Labor — employee selection, hours, rate types (Regular, Overtime, Holiday, Benefit, Overhead, Standby, Shift Diff, Other), account, job codes, start/finish dates
- Equipment — equipment selection, hours/units, operator, account, start/finish dates
- Material — storeroom selection, material, units, serial numbers, account, assembly parts

**Crew costs:** Select a crew to auto-populate labor, equipment, and material from crew definition

**Contractor costs:** Contractor labor, equipment, and material with contractor-specific rates

**Line Item costs:** Contract-based costs with unit quantities, verification status (Unverified/Pass/Fail)

Each cost type supports Actual vs Estimated, with ability to transfer estimated to actual.

---

*Extracted from Cityworks Respond 5.12 Guide — March 18, 2026*

---

## Appendix: AMS Office Companion — Unique Features Not in Respond

> Source: https://help.cityworks.com/AMS/OC/
> The AMS Office Companion is the older/classic Cityworks UI. Most workflows overlap with Respond, but these features are unique or expanded.

### Full Standard Inspection Types (9 total)

The Office Companion supports more standard inspection types than Respond:

| Type | Description |
|------|-------------|
| TV Inspection | CCTV pipe inspection (PACP) |
| Manhole Inspection | Storm/wastewater manhole (MACP) |
| Hydrant Flow Test | Flow rate and pressure testing |
| Pavement Inspection | Pavement condition assessment |
| **Valve Inspection** | Water valve device inspection |
| **Hydrant Inspection** | Hydrant device condition inspection |
| **Smoke Test** | Sewer smoke testing for leaks/connections |
| **Dye Test** | Dye testing for I/I identification |
| **Inlet Inspection** | Storm inlet condition inspection |

The bolded types are only available in Office Companion, not in Respond's standard inspection list. All standard inspections are created from work orders and have Custom Fields tabs.

### Allocation Manager (Workload Balancing)
- Managers view employee workload across date ranges
- Unassigned work shown in left column, assigned in right
- Each employee shows total hours (from "Effort" field) and activity count
- Drag-and-drop assignment of work to employees
- Effort field configurable at template level for WOs, tasks, SRs, inspections

### Asset Analytics
- Summary view per asset showing:
  - Work history (all WOs, inspections, SRs)
  - Cost history (labor, material, equipment totals)
  - GIS attributes
  - Condition information/ratings
- Useful for capital planning and replacement decisions

### Entity Divisions (Asset Splitting)
- Split a pipe or polygon asset into two pieces
- Work history preserved and optionally copied to new entity
- Supports splits done in Cityworks editor or external GIS tools
- Uses ASSETSPLITRECORD table for tracking

### 8 Ways to Create a Work Order
1. From the map (select assets)
2. From a service request
3. From a custom inspection
4. From the inbox
5. From search results
6. From GIS search
7. From entity lookup
8. From asset analytics

### Key Constraint
Inspections can only be done for one asset. If multiple assets are selected, a separate inspection is created for each one.

---

*AMS Office Companion appendix extracted March 18, 2026*
