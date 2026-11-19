# V14.2.0 Market Dynamics — Data Contract Verification

**Date:** 2026-11-19  
**Purpose:** Verified data contracts and tick timeline for V14.2 Market Dynamics implementation.

---

## 1. Inventory Timeline

### Opening Inventory (tick start)
- **Location:** `src/game/workers/industryTick.worker.ts:127`
- **Code:** `const tickStartGoods = { ...goods };`
- **Description:** Shallow clone of `goods` at the very start of `processIndustry`, before ANY production, purchases, or consumption.
- **Used for:** Inventory conservation invariants (lines 958-983, 989-1012), `computeColonyGoodsDelta` (line 682 in industryTickHelpers.ts).

### Production This Tick
- **Location:** `src/game/workers/nonCumulativeFlow.ts:305, 462-464`
- **Variable:** `sumGoodsProduction` (accumulated in `executeNonCumulativeFlow`)
- **Description:** Aggregates `producedGoods` from each executed sector's result, scaled by `effectiveScale`.
- **Returned in:** `NonCumulativeFlowResult.sumGoodsProduction` → `IndustryTickPatch.goodsProduction` → `IndustryTickMetricsData.goodsProduction`.

### Requirements This Tick
- **Location:** `src/game/workers/nonCumulativeFlow.ts:304, 466-470`
- **Variable:** `sumGoodsRequirements` (accumulated in `executeNonCumulativeFlow`)
- **Description:** Aggregates `consumedGoods` from each executed sector's result.
- **Returned in:** `NonCumulativeFlowResult.sumGoodsRequirements` → `IndustryTickPatch.goodsRequirements` → `IndustryTickMetricsData.goodsRequirements`.

---

## 2. Demand Snapshot Sources (Pre-Constraint)

### Household Desired Demand
- **Function:** `computePopulationConsumption` in `src/game/workers/industryTickHelpers.ts:89-218`
- **Returned field:** `desiredConsumptionByPop` (line 95, 187)
- **Timing:** Computed BEFORE affordability filtering. Returns raw requirements based on QoL, salary, and prices.
- **Flow:** `populationConsumption` (aggregate) + `desiredConsumptionByPop` (per-pop) returned at line 217.
- **Used in worker:** Line 70-74 in `industryTick.worker.ts` — passed to `buySectorInputs` and `allocatePopulationSales`.

### Sector Desired Demand (Full Scale)
- **Location:** `SectorBid` creation in `src/game/workers/industryTick.worker.ts:254-260`
- **Field:** `bid.idealGoodsDemand` — at full scale per tick (before `actualScale` constraints)
- **Timing:** Created BEFORE allocator constraints (labor, goods, budget).
- **Constraint application:** `actualScale` computed at line 368-385, then `bid.actualScale = Math.min(1, actualScale)` at line 385.
- **Key insight:** `idealGoodsDemand` represents full desired demand; `actualScale` reduces it.

### Capital Desired Demand
- **Function:** `processCapital` in `src/game/workers/capitalSystem.ts:65-338`
- **Timing:** Runs AFTER sector execution, uses `validatedProductionRatio` (line 163) which is `productionRatio` clamped to 1.0.
- **Capital goods:** Configured in `industrySectorBlueprints` (sector blueprint `capitalGoods` field).
- **Processing:** Wear → Decay → Replenish → Invest, all at `validatedProductionRatio` scale.

---

## 3. Non-Cumulative Flow

### Execution
- **Function:** `executeNonCumulativeFlow` in `src/game/workers/nonCumulativeFlow.ts:271-540`
- **Flow pool:** Initialized from `colonyGoods` for `NON_CUMULATING_GOODS` only (line 292-295).
- **No opening inventory carried over** for non-cumulative goods (line 989-1012 invariant).
- **Production tracked:** `sumGoodsProduction` (line 305, 462-464) — includes non-cumulative production.
- **Requirements tracked:** `sumGoodsRequirements` (line 304, 466-470) — includes non-cumulative consumption.
- **Fulfilled demand:** Actual `consumedGoods` from sector results (non-cumulative goods flow through pool).

### Separation from Cumulative
- **Invariant (lines 989-1012):** `closing = production - requirements - householdConsumption` (no opening inventory).
- **Goods list:** `NON_CUMULATING_GOODS` from `@game/data/Goods` (includes `energy`, `waste`, etc.).

---

## 4. Worker Pool & Price Memory Lifecycle

### Current Price Memory
- **Location:** `src/game/workers/industryTick.worker.ts:32`
- **Variable:** `colonyPriceMemory = new Map<string, Partial<Record<keyof Goods, number>>>()`
- **Usage:** Line 62-63 — `const memory = { ...(priceMemory.get(entityId) ?? {}) }; const prices = validatePrices(getPrices(goods, memory));`
- **Update:** Not currently updated in worker; `getPrices` in `Goods.ts` computes supply-only prices.

