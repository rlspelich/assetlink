# Competitive Analysis: BidTabs.NET & DOT Construction Estimating Software Market

> Last updated: 2026-03-29
> Purpose: Inform AssetLink Estimator module strategy

---

## 1. BidTabs.NET by Oman Systems — The Primary Competitor

### Company Overview

| Attribute | Detail |
|-----------|--------|
| Company | Oman Systems, Inc. (OSI) |
| Location | Nashville, Tennessee |
| Founded | 1992 (software company); family construction roots since 1881 |
| Origin | John Oman, 5th-generation highway contractor, built estimating software for Oman Construction Company, then spun it into a dedicated software company |
| Size | 37-72 employees (varies by source) |
| Revenue | ~$7-25M annually (private, estimates vary) |
| Products | BidTabs.NET, ProEstimate.NET, FieldManagement Pro (FMP) |
| Website | omanco.com |

**Key context:** This is a small, family-run, niche software company. They have deep domain expertise (100+ years of actual construction experience before pivoting to software). They are the **sole data supplier to FHWA** for the National Highway Construction Cost Index (NHCCI) — the federal government literally buys bid tab data from them. That is an extraordinary moat.

### BidTabs.NET — Product Deep Dive

**What it is:** A historical bid tabulation database and analysis tool covering DOT highway construction lettings across 49 states (all except Hawaii). It is the dominant product in this niche — no competitor offers comparable multi-state coverage.

**Technology stack:**
- Windows desktop application (.NET Framework 4.8)
- Deployed via ClickOnce installer
- Current version: 2.4.6.4611
- NOT a true web/cloud app — it's a .NET Windows Forms app that downloads data updates
- Requires Windows Installer 4.5 and .NET Framework 4.8
- Data updates pushed when DOTs publish new letting results

**This is a critical competitive vulnerability:** The product is a Windows-only desktop application built on aging technology (ClickOnce, WinForms). It cannot run on Mac, tablets, or phones. The "cloud-based" marketing claim refers to automatic data updates, not a web application.

### Data Coverage

**49 states** (all except Hawaii), with data going back to the mid-1990s for some states. Additional specialty databases:

| Database | Coverage |
|----------|----------|
| Standard DOT | 49 states |
| FL Districts | Florida district-level data |
| IL Aero & Tollway | Illinois aeronautics and tollway |
| MS State Aid | Mississippi state-aid projects |
| NJ Turnpike | New Jersey Turnpike Authority |
| OK Turnpike | Oklahoma Turnpike Authority |
| PA Turnpike | Pennsylvania Turnpike Commission |
| TX Maintenance | Texas maintenance contracts |

**Data freshness:** Updates are posted typically within one week after a DOT publishes letting results. Data is verified and converted by Oman staff before publishing.

**Historical depth by state (from 2006 manual — likely deeper now):**

Early coverage (1990s): Alabama, Arkansas, California, Colorado, Connecticut, Delaware, Florida, Georgia, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Mexico, North Carolina, North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming

### Features — Detailed Report Types

The software has two main report categories:

#### Detailed Reports (Chapter 2 of manual)

1. **By Contractor Report**
   - Select any contractor, see all their bidding history
   - Filter by: bid position (All/Low/Low2/Low3), specific jobs, specific pay items, date ranges, DOT regions, counties, project size, quantity range
   - Output: Average prices by pay item, job totals, detailed job listings
   - Subtotal by work category
   - Export to spreadsheet

2. **By Job Report**
   - Detailed line-item breakdown for any specific project
   - Compare all contractors who bid on a job
   - View engineer's estimate vs contractor bids
   - Category breakdown pie charts (by dollar amount or percentage)
   - Sort by contractor, pay item, or side-by-side comparison (up to 5-6 bidders across the page)
   - "By Pay Item Across Page (Compare)" highlights where a bidder was higher or lower than competitors

3. **By Pay Item Report** (described as the "most useful and most used" report)
   - Weighted average, straight average, median price by pay item
   - Detailed list of all occurrences
   - Monthly and annual trend reports with graphs
   - Filter by: county, DOT region, date range, project size, quantity range, PI category, PI group
   - **List Items** window: shows all individual prices, lets you delete outliers and recalculate
   - Point graph and bar chart visualization
   - Statistics: high, low, weighted avg, straight avg, median, total quantity, count of bids

