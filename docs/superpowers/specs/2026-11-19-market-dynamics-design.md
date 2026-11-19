# V14.2 Market Dynamics — Implementation Specification

## 1. Overview

**Objective**: Replace the existing supply-only `getPrices()` with a market-driven price system where individual goods prices respond to supply and demand imbalances.

**Architecture**: Approach 1 — Replace & Extend. Single authoritative price per good, per industry entity, per tick.

**Key Principle**: The new system computes prices from market metrics (supply/demand imbalance) and stores them in the existing `priceMemory` Map. Workers receive immutable price snapshots as input; they never mutate prices.

---

## 2. Current System Analysis

### 2.1 Existing `getPrices()` Behavior
- **Input**: `goods` (current stock), `memory` (previous prices from `priceMemory`)
- **Logic**: Stock-based adjustment only (no demand consideration)
  - `adjustment = baseline / stock` (higher stock = lower price)
  - `targetPrice = basePrice * adjustment`
  - `dampedPrice = currentPrice + (targetPrice - currentPrice) * 0.3`
  - Clamped to `[basePrice * 0.1, basePrice * 10]`
- **Persistence**: `priceMemory.set(entityId, prices)` after each tick

### 2.2 Price Memory Structure
```typescript
const colonyPriceMemory = new Map<string, Partial<Record<keyof Goods, number>>>();
// Key: entityId, Value: { [good]: price }
```
- **Initial prices**: `basePrices` (used when `memory[key]` is missing)
- **Per-entity isolation**: Each industry entity has independent prices
- **Persistence**: Map maintained in worker, pruned for inactive entities

### 2.3 Supply/Demand Data Available (from V13 Accounting)

| Domain | Desired Demand | Fulfilled/Actual Supply |
|--------|---------------|------------------------|
| Households | `desiredConsumptionByPop` (from `computePopulationConsumption`) | `spendingByPop` / `householdSalesByGood` |
| Sectors | `bid.idealGoodsDemand` (in `SectorBid`) | `sectorInputsPurchasedBySector` / `sectorInputsConsumedBySector` |
| Capital | `processCapital` input requirements | `capitalPurchasesByGood` |
| Non-cumulative | `bid.idealGoodsDemand` (non-cumulative goods) | `flowPool` production in `executeNonCumulativeFlow` |

---

## 3. Market Metrics Definitions

### 3.1 Per-Good Market Metrics

```typescript
interface GoodMarketMetrics {
    good: keyof Goods;

    // Prices
    openingPrice: number;           // Price at tick start (from priceMemory)
    closingPrice: number;           // Price at tick end (new calculation)

    // Supply (physical quantities available to market)
    openingInventory: number;       // Warehouse stock at tick start (before ANY production/consumption)
    productionAvailable: number;    // Production available for market this tick
    availableSupply: number;        // openingInventory + productionAvailable

    // Demand
    desiredDemand: number;          // Total requested before affordability/supply constraints
    fulfilledDemand: number;        // Net physical quantity delivered to consuming domain during tick
    unmetDemand: number;            // desiredDemand - fulfilledDemand (≥ 0)

    // Derived
    supplyDemandRatio: number;      // availableSupply / desiredDemand (Infinity if no demand)
    shortageRatio: number;          // max(0, (desiredDemand - availableSupply) / desiredDemand)
    surplusRatio: number;           // max(0, (availableSupply - desiredDemand) / availableSupply)
    imbalance: number;              // (desiredDemand - availableSupply) / max(desiredDemand, availableSupply, 1)
    fulfillmentShortageRatio: number; // unmetDemand / desiredDemand (0 if no demand)
    tradedQuantity: number;         // Actual quantity exchanged (fulfilledDemand)
}
```

### 3.2 Supply/Demand Semantics by Good Type