### Worker Pool Message Contract
- **Location:** `src/game/systems/industryWorkerPool.ts:4-8`
- **Message:** `WorkerPoolMessage = { type: string; tick: number; patches: IndustryTickPatch[] }`
- **Tick tracking:** `nextTickId` (line 25) increments per batch, passed to workers (line 74).
- **Response handling:** `handleMessage` verifies tick matches pending batch (lines 78-101).

### Save/Load Gap
- **Current state:** No save/load mechanism for `colonyPriceMemory` in worker pool.
- **IndustryComponent:** Has `priceMemory` field but not connected to worker pool memory.

---

## 5. Key Data Structures for Market Metrics

### IndustryTickMetricsData (from IndustryTickPatch.metrics)
Contains all accounting data needed for market metrics:
- `goodsProduction: Partial<Goods>`
- `goodsRequirements: Partial<Goods>`
- `accounting.householdSalesByGood: Partial<Goods>`
- `accounting.sectorInputsPurchasedBySector: Record<string, Partial<Goods>>`
- `accounting.sectorInputsConsumedBySector: Record<string, Partial<Goods>>`
- `accounting.capitalPurchasesByGood: Partial<Goods>`
- `accounting.wagesByPop`, `accounting.spendingByPop`

### SectorBid Fields Relevant to Demand
- `idealGoodsDemand: Partial<Goods>` — full scale desired demand
- `idealGoodsProduction: Partial<Goods>` — full scale production
- `idealWorkerDemand: Partial<Population>` — full scale labor demand
- `actualScale: number` — constrained scale (0-1)
- `budgetRatio, inputLevel, outputLevel, capitalMultiplier` — constraint factors

---

## 6. Deviations from Spec & Implementation Notes

### Clarification 1: Supply Definition ✓
- **Cumulative:** `openingInventory + productionAvailable` (line 963-964 invariant)
- **Non-cumulative:** `productionAvailable` only (line 994 invariant, flow pool)

### Clarification 2: Fulfilled Demand = Net Physical Delivery ✓
- **Households:** `fulfilledDemandQty` from `allocatePopulationSales` (lines 655-665)
- **Sectors:** `sectorInputsConsumedBySector` from reconciliation (actual consumed, not purchased)
- **Capital:** `capitalPurchasesByGood` from `processCapital` physical audit

### Clarification 3: Price Snapshot Tick Convention ✓
- **Worker receives:** Prices committed at `sourceTick`, effective for `sourceTick + 1`
- **Implementation:** `MarketPriceSystem` will commit at `sourceTick`, `effectiveTick = sourceTick + 1`

### Clarification 4: Atomic Price Commits ✓
- **Single CommittedMarketPrices object** per entity per tick
- **MarketPricesUpdatedEvent** dispatched after successful commit

### Clarification 5: Non-Cumulative Imbalance ✓
- **Non-cumulative imbalance:** `(desiredDemand - productionAvailable) / max(desiredDemand, productionAvailable, 1)`
- **No opening inventory** in supply for non-cumulative goods

---

## 7. Files Requiring Modification for V14.2

### New Files
1. `src/game/economics/market/marketTypes.ts` — Core type definitions
2. `src/game/economics/market/priceAdjustmentConfig.ts` — Config + validation
3. `src/game/economics/market/priceAdjustmentCalculator.ts` — Price calculation
4. `src/game/economics/market/marketMetricsCalculator.ts` — Metrics from explicit input
5. `src/engine/lib/events/MarketPricesUpdatedEvent.ts` — Event definition
6. `src/game/systems/MarketPriceSystem.ts` — Price memory owner

### Modified Files
1. `src/game/workers/IndustryTickInput.ts` — Add `prices: PriceSnapshot`
2. `src/game/workers/industryTick.worker.ts` — Use input prices, remove `getPrices()` call
3. `src/game/systems/industrySystem.ts` — Pass `PriceSnapshot` from `MarketPriceSystem`
4. `src/game/systems/industryWorkerPool.ts` — Include `tick` in message contract
5. `src/game/game.ts` — Register `MarketPriceSystem`
6. `src/game/data/Goods.ts` — Deprecate `getPrices()`

---

## 8. Verification Checklist

- [x] Opening inventory = `goods` at tick start (before production)
- [x] `goodsProduction` = `sumGoodsProduction` from non-cumulative flow
- [x] `desiredConsumptionByPop` returned BEFORE affordability filtering
- [x] `idealGoodsDemand` at full scale (before `actualScale` constraints)
- [x] Capital requirements computed at `validatedProductionRatio` (clamped to 1)
- [x] Non-cumulative goods use flow pool, no opening inventory
- [x] Worker pool uses `tick` for batch identity
- [x] No existing save/load for price memory (new implementation needed)
- [x] V14.1 `EconomicMetricsSystem` continues to work (subscribes to `IndustryTickCompletedEvent`)

---

**Signed off:** Ready for implementation.