4. **Compare 2 Contractors Report**
   - Side-by-side price comparison between any two contractors on a job
   - Compare contractor prices to state averages
   - Compare contractor to other bidders' averages
   - Compare contractor to engineer's estimate
   - Variance highlighting (red for over, green for under a configurable threshold)
   - Variance breakdown bar chart and category pie chart

5. **Pay Item Search Report**
   - Multi-criteria search: pay item number (supports wildcards, e.g. "301-" returns 301-01, 301-02), description text, category, job number, county, contractor, date range, project size, quantity range
   - Two-stage results: overview grid, then expandable full-screen detail
   - Navigate between jobs, print/export individual results

#### Summary/Analysis Reports (Chapter 3)

6. **Letting Report**
   - All projects in a letting, letting totals by month/year
   - Map visualization showing letting data by county
   - Sub-total by month/year, breakdown by category, sub-total by region, sub-total by fiscal year
   - Engineer's estimate display (where published by the state)
   - Graph: letting totals over time (bar chart)

7. **Contractor Analysis Report**
   - Market share analysis for a contractor
   - Win rate, total work volume, work type breakdown

8. **Market Analysis Report**
   - Industry trends, market volume, work type distribution
   - Geographic analysis

9. **Competitor Analysis Report**
   - Head-to-head competitive positioning

### Pay Item Categorization System

Oman has invested "thousands of man-hours" to categorize every standard pay item into **31 predefined categories** (the manual screenshots show these; not all are visible but include):

- Grading/Excavation
- Bridge
- Asphalt
- Base Stone
- Drainage Pipe
- Drainage Inlets/Catch Basins
- Concrete Culverts
- Concrete Misc.
- Traffic Control
- Guard Rail
- Fencing
- Grassing
- Clearing
- Erosion Control
- Striping/Pavement Marking
- Mobilization
- Retaining Wall
- (and others up to 31 total)

Users can also create **custom pay item groups** for their own analysis.

### Geographic Granularity

- Filter by **county** (individual county selection)
- Filter by **DOT region/district** (state-defined county groupings)
- Filter by **user-defined regions** (custom county groupings)
- Population classification: **suburban, urban, rural** per county

### Price Adjustment

- **NHCCI (National Highway Construction Cost Index)** — adjusts historical prices for inflation
- **State Asphalt Cost Index** — adjusts for volatile asphalt prices
- **Advanced averaging options:** weighted average, straight average (with/without omitting high/low), median

### BidTabs Plus Add-on

BidTabs Plus is an add-on module to BidTabs Professional that enables:

- Import pay item data from any electronic format (Expedite, Excel, etc.)
- "Tab out" a project — load your proposed prices and compare to historical averages
- Create **engineers' estimates** and **bid bonds**
- Compare your prices to state averages or specific contractor averages
- Load multiple scenarios and run unlimited comparisons
- Categorize and see project work breakdown
- Load prices from similar past projects
- Export estimates as XML

### Pricing

**Not publicly disclosed.** Quote-based pricing. What is known:
- Described as "reasonable" by third-party reviewer
- 7-day free trial available (6 months of data)
- Lifetime support included at no extra cost
- Single-computer license (must purchase multiple for multiple users)
- **DOT Bundle** available: full BidTabs.NET site license + 2 ProEstimate.NET licenses (quote required)
- Consultants can potentially be included in DOT Bundle agreements

**Estimated range (based on industry context):** Likely $2,000-$5,000/year per license for BidTabs.NET alone, potentially more for the Plus module. DOT Bundle pricing likely $10,000-$25,000+ for enterprise/site licenses.

### User Base

- Contractors (primary)
- Subcontractors
- DOT agencies (both state and county)
- Engineering and consulting firms
- FHWA (federal government)
- Bonding companies
- Universities and educational institutions
- Industry associations (e.g., ACPA — American Concrete Pavement Association)

### Client Testimonials (from omanco.com)

