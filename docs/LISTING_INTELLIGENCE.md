# Listing Intelligence Module Documentation

## 1. Overview & Architecture

The **Listing Intelligence** module detects and diagnoses listing inaccuracies across e-commerce channels (Shopify, Amazon, Myntra, Flipkart, WooCommerce). By analyzing customer reviews, customer-reported return reasons, and listing media (catalog images, size charts), it identifies listing defects that drive costly returns and RTOs (Return to Origin).

```
                      ┌──────────────────────┐
                      │  POST /listings/imp  │
                      │  POST /reviews/imp   │
                      └──────────┬───────────┘
                                 │
                     ┌───────────▼───────────┐
                     │ PII Redaction Pipeline │ (Strip names, phone numbers, emails)
                     └───────────┬───────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
         ┌─────────▼────────┐        ┌─────────▼────────┐
         │ pg-boss Queue:   │        │ pg-boss Queue:   │
         │ review.analyze   │        │ image.analyze    │
         └─────────┬────────┘        └─────────┬────────┘
                   │                           │
      ┌────────────▼────────────┐              │
      │ Text Analyzer:          │              │
      │ • LlmAnalyzer (JSON)    │    ┌─────────▼────────┐
      │ • LexiconAnalyzer (Fall)│    │ Image Analyzer:  │
      └────────────┬────────────┘    │ • Size Chart     │
                   │                 │ • Min Resolution │
                   └─────────────┬───│ • Contradictions │
                                 │   └─────────┬────────┘
                                 │             │
                     ┌───────────▼─────────────▼───┐
                     │  Listing Scoring in Engine  │
                     │  • Accuracy Score (0-100)   │
                     │  • Recency Weighting (t½)   │
                     │  • Loss & Savings Estimate  │
                     │  • Listing Risk Modifier    │
                     └──────────────┬──────────────┘
                                    │
                     ┌──────────────▼──────────────┐
                     │ Order RTO Scoring Modifier  │
                     │ (Policy switchable)         │
                     └─────────────────────────────┘
```

---

## 2. Ingestion & Column Mappings

### 2.1 Supported Platforms & Connector Status
All connectors implement the unified `ListingSource` interface. In accordance with platform terms of service and compliance rules, **no web scraping is performed**.

| Platform | Connector Type | `isSimulated` Flag | Data Mechanism |
|---|---|---|---|
| **Shopify** | Fixture & Webhook Adapter | `false` | Shopify Product & Order API format |
| **Amazon** | Marketplace Adapter | `true` | SP-API Reports CSV mapping |
| **Myntra** | Marketplace Adapter | `true` | Partner Portal CSV export mapping |
| **Flipkart** | Marketplace Adapter | `true` | Seller Hub CSV export mapping |
| **WooCommerce**| REST Adapter | `true` | WC REST API JSON/CSV mapping |
| **MockSource** | Seed / Sandbox | `true` | In-memory seeded catalog & reviews |

### 2.2 CSV / JSON Import Column Mappings

#### Reviews & Returns Ingestion (`POST /reviews/import`)
Accepts either JSON payloads or parsed CSV rows with the following column headers:

| Field Name | Accepted CSV Aliases | Type | Description |
|---|---|---|---|
| `platform` | `Platform`, `source`, `channel` | string | `shopify`, `amazon`, `myntra`, `flipkart`, `woocommerce` (default: `shopify`) |
| `sku` | `SKU`, `product_sku`, `item_code` | string | **Required.** Unique merchant SKU code |
| `rating` | `Rating`, `stars`, `score` | integer | Rating from 1 to 5. Defaults to 1 for return reasons |
| `text` | `review_text`, `comment`, `Reason`, `feedback` | string | **Required.** Customer feedback or return explanation (English or Hinglish) |
| `date` | `Date`, `created_at`, `review_date` | ISO / Date | Feedback creation timestamp |
| `photos` | `hasPhotos`, `has_photos`, `photos_present` | boolean | Indicates whether customer uploaded photos |
| `photoUrls`| `photos`, `images`, `image_urls` | array/string | Array or comma-delimited URLs of customer photos |
| `returnReason`| `reportedReason`, `return_reason`, `cancellation_reason` | string | If present, row is categorized as a return reason |
| `orderId` | `order_id`, `Order ID` | string | Optional associated order reference |