| Good Type | Available Supply | Desired Demand |
|-----------|-----------------|----------------|
| **Cumulative** | `openingInventory + productionAvailable` | `desiredDemand` (see 3.3) |
| **Non-cumulative** | `productionAvailable` (from flow execution) | `desiredDemand` (see 3.3) |

**Supply decomposition:**
```
availableSupply = openingInventory + productionAvailable

openingInventory = goods[good] at tick start (before ANY production, purchases, reservations, or consumption)
productionAvailable = goodsProduction[good]  // production this tick

fulfilledDemand = 
    householdPurchases[good] +      // from accounting.householdSalesByGood
    sectorInputPurchases[good] +    // from accounting.sectorInputsPurchasedBySector
    capitalPurchases[good];         // from accounting.capitalPurchasesByGood
```

**Important:** `sectorInputsPurchasedBySector` represents fulfilled demand, NOT additional supply. It is subtracted from available supply when computing remaining inventory, not added to supply.

### 3.3 Demand Definitions

**Explicit demand snapshots (captured BEFORE any constraints):**

```typescript
interface MarketDemandSnapshot {
    household: Partial<Record<keyof Goods, number>>;
    sectors: Partial<Record<keyof Goods, number>>;
    capital: Partial<Record<keyof Goods, number>>;
}

interface HouseholdMarketDemand {
    desiredByGood: Partial<Record<keyof Goods, number>>;
    fulfilledByGood: Partial<Record<keyof Goods, number>>;
}

interface SectorDesiredDemand {
    sectorId: string;
    goods: Partial<Record<keyof Goods, number>>;
}
```

- **Desired Demand**: Total quantity requested *before* affordability/supply constraints
  - **Households**: `desiredConsumptionByPop` from `computePopulationConsumption` (BEFORE affordability filtering)
  - **Sectors**: `bid.idealGoodsDemand` at full `actualScale=1` (unconstrained by goods/labor/budget). Capture as explicit `SectorDesiredDemand` snapshot at bid creation.
  - **Capital**: `processCapital` input requirements at full production (captured before budget/inventory constraints)
  - **Sum**: Sum across all domains for each good

- **Fulfilled Demand**: Net physical quantity delivered to the consuming domain during the tick (from settlement results)
  - **Households**: Actual delivered quantity (`accounting.householdSalesByGood`)
  - **Sectors**: Net physical quantity delivered, excluding quantities physically returned (`accounting.sectorInputsPurchasedBySector` minus physical returns via provenance)
  - **Capital**: Actual delivered quantity (`accounting.capitalPurchasesByGood`)
  - **Sum**: Total net physical quantity actually exchanged

  **Important:** A financial refund without a physical return does NOT reduce fulfilled demand. Only physical returns (tracked via provenance settlement) reduce fulfilled demand. This prevents artificial market supply from financial refunds without physical returns.

- **Unmet Demand**: `desiredDemand - fulfilledDemand` (always ≥ 0)

### 3.4 Non-Cumulative Market Flow

```typescript
interface NonCumulativeMarketFlow {
    productionAvailable: number;    // Total production from flow execution (sumGoodsProduction)
    desiredDemand: number;          // Sum of bid.idealGoodsDemand[good] at full scale
    fulfilledDemand: number;        // Actual flow settled (from executeNonCumulativeFlow results)
    unmetDemand: number;            // desiredDemand - fulfilledDemand
    imbalance: number;              // calculateImbalance(desiredDemand, productionAvailable)
}
```

**Note:** `productionAvailable` comes from actual flow execution results (`sumGoodsProduction`), not `flowPool` snapshot. `fulfilledDemand` comes from actual consumption in `executeNonCumulativeFlow` results.

**Important:** Non-cumulative demand and fulfillment must NOT be included in the cumulative market's demand and fulfillment totals. Non-cumulative goods have a separate accounting path.

