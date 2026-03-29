# AssetLink Estimator — Product Expansion Roadmap

> Date: 2026-03-29
> Context: Analysis of competitive gap vs BidTabs.NET (Oman Systems) and recommendations for making the Estimator a standalone product.

---

## The Gap: You Have a Pricing Engine. They Have a War Room.

The AssetLink Estimator answers: *"What should this item cost?"*
BidTabs answers: *"What should it cost, who are you bidding against, what do they typically bid, where are they winning, and where is the market going?"*

BidTabs isn't just a pricing tool. It's a **competitive intelligence platform** disguised as a bid tab viewer. That's what makes it sticky. The Estimator already beats them on technology (web-based, modern stack, confidence scoring, API). What it lacks is **breadth of intelligence**.

---

## Features to Add (Prioritized)

### Tier 1 — Contractor Intelligence (Highest Impact)

#### 1. Contractor Profiles & Win Rate Analysis

We already have contractor data in the `contractor` and `bid` tables from IDOT bid tabs. Build views that show:

- Contractor bidding history (jobs bid, jobs won, win rate)
- Price tendencies by item category (do they bid heavy on asphalt? cheap on earthwork?)
- Geographic footprint (which counties/districts do they work in?)
- Activity trend (are they bidding more or less this year?)

This is BidTabs' "By Contractor" and "Contractor Analysis" reports — their users' #2 most-used feature.

#### 2. Head-to-Head Contractor Comparison

*"Compare 2 Contractors"* is a killer BidTabs feature. Show side-by-side: your historical prices vs. a competitor's, item by item, with variance highlighting. A contractor preparing a bid can see *"On the last 10 jobs where we both bid, Company X beats us on earthwork by 12% but we beat them on asphalt by 8%."*

#### 3. Job/Letting Analysis

Show full bid tab breakdowns for any historical contract: every bidder, every line item, who won, by how much, how each bidder compared to the engineer's estimate. This is the "By Job" report — the thing estimators use for post-bid analysis.

---

### Tier 2 — Market Intelligence

#### 4. Market Trends Dashboard

Interactive charts showing:

