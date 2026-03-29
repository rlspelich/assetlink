# AssetLink Estimator — Pricing & Inflation Methodology

> Version 1.0 | March 2026
> Module: Estimator (Phase 1b)

---

## Overview

The AssetLink Estimator generates construction cost estimates using **1.4 million awarded contract prices** from the Illinois Department of Transportation (IDOT), spanning 2003 through 2026. Raw historical prices are adjusted through a three-stage pipeline before being presented as a recommended unit price:

1. **Inflation Adjustment** — brings past prices to current-year dollars
2. **Recency Weighting** — gives more influence to recent data
3. **Regional Adjustment** — accounts for geographic cost differences across all 50 states

The result is a defensible, data-driven unit price that reflects what the item would cost **today**, in the **target geography**, based on **real awarded contract data** — not opinion or rule-of-thumb.

---

## Data Sources

### IDOT Pay Item Award Reports

| Attribute | Detail |
|---|---|
| **Source** | IDOT Transportation Bulletin — Pay Item Reports with Awarded Prices |
| **Format** | Scraped Excel reports, converted to standardized CSV |
| **Coverage** | January 2003 — April 2026 (164 letting files) |
| **Total Records** | 1,385,747 awarded line items |
| **Unique Pay Items** | 36,102 distinct IDOT pay item codes |
| **Contracts** | 21,029 contracts across 24 years |
| **Fields per Record** | Pay item code, description, unit, quantity, unit price, contract number, county, IDOT district, letting date |

This is **public data** — every price in the system is a real price that was awarded on an actual IDOT contract. No synthetic or estimated data is used.

### FHWA National Highway Construction Cost Index (NHCCI)

| Attribute | Detail |
|---|---|
| **Source** | Federal Highway Administration |
| **Coverage** | Q1 2003 — Q4 2025 (93 quarterly observations) |
| **Base Year** | 2003 (Q1 2003 = 100.00) |
| **Latest Value** | Q4 2025 = 310.80 |
| **Granularity** | Quarterly |
| **Purpose** | Adjusts historical prices for construction cost inflation |

The NHCCI tracks the cost of highway construction inputs (labor, materials, equipment) nationwide and is the standard inflation index used by state DOTs and FHWA for construction cost trending.

### RSMeans City Cost Index — Regional Factors

| Attribute | Detail |
|---|---|
| **Source** | RSMeans (Gordian) City Cost Index |
| **Coverage** | All 50 states + District of Columbia |
| **Base** | Illinois = 1.0000 |
| **Year** | 2025 |
| **Update Frequency** | Annual |
| **Purpose** | Adjusts Illinois-based prices for other states |

---

## Stage 1: Inflation Adjustment

### The Problem

A cubic yard of earth excavation that cost $12.00 in 2008 does not cost $12.00 today. Construction input costs — diesel, steel, labor, asphalt — have changed substantially. Using raw historical prices without adjustment would systematically underestimate current costs.

### The Method

Every historical price is adjusted to current-year dollars using the FHWA NHCCI quarterly index:

```
adjusted_price = historical_price x (target_index / source_index)
```

Where:
- **historical_price** = the actual awarded unit price from the contract
- **source_index** = NHCCI value for the quarter when the contract was let
- **target_index** = NHCCI value for the target estimate year (defaults to Q4 of the current year)

### Example

A pay item was awarded at **$18.50/CU YD** on a contract let in **Q1 2014**.

| Component | Value |
|---|---|
| Historical price | $18.50 |
| NHCCI Q1 2014 | 194.80 |
| NHCCI Q4 2025 | 310.80 |
| Adjustment factor | 310.80 / 194.80 = **1.5954** |
| **Adjusted price** | $18.50 x 1.5954 = **$29.52** |

This means: what cost $18.50 in early 2014 would cost approximately $29.52 in late 2025, based on the trajectory of national highway construction costs.

### Division-to-Index Mapping

The NHCCI is a composite index covering highway construction broadly. All 23 IDOT pay item divisions (Earthwork, Bituminous Surfaces, Bridges, Utilities, Erosion Control, etc.) currently map to the NHCCI as the index source. The system architecture supports per-division index sources (e.g., mapping asphalt items to BLS PPI for Asphalt, steel items to PPI for Steel) — this can be activated when finer-grained indices add value.

### Quarter Determination

Each letting date is converted to a fiscal quarter for index lookup:

| Letting Month | Quarter |
|---|---|
| January — March | Q1 |
| April — June | Q2 |
| July — September | Q3 |
| October — December | Q4 |

### Fallback Behavior