**Imbalance calculation:** Uses `calculateImbalance(desiredDemand, productionAvailable)` — the same helper as cumulative goods. This ensures the imbalance formula is identical across both market types. The supply parameter is `productionAvailable` (actual flow execution output), not `flowPool` snapshot. This ensures the market sees only what was actually produced and made available to downstream consumption.

### 3.5 Demand Snapshot Capture Points

| Domain | Snapshot Timing | Source |
|--------|----------------|--------|
| Households | `computePopulationConsumption` returns `desiredConsumptionByPop` BEFORE affordability filtering | `desiredConsumptionByPop` |
| Sectors | At `SectorBid` creation: `idealGoodsDemand` at full scale | `SectorDesiredDemand` snapshot |
| Capital | `processCapital` computes requirements BEFORE budget/inventory constraints | `CapitalDesiredDemand` snapshot |
| Non-cumulative | Sum of `idealGoodsDemand` for non-cumulative goods at full scale | Bid snapshot |

---

## 4. Price Adjustment Calculator

### 4.1 Configuration

```typescript
interface PriceAdjustmentConfig {
    sensitivity: number;           // How strongly prices respond to imbalance (default: 0.15)
    maxIncreasePerTick: number;    // Cap on price increase per tick (default: 0.10 = 10%)
    maxDecreasePerTick: number;    // Cap on price decrease per tick (default: 0.10 = 10%)
    minPriceMultiplier: number;    // Floor relative to basePrice (default: 0.1)
    maxPriceMultiplier: number;    // Ceiling relative to basePrice (default: 10.0)
}
```

**Validation (run at startup):**
```typescript
function validateConfig(config: PriceAdjustmentConfig): void {
    const values = [
        config.sensitivity,
        config.maxIncreasePerTick,
        config.maxDecreasePerTick,
        config.minPriceMultiplier,
        config.maxPriceMultiplier,
    ];

    if (!values.every(Number.isFinite)) {
        throw new Error("Price adjustment config must contain finite values");
    }

    if (config.sensitivity < 0) throw new Error("sensitivity must be >= 0");
    if (config.maxIncreasePerTick < 0 || config.maxIncreasePerTick >= 1) {
        throw new Error("maxIncreasePerTick must be in [0, 1)");
    }
    if (config.maxDecreasePerTick < 0 || config.maxDecreasePerTick >= 1) {
        throw new Error("maxDecreasePerTick must be in [0, 1)");
    }
    if (config.minPriceMultiplier <= 0) {
        throw new Error("minPriceMultiplier must be > 0");
    }
    if (config.maxPriceMultiplier < config.minPriceMultiplier) {
        throw new Error("maxPriceMultiplier must be >= minPriceMultiplier");
    }
}
```

### 4.2 Price Formula (Deterministic, Bounded)

```typescript
function calculateNewPrice(
    oldPrice: number,
    basePrice: number,
    imbalance: number,        // -1 (max surplus) to +1 (max shortage)
    config: PriceAdjustmentConfig
): number {
    // Validate inputs
    if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
        throw new Error(`Invalid oldPrice: ${oldPrice}`);
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new Error(`Invalid basePrice: ${basePrice}`);
    }
    if (!Number.isFinite(imbalance) || Math.abs(imbalance) > 1) {
        throw new Error(`Invalid imbalance: ${imbalance}`);
    }

    // 1. Raw adjustment proportional to imbalance
    const rawAdjustment = imbalance * config.sensitivity;

    // 2. Clamp to per-tick limits
    const clampedAdjustment = clamp(
        rawAdjustment,
        -config.maxDecreasePerTick,
        config.maxIncreasePerTick
    );

    // 3. Apply to old price
    const newPrice = oldPrice * (1 + clampedAdjustment);

    // 4. Apply absolute floor/ceiling relative to basePrice
    const floor = basePrice * config.minPriceMultiplier;
    const ceiling = basePrice * config.maxPriceMultiplier;

    return clamp(newPrice, floor, ceiling);
}
```

### 4.3 Imbalance Calculation & Validation