| Person | Company | Quote/Sentiment |
|--------|---------|-----------------|
| Will Duke | Boggs Contracting | Uses BidTabs Plus daily to ensure competitive pricing |
| Deb LaValle | ACPA National | "Great product with great customer service. Huge fan!" |
| Mike Pruitt | Angel Brothers | Uses for researching new markets, monitoring market shares |
| Dirk Holtman | Interstate Highway Construction | Pay Item Report is a "reality check"; market share saves time |
| Mark Goerger | **Illinois DOT** | Technical support is helpful, timely, professional |
| Brian Howle | Asimpa LLC | Rates satisfaction at 99.9% |

### Strengths (What They Do Well)

1. **Unmatched data coverage** — 49 states, 20+ years of history, no competitor comes close
2. **FHWA relationship** — they are the official data source for the federal highway cost index
3. **Deep categorization** — 31 categories with thousands of man-hours invested
4. **Geographic granularity** — county-level, with suburban/urban/rural classification
5. **Comprehensive reporting** — 9+ report types covering every angle (contractor, job, pay item, market, competitor)
6. **Price adjustment** — NHCCI inflation and asphalt index built in
7. **Domain expertise** — founded by a 5th-generation highway contractor; "built by estimators, for estimators"
8. **Sticky product** — once you know the interface, switching costs are high
9. **Support quality** — consistently praised in testimonials; 24/7 availability claimed
10. **Trusted by government** — DOTs and FHWA are customers, not just contractors

### Weaknesses (Competitive Opportunities)

1. **Ancient technology** — Windows-only desktop app (.NET WinForms, ClickOnce deployment). Cannot run on Mac, tablets, mobile. The UI screenshots show Windows XP-era design even in the current product
2. **Not truly cloud** — despite "cloud-based" marketing, it's a desktop app with data sync. No browser access, no collaboration, no shared workspace
3. **No API** — no programmatic access to data; can't integrate with other systems
4. **No modern visualization** — graphs are basic Windows Forms charts (bar, pie, line). No interactive dashboards, no maps with data overlays (despite having county data), no heatmaps
5. **Quote-based pricing** — opaque, likely expensive. No self-serve, no try-before-you-buy beyond the limited trial
6. **Single-computer licensing** — not per-user or per-org; limits sharing and collaboration
7. **Small team** — 37-72 employees means slow feature development, limited engineering bandwidth
8. **No mobile** — field crews and estimators on job sites cannot use it
9. **Limited export/integration** — exports to spreadsheets, but no REST API, webhook, or modern integration pattern
10. **Data entry for comparison** — BidTabs Plus requires manual data import to compare your prices; not a modern estimation workflow
11. **No real-time collaboration** — one person, one machine, one report at a time
12. **Pay item categories locked at 31** — rigid structure, users can only add custom groups on top
13. **No confidence scoring** — shows averages and ranges but no statistical confidence or data quality indicators
14. **No predictive pricing** — purely historical lookback, no inflation-forward projections

---

## 2. ProEstimate.NET by Oman Systems

### What It Is

A **crew-based estimating system** for heavy/highway contractors and subcontractors. Designed for building bids from the bottom up (labor + equipment + materials + production rates).

### Key Features

- **Crew-based estimation:** Pre-build crews with defined resources and production rates
- **Cloud-based:** (appears to be more genuinely cloud than BidTabs)
- **Training-friendly:** New estimators can use pre-built crew templates with less supervision
- **Check Bid function:** Built-in error and omission checking
- **Scheduling/Gantt:** Auto-generates Gantt charts from estimate tasks, drag-and-drop scheduling
- **Cash flow:** Graph based on schedule and costs
- **Report engine:** Search within reports, multiple reports open simultaneously
- **Hauling and trenching worksheets**
- **Fuel price adjustment**
- **24/7 support**

### How It Relates to BidTabs.NET

They are **complementary products** sold separately (or together as the DOT Bundle):

- **ProEstimate.NET** = cost-based estimating (bottom-up: crews, equipment, materials, production rates) for high-value items
- **BidTabs.NET** = historical-based estimating (top-down: what did similar items cost in the past?) for lower-value items

The "80/20 principle" is their sales pitch: 80% of project cost comes from 20% of items. Use ProEstimate for the big-ticket items (detailed crew analysis), use BidTabs for the remaining 80% of line items (historical pricing).

### Changes from ProEstimate Heavy to ProEstimate.NET

- Moved to cloud architecture (access from any location)
- Enhanced project list with cross-folder search/filter
- Rebuilt report engine (search, multiple reports open)
- Real-time auto-update as data is entered
- Improved error checking (double-click error to navigate to it)
- Streamlined navigation between edit sheet, pricing sheet, and reports