- Letting volume by month/quarter/year (is the market growing?)
- Average prices by category over time (where are costs rising fastest?)
- Work type mix (what's getting built — more bridges? more resurfacing?)
- County/district heatmap of construction activity

#### 5. Price Trend Forecasting

We already have NHCCI data through Q4 2025 and 24 years of historical prices. Build a simple trend line: *"Based on the last 5 years, HMA surface course has been increasing at 6.2%/year. Projected 2027 price: $178/TON."* Nobody else does forward-looking projections.

#### 6. Bid Comparison Tool (Tab Out)

This is BidTabs Plus. Let users import a project's bid items (from a letting advertisement or their own estimate) and instantly compare every line item to historical averages. Color-code items that are significantly above or below market. This is the "am I about to win or lose money?" sanity check.

---

### Tier 3 — Multi-State Expansion

#### 7. Add 5-10 More States

We already have the scraper architecture. The highest-value targets:

| State | Rationale |
|---|---|
| **Texas** | Largest DOT spender, has a clean public bid tab dashboard |
| **Florida** | Large market, district-level data available |
| **California** | Highest costs, huge market |
| **New York** | Large market, public data |
| **Ohio** | Large program, accessible data |
| **Pennsylvania** | Large program, accessible data |
| **Georgia** | Large program, accessible data |

Each state added makes the product exponentially more valuable to multi-state contractors (which are the ones willing to pay).

---

### Tier 4 — Workflow & Integration

#### 8. Bid Workspace / Project Board

Turn the estimate builder into a project-centric workspace: create a project from a letting advertisement, auto-import bid items, price them, track who's bidding, note your strategy per item, and export the final bid. This is the workflow gap between "tool" and "platform."

#### 9. API Access (Already Done)

We already have a REST API. Package it as a feature. Let HeavyBid/B2W users pull price data into their estimating tools. Nobody else offers this. Charge for API access as a premium tier.

#### 10. Engineer's Estimate Mode

DOTs use BidTabs to create engineer's estimates. Add a mode that generates an engineer's estimate report (formatted for DOT use, with source citations and statistical basis). This opens the DOT buyer persona — the same orgs already using our municipal asset management.

---

## The Product Vision

```
AssetLink Estimator
├── Price Intelligence          ← We have this (1.4M prices, inflation, regional, confidence)
├── Contractor Intelligence     ← Build this (profiles, head-to-head, win rates)
├── Market Intelligence         ← Build this (trends, forecasting, heatmaps)
├── Bid Workspace              ← Build this (project board, tab-out, export)
├── Multi-State Data           ← Expand this (TX, FL, CA, NY, OH...)
└── API Access                 ← Package this (let other tools consume your data)
```

That's a product worth $200-500/month to a contractor, and it runs in a browser on any device — which BidTabs can't do.

---

## What We Should NOT Build

| Don't Build | Why |
|---|---|
| **Crew-based estimation** | That's ProEstimate/HeavyBid territory — different product, massive scope |
| **Bid submission** | That's Bid Express — infrastructure, not analysis |
| **Field management** | We already have this in AssetLink's asset modules |

---

## Current Competitive Position

### Where We Already Win vs BidTabs.NET

| Feature | AssetLink Estimator | BidTabs.NET |
|---|---|---|
| **Platform** | Web-based (any browser, any device) | Windows-only desktop app |
| **Technology** | Modern stack (FastAPI, React, PostgreSQL) | .NET WinForms, ClickOnce |
| **Pricing engine** | Recency-weighted averages (exponential decay) | Weighted/straight/median average |
| **Confidence scoring** | Percentile rank vs historical distribution | None |
| **Inflation adjustment** | FHWA NHCCI (2003-2025, quarterly) | NHCCI + state asphalt index |
| **Regional factors** | 50 states + DC (RSMeans multipliers) | Per-state data, suburban/urban/rural |
| **Categorization** | 45 IDOT divisions, 302 subcategories | 31 categories |
| **Estimate builder** | Full CRUD, auto-pricing, recalculate, CSV export | BidTabs Plus add-on (import/compare) |
| **API** | REST API with OpenAPI docs | None |
| **Mobile** | Responsive web (works on any device) | No |
| **Multi-tenant** | Built-in (per-organization data isolation) | Single-computer license |

### Where BidTabs Still Beats Us

1. **49 states vs 1** — their biggest advantage. We only have Illinois data.
2. **Contractor-level analysis** — they can show what any specific contractor typically bids. We have the data but haven't built the views.
3. **Head-to-head comparison** — "Compare 2 Contractors" is a killer feature for competitive intelligence.
4. **Market/competitor analysis reports** — market share, win rates, competitive positioning.
5. **DOT trust and relationships** — 25+ years of working with state DOTs, FHWA relationship.
6. **Data depth** — they have data back to the mid-1990s in some states; we start at 2003 for IL.

---

## Market Context

| Market | 2025 Size | Projected | CAGR |
|---|---|---|---|
| Construction Estimating Software | $2.73B | $5.01B (2030) | 12.89% |
| Construction Bid Management Software | $1.16B | $3.35B (2035) | ~11% |

**Key stat:** Contractors using dedicated bid management platforms win 31% more work and reduce estimating costs by 22% vs spreadsheet/email workflows.

**BidTabs' biggest weakness is technology.** Windows-only desktop app, XP-era UI, no API, no mobile, no collaboration, single-computer licensing, opaque pricing. This is a massive opening for a modern web platform.

**BidTabs' biggest moat is data.** 49 states, 20+ years, sole supplier to FHWA for NHCCI. Closing this gap requires systematic state-by-state data acquisition.

---

## Related Documents

- `docs/competitive_analysis_bidtabs_estimating.md` — Full competitive research (BidTabs features from their user manual, competitor profiles, market data, user pain points)
- `docs/estimator_pricing_methodology.md` — How our pricing engine works (inflation, recency, regional)
- `docs/estimator_regional_factors.md` — Regional cost factor methodology and full state table