```typescript
export function calculateImbalance(demand: number, supply: number): number {
    if (!Number.isFinite(demand) || demand < 0) {
        throw new Error(`Invalid demand: ${demand}`);
    }
    if (!Number.isFinite(supply) || supply < 0) {
        throw new Error(`Invalid supply: ${supply}`);
    }
    return (demand - supply) / Math.max(demand, supply, 1);
}
```

**Note:** The denominator includes `1` to avoid division by zero and prevent exaggerated responses in low-volume markets. This means small fractional quantities produce a proportional imbalance rather than an exaggerated one. For example, demand=0.1, supply=0 gives imbalance=0.1 (not 1). This is intentional for numerical stability.

### 4.3 Special Cases

| Scenario | Behavior |
|----------|----------|
| No demand, no supply | `imbalance = 0` → no price change |
| Demand > 0, supply = 0 | `imbalance = 1` → max increase |
| Supply > 0, demand = 0 | `imbalance = -1` → max decrease |
| Invalid prices/quantities | Throw error (fail fast) |
| Zero/negative oldPrice | Throw error (invalid persisted state) |

**Note on missing prices:** If `priceMemory` has no entry for a good, initialize from `basePrice` in `MarketPriceSystem` before calculation. This is a system-level initialization, not a fallback in the calculator.

---

## 5. System Architecture

### 5.1 Data Flow

```
Tick N Complete
    │
    ▼
IndustryTickCompletedEvent (per entity, with accounting data + demand snapshots)
    │
    ▼
MarketMetricsCalculator  ──► GoodMarketMetrics[]
    │
    ▼
PriceAdjustmentCalculator  ──► newPrices: Record<keyof Goods, number>
    │
    ▼
MarketPriceSystem
    │  ├─ Validates new prices
    │  ├─ Commits CommittedMarketPrices atomically
    │  └─ Emits MarketPricesUpdatedEvent
    │
    ▼
Atomic Tick Boundary
    │
    ▼
Tick N+1 Worker Input (immutable price snapshot, Readonly<Record<keyof Goods, number>>)
```

### 5.2 Component Responsibilities

| Component | Responsibility | Location |
|-----------|---------------|----------|
| `MarketMetricsCalculator` | Pure: `accounting + goods + sectorBids + demandSnapshots → GoodMarketMetrics[]` | `src/game/economics/market/marketMetricsCalculator.ts` |
| `PriceAdjustmentCalculator` | Pure: `metrics + oldPrices + basePrices + config → newPrices` | `src/game/economics/market/priceAdjustmentCalculator.ts` |
| `MarketPriceSystem` | ECS System: owns `priceMemory`, validates/commits prices, emits events | `src/game/systems/MarketPriceSystem.ts` |
| `MarketPricesUpdatedEvent` | Notifies UI/dashboard of price changes | `src/engine/lib/events/MarketPricesUpdatedEvent.ts` |

### 5.3 Price Memory Ownership

```typescript
interface CommittedMarketPrices {
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Readonly<Record<keyof Goods, number>>;
}

class MarketPriceSystem extends System {
    // Owned by MarketPriceSystem, NOT worker-local
    // Single authoritative object per entity - prevents partial updates
    private priceMemory = new Map<string, CommittedMarketPrices>();
    
    // Initialize missing prices from basePrices
    private ensureInitialized(entityId: string): void {
        if (!this.priceMemory.has(entityId)) {
            this.priceMemory.set(entityId, {
                entityId,
                sourceTick: 0,
                effectiveTick: 1,
                prices: { ...basePrices },
            });
        }
    }
}
```

- **Owner**: `MarketPriceSystem` (ECS system, single authoritative source)
- **Persistence**: Survives save/load (serialized with ECS state via explicit serialization)
- **Per-entity isolation**: Each industry entity has independent prices
- **Initialization**: Missing prices → `basePrices` on first access (sourceTick=0, effectiveTick=1)