### Client Testimonial

Mark A. Spence (R.J. Haynie & Associates): "What used to take days, now only takes hours."

---

## 3. FieldManagement Pro (FMP) by Oman Systems

Oman's third product — project management and field reporting:

- Diaries, photos, timecards, quantities, equipment tracking
- Crew scheduling (employees, equipment, cost codes, quantities)
- Equipment move scheduling and dispatch
- Custom field forms (text, checkboxes, signature fields)
- Mobile apps (iOS and Android) for field personnel
- Windows laptop app for field use
- Integration with Trimble FleetWatcher

This is relevant because it shows Oman's full workflow: **Estimate (ProEstimate) -> Win bid -> Track field work (FMP)**. Their platform play mirrors what we're doing with AssetLink's module architecture.

---

## 4. Other Competitors in the Space

### HCSS HeavyBid (Primary Estimating Competitor)

| Attribute | Detail |
|-----------|--------|
| Company | HCSS (Heavy Construction Systems Specialists) |
| Product | HeavyBid |
| Users | 50,000+ estimators across North America |
| Focus | Unit-price bidding, complex multi-phase DOT projects |
| Pricing | $12,000/year single user; $100-500/mo subscription; $1,000-5,000/year plans; implementation $5,000-$100,000+ |
| Plans | Essential, Professional, Enterprise |
| Strengths | Crew analysis, DOT integrations (30+ accounting/DOT systems), industry standard for large contractors |
| Weaknesses | **No bid tab history/analysis** — their "Bid History" feature is "very cumbersome" with no improvements planned; does NOT compete with BidTabs on historical pricing |
| Relationship to BidTabs | Complementary, not competitive. HeavyBid users often also buy BidTabs. An HeavyBid industry blogger called BidTabs "the best source for county and state DOT historical bid prices." |

**Key insight:** HeavyBid is a **bid-building** tool (bottom-up crew estimation). BidTabs is a **bid-intelligence** tool (historical price analysis). They serve different parts of the workflow. HeavyBid has an RS Means integration for cost data but nothing comparable to BidTabs for DOT-specific historical pricing.

### B2W Estimate (now Trimble)

| Attribute | Detail |
|-----------|--------|
| Company | Trimble (acquired B2W Software) |
| Focus | Heavy civil/highway estimating and bidding |
| Pricing | $5,500 perpetual license; $2,500/month subscription |
| Strengths | Centralized cost database, multi-estimator collaboration, 30+ ERP integrations, DOT electronic bidding integration, standardized processes |
| Best for | Multi-million dollar infrastructure with detailed WBS requirements |

### InfoTech / Bid Express / BidX

| Attribute | Detail |
|-----------|--------|
| Company | Infotech, Inc. |
| Product | Bid Express (bidx.com) |
| What it does | Electronic bidding platform — how contractors submit bids to DOTs |
| Coverage | 44 state agencies, processed 500,000+ bids worth ~$2 trillion |
| Role | Infrastructure, not competitor — this is the **submission** platform, not analysis |

**Key insight:** Bid Express is the pipe through which bids flow to DOTs. It's where the data originates that Oman then collects, standardizes, and sells. Bid Express does publish bid tab results, but does not provide the analysis and comparison tools that BidTabs offers.

### AASHTOWare Project Bids

- AASHTO's official electronic bidding software for state DOTs
- Handles bid submission, error checking, tabulation
- Produces bid tab reports as output
- Again, this is **infrastructure** — it generates the raw data that tools like BidTabs analyze

### ConstructConnect

- Pre-construction, bidding, and takeoff solutions
- More focused on commercial construction than heavy/highway
- Does not have DOT-specific bid tab analysis comparable to BidTabs

### RSMeans (Gordian)

- North America's leading construction cost database
- 92,000+ unit line items
- Covers labor, equipment, material prices
- **Not DOT-specific** — general construction cost data
- HCSS HeavyBid has an RS Means integration
- Useful for general cost estimation but lacks the DOT bid-specific granularity (county, contractor, letting date, bid position)

### ProEst (Autodesk)

- Cloud-based estimating platform
- Integration with Procore, Autodesk, QuickBooks
- More focused on commercial/general construction
- Automated proposal generation