| Scenario | Behavior |
|---|---|
| Exact quarter not in database | Uses the latest available quarter for that year |
| Year not in database | Uses the latest available index value for the source |
| No index data exists at all | Returns factor of 1.0 (no adjustment applied) |
| Source index is zero | Returns factor of 1.0 (no adjustment applied) |

Inflation adjustment can be toggled on or off per estimate via the `use_inflation_adjustment` setting.

---

## Stage 2: Recency Weighting

### The Problem

Not all historical data points are equally relevant. A price from last month is more informative than a price from 2008, even after inflation adjustment. Market conditions, contractor capacity, material availability, and competitive dynamics change in ways that raw inflation indices don't fully capture.

### The Method

Each historical price receives a weight based on how recently the contract was let:

| Data Age | Weight | Rationale |
|---|---|---|
| 0 — 2 years | **1.00** | Current market conditions; full relevance |
| 2 — 5 years | **0.50** | Recent but may not reflect current supply/demand |
| 5 — 10 years | **0.25** | Useful for trend context; reduced influence |
| 10+ years | **0.10** | Minimal relevance; retained for items with sparse recent data |

The **weighted average** is computed as:

```
weighted_avg = SUM(adjusted_price_i x weight_i) / SUM(weight_i)
```

### Why Not Just Use Recent Data?

For common items (earth excavation, HMA surface course), there may be hundreds of recent data points and older data adds little. But for specialized items (unusual bridge bearings, uncommon utility fittings), there may only be 5-10 occurrences in the entire 24-year dataset. The weighting scheme ensures these items still get a price recommendation while appropriately favoring recent evidence when it exists.

### Example

For pay item 20200100 (Earth Excavation) with 6 data points:

| Letting Date | Nominal Price | Inflation-Adjusted | Age (years) | Weight |
|---|---|---|---|---|
| 2025-01-10 | $22.50 | $22.95 | 0.2 | 1.00 |
| 2024-06-10 | $19.75 | $20.89 | 0.8 | 1.00 |
| 2024-03-20 | $21.00 | $22.26 | 1.0 | 1.00 |
| 2024-01-15 | $18.50 | $19.72 | 1.2 | 1.00 |
| 2023-04-15 | $17.80 | $19.85 | 2.9 | 0.50 |
| 2023-09-05 | $16.25 | $17.94 | 2.5 | 0.50 |

```
Weighted avg = (22.95x1 + 20.89x1 + 22.26x1 + 19.72x1 + 19.85x0.5 + 17.94x0.5)
             / (1 + 1 + 1 + 1 + 0.5 + 0.5)
             = 104.72 / 5.0
             = $20.94
```

Compare to a simple average of $20.60 — the weighted average gives slightly more influence to the cluster of recent (2024-2025) prices.

---

## Stage 3: Regional Adjustment

### The Problem

All 1.4 million data points are from Illinois IDOT contracts. A contractor bidding work in New York, California, or Mississippi faces different labor rates, material costs, and market conditions.

### The Method

State-level cost multipliers derived from the RSMeans City Cost Index adjust Illinois-based prices for other geographies:

```
regional_price = adjusted_price x state_factor
```

Illinois is the baseline at **1.0000**. All other states are expressed relative to Illinois.

### Selected Regional Factors (2025)

| State | Factor | Interpretation |
|---|---|---|
| Mississippi (MS) | 0.8200 | 18% less expensive than IL |
| Arkansas (AR) | 0.8400 | 16% less expensive than IL |
| South Carolina (SC) | 0.8400 | 16% less expensive than IL |
| Texas (TX) | 0.8800 | 12% less expensive than IL |
| **Illinois (IL)** | **1.0000** | **Baseline** |
| Pennsylvania (PA) | 1.0500 | 5% more expensive than IL |
| Connecticut (CT) | 1.1500 | 15% more expensive than IL |
| New York (NY) | 1.2200 | 22% more expensive than IL |
| California (CA) | 1.2500 | 25% more expensive than IL |
| Alaska (AK) | 1.2800 | 28% more expensive than IL |
| Hawaii (HI) | 1.3200 | 32% more expensive than IL |

<details>
<summary>Full 50-State + DC Factor Table</summary>

