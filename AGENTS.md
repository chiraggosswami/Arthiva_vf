# Margin Pilot Project Handoff

## Overview
Margin Pilot is a profit-aware order and delivery operations app for Indian D2C ecommerce. It scores orders, compares order journeys by expected margin (rather than just risk), and recommends automated rescue and recovery actions to preserve profits.

**Note:** This is a frontend-only demo. Data is seeded locally and all state is persisted via `localStorage`. There is no actual backend database, live courier integration, or messaging infrastructure.

## Screens
- **Command Centre (`/`)**: Main dashboard showing high-level KPIs, risk queues, margin tracking, and trend charts.
- **Orders (`/orders`)**: Sortable list of all orders.
- **Order Detail (`/orders/:id`)**: Deep-dive into a specific order's risk score, expected value by journey, timeline, and actions.
- **Checkout (`/checkout`)**: Store simulation allowing manual order creation to see how the engine scores orders live.
- **Delivery Rescue (`/rescue`)**: Action board to manage and intervene on NDRs (Non-Delivery Reports).
- **RTO Recovery (`/recovery`)**: Queue of RTO-initiated orders and recommendations on whether to reattempt, write-off, or route to inventory.
- **Journey Rules (`/journeys`)**: Journey-level cost and retention configurations, thresholds, and simulation tools.
- **Intelligence (`/intelligence`)**: (Added in Phase 3) Breakdowns of margin drag and RTO exposure by Pincode, Product, Channel, and Courier. Action suggestions can be applied directly to modify the engine's evaluation.
- **Integrations (`/integrations`)**: (Added in Phase 3) Simulated sync connections for external storefronts and couriers, displaying sample webhook data.
- **Demo Mode (`/demo`)**: (Added in Phase 3) A 6-step guided walkthrough of the full lifecycle of order `MP-1042`.

## Engine Logic
Found in `src/engine/`:
- **`scoreOrder`**: Computes an order health score (0-100) based on payment, address quality, customer history, pincode risk, campaign, courier success, and product margin.
- **`evaluate` / `journeyValues`**: Evaluates different predefined "journeys" (e.g., Full COD, OTP, Prepaid incentive). The winning journey is the one with the highest Expected Value (EV).
  - `EV = retention * [(1 - p_rto*rto_mult) * margin_success - p_rto*rto_mult * rto_loss] - journey_cost`
- **`recommendNdrRescue` / `rankRecoveryActions`**: Generates message previews and optimal actions for in-transit exceptions and RTO scenarios.

## Directory Overview
- `src/components/`: Reusable shell, navigation, and error boundary components.
- `src/data/`: `seed.ts` contains the local database mock data.
- `src/engine/`: Core logic for risk, margin, intelligence, and recommendations.
- `src/pages/`: Views and screens, styled via `operations.css`.
- `src/state/`: `AppState.tsx` manages all interactions and `localStorage` syncing.

## Run, Typecheck, Build
- **Dev Server**: `npm run dev --workspace=@workspace/margin-pilot`
- **Typecheck**: `npm run typecheck`
- **Production Build**: `npm run build --workspace=@workspace/margin-pilot`

## Strict Rules & Constraints
- **Frontend Only**: Do not add backends or databases. Keep within `artifacts/margin-pilot`.
- **Existing Files**: Reuse the existing `engine`, `seed data`, and `AppState`.
- **Visual Language**: Conform exactly to the existing CSS. Use Ink Teal, Chalk, Saffron, Go Green, Risk Red, and Slate. Fonts: Bricolage Grotesque and Hanken Grotesk. Sentence-case headers, standard INR formatting (₹1,24,500).
- **Interactivity**: All buttons must do something visible (state update, toast, or navigation). Focus states must work.