#### Listings Ingestion (`POST /listings/import`)
| Field Name | Accepted CSV Aliases | Type | Description |
|---|---|---|---|
| `platform` | `Platform`, `source` | string | E-commerce channel |
| `sku` | `SKU`, `product_sku` | string | **Required.** Merchant SKU code |
| `title` | `Title`, `name`, `product_name` | string | **Required.** Listing title |
| `description`| `Description`, `body_html` | string | Product copy and specifications |
| `category` | `Category`, `product_type` | string | e.g. `Apparel`, `Footwear`, `Beauty` |
| `price` | `Price`, `mrp`, `sale_price` | number | Product selling price in INR |
| `sizeChartPresent`| `size_chart_present`, `Size Chart` | boolean | Whether a size guide is attached |
| `images` | `Images`, `image_urls` | array | Array of catalog image URLs |

---

## 3. Privacy, PII Protection & Data Provenance

### 3.1 Strict Privacy Protections
Customer feedback frequently contains unintentional PII (Personally Identifiable Information). To protect buyer privacy and comply with DPDP (Digital Personal Data Protection Act) and GDPR:
1. **Name & Contact Stripping:** Reviewer names, email addresses, and phone numbers are **never stored** in `reviews` or `return_reasons` tables.
2. **Automated Redaction:** Before database insertion or sending to external LLM analyzers, all text passes through `sanitizeReviewText()`:
   - Indian mobile numbers (`[6789]\d{9}` and variations with `+91`) are masked as `[PHONE_REDACTED]`.
   - Email addresses are masked as `[EMAIL_REDACTED]`.
   - Order identifiers matching customer IDs are detached.
3. **Provable De-identification:** Only anonymized feedback text, text hashes, star ratings, and dates are preserved.

### 3.2 Data Provenance & Cryptographic Deduplication
- Every ingested text snippet is trimmed, lowercase-normalized, and hashed using `SHA-256` to create a 16-character deterministic `text_hash`.
- The database enforces uniqueness on `(store_id, text_hash)` for text analysis.
- If identical feedback is ingested multiple times across different batches, the analysis is retrieved from the cache without incurring redundant LLM API costs or token usage.

---

## 4. Analysis Pipeline & Taxonomy

### 4.1 Cause Label Taxonomy
The pipeline classifies feedback into 10 standardized root-cause labels:

| Cause Label | Description | Listing-Caused? | Example Customer Phrase |
|---|---|---|---|
| `size_fit` | Sizing mismatch, incorrect measurements, tight/loose | **Yes** | *"Size M order kiya tha par ye XS jaisa tight hai"* |
| `colour_mismatch` | Delivered shade contradicts picture / title | **Yes** | *"Photo me royal blue dikh raha tha par blackish navy nikla"* |
| `description_mismatch` | Fabric, materials or specs do not match copy | **Yes** | *"100% pure organic cotton likha hai par tag pe polyester nikla"* |
| `image_mismatch` | Heavy editing/photoshop filters contradict real item | **Yes** | *"Picture alag hai real product se! Heavy filter laga ke photo dali hai"* |
| `quality` | Defective stitching, cheap finish, loose threads | No | *"Ghatiya quality material. Pehle wash me silai khul gayi"* |
| `damaged` | Broken in transit, leaking bottle, torn packaging | No | *"Bottle was leaking inside bubble wrap. Parcel completely soaked"* |
| `delivery` | Delayed courier, fake delivery attempt, rude courier | No | *"Delivery was delayed by 6 days. Courier boy did not call"* |
| `expectation_gap` | General dissatisfaction, did not meet subjective taste | No | *"Average product, expected much better finish for this brand"* |
| `price` | Overpriced perception, not worth the price | No | *"Paisa barbad. Normal mug hai aur 1900 le rahe hain"* |
| `other` | General positive reviews or unclassified feedback | No | *"Bohot hi badiya product! Fabric is so soft and comfortable"* |

### 4.2 Text Analyzers
1. **`LexiconAnalyzer` (Baseline):**
   - High-throughput, zero-cost keyword and regex rule engine with Hinglish support.
   - Detects localized vocabulary: *chhota*, *bada*, *ghatiya*, *fata*, *toota*, *bekar*, *kapda*, *rang*, *silai*.
