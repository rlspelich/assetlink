# AssetLink Estimator — Regional Cost Factors

> Version 1.0 | March 2026
> Module: Estimator (Phase 1b)

---

## What Are Regional Factors?

Every price in the AssetLink Estimator is derived from **Illinois IDOT contract data**. When estimating work in another state, those Illinois-based prices need to be adjusted for the cost differences between Illinois and the target state.

Regional cost factors are **multipliers** that convert Illinois-based prices to equivalent prices in any of the 50 states plus the District of Columbia. They account for systemic differences in:

- **Labor rates** — prevailing wages, union density, cost of living
- **Material costs** — transportation distance, local supply/demand, taxes
- **Equipment costs** — availability, mobilization distances
- **Overhead and profit margins** — local market competitiveness
- **Regulatory costs** — permitting, environmental compliance, bonding

---

## Data Source

| Attribute | Detail |
|---|---|
| **Source** | RSMeans City Cost Index (published by Gordian) |
| **Edition** | 2025 |
| **Coverage** | All 50 states + District of Columbia (51 entries) |
| **Update Frequency** | Annual |
| **Baseline** | Illinois = 1.0000 |

### About RSMeans

The RSMeans City Cost Index is the construction industry's most widely used geographic cost reference. Published annually by Gordian (formerly R.S. Means), it compiles construction cost data from hundreds of U.S. cities and normalizes it into comparable indices. The data is based on:

- Union and open-shop labor rates from field surveys
- Material prices from supplier quotes and published indices
- Equipment costs from rental rate surveys
- Weighted by typical construction project labor/material/equipment ratios

RSMeans factors are used by:
- **Federal agencies** (GSA, Army Corps of Engineers, VA) for project budgeting
- **State DOTs** for cross-state cost comparisons
- **Engineering firms** for preliminary estimates on out-of-state work
- **Contractors** for bid strategy when expanding into new markets

### Why RSMeans (Not Raw Data)?

We have 1.4 million awarded prices from IDOT — but only from Illinois. We do not have equivalent datasets for other states. Rather than attempt to build 50 separate state databases (each with different formats, agencies, and access restrictions), we apply a well-established geographic adjustment factor to normalize our Illinois data to other states.

This approach is:
- **Transparent** — users see the exact multiplier applied
- **Industry-standard** — RSMeans is the accepted source for geographic cost adjustment
- **Auditable** — factors come from a published, citable source
- **Updateable** — new edition each year

---

## How It Works

### The Formula

```
regional_price = illinois_price x state_factor
```

That's it. The regional factor is a single multiplier applied to the inflation-adjusted weighted average price.

### Where It Fits in the Pipeline

Regional adjustment is the **last step** before the final price is stored:

```
1. Query 1.4M historical IDOT award prices for the pay item
2. Adjust each price for inflation (FHWA NHCCI index)
3. Weight by recency (recent data = higher weight)
4. Compute weighted average → this is the base unit price (IL dollars)
5. Multiply by regional factor → this is the regional unit price
6. Multiply by quantity → this is the line item extension
```

Each estimate item stores three price levels for transparency:

| Field | What It Represents |
|---|---|
| `unit_price` | Inflation-adjusted weighted average in Illinois dollars |
| `regional_unit_price` | After applying the state factor |
| `extension` | Quantity x regional unit price (the number that goes on the bid) |

### Example

Estimating **Hot-Mix Asphalt Surface Course** for a project in **California**:

| Step | Value | Calculation |
|---|---|---|
| Historical weighted avg (IL) | $156.52/TON | From 247 IDOT award records, inflation-adjusted |
| California factor | 1.2500 | RSMeans 2025 |
| **Regional unit price** | **$195.65/TON** | $156.52 x 1.25 |
| Quantity | 2,500 TON | From project scope |
| **Line extension** | **$489,125.00** | $195.65 x 2,500 |

If the same estimate were for **Mississippi** (factor 0.82):

| Step | Value | Calculation |
|---|---|---|
| Historical weighted avg (IL) | $156.52/TON | Same base data |
| Mississippi factor | 0.8200 | RSMeans 2025 |
| **Regional unit price** | **$128.35/TON** | $156.52 x 0.82 |
| Quantity | 2,500 TON | Same scope |
| **Line extension** | **$320,875.00** | $128.35 x 2,500 |

The difference: **$168,250** (52%) between California and Mississippi for the same work item and quantity. Geography matters.

---

## Complete Factor Table

All 51 factors sorted by state name. Illinois is the baseline (1.0000).

