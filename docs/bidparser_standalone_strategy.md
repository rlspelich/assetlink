# BidParser — Standalone Product Strategy

> Date: 2026-03-30
> Domain: bidparser.com
> Context: BidParser is the Estimator module within AssetLink, but needs its own brand identity as a standalone product for contractors.

---

## Architecture: Share the Plumbing, Not the Storefront

One codebase, one database, one deployment. The frontend detects which domain it's served from and shows the appropriate brand and modules.

```
bidparser.com          → Marketing site (Webflow) — contractor-focused messaging
app.bidparser.com      → Same Cloud Run app, different route/branding
assetlink.us           → Marketing site (Webflow) — municipality-focused messaging
app.assetlink.us       → Same Cloud Run app, different route/branding
```

### How It Works

- **bidparser.com** login → tenant_type: "contractor", modules_enabled: ["estimator"] → sees only Estimator tabs, BidParser branding
- **assetlink.us** login → tenant_type: "municipality", modules_enabled: ["signs", "water", "sewer"] → sees only Asset Management, AssetLink branding
- **A contractor who also does municipal work** → modules_enabled: ["estimator", "signs"] → sees both, branded per domain they logged in from

---

## What Needs to Change

| Layer | Current | Needed |
|---|---|---|
| **Domain routing** | Single domain (assetlink.bucket6.com) | Cloud Run custom domain mapping for both domains |
| **Frontend branding** | AssetLink logo + nav everywhere | Domain-aware: detect hostname → show BidParser or AssetLink branding |
| **Sidebar navigation** | Shows all modules | Module-gated: only show nav items for enabled modules |
| **Login page** | Generic | Branded per domain — BidParser has its own identity |
| **Clerk auth** | Single app | Same Clerk app, works on both domains |
| **Stripe billing** | Not yet built | Two product lines: BidParser subscription + AssetLink subscription (or combined) |
| **Marketing sites** | None yet | Two Webflow sites with different messaging |

---

## Pricing Strategy

```
BidParser (bidparser.com)
├── Free Tier: Pay item search, limited price history (last 2 years)
├── Professional ($99/mo): Full 23-year history, contractor intelligence,
│   head-to-head, market analysis, exports, API access
├── Enterprise ($249/mo): Multi-user, custom groups, priority data updates
│
AssetLink (assetlink.us)
├── Signs Module ($X/mo)
├── Water & Sewer ($X/mo)
├── Full Platform ($X/mo): All modules
├── Add BidParser: +$79/mo (discounted bundle)
```

The bundled price is the cross-sell — a municipality that uses AssetLink for asset management gets BidParser at a discount for their engineer's estimates. A contractor who uses BidParser gets exposure to AssetLink if they also do municipal work.

---

## Target Users by Product

### BidParser (bidparser.com)

| User | Use Case |
|---|---|
| **Contractor estimators** | Historical price lookup, bid strategy, competitive intelligence |
| **Subcontractors** | Price benchmarking for specialty items |
| **DOT engineers** | Engineer's estimates, cost validation |
| **Engineering/consulting firms** | Project cost estimates for clients |
| **Bonding companies** | Bid sanity checking, contractor risk assessment |
| **Universities** | Construction cost research |

### AssetLink (assetlink.us)

| User | Use Case |
|---|---|
| **Municipal DPW** | Sign inventory, water/sewer asset management |
| **County engineers** | Infrastructure tracking, compliance |
| **Utility districts** | Pipe/valve/hydrant management |
| **Consulting firms** | Asset condition assessment for municipal clients |

---

## Implementation Priority

1. **Domain-aware branding** (1-2 hours) — detect hostname, swap logo/colors/title
2. **Module-gated navigation** (already partially built) — sidebar only shows modules the tenant has access to
3. **Custom domain setup** on Cloud Run (30 min) — map bidparser.com and assetlink.us
4. **Clerk multi-domain** — configure Clerk to accept auth from both domains
5. **Stripe integration** — subscription management, module provisioning

---

## Technical Details

### Domain Detection (Frontend)

```typescript
const hostname = window.location.hostname;
const isBidParser = hostname.includes('bidparser');
const brand = isBidParser
  ? { name: 'BidParser', logo: '/bidparser-logo.svg', accent: '#...' }
  : { name: 'AssetLink', logo: '/assetlink-logo.svg', accent: '#3B82F6' };
```

### Cloud Run Custom Domains

```bash
# Map both domains to the same Cloud Run service
gcloud run domain-mappings create --service assetlink-api --domain app.bidparser.com
gcloud run domain-mappings create --service assetlink-api --domain app.assetlink.us
```

### Clerk Multi-Domain

Clerk supports multiple authorized domains on a single application. Both `app.bidparser.com` and `app.assetlink.us` are added as authorized origins in the Clerk dashboard.

### Stripe Product Lines

```
Stripe Products:
├── prod_bidparser_pro     → BidParser Professional ($99/mo)
├── prod_bidparser_ent     → BidParser Enterprise ($249/mo)
├── prod_assetlink_signs   → AssetLink Signs ($X/mo)
├── prod_assetlink_water   → AssetLink Water & Sewer ($X/mo)
├── prod_assetlink_full    → AssetLink Full Platform ($X/mo)
└── prod_bundle            → AssetLink + BidParser Bundle (discounted)
```

On subscription creation, Stripe webhook updates the tenant's `modules_enabled` array in the database.

---

## Related Documents

- `docs/estimator_product_roadmap.md` — Feature roadmap for the Estimator/BidParser module
- `docs/competitive_analysis_bidtabs_estimating.md` — Competitive analysis vs Oman BidTabs.NET
- `docs/estimator_pricing_methodology.md` — How the pricing engine works
- `docs/estimator_regional_factors.md` — Regional cost factor methodology
- `CLAUDE.md` — Platform architecture decision: "Share the plumbing, not the storefront"