2. **`LlmAnalyzer`:**
   - Enforces strict JSON schema output: `{ sentiment, aspects[{aspect, polarity}], cause_label, confidence }`.
   - Equipped with a circuit breaker: Rate limit capped at 60 req/min, cost cap capped at $5.00/day.
   - Graceful fallback: Automatically delegates to `LexiconAnalyzer` if offline, capped, or rate-limited.

### 4.3 Image Analyzer
Checks catalog images for:
- **Missing Size Chart:** Flags Apparel SKUs lacking explicit size charts (`missing_size_chart`).
- **Low Resolution:** Flags images under 800x800px where customer cannot inspect fabric details (`image_resolution_low`).
- **Customer Photo Contradictions:** Flags when customer review photos indicate discrepancies with model catalog photos.

---

## 5. Scoring Math & Formulas

The scoring engine in `lib/engine/src/listingScoring.ts` operates on the following mathematical principles:

### 5.1 Recency Weighting
Customer reviews decay exponentially based on age:
$$w_i = 0.5^{\frac{\Delta t_i}{t_{1/2}}}$$
where $\Delta t_i$ is the age in days and $t_{1/2} = 60\text{ days}$ (half-life).

### 5.2 Minimum Volume Threshold
Listings require a minimum of 5 customer feedback records before penalties are applied. For listings under the threshold, the score defaults to 100 with 0 risk modifier to avoid penalizing new launches.

### 5.3 Listing Accuracy Score (0 - 100)
Let $W_{\text{listing\_caused}}$ be the sum of recency weights for returns and reviews attributed to listing defects (`size_fit`, `colour_mismatch`, `description_mismatch`, `image_mismatch`):
$$\text{Penalty Ratio} = \frac{W_{\text{listing\_caused}}}{\sum w_i}$$
$$\text{Accuracy Score} = \max\left(0, \min\left(100, \text{round}\left(100 - 150 \times \text{Penalty Ratio}\right)\right)\right)$$

### 5.4 Financial Impact Estimation
- **Estimated Loss:**
  $$\text{Loss} = N_{\text{listing\_returns}} \times \left(C_{\text{fwd}} + C_{\text{rev}} + C_{\text{pkg}}\right)$$
  Default cost assumptions: Forward ₹80, Reverse ₹95, Packaging ₹50 ($₹225$ per return).
- **Estimated Saving:**
  $$\text{Saving} = \text{Loss} \times \frac{\text{Eff}_{\min} + \text{Eff}_{\max}}{2}$$
  Default fix effectiveness range: 35% - 65% (mean: 50%).

### 5.5 Order Risk Modifier (`listing_risk_modifier`)
Exposed to the order scoring engine:
- Score $\ge 85$: $+5$ (healthy listing bonus)
- Score $70 - 84$: $0$ (neutral)
- Score $50 - 69$: $-5$ (moderate return risk)
- Score $< 50$: $-15$ (severe return risk penalty)

This modifier is toggleable via the engine policy rule configuration (`enableListingRiskModifier: true/false`).

---

## 6. Endpoints Reference

| Method | Path | Summary |
|---|---|---|
| `POST` | `/api/listings/import` | Import listings via CSV/JSON mapping |
| `POST` | `/api/reviews/import` | Import reviews & return reasons with PII stripping |
| `POST` | `/api/listings/pipeline/run` | Trigger listing intelligence analysis job |
| `GET` | `/api/listings` | List all catalog SKUs with accuracy scores |
| `GET` | `/api/listings/:id` | Detailed listing view with issues, aspects & evidence |
| `GET` | `/api/listings/summary` | Executive KPI summary (flagged SKUs, total loss/saving) |
| `GET` | `/api/listing-alerts` | Alert list of critical/high defect listings |
| `PATCH`| `/api/listing-issues/:id` | Acknowledge, resolve, or dismiss a listing issue |

---

## 7. Operational Limits & Guardrails
1. **Scraping Prohibition:** No scraping or unauthorized marketplace crawling is implemented.
2. **LLM Cost Caps:** Built-in safeguards stop LLM calls once daily budget or rate ceilings are met.
3. **Human Review Candidate Flow:** Discovered issues are marked `isHumanReviewed: false` by default, serving as high-confidence candidate recommendations for catalog managers rather than auto-mutating live storefronts.