| State | Code | Factor | vs. Illinois |
|---|---|---|---|
| Alabama | AL | 0.8700 | 13% lower |
| Alaska | AK | 1.2800 | 28% higher |
| Arizona | AZ | 0.9200 | 8% lower |
| Arkansas | AR | 0.8400 | 16% lower |
| California | CA | 1.2500 | 25% higher |
| Colorado | CO | 0.9800 | 2% lower |
| Connecticut | CT | 1.1500 | 15% higher |
| Delaware | DE | 1.0200 | 2% higher |
| District of Columbia | DC | 1.0800 | 8% higher |
| Florida | FL | 0.8900 | 11% lower |
| Georgia | GA | 0.8800 | 12% lower |
| Hawaii | HI | 1.3200 | 32% higher |
| Idaho | ID | 0.9100 | 9% lower |
| **Illinois** | **IL** | **1.0000** | **Baseline** |
| Indiana | IN | 0.9500 | 5% lower |
| Iowa | IA | 0.9300 | 7% lower |
| Kansas | KS | 0.9000 | 10% lower |
| Kentucky | KY | 0.8900 | 11% lower |
| Louisiana | LA | 0.8600 | 14% lower |
| Maine | ME | 0.9600 | 4% lower |
| Maryland | MD | 1.0100 | 1% higher |
| Massachusetts | MA | 1.1800 | 18% higher |
| Michigan | MI | 0.9700 | 3% lower |
| Minnesota | MN | 1.0300 | 3% higher |
| Mississippi | MS | 0.8200 | 18% lower |
| Missouri | MO | 0.9400 | 6% lower |
| Montana | MT | 0.9200 | 8% lower |
| Nebraska | NE | 0.9100 | 9% lower |
| Nevada | NV | 1.0200 | 2% higher |
| New Hampshire | NH | 1.0000 | Same as IL |
| New Jersey | NJ | 1.1600 | 16% higher |
| New Mexico | NM | 0.8900 | 11% lower |
| New York | NY | 1.2200 | 22% higher |
| North Carolina | NC | 0.8600 | 14% lower |
| North Dakota | ND | 0.9100 | 9% lower |
| Ohio | OH | 0.9600 | 4% lower |
| Oklahoma | OK | 0.8500 | 15% lower |
| Oregon | OR | 1.0100 | 1% higher |
| Pennsylvania | PA | 1.0500 | 5% higher |
| Rhode Island | RI | 1.1200 | 12% higher |
| South Carolina | SC | 0.8400 | 16% lower |
| South Dakota | SD | 0.8800 | 12% lower |
| Tennessee | TN | 0.8700 | 13% lower |
| Texas | TX | 0.8800 | 12% lower |
| Utah | UT | 0.9300 | 7% lower |
| Vermont | VT | 0.9500 | 5% lower |
| Virginia | VA | 0.9400 | 6% lower |
| Washington | WA | 1.0500 | 5% higher |
| West Virginia | WV | 0.9200 | 8% lower |
| Wisconsin | WI | 0.9800 | 2% lower |
| Wyoming | WY | 0.9000 | 10% lower |

### By Cost Level

**Most expensive** (factor > 1.10):
1. Hawaii — 1.3200
2. Alaska — 1.2800
3. California — 1.2500
4. New York — 1.2200
5. Massachusetts — 1.1800
6. New Jersey — 1.1600
7. Connecticut — 1.1500
8. Rhode Island — 1.1200

**Near Illinois** (factor 0.95 — 1.05):
- New Hampshire — 1.0000
- Maryland — 1.0100
- Oregon — 1.0100
- Delaware — 1.0200
- Nevada — 1.0200
- Minnesota — 1.0300
- Pennsylvania — 1.0500
- Washington — 1.0500
- Colorado — 0.9800
- Wisconsin — 0.9800
- Michigan — 0.9700
- Maine — 0.9600
- Ohio — 0.9600
- Indiana — 0.9500
- Vermont — 0.9500

**Least expensive** (factor < 0.90):
1. Mississippi — 0.8200
2. Arkansas — 0.8400
3. South Carolina — 0.8400
4. Oklahoma — 0.8500
5. Louisiana — 0.8600
6. North Carolina — 0.8600
7. Alabama — 0.8700
8. Tennessee — 0.8700
9. Georgia — 0.8800
10. South Dakota — 0.8800
11. Texas — 0.8800
12. Florida — 0.8900
13. Kentucky — 0.8900
14. New Mexico — 0.8900

---

## Estimate-Level Totals

Each estimate displays three total lines so users can see exactly what regional adjustment does:

| Total | Definition | When to Use |
|---|---|---|
| **Nominal Total** | SUM(quantity x base unit price) | Sanity check — what would this cost using raw averages? |
| **Adjusted Total** | SUM(quantity x inflation-adjusted unit price) | Illinois-equivalent cost in current-year dollars |
| **Regional Total** | SUM(quantity x regional unit price) | **The final estimate** — adjusted for target state |
| **Confidence Low** | SUM(quantity x 25th percentile price) | Conservative end of the range |
| **Confidence High** | SUM(quantity x 75th percentile price) | Aggressive end of the range |