### PlanHub, SmartBid, BuildingConnected

- All focused on bid management/distribution (connecting GCs with subs)
- Not historical DOT price analysis tools
- Different market segment

---

## 5. Free / Open Data Alternatives

Many state DOTs publish their bid tabulation data for free online:

| State | What's Available |
|-------|-----------------|
| **WSDOT (Washington)** | Full bid tabs by month/contract number + Unit Bid Analysis (UBA) with project history per item |
| **ODOT (Oregon)** | Spreadsheets with bid price data: date, contract, region, description, quantity, price, bidder rank |
| **TxDOT (Texas)** | Interactive dashboard: all bids for past 24 months, including DOT estimate |
| **MDOT (Michigan)** | Bid results and tabulations |
| **VDOT (Virginia)** | Statewide bid tab query tool |
| **SCDOT (South Carolina)** | Online bid tabulation system |
| **NYSDOT (New York)** | Construction bid tabulations |
| **Alabama DOT** | Online bid tabs |
| **FHWA Federal Lands** | Posted on SAM.gov since Oct 2021 |
| **IDOT (Illinois)** | Pay Item Award Reports downloadable from Transportation Bulletin |

**Critical insight:** The raw data is mostly public and free. What Oman sells is:
1. **Aggregation** across 49 states (no one else has done this)
2. **Standardization** (different states publish in different formats)
3. **Categorization** (31 categories, manually curated)
4. **Analysis tools** (the BidTabs reports, graphs, comparisons)
5. **Convenience** (one tool vs 49 different DOT websites)

**This is exactly what we're building with the Estimator module.** We've already aggregated 1.4M rows of IDOT award data and built the analysis engine. The question is whether to expand to more states.

---

## 6. Typical Contractor Workflow with Bid Tab Data

Based on research, here is how contractors and DOTs use historical bid data:

### Contractor Estimating Workflow

1. **DOT advertises a project** — contractor downloads plans, specs, and bid items
2. **Estimator reviews bid items** — identifies which items they know well (crew-estimate from experience) and which need market research
3. **Historical price lookup** — for unfamiliar items or as a sanity check, estimator searches historical bid tabs for that pay item in the same geographic area
4. **Filter and refine** — narrow by county, project size, quantity range, recent dates, and winning bids to get relevant comparisons
5. **Adjust for inflation** — apply NHCCI or asphalt index to bring older prices to current dollars
6. **Compare to competition** — look at what specific competitors typically bid on similar items
7. **Set prices** — combine crew-based estimates (high-value items) with historical pricing (everything else)
8. **Validate bid** — compare total bid against historical project size for similar work types; use BidTabs Plus to "tab out" and check work breakdown
9. **Post-bid analysis** — after letting, compare your bid to the winner's and to state averages to improve future estimates

### DOT / Engineer's Estimate Workflow

1. **Design project** — engineers define scope and bid items
2. **Create engineer's estimate** — use historical bid data to estimate fair market price for each item
3. **Set bid bond requirements** — based on estimated project cost
4. **Evaluate bids** — compare submitted bids to engineer's estimate and to each other
5. **Monitor market** — track construction cost trends, identify if prices are rising/falling in specific categories or regions

### Bonding Company Workflow

1. **Contractor requests bond** — bonding company needs to evaluate the contractor's bid
2. **Sanity check the bid** — compare contractor's prices to historical averages for that work type
3. **Assess risk** — identify items where the contractor's price is significantly below market (possible loss leaders or errors)

---

## 7. Market Size and Growth

| Market | 2025 Size | Projected | CAGR |
|--------|-----------|-----------|------|
| Construction Estimating Software | $2.73B | $5.01B (2030) | 12.89% |
| Construction Bid Management Software | $1.16B | $3.35B (2035) | ~11% |
| Broader Construction Software | $10.19B | $21.04B (2032) | ~10% |

**Growth drivers:**
- Rapid digitization across construction industry
- Rising material-price volatility (contractors need better pricing intelligence)
- Shrinking skilled labor pool (estimators retiring, tools need to be easier for new people)
- PennDOT's Digital Delivery Directive 2025 mandating 3D models (signals DOT tech modernization)
- Infrastructure Investment and Jobs Act (IIJA) funding driving more DOT projects