| State | Code | Factor |
|---|---|---|
| Alabama | AL | 0.8700 |
| Alaska | AK | 1.2800 |
| Arizona | AZ | 0.9200 |
| Arkansas | AR | 0.8400 |
| California | CA | 1.2500 |
| Colorado | CO | 0.9800 |
| Connecticut | CT | 1.1500 |
| Delaware | DE | 1.0200 |
| District of Columbia | DC | 1.0800 |
| Florida | FL | 0.8900 |
| Georgia | GA | 0.8800 |
| Hawaii | HI | 1.3200 |
| Idaho | ID | 0.9100 |
| Illinois | IL | 1.0000 |
| Indiana | IN | 0.9500 |
| Iowa | IA | 0.9300 |
| Kansas | KS | 0.9000 |
| Kentucky | KY | 0.8900 |
| Louisiana | LA | 0.8600 |
| Maine | ME | 0.9600 |
| Maryland | MD | 1.0100 |
| Massachusetts | MA | 1.1800 |
| Michigan | MI | 0.9700 |
| Minnesota | MN | 1.0300 |
| Mississippi | MS | 0.8200 |
| Missouri | MO | 0.9400 |
| Montana | MT | 0.9200 |
| Nebraska | NE | 0.9100 |
| Nevada | NV | 1.0200 |
| New Hampshire | NH | 1.0000 |
| New Jersey | NJ | 1.1600 |
| New Mexico | NM | 0.8900 |
| New York | NY | 1.2200 |
| North Carolina | NC | 0.8600 |
| North Dakota | ND | 0.9100 |
| Ohio | OH | 0.9600 |
| Oklahoma | OK | 0.8500 |
| Oregon | OR | 1.0100 |
| Pennsylvania | PA | 1.0500 |
| Rhode Island | RI | 1.1200 |
| South Carolina | SC | 0.8400 |
| South Dakota | SD | 0.8800 |
| Tennessee | TN | 0.8700 |
| Texas | TX | 0.8800 |
| Utah | UT | 0.9300 |
| Vermont | VT | 0.9500 |
| Virginia | VA | 0.9400 |
| Washington | WA | 1.0500 |
| West Virginia | WV | 0.9200 |
| Wisconsin | WI | 0.9800 |
| Wyoming | WY | 0.9000 |

</details>

### District-Level Filtering

Within Illinois, users can optionally filter historical data by **IDOT district** (1-9) to get prices specific to a region of the state. When no district is specified, all statewide data is used.

---

## Confidence Scoring

### Purpose

Every recommended price includes a **confidence score** that tells the user how their proposed unit price compares to the historical distribution. This helps identify items that may be priced too aggressively (high risk of losing the bid) or too conservatively (leaving money on the table).

### Method

The confidence score is a **percentile rank**: what percentage of historical awarded prices for this item were at or below the proposed price?

```
percentile = (count of historical prices <= proposed price) / (total data points) x 100
```

### Interpretation

| Percentile | Label | Badge Color | Meaning |
|---|---|---|---|
| 0 — 15 | Very Low | Green | Well below typical pricing. Very competitive — may be unsustainably low. |
| 16 — 40 | Low | Green | Below median. Competitive positioning. |
| 41 — 60 | Fair | Blue | Near the median. Typical market pricing. |
| 61 — 85 | High | Yellow | Above median. Premium positioning — may lose competitive bids. |
| 86 — 100 | Very High | Red | Top of market. Significantly above typical awarded prices. |
| No data | No Data | Gray | Insufficient historical data to score. |

### What Confidence Does NOT Measure

- **Project-specific risk** (complex staging, difficult access, contaminated soil)
- **Current contractor capacity** (busy season vs. slow season)
- **Specific material price spikes** (e.g., a steel tariff announced last week)
- **Subcontractor availability** in the target area

Confidence scoring is a **market positioning tool**, not a profitability calculator. A "Fair" confidence score means the price is typical — it does not guarantee the contractor will make money at that price.

---

## Percentile Distribution

In addition to the weighted average, each pay item includes distribution data to help users understand the range of historical pricing:

| Statistic | Description |
|---|---|
| **p10** | 10th percentile — only 10% of historical prices were below this |
| **p25** | 25th percentile — conservative/competitive end of the range |
| **p50** | Median — the middle of the distribution |
| **p75** | 75th percentile — upper end of typical pricing |
| **p90** | 90th percentile — only 10% of historical prices exceeded this |
| **min** | Lowest awarded price in the filtered dataset |
| **max** | Highest awarded price in the filtered dataset |

The **p25-to-p75 range** (interquartile range) is used to generate the **confidence low** and **confidence high** totals on each estimate, giving users a defensible range for budget planning.

---

## Estimate-Level Totals

Each estimate aggregates item-level pricing into three summary totals:

| Total | Calculation | Use Case |
|---|---|---|
| **Nominal Total** | SUM(quantity x raw weighted average) | What the items cost on average historically, no adjustments |
| **Adjusted Total** | SUM(quantity x inflation-adjusted weighted average) | Current-year dollars, Illinois baseline |
| **Regional Total** | SUM(quantity x inflation-adjusted x regional factor) | Final estimate in target geography |
| **Confidence Low** | SUM(quantity x p25) | Conservative end — 75% of historical prices were higher |
| **Confidence High** | SUM(quantity x p75) | Aggressive end — 75% of historical prices were lower |