### 5.4 Tick-Boundary Ordering Guarantee

```
Tick N submitted
    ↓
Tick N completed (IndustryTickCompletedEvent)
    ↓
MarketMetricsCalculator runs
    ↓
PriceAdjustmentCalculator runs
    ↓
MarketPriceSystem validates & commits to priceMemory
    ↓
MarketPricesUpdatedEvent emitted
    ↓
Entity eligible for Tick N+1 (next onDayPassed)
```

**Guarantee**: An entity's Tick N+1 cannot begin until its Tick N price update is committed. This is enforced by `MarketPriceSystem` tracking committed tick per entity.

**Price Snapshot with Tick Identity:**
```typescript
interface PriceSnapshot {
    entityId: string;
    sourceTick: number;      // Tick that produced these prices (0 for initial base prices)
    effectiveTick: number;   // Tick that will use these prices
    prices: Readonly<Record<keyof Goods, number>>;
}
```

`MarketPriceSystem` provides:
```typescript
getPriceSnapshot(entityId: string, expectedTick: number): Readonly<Record<keyof Goods, number>>;
```
Rejects request if prices for `expectedTick` are not yet committed.

**Tick Convention:**
- Tick 1 starts with base prices (sourceTick=0, effectiveTick=1)
- Completing tick 1 calculates prices effective for tick 2 (sourceTick=1, effectiveTick=2)
- Completing tick N calculates prices effective for tick N+1 (sourceTick=N, effectiveTick=N+1)

```typescript
// Initial snapshot
{
    entityId,
    sourceTick: 0,
    effectiveTick: 1,
    prices: basePrices,
}

// After tick 1 completes
{
    entityId,
    sourceTick: 1,
    effectiveTick: 2,
    prices: updatedPrices,
}
```

`getPriceSnapshot(entityId, 2)` returns the snapshot effective for tick 2.
```

**Do not rely solely on ECS system registration order or event subscription order to enforce this invariant.**

### 5.5 Market Price Status & Failure Handling

If price calculation fails (invalid metrics, validation error, etc.), the entity must not start its next tick with stale prices. Track status explicitly:

```typescript
type MarketPriceStatus =
    | { status: "ready"; effectiveTick: number }
    | { status: "pending"; completedTick: number }
    | { status: "failed"; completedTick: number; error: string };
```

Lifecycle:
```
Tick N submitted
    ↓
Tick N completed (IndustryTickCompletedEvent)
    ↓
MarketPriceSystem: status = "pending"
    ↓
MarketMetricsCalculator runs
    ↓
PriceAdjustmentCalculator runs
    ↓
MarketPriceSystem validates & commits
    ↓
If success: status = "ready" for effectiveTick
If fail:    status = "failed" (blocks next tick)
```

`getPriceSnapshot` rejects request if status is "pending" or "failed".

---

## 6. Integration Points

### 6.1 IndustryTickInput Contract (Worker Input)

```typescript
interface IndustryTickInput {
    // ... existing fields ...
    tick: number;
    prices: Readonly<Record<keyof Goods, number>>;  // NEW: immutable price snapshot
}
```

**Worker validation (fail fast):**
```typescript
function processIndustry(input: IndustryTickInput, ...): IndustryTickPatch | null {
    // Prices are immutable input - never call getPrices()
    const prices = validatePrices(input.prices);
    // ...
}
```

**Validation in `validatePrices`:**
```typescript
function validatePrices(
    prices: Readonly<Record<keyof Goods, number>>
): Readonly<Record<keyof Goods, number>> {
    for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
        const value = prices[key];

        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`Invalid or missing price for ${key}: ${value}`);
        }
    }
    // Ensure ALL expected goods are present
    for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
        if (!(key in prices)) {
            throw new Error(`Missing price for ${key}`);
        }
    }
    return prices;
}
```

**Worker never calls `getPrices()`** — prices are authoritative input.

### 6.2 IndustrySystem — Tick Boundary Integration

```typescript
// In IndustrySystem.onDayPassed
const pricesSnapshot = { 
    ...marketPriceSystem.getPriceSnapshot(entityId, this.tickCounter)  // Readonly snapshot
};