**Key stat:** Contractors using dedicated bid management platforms win 31% more work and reduce estimating costs by 22% vs spreadsheet/email workflows.

---

## 8. Common User Pain Points and Feature Gaps

Based on research across the competitive landscape:

### With BidTabs.NET Specifically

1. **Windows-only** — Mac users, tablet users, mobile users are locked out
2. **Old UI** — Windows XP-era interface design, not intuitive for younger estimators
3. **No collaboration** — one person, one computer, one license
4. **Price variability** — "average unit price for the year can have a very large swing in min/max" (acknowledged by users). No statistical confidence indicators to help interpret this
5. **No integration** — can't feed BidTabs data into HeavyBid, B2W, or other estimating tools via API
6. **Manual workflow** — must manually export, re-enter, or copy-paste data between systems

### With Construction Estimating Generally

1. **Still using Excel** — 26% of construction professionals cite "time consuming estimating process" as their biggest challenge. Large spreadsheets crash, formula errors propagate silently, version control is nonexistent
2. **No real-time updates** — material prices change daily; historical tools show what things cost months ago
3. **Poor mobile support** — estimators are often in the field but tools are desktop-only
4. **Training burden** — complex tools like HeavyBid require significant training investment
5. **Integration gaps** — estimating tools don't talk to field management, accounting, or bid submission systems
6. **Single-state thinking** — most free DOT tools only cover one state; contractors working across states need aggregated data
7. **No predictive analytics** — all tools are backward-looking; none predict where prices are heading
8. **Limited confidence indicators** — raw averages without sample size, recency weighting, or statistical confidence are misleading

---

## 9. AssetLink Estimator — Competitive Positioning

### What We Already Have That BidTabs Does Not

| Feature | AssetLink Estimator | BidTabs.NET |
|---------|-------------------|-------------|
| **Platform** | Web-based (any browser, any device) | Windows-only desktop app |
| **Technology** | Modern stack (FastAPI, React, PostgreSQL) | .NET WinForms, ClickOnce |
| **Data** | 1.4M IDOT award items (2003-2026) | 49 states, 20+ years |
| **Pricing engine** | Recency-weighted averages (exponential decay) | Weighted/straight/median average |
| **Confidence scoring** | Percentile rank vs historical distribution | None |
| **Inflation adjustment** | FHWA NHCCI (2003-2025, quarterly) | NHCCI + state asphalt index |
| **Regional factors** | 50 states + DC (RSMeans-style multipliers) | Per-state data, suburban/urban/rural |
| **Categorization** | 45 IDOT divisions, 302 subcategories | 31 categories |
| **Estimate builder** | Full CRUD, auto-pricing, recalculate, CSV export | BidTabs Plus add-on (import/compare) |
| **API** | REST API with OpenAPI docs | None |
| **Mobile** | Responsive web (works on any device) | No |
| **Multi-tenant** | Built-in (per-organization data isolation) | Single-computer license |

### Where BidTabs Still Beats Us

1. **49 states vs 1** — This is their biggest advantage. We only have Illinois data. Expanding to even 5-10 major states would dramatically close this gap
2. **Contractor-level analysis** — BidTabs can show what any specific contractor typically bids. We have contractor data but haven't built the analysis views yet
3. **Head-to-head comparison** — "Compare 2 Contractors" is a killer feature for competitive intelligence
4. **Market/competitor analysis reports** — market share, win rates, competitive positioning. We don't have these yet
5. **DOT trust and relationships** — 25+ years of working with state DOTs, FHWA relationship
6. **Data depth** — They have data back to the mid-1990s in some states; we start at 2003 for IL

### Strategic Opportunities