The **Confidence Low to Confidence High** range represents the likely range for a competitive bid. Bidding below Confidence Low risks leaving margin; bidding above Confidence High risks losing the contract.

---

## Calculation Precision

| Layer | Precision | Type |
|---|---|---|
| Unit prices | 4 decimal places | Numeric(12,4) |
| Quantities | 3 decimal places | Numeric(12,3) |
| Extensions (line totals) | 2 decimal places | Numeric(15,2) |
| Inflation indices | 4 decimal places | Numeric(10,4) |
| Regional factors | 4 decimal places | Numeric(6,4) |

All intermediate calculations use Python's `Decimal` type to avoid floating-point rounding errors. No floating-point arithmetic is used in the pricing pipeline.

---

## Complete Calculation Flow

```
For each line item in an estimate:

1. QUERY historical prices
   └─ SELECT * FROM award_item
      WHERE pay_item_code = :code
        AND letting_date >= (today - 10 years)
        AND unit_price > 0
        AND district = :district (if specified)

2. ADJUST each price for inflation
   └─ For each row:
      ├─ Determine letting quarter from letting_date
      ├─ Look up NHCCI index for letting quarter
      ├─ Look up NHCCI index for target year Q4
      └─ adjusted = nominal x (target_index / source_index)

3. ADJUST each price for regional differences
   └─ adjusted_regional = adjusted x state_factor

4. WEIGHT by recency
   └─ weight = { 1.0 if ≤2yr, 0.5 if ≤5yr, 0.25 if ≤10yr, 0.1 if >10yr }

5. COMPUTE statistics
   ├─ weighted_avg = SUM(price x weight) / SUM(weight)
   ├─ Sort prices, compute p10/p25/p50/p75/p90
   └─ Count data points

6. SCORE confidence
   ├─ percentile = (prices ≤ proposed) / total x 100
   └─ Map to label: very_low / low / fair / high / very_high

7. CALCULATE extension
   └─ extension = quantity x regional_unit_price

8. UPDATE estimate totals
   ├─ total_adjusted = SUM(extensions)
   ├─ confidence_low = SUM(quantity x p25)
   └─ confidence_high = SUM(quantity x p75)
```

---

## User-Configurable Settings

Each estimate can be customized with these settings, which affect how prices are calculated:

| Setting | Default | Effect |
|---|---|---|
| **Target Year** | Current year | Which year to adjust prices to |
| **Target State** | Illinois | Which state's regional factor to apply |
| **Target District** | All (statewide) | Filter historical data to a specific IDOT district (1-9) |
| **Use Inflation Adjustment** | On | Toggle inflation adjustment on/off |

Changing any of these settings triggers an automatic recalculation of all line items in the estimate. Manually-overridden prices are preserved — only auto-computed prices are recalculated.

---

## Data Freshness & Updates

| Data Source | Current Coverage | Update Mechanism |
|---|---|---|
| IDOT Award Prices | Jan 2003 — Apr 2026 | IDOT web scraper downloads new letting files as published (~monthly) |
| FHWA NHCCI | Q1 2003 — Q4 2025 | Manual update from FHWA quarterly release |
| RSMeans Regional Factors | 2025 | Annual update from RSMeans publication |

The system is designed for incremental updates — new award data is appended without affecting existing records. Historical data is never modified.

---

## Limitations & Assumptions

1. **Illinois-centric data.** All 1.4M historical prices are from IDOT contracts. Regional factors approximate out-of-state pricing but do not replace local historical data. Clients estimating work in other states should treat AssetLink prices as informed starting points, not definitive quotes.

2. **NHCCI is a composite index.** It tracks overall highway construction cost trends but does not isolate individual commodities. A steel price spike may not be fully reflected in the composite index for several quarters. The system architecture supports per-commodity indices (BLS PPI for Asphalt, Steel, Concrete, etc.) which can be activated when warranted.

3. **Recency weighting is heuristic.** The 1.0/0.5/0.25/0.1 weight tiers are practical defaults, not derived from statistical optimization. They perform well across the range of IDOT pay items but may be refined as usage data accumulates.

4. **Confidence scoring is descriptive, not predictive.** A "Fair" confidence score means the proposed price is near the historical median — it does not predict whether the contractor will win the bid or make money on the item.

5. **Quantities affect competitiveness.** A unit price for 50 CU YD of excavation will typically be higher than for 50,000 CU YD due to economies of scale. The current system does not adjust for quantity tiers — all quantities for a given pay item are pooled. Quantity-based price banding is planned for a future release.

6. **Zero and negative prices are excluded.** Award records with unit_price <= 0 are filtered out before any calculations. These typically represent contract adjustments, lump-sum redistributions, or data entry errors.