industries.push({
    // ... existing fields
    tick: this.tickCounter,
    prices: pricesSnapshot,
});

// After worker completes:
// 1. Apply patch to IndustryComponent
// 2. Emit IndustryTickCompletedEvent (with accounting + demandSnapshots)
// MarketPriceSystem subscribes, calculates new prices, commits to priceMemory
// Next onDayPassed reads from updated priceMemory
```

### 6.3 MarketPriceSystem — Tick Boundary

```typescript
// MarketPriceSystem subscribes to IndustryTickCompletedEvent
private handleTickCompleted = (data: IndustryTickCompletedData) => {
    const entityId = data.entity.id;
    
    // Reject stale/duplicate/skipped events - exact tick match required
    const current = this.priceMemory.get(entityId);
    const expectedSourceTick = current?.sourceTick ?? 0;
    const expectedCompletionTick = expectedSourceTick + 1;
    
    if (data.tick !== expectedCompletionTick) {
        throw new Error(
            `Unexpected market price update for ${entityId}: ` +
            `expected tick ${expectedCompletionTick}, received ${data.tick}`
        );
    }
    
    const oldPrices = this.priceMemory.get(entityId)?.prices ?? { ...basePrices };
    
    // Calculate metrics
    const metrics = this.calculateMetrics(data.accounting, data.demandSnapshots);
    
    // Calculate new prices
    const newPrices = this.calculateNewPrices(metrics, oldPrices);
    
    // Validate all prices
    validatePrices(newPrices);
    
    // Commit atomically - single CommittedMarketPrices object
    const committed: CommittedMarketPrices = {
        entityId,
        sourceTick: data.tick,
        effectiveTick: data.tick + 1,
        prices: newPrices,
    };
    this.priceMemory.set(entityId, committed);
    
    // Notify UI
    this.engine!.dispatchEvent(
        new MarketPricesUpdatedEvent({
            entityId: entityId,
            tick: data.tick,
            prices: newPrices,
        })
    );
}
```

### 6.4 Accounting Compatibility

- **No changes** to `TransactionLedger`, `buySectorInputs`, `allocatePopulationSales`, etc.
- All existing accounting uses prices from worker context (now from `input.prices` instead of `getPrices()`)
- Refunds continue to use original purchase prices (stored in provenance)
- Capital expenditure uses prices effective for that tick

---

## 6.5 Worker Pool Contract

The worker pool message contract must include the tick:

```typescript
interface WorkerPoolMessage {
    type: string;
    tick: number;           // Must match IndustryTickInput.tick
    patches: IndustryTickPatch[];
}
```

Worker rejects input with missing/invalid prices:

```typescript
// In processIndustry
if (!input.prices || Object.keys(input.prices).length === 0) {
    throw new Error(`Missing prices for entity ${input.entityId}`);
}
```

---

## 6.6 Price Memory Persistence

`MarketPriceSystem` implements explicit serialization:

```typescript
// Save/Load format - mirrors runtime CommittedMarketPrices exactly
interface PriceMemoryState {
    version: number;
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Record<keyof Goods, number>;
}
```

`MarketPriceSystem` implements:
```typescript
serialize(): PriceMemoryState[] {
    const result: PriceMemoryState[] = [];
    for (const [entityId, committed] of this.priceMemory) {
        result.push({
            version: 1,
            entityId: committed.entityId,
            sourceTick: committed.sourceTick,
            effectiveTick: committed.effectiveTick,
            prices: { ...committed.prices }, // copy to mutable
        });
    }
    return result;
}