1. **Modern web experience** — Be the first DOT bid tab tool that works in a browser. BidTabs' Windows-only limitation is a massive opening
2. **Self-serve pricing** — Transparent pricing, free tier or freemium model. BidTabs' quote-based approach locks out small contractors and students
3. **API-first** — Let users integrate bid data into their own tools. Nobody else offers this
4. **Predictive pricing** — Use historical trends + NHCCI trajectory to project where prices are heading (not just where they've been)
5. **Confidence and data quality** — Show sample size, recency distribution, and statistical confidence alongside every price estimate. BidTabs shows raw averages without context
6. **Illinois-first, then expand** — Own Illinois deeply (we already have better IL coverage with 1.4M rows and 302 subcategories vs their 31 categories), then systematically add states
7. **Integrate with the rest of AssetLink** — Municipalities using our asset management can also use the estimator for engineer's estimates. Contractors using the estimator get exposure to AssetLink's municipal modules. Cross-sell opportunity that Oman cannot replicate
8. **Target younger estimators** — Modern UI, mobile-friendly, collaborative. The next generation of estimators won't tolerate a WinForms app

### Expansion Roadmap for Multi-State Coverage

To compete with BidTabs' 49-state coverage, prioritize states by:
1. **Data availability** — states that publish machine-readable bid tabs (Oregon, Texas, Washington, Virginia all have good online systems)
2. **Market size** — Texas, California, Florida, New York, Pennsylvania are the biggest DOT spenders
3. **Data format complexity** — some states publish clean CSVs, others publish PDFs or proprietary formats
4. **Contractor demand** — which states have the most contractors bidding on DOT work?

A realistic 12-month target: Illinois (done) + 5-10 additional states = meaningful competition.

---

## Sources

- [BidTabs.NET Product Page](https://www.omanco.com/product/bid-tabs-net/)
- [ProEstimate.NET Product Page](https://www.omanco.com/product/pro-estimate-net/)
- [DOT Bundle](https://www.omanco.com/dot-bundle-get-the-power-of-historical-cost-based-estimating/)
- [ProEstimate Heavy vs NET Changes](https://www.omanco.com/proestimate-heavy-vs-proestimate-netchanges-we-made/)
- [Client Testimonials](https://www.omanco.com/partners/testimonials/)
- [BidTabs.NET by Oman Systems — HeavyBid & Beyond](https://heavybid.ewksol.com/index.php/2020/03/20/bidtabs-net-by-oman-systems/)
- [BidTabs Pro Users Manual v6.05 (WSDOT)](https://wsdot.wa.gov/publications/fulltext/ProjectDev/AdReady/BidTabsPro/OmanBidTabsPro.pdf)
- [BidTabs.NET ClickOnce Publish Page](http://www.fieldmanagerpro.com/bidTABS.NET/Publish.htm)
- [FHWA NHCCI Methodology](https://www.fhwa.dot.gov/policy/otps/nhcci/methodology.cfm)
- [HCSS HeavyBid](https://www.hcss.com/products/construction-estimating-software/)
- [HCSS Pricing](https://www.hcss.com/pricing/)
- [B2W Estimate](https://www.trimble.com/en/products/b2w-software/estimate)
- [B2W Pricing](https://softwareconnect.com/reviews/b2w-estimate/)
- [InfoTech Bid Express](https://www.infotechinc.com/bidexpress/)
- [InfoTech BidX](https://www.infotechinc.com/bidx/)
- [AASHTOWare Project Bids](https://www.aashtowareproject.org/bids)
- [WSDOT Bid Tabulations](https://wsdot.wa.gov/business-wsdot/contracts/about-public-works-contracts/public-works-contract-history/bid-tabulations)
- [WSDOT Unit Bid Analysis](https://wsdot.wa.gov/engineering-standards/design-topics/engineering-applications/unit-bid-analysis)
- [Oregon DOT Bid Item Prices](https://www.oregon.gov/odot/business/pages/average_bid_item_prices.aspx)
- [TxDOT Bid Tabulations Dashboard](https://www.txdot.gov/business/road-bridge-maintenance/contract-letting/bid-tabulations-dashboard.html)
- [RSMeans Data](https://www.rsmeans.com/)
- [Construction Estimating Software Market (Mordor Intelligence)](https://www.mordorintelligence.com/industry-reports/construction-estimating-software-market)
- [FHWA Guidelines on Engineer's Estimates](https://www.fhwa.dot.gov/programadmin/contracts/ta508046.cfm)
- [Oman Systems LinkedIn](https://www.linkedin.com/company/omansytemsinc)
- [Oman Systems on Growjo](https://growjo.com/company/Oman_Systems)
- [HCSS HeavyBid on Capterra](https://www.capterra.com/p/34221/HeavyBid/)
- [B2W vs HCSS Comparison](https://www.getonecrew.com/post/b2w-vs-hcss)