For Illinois estimates, the Adjusted Total and Regional Total will be identical (factor = 1.0).

---

## Limitations

### 1. State-Level Granularity

Factors are **statewide averages**. Construction costs in Manhattan differ significantly from upstate New York. Costs in Los Angeles differ from rural Northern California. The RSMeans factor for a state represents the average across its metro and non-metro areas.

**What this means for users:** The regional factor is a reasonable starting point, but users estimating work in high-cost metros (NYC, SF, Boston, DC) should expect actual costs above the state average. Users estimating rural work may find costs below the state average.

### 2. Single Composite Factor

The factor is a **single multiplier** applied uniformly to all pay items. In reality, labor costs vary differently than material costs across states. An item that is 80% labor (like hand excavation) will be more sensitive to geographic labor rate differences than an item that is 80% materials (like pipe).

**What this means for users:** The composite factor is directionally correct for mixed-labor-and-material items. For highly labor-intensive items in high-wage states, actual costs may exceed the factored estimate. For material-heavy items, the factor may slightly overstate geographic differences.

### 3. Annual Updates Only

RSMeans publishes annually. Rapid cost changes — a hurricane affecting Gulf Coast lumber prices, a tariff on imported steel, a labor shortage in a specific market — may not be reflected until the next edition.

**What this means for users:** For estimates on work starting within the next 6-12 months, the 2025 factors are appropriate. For estimates on work 2+ years out, users should consider whether market conditions are shifting in the target state.

### 4. Not a Substitute for Local Data

Regional factors adjust Illinois data to approximate other states. They do not replace actual local bid data. A contractor with access to local award histories should use those alongside (not instead of) regionally-adjusted Illinois data.

**What this means for users:** Use regional estimates as a benchmark and sanity check. If you have local data, give it priority.

### 5. Within-Illinois Adjustment

For Illinois projects, the IDOT district filter provides geographic specificity within the state. Districts in the Chicago metro area (District 1) tend to have higher prices than downstate districts. The regional factor is 1.0 for IL, but the district filter handles intra-state variation.

---

## Frequently Asked Questions

### Why is Illinois the baseline?

Our historical price database contains 1.4 million awarded prices from IDOT contracts — all from Illinois. Illinois is the baseline because it's where our data comes from. The regional factor converts our Illinois-anchored data to other states.

### Can I override the regional factor?

Not currently. You can override individual item unit prices manually, which effectively overrides the regional adjustment for that item. A custom factor override per estimate is planned for a future release.

### What if my state isn't listed?

All 50 states and DC are included. If you're estimating work in a U.S. territory (Puerto Rico, Guam, USVI), contact support — we can add territory-specific factors on request.

### How often are factors updated?

Annually, when the new RSMeans edition is published (typically Q1). The `year` field on each factor indicates which edition is in use. Historical factors are preserved — updating to the 2026 edition will not change estimates built with 2025 factors.

### Are these the same factors my engineering firm uses?

Likely yes, if they use RSMeans. The RSMeans City Cost Index is the de facto standard for geographic cost adjustment in the U.S. construction industry. Our factors are state-level averages derived from the same source data.

### Why not use FHWA's state-level cost indices instead?

FHWA publishes highway construction cost data by state, but it covers only highway work and has irregular update cycles. RSMeans covers all construction types (highway, building, utility, site work) with consistent annual updates. For a general-purpose estimating tool, RSMeans provides broader, more reliable coverage.

### How does the regional factor interact with inflation adjustment?

They are independent adjustments applied in sequence:

1. **Inflation** adjusts a historical price to current-year dollars (time adjustment)
2. **Regional** adjusts an Illinois price to another state's cost level (geographic adjustment)

A $20 item from 2015 in Illinois becomes:
- $20 x 1.45 (inflation to 2025) = $29.00 (current IL dollars)
- $29.00 x 1.25 (California factor) = $36.25 (current CA dollars)

The two adjustments answer different questions: "What would it cost today?" (inflation) and "What would it cost there?" (regional).

---

## Technical Reference

### Database Schema

```sql
CREATE TABLE regional_factor (
    regional_factor_id  UUID PRIMARY KEY,
    state_code          VARCHAR(2) NOT NULL UNIQUE,
    state_name          VARCHAR(50) NOT NULL,
    factor              NUMERIC(6,4) NOT NULL,
    source              VARCHAR(50) DEFAULT 'RSMeans',
    year                INTEGER NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/estimator/regional-factors` | List all 51 state factors |
| POST | `/api/v1/estimator/regional-factors/seed` | Load/update factors from bundled CSV |

### Source Data File

`backend/app/services/estimator/data/regional_factors.csv` — CSV with columns: `state_code`, `state_name`, `factor`, `source`, `year`

Updating factors: replace the CSV file with new edition data and call the seed endpoint. Existing factors are updated in-place (upsert by state_code).