deserialize(state: PriceMemoryState[]): void {
    for (const s of state) {
        // Validate schema version
        if (s.version !== 1) {
            throw new Error(`Unsupported price memory schema version: ${s.version}`);
        }
        // Validate required fields
        if (!Number.isInteger(s.sourceTick) || s.sourceTick < 0) {
            throw new Error(`Invalid sourceTick: ${s.sourceTick}`);
        }
        if (s.effectiveTick !== s.sourceTick + 1) {
            throw new Error(`effectiveTick must equal sourceTick + 1: ${s.effectiveTick} !== ${s.sourceTick} + 1`);
        }
        // Validate all prices
        for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
            const value = s.prices[key];
            if (!Number.isFinite(value) || value <= 0) {
                throw new Error(`Invalid price for ${key}: ${value}`);
            }
        }
        // Restore
        this.priceMemory.set(s.entityId, {
            entityId: s.entityId,
            sourceTick: s.sourceTick,
            effectiveTick: s.effectiveTick,
            prices: s.prices,
        });
    }
}
```

**Validation rules on deserialization:**
- Supported schema version (currently 1)
- Unique entity IDs
- All expected goods present
- All prices finite and strictly positive
- `sourceTick` is a nonnegative integer
- `effectiveTick === sourceTick + 1`

Do not silently repair invalid persisted prices.

---

## 7. Files to Create/Modify

### 7.1 New Files

| File | Purpose |
|------|---------|
| `src/game/economics/market/marketTypes.ts` | Interfaces: `GoodMarketMetrics`, `MarketMetricsSnapshot`, `PriceAdjustmentConfig`, `NonCumulativeMarketFlow`, `MarketDemandSnapshot`, `HouseholdMarketDemand`, `SectorDesiredDemand`, `CapitalDesiredDemand` |
| `src/game/economics/market/marketMetricsCalculator.ts` | Pure: `accounting + goods + sectorBids + demandSnapshots → GoodMarketMetrics[]` |
| `src/game/economics/market/priceAdjustmentCalculator.ts` | Pure: `metrics + oldPrices + basePrices + config → newPrices` |
| `src/game/economics/market/priceAdjustmentConfig.ts` | Default config + validation |
| `src/game/economics/market/__tests__/marketMetricsCalculator.test.ts` | Unit tests |
| `src/game/economics/market/__tests__/priceAdjustmentCalculator.test.ts` | Unit tests |
| `src/game/systems/MarketPriceSystem.ts` | ECS System: owns `priceMemory`, commits prices |
| `src/engine/lib/events/MarketPricesUpdatedEvent.ts` | Event for UI/dashboard |

### 7.2 Modified Files

| File | Change |
|------|--------|
| `src/game/workers/industryTick.worker.ts` | Remove `getPrices()` call; validate `input.prices` |
| `src/game/systems/industrySystem.ts` | Pass `pricesSnapshot` in `IndustryTickInput`; register `MarketPriceSystem` |
| `src/game/data/Goods.ts` | Deprecate `getPrices()` (keep for other uses), mark `@deprecated` |
| `src/game/systems/industrySystem.ts` | Add `MarketPriceSystem` to engine |

### 7.3 Deprecated (Not Removed)

- `getPrices()` in `Goods.ts` — keep for potential other consumers (UI, tests), mark `@deprecated`

---

## 8. Implementation Phases

| Phase | Scope | Behavior Changes |
|-------|-------|------------------|
| **V14.2.0** | Code inspection: verify inventory timeline, production, household sales, capital, non-cumulative flow, worker pool, save/load | Verified data sources and tick timeline |
| **V14.2.1** | Market types, demand snapshots, accounting metrics calculator | No |
| **V14.2.2** | Pure price adjustment calculator + config with full validation | No |
| **V14.2.3** | `MarketPriceSystem`, `priceMemory` ownership, `MarketPricesUpdatedEvent` | No (system exists, not yet wired) |
| **V14.2.4** | Tick-boundary integration: `IndustrySystem` passes prices snapshot, `MarketPriceSystem` commits on `IndustryTickCompletedEvent` | Yes (price source changes) |
| **V14.2.5** | Replace `getPrices()` in worker, pass prices snapshot | Yes |
| **V14.2.6** | Scenario tests, balance tuning | Validation |

---

## 9. Test Requirements

### 9.1 Unit Tests

| Test | Scenario |
|------|----------|
| `marketMetricsCalculator` | Missing goods, zero demand, zero supply, mixed goods, non-cumulative flow |
| `priceAdjustmentCalculator` | Shortage → increase, surplus → decrease, no change, bounds enforcement, invalid inputs |

### 9.2 Scenario Tests

| Scenario | Expected |
|----------|----------|
| Stable supply/demand | Price ~stable |
| Severe energy shortage | Energy price ↑ within cap |
| Food surplus | Food price ↓ within cap |
| Capital goods demand spike | Capital goods price ↑ |
| Non-cumulative (energy) shortage | Energy price ↑ |
| Affordability crisis (high demand, low supply) | Price ↑, not mistaken for weak demand |
| Repeated shortage cycles | Price rises to ceiling, stays there |
| Price floor/ceiling | Never crosses boundaries |

### 9.3 Integration Tests

- Price snapshot passed to worker matches `MarketPriceSystem` committed prices
- `IndustryTickCompletedEvent` triggers price update before next tick
- `MarketPricesUpdatedEvent` emitted with correct entity/tick/prices
- All existing V13 accounting tests pass
- V14.1 metrics history continues working

### 9.4 Mandatory Additional Tests

| Test | Expected |
|------|----------|
| Opening inventory captured before production | No double counting |
| Production captured after actual execution | Only real production included |
| Sector demand captured before scaling | Allocator constraints do not erase demand |
| Household demand captured before affordability | Low cash does not hide demand |
| Capital demand captured before allocation | Actual purchases are not mistaken for desired demand |
| Same non-cumulative good used by multiple sectors | No double counting |
| Non-cumulative goods immediately consumed | Production and fulfillment both recorded |
| Worker receives partial price record | Tick rejected |
| Persisted price is zero or negative | Explicit failure |
| Price memory restored from save | Prices and tick identity preserved |
| Duplicate completion event | Same tick cannot be committed twice |
| Stale completion event | Older prices cannot overwrite newer prices |
| Worker completion arrives out of order | Prices remain associated with correct entity and tick |
| Market metrics contain invalid quantities | Tick rejected |
| Price update fails | Next tick cannot start using stale or partially committed prices |

---

## 10. Acceptance Criteria

- [ ] Every good has measurable market metrics per tick
- [ ] Opening inventory and production are counted exactly once
- [ ] Purchased goods are not counted again as additional supply
- [ ] Desired demand is measured before affordability and supply constraints
- [ ] Actual fulfilled demand comes from settlement results
- [ ] Non-cumulative fulfilled demand comes from actual flow execution
- [ ] Prices respond in correct direction (shortage → ↑, surplus → ↓)
- [ ] Price changes bounded per tick and absolutely
- [ ] No-demand/no-supply markets remain stable
- [ ] Price updates at tick boundaries only (no mid-tick changes)
- [ ] No retroactive transaction repricing
- [ ] Missing prices initialize from base prices
- [ ] Invalid prices fail explicitly (no silent substitution)
- [ ] Price snapshots are associated with an exact entity and tick
- [ ] An entity cannot start its next tick before its new prices are committed
- [ ] Price memory survives the intended save/load lifecycle
- [ ] Price history and metrics remain consistent with the prices actually used by transactions
- [ ] V13 accounting invariants preserved (all existing tests pass)
- [ ] V14.1 metrics history continues working
- [ ] `MarketPricesUpdatedEvent` emitted with correct data
- [ ] All scenario tests demonstrate expected behavior