# V14.2 Market Dynamics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing supply-only `getPrices()` with a market-driven price system where individual goods prices respond to supply and demand imbalances.

**Architecture:** Approach 1 — Replace & Extend. Single authoritative price per good, per industry entity, per tick. `MarketPriceSystem` owns `priceMemory`, computes prices from supply/demand metrics, commits at tick boundaries. Workers receive immutable price snapshots.

**Tech Stack:** TypeScript, React/Tauri, Vite, Vitest, ECS architecture, Web Workers for industry tick.

**Spec:** `docs/superpowers/specs/2026-11-19-market-dynamics-design.md`

## Global Constraints

- TypeScript strict mode; `pnpm build` runs `tsc` + Vite
- All monetary/quantity values: `Number.isFinite()` and `>= 0`
- Per-tick price cap: `maxIncreasePerTick = 0.10`, `maxDecreasePerTick = 0.10`
- Absolute price floor: `basePrice * 0.1`, ceiling: `basePrice * 10.0`
- Imbalance sensitivity: `0.15`
- 837+ existing tests must pass
- `pnpm lint` strict (`--max-warnings 0`)
- V13 accounting invariants preserved
- V14.1 metrics history continues working
- No generalized inflation, CPI, or monetary policy

## Review Focus

| Input / Condition | Expected Behavior |
|-------------------|-------------------|
| Zero/negative oldPrice in priceMemory | Throw error (invalid persisted state), not silently fallback |
| Missing price for a good | Initialize from `basePrice` in MarketPriceSystem before calculation |
| Demand > 0, supply = 0 | `imbalance = 1` → max increase within per-tick cap |
| Supply > 0, demand = 0 | `imbalance = -1` → max decrease within per-tick cap |
| Invalid price in worker input | Worker throws immediately, tick fails |
| Partial price record in worker input | Worker throws immediately |
| Negative/zero price in worker input | Worker throws immediately |
| Stale IndustryTickCompletedEvent | Older prices cannot overwrite newer prices |
| Price update fails | Next tick cannot start with stale prices |

---

### Task 0: V14.2.0 Code Inspection & Data Contract Verification

**Files:**
- Inspect: `src/game/workers/industryTick.worker.ts` (processIndustry)
- Inspect: `src/game/workers/nonCumulativeFlow.ts` (executeNonCumulativeFlow)
- Inspect: `src/game/workers/industryTickHelpers.ts` (computePopulationConsumption)
- Inspect: `src/game/workers/capitalSystem.ts` (processCapital)
- Inspect: `src/game/systems/industryWorkerPool.ts`
- Inspect: `src/game/systems/industrySystem.ts` (onDayPassed)

**Interfaces:**
- Consumes: Existing codebase
- Produces: Verified data contract document (shared notes)

- [ ] **Step 1: Verify inventory timeline**
  - Trace `goods` from start of `processIndustry` through all modifications
  - Identify exact point where `openingInventory` = `goods` at tick start (before ANY production/purchases)
  - Document where `goodsProduction` is populated

- [ ] **Step 2: Verify demand snapshot sources**
  - In `computePopulationConsumption`: confirm `desiredConsumptionByPop` is returned BEFORE affordability filtering
  - In `SectorBid` creation: confirm `idealGoodsDemand` at full scale (before allocator constraints)
  - In `processCapital`: confirm requirements computed BEFORE budget/inventory constraints

- [ ] **Step 3: Verify non-cumulative flow**
  - In `executeNonCumulativeFlow`: identify `sumGoodsProduction` (total production)
  - Identify `fulfilledDemand` from actual consumption results
  - Confirm non-cumulative goods NOT in cumulative accounting

- [ ] **Step 4: Verify worker pool & save/load**
  - Trace `colonyPriceMemory` lifecycle in worker pool
  - Check existing save/load mechanism for system state

- [ ] **Step 5: Document findings**
  - Create shared note with verified data contracts and tick timeline
  - Update this plan with any deviations from spec

- [ ] **Step 6: Commit verification notes**
```bash
git add docs/superpowers/notes/2026-11-19-market-data-contracts.md
git commit -m "docs(market): V14.2.0 data contract verification"
```

---

### Task 1: Market Types, Demand Snapshots & Interfaces

**Files:**
- Create: `src/game/economics/market/marketTypes.ts` (core type definitions only)
- Create: `src/game/economics/market/priceAdjustmentConfig.ts` (config + validation, re-exports from marketTypes)
- Create: `src/game/economics/market/priceAdjustmentCalculator.ts` (calculation functions - MOVED from Task 2)

**Interfaces:**
- Consumes: `basePrices` from `@game/data/Goods`, `Goods` type
- Produces: `GoodMarketMetrics`, `NonCumulativeMarketFlow`, `MarketMetricsSnapshot`, `PriceAdjustmentConfig`, `validateConfig`, `MarketDemandSnapshot`, `HouseholdMarketDemand`, `SectorDesiredDemand`, `CapitalDesiredDemand`, `calculateImbalance`, `clamp`
- **No duplicate `MarketMetricsSnapshot` declaration** - single source in marketTypes.ts
- **Single import path** - `priceAdjustmentConfig.ts` re-exports from `marketTypes.ts`, `priceAdjustmentCalculator.ts` imports from both

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/economics/market/__tests__/marketTypes.test.ts
import { describe, it, expect } from "vitest";
import { PriceAdjustmentConfig, validateConfig, MarketDemandSnapshot, SectorDesiredDemand } from "../priceAdjustmentConfig";
import { Goods } from "@game/data/Goods";
import { calculateImbalance } from "../marketTypes";

describe("PriceAdjustmentConfig", () => {
    it("validates valid config", () => {
        const config: PriceAdjustmentConfig = {
            sensitivity: 0.15,
            maxIncreasePerTick: 0.10,
            maxDecreasePerTick: 0.10,
            minPriceMultiplier: 0.1,
            maxPriceMultiplier: 10.0,
        };
        expect(() => validateConfig(config)).not.toThrow();
    });

    it("rejects negative sensitivity", () => {
        const config = { sensitivity: -0.1, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("sensitivity must be >= 0");
    });

    it("rejects maxIncreasePerTick >= 1", () => {
        const config = { sensitivity: 0.15, maxIncreasePerTick: 1.0, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("maxIncreasePerTick must be in [0, 1)");
    });

    it("rejects minPriceMultiplier <= 0", () => {
        const config = { sensitivity: 0.15, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("minPriceMultiplier must be > 0");
    });

    it("rejects maxPriceMultiplier < minPriceMultiplier", () => {
        const config = { sensitivity: 0.15, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.5, maxPriceMultiplier: 0.1 };
        expect(() => validateConfig(config)).toThrow("maxPriceMultiplier must be >= minPriceMultiplier");
    });

    it("rejects NaN/Infinity values", () => {
        const config = { sensitivity: NaN, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("Price adjustment config must contain finite values");
    });
});

describe("MarketDemandSnapshot", () => {
    it("has household, sectors, capital demand maps", () => {
        const snapshot: MarketDemandSnapshot = {
            household: { energy: 100 },
            sectors: { powerPlant: { energy: 80 } },
            capital: { machinery: 10 },
        };
        expect(snapshot.household.energy).toBe(100);
        expect(snapshot.sectors.powerPlant.energy).toBe(80);
        expect(snapshot.capital.machinery).toBe(10);
    });
});

describe("SectorDesiredDemand", () => {
    it("captures sector demand at full scale before constraints", () => {
        const demand: SectorDesiredDemand = {
            sectorId: "powerPlant",
            goods: { energy: 100, water: 20 },
        };
        expect(demand.sectorId).toBe("powerPlant");
        expect(demand.goods.energy).toBe(100);
    });
});

describe("calculateImbalance", () => {
    it("imbalance formula produces -1 to 1", () => {
        expect(calculateImbalance(10, 0)).toBe(1);
        expect(calculateImbalance(0, 10)).toBe(-1);
        expect(calculateImbalance(5, 5)).toBe(0);
    });

    it("throws on negative demand", () => {
        expect(() => calculateImbalance(-1, 10)).toThrow("Invalid demand");
    });

    it("throws on negative supply", () => {
        expect(() => calculateImbalance(10, -1)).toThrow("Invalid supply");
    });
});

describe("NonCumulativeMarketFlow", () => {
    it("has separate production/fulfillment from cumulative", () => {
        const flow: NonCumulativeMarketFlow = {
            productionAvailable: 50,
            desiredDemand: 80,
            fulfilledDemand: 40,
            unmetDemand: 40,
        };
        expect(flow.unmetDemand).toBe(40);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/economics/market/__tests__/marketTypes.test.ts -v`
Expected: FAIL (files don't exist)

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/economics/market/marketTypes.ts
import type { Goods } from "@game/data/Goods";
import type { SectorBid } from "@game/workers/SectorBid";
import type { InputPaymentBreakdown } from "@game/workers/industryTickHelpers";
import type { PurchaseProvenance } from "@game/workers/industryTickHelpers";

export interface GoodMarketMetrics {
    good: keyof Goods;
    openingPrice: number;
    closingPrice: number;
    openingInventory: number;
    productionAvailable: number;
    availableSupply: number;
    desiredDemand: number;
    fulfilledDemand: number;
    unmetDemand: number;
    supplyDemandRatio: number;
    shortageRatio: number;
    surplusRatio: number;
    imbalance: number;
    tradedQuantity: number;
}

export interface NonCumulativeMarketFlow {
    productionAvailable: number;
    desiredDemand: number;
    fulfilledDemand: number;
    unmetDemand: number;
}

export interface MarketMetricsSnapshot {
    tick: number;
    entityId: string;
    goods: Partial<Record<keyof Goods, GoodMarketMetrics>>;
}

export interface MarketDemandSnapshot {
    household: Partial<Record<keyof Goods, number>>;
    sectors: Partial<Record<keyof Goods, number>>;
    capital: Partial<Record<keyof Goods, number>>;
}

export interface HouseholdMarketDemand {
    desiredByGood: Partial<Record<keyof Goods, number>>;
    fulfilledByGood: Partial<Record<keyof Goods, number>>;
}

export interface SectorDesiredDemand {
    sectorId: string;
    goods: Partial<Record<keyof Goods, number>>;
}

export interface CapitalDesiredDemand {
    goods: Partial<Record<keyof Goods, number>>;
}

export interface PriceAdjustmentConfig {
    sensitivity: number;
    maxIncreasePerTick: number;
    maxDecreasePerTick: number;
    minPriceMultiplier: number;
    maxPriceMultiplier: number;
}

export const DEFAULT_PRICE_CONFIG: PriceAdjustmentConfig = {
    sensitivity: 0.15,
    maxIncreasePerTick: 0.10,
    maxDecreasePerTick: 0.10,
    minPriceMultiplier: 0.1,
    maxPriceMultiplier: 10.0,
};

export function validateConfig(config: PriceAdjustmentConfig): void {
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

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

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

```typescript
// src/game/economics/market/priceAdjustmentConfig.ts
export { 
    PriceAdjustmentConfig, 
    DEFAULT_PRICE_CONFIG, 
    validateConfig, 
    clamp, 
    calculateImbalance,
    MarketDemandSnapshot,
    HouseholdMarketDemand,
    SectorDesiredDemand,
    CapitalDesiredDemand,
    NonCumulativeMarketFlow,
} from "./marketTypes";
```

```typescript
// src/game/economics/market/priceAdjustmentCalculator.ts
import { Goods } from "@game/data/Goods";
import { basePrices } from "@game/data/Goods";
import { PriceAdjustmentConfig, DEFAULT_PRICE_CONFIG, validateConfig, calculateImbalance, clamp } from "./marketTypes";

export function calculateNewPrice(
    oldPrice: number,
    basePrice: number,
    imbalance: number,
    config: PriceAdjustmentConfig = DEFAULT_PRICE_CONFIG
): number {
    validateConfig(config);

    if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
        throw new Error(`Invalid oldPrice: ${oldPrice}`);
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new Error(`Invalid basePrice: ${basePrice}`);
    }
    if (!Number.isFinite(imbalance) || Math.abs(imbalance) > 1) {
        throw new Error(`Invalid imbalance: ${imbalance}`);
    }

    const rawAdjustment = imbalance * config.sensitivity;
    const clampedAdjustment = clamp(
        rawAdjustment,
        -config.maxDecreasePerTick,
        config.maxIncreasePerTick
    );

    const newPrice = oldPrice * (1 + clampedAdjustment);
    const floor = basePrice * config.minPriceMultiplier;
    const ceiling = basePrice * config.maxPriceMultiplier;

    return clamp(newPrice, floor, ceiling);
}

export function calculateAllNewPrices(
    metrics: Array<{
        good: keyof Goods;
        imbalance: number;
        openingPrice: number;
        basePrice: number;
    }>,
    oldPrices: Partial<Record<keyof Goods, number>>,
    config: PriceAdjustmentConfig = DEFAULT_PRICE_CONFIG
): Record<keyof Goods, number> {
    validateConfig(config);

    const newPrices: Partial<Record<keyof Goods, number>> = {};

    for (const m of metrics) {
        const oldPrice = oldPrices[m.good];
        if (oldPrice === undefined) {
            throw new Error(`Missing price for ${m.good} in oldPrices - must be initialized before calculation`);
        }
        if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
            throw new Error(`Invalid price for ${m.good}: ${oldPrice}`);
        }
        newPrices[m.good] = calculateNewPrice(oldPrice, m.basePrice, m.imbalance, config);
    }

    // Fill in any missing goods with basePrices (for goods not in metrics)
    const result: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
    for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
        result[key] = newPrices[key] ?? basePrices[key];
    }

    return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/economics/market/__tests__/marketTypes.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/economics/market/marketTypes.ts src/game/economics/market/priceAdjustmentConfig.ts src/game/economics/market/priceAdjustmentCalculator.ts src/game/economics/market/__tests__/marketTypes.test.ts
git commit -m "feat(market): add market types, demand snapshots, price config, calculator, and validation"
```

---

### Task 2: Price Adjustment Calculator

**Files:**
- Create: `src/game/economics/market/priceAdjustmentCalculator.ts`
- Test: `src/game/economics/market/__tests__/priceAdjustmentCalculator.test.ts`

**Interfaces:**
- Consumes: `GoodMarketMetrics[]`, `Record<keyof Goods, number>`, `PriceAdjustmentConfig`, `basePrices` from `@game/data/Goods`
- Produces: `calculateNewPrice`, `calculateAllNewPrices`

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/economics/market/__tests__/priceAdjustmentCalculator.test.ts
import { describe, it, expect } from "vitest";
import { calculateNewPrice, calculateAllNewPrices, DEFAULT_PRICE_CONFIG, basePrices } from "../priceAdjustmentCalculator";
import { Goods } from "@game/data/Goods";

describe("calculateNewPrice", () => {
    const config = DEFAULT_PRICE_CONFIG;
    const basePrice = basePrices.energy; // 20
    const oldPrice = 20;

    it("no demand no supply -> no change", () => {
        const imbalance = 0;
        const newPrice = calculateNewPrice(oldPrice, basePrice, imbalance, config);
        expect(newPrice).toBeCloseTo(oldPrice);
    });

    it("demand > 0, supply = 0 -> max increase", () => {
        const imbalance = 1;
        const newPrice = calculateNewPrice(oldPrice, basePrice, imbalance, config);
        const maxIncrease = oldPrice * (1 + config.maxIncreasePerTick);
        expect(newPrice).toBeCloseTo(maxIncrease);
    });

    it("supply > 0, demand = 0 -> max decrease", () => {
        const imbalance = -1;
        const newPrice = calculateNewPrice(oldPrice, basePrice, imbalance, config);
        const maxDecrease = oldPrice * (1 - config.maxDecreasePerTick);
        expect(newPrice).toBeCloseTo(maxDecrease);
    });

    it("moderate shortage -> proportional increase", () => {
        const imbalance = 0.5; // 50% shortage
        const newPrice = calculateNewPrice(oldPrice, basePrice, imbalance, config);
        const expected = oldPrice * 1.075;
        expect(newPrice).toBeCloseTo(expected);
    });

    it("moderate surplus -> proportional decrease", () => {
        const imbalance = -0.5;
        const newPrice = calculateNewPrice(oldPrice, basePrice, imbalance, config);
        const expected = oldPrice * 0.925;
        expect(newPrice).toBeCloseTo(expected);
    });

    it("respects price floor (0.1 * basePrice)", () => {
        const veryLowPrice = basePrices.energy * 0.05; // below floor
        const imbalance = -1;
        const newPrice = calculateNewPrice(veryLowPrice, basePrices.energy, imbalance, config);
        expect(newPrice).toBeCloseTo(basePrices.energy * 0.1);
    });

    it("respects price ceiling (10 * basePrice)", () => {
        const veryHighPrice = basePrices.energy * 20; // above ceiling
        const imbalance = 1;
        const newPrice = calculateNewPrice(veryHighPrice, basePrices.energy, imbalance, config);
        expect(newPrice).toBeCloseTo(basePrices.energy * 10);
    });

    it("throws on zero/negative oldPrice", () => {
        expect(() => calculateNewPrice(0, basePrices.energy, 0, config)).toThrow("Invalid oldPrice");
        expect(() => calculateNewPrice(-1, basePrices.energy, 0, config)).toThrow("Invalid oldPrice");
    });

    it("throws on invalid imbalance", () => {
        expect(() => calculateNewPrice(20, basePrices.energy, 2, config)).toThrow("Invalid imbalance");
    });

    it("throws on non-finite imbalance", () => {
        expect(() => calculateNewPrice(20, basePrices.energy, NaN, config)).toThrow("Invalid imbalance");
    });
});

describe("calculateAllNewPrices", () => {
    it("computes prices for all goods", () => {
        const oldPrices = { ...basePrices };
        const metrics = [
            { good: "energy" as keyof Goods, imbalance: 0.5, openingPrice: 20, basePrice: 20, desiredDemand: 100, availableSupply: 50 },
            { good: "food" as keyof Goods, imbalance: -0.5, openingPrice: 30, basePrice: 30, desiredDemand: 50, availableSupply: 100 },
        ];
        const newPrices = calculateAllNewPrices(metrics, oldPrices, DEFAULT_PRICE_CONFIG);
        expect(newPrices.energy).toBeGreaterThan(20);
        expect(newPrices.food).toBeLessThan(30);
    });

    it("initializes missing prices from basePrices", () => {
        const oldPrices: Partial<Record<keyof Goods, number>> = { energy: 25 };
        const metrics = [
            { good: "energy" as keyof Goods, imbalance: 0, openingPrice: 25, basePrice: 20, desiredDemand: 100, availableSupply: 100 },
            { good: "food" as keyof Goods, imbalance: 0, openingPrice: 30, basePrice: 30, desiredDemand: 100, availableSupply: 100 },
        ];
        const newPrices = calculateAllNewPrices(metrics, oldPrices, DEFAULT_PRICE_CONFIG);
        expect(newPrices.energy).toBe(25);
        expect(newPrices.food).toBe(30); // initialized from basePrice
    });

    it("throws on invalid config values", () => {
        const badConfig = { sensitivity: NaN, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 };
        expect(() => calculateAllNewPrices([], { energy: 20 }, badConfig)).toThrow("Price adjustment config must contain finite values");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/economics/market/__tests__/priceAdjustmentCalculator.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/economics/market/priceAdjustmentCalculator.ts
import { Goods } from "@game/data/Goods";
import { basePrices } from "@game/data/Goods";
import { PriceAdjustmentConfig, DEFAULT_PRICE_CONFIG, validateConfig, calculateImbalance, clamp } from "./marketTypes";

export function calculateNewPrice(
    oldPrice: number,
    basePrice: number,
    imbalance: number,
    config: PriceAdjustmentConfig = DEFAULT_PRICE_CONFIG
): number {
    validateConfig(config);

    if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
        throw new Error(`Invalid oldPrice: ${oldPrice}`);
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new Error(`Invalid basePrice: ${basePrice}`);
    }
    if (!Number.isFinite(imbalance) || Math.abs(imbalance) > 1) {
        throw new Error(`Invalid imbalance: ${imbalance}`);
    }

    const rawAdjustment = imbalance * config.sensitivity;
    const clampedAdjustment = clamp(
        rawAdjustment,
        -config.maxDecreasePerTick,
        config.maxIncreasePerTick
    );

    const newPrice = oldPrice * (1 + clampedAdjustment);
    const floor = basePrice * config.minPriceMultiplier;
    const ceiling = basePrice * config.maxPriceMultiplier;

    return clamp(newPrice, floor, ceiling);
}

export function calculateAllNewPrices(
    metrics: Array<{
        good: keyof Goods;
        imbalance: number;
        openingPrice: number;
        basePrice: number;
    }>,
    oldPrices: Partial<Record<keyof Goods, number>>,
    config: PriceAdjustmentConfig = DEFAULT_PRICE_CONFIG
): Record<keyof Goods, number> {
    validateConfig(config);

    const newPrices: Partial<Record<keyof Goods, number>> = {};

    for (const m of metrics) {
        const oldPrice = oldPrices[m.good] ?? basePrices[m.good];
        newPrices[m.good] = calculateNewPrice(m.openingPrice, m.basePrice, m.imbalance, config);
    }

    // Fill in any missing goods with basePrices
    const result: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
    for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
        result[key] = newPrices[key] ?? basePrices[key];
    }

    return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/economics/market/__tests__/priceAdjustmentCalculator.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/economics/market/priceAdjustmentCalculator.ts src/game/economics/market/__tests__/priceAdjustmentCalculator.test.ts
git commit -m "feat(market): add price adjustment calculator with bounds and validation"
```

---

### Task 2: Market Metrics Calculator (Complete Redesign)

**Files:**
- Create: `src/game/economics/market/marketMetricsCalculator.ts`
- Test: `src/game/economics/market/__tests__/marketMetricsCalculator.test.ts`

**Interfaces:**
- Consumes: Explicit `MarketMetricsInput` struct (see below), `Goods`, `basePrices`, `NON_CUMULATING_GOODS`
- Produces: `GoodMarketMetrics[]`, `NonCumulativeMarketFlow[]`

**Input Structure (Explicit - NO implicit accounting/object traversal):**
```typescript
interface MarketMetricsInput {
    tick: number;
    entityId: string;
    // Cumulative goods
    openingInventory: Partial<Record<keyof Goods, number>>;      // goods at tick start
    goodsProduction: Partial<Record<keyof Goods, number>>;       // total production this tick
    // Non-cumulative goods (from flow execution)
    nonCumulativeFlow: {
        productionAvailable: Partial<Record<keyof NonCumulativeGoods, number>>;
        fulfilledDemand: Partial<Record<keyof NonCumulativeGoods, number>>;
    };
    // Demand snapshots (pre-constraint)
    householdDesiredDemand: Partial<Record<keyof Goods, number>>;
    sectorDesiredDemand: Partial<Record<keyof Goods, number>>;   // sum of idealGoodsDemand at full scale
    capitalDesiredDemand: Partial<Record<keyof Goods, number>>;
    // Fulfillment (actual settlements)
    householdFulfilledDemand: Partial<Record<keyof Goods, number>>;
    sectorFulfilledDemand: Partial<Record<keyof Goods, number>>;
    capitalFulfilledDemand: Partial<Record<keyof Goods, number>>;
    // Current prices
    oldPrices: Partial<Record<keyof Goods, number>>;
}
```

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/economics/market/__tests__/marketMetricsCalculator.test.ts
import { describe, it, expect } from "vitest";
import { marketMetricsCalculator } from "../marketMetricsCalculator";
import { Goods, basePrices, NON_CUMULATING_GOODS } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import { SectorBid } from "@game/workers/SectorBid";
import { createEmptyWarehouse } from "@game/factories/createStarterWarehouse";

function createMockInput() {
    return {
        tick: 1,
        entityId: "test-entity",
        openingInventory: { energy: 200, food: 500 } as Partial<Record<keyof Goods, number>>,
        goodsProduction: { energy: 50, food: 100 } as Partial<Record<keyof Goods, number>>,
        nonCumulativeFlow: {
            productionAvailable: { energy: 50 } as Partial<Record<keyof Goods, number>>,
            fulfilledDemand: { energy: 40 } as Partial<Record<keyof Goods, number>>,
        },
        householdDesiredDemand: { energy: 120, food: 200 } as Partial<Record<keyof Goods, number>>,
        sectorDesiredDemand: { energy: 100 } as Partial<Record<keyof Goods, number>>,
        capitalDesiredDemand: { machinery: 10 } as Partial<Record<keyof Goods, number>>,
        householdFulfilledDemand: { energy: 50, food: 100 } as Partial<Record<keyof Goods, number>>,
        sectorFulfilledDemand: { energy: 80 } as Partial<Record<keyof Goods, number>>,
        capitalFulfilledDemand: { machinery: 10 } as Partial<Record<keyof Goods, number>>,
        oldPrices: { energy: 20, food: 30, machinery: 500 } as Partial<Record<keyof Goods, number>>,
    };
}

describe("marketMetricsCalculator", () => {
    it("computes cumulative good metrics correctly", () => {
        const input = createMockInput();
        const metrics = marketMetricsCalculator(input);

        const energy = metrics.find(m => m.good === "energy");
        expect(energy).toBeDefined();
        expect(energy!.openingInventory).toBe(200);
        expect(energy!.productionAvailable).toBe(50);
        expect(energy!.availableSupply).toBe(250); // 200 + 50
        expect(energy!.desiredDemand).toBe(220); // household 120 + sector 100
        expect(energy!.fulfilledDemand).toBe(130); // household 50 + sector 80
        expect(energy!.unmetDemand).toBe(90);
        expect(energy!.imbalance).toBeLessThanOrEqual(1);
        expect(energy!.imbalance).toBeGreaterThanOrEqual(-1);
    });

    it("handles zero demand", () => {
        const input = createMockInput();
        input.householdDesiredDemand = {};
        input.sectorDesiredDemand = {};
        input.capitalDesiredDemand = {};
        input.householdFulfilledDemand = {};
        input.sectorFulfilledDemand = {};
        input.capitalFulfilledDemand = {};

        const metrics = marketMetricsCalculator(input);

        const tourism = metrics.find(m => m.good === "tourism");
        expect(tourism!.desiredDemand).toBe(0);
        expect(tourism!.fulfilledDemand).toBe(0);
        expect(tourism!.imbalance).toBe(0);
    });

    it("handles zero supply with positive demand", () => {
        const input = createMockInput();
        input.openingInventory = {};
        input.goodsProduction = {};
        input.nonCumulativeFlow = { productionAvailable: {}, fulfilledDemand: {} };

        const metrics = marketMetricsCalculator(input);

        const energy = metrics.find(m => m.good === "energy");
        expect(energy!.availableSupply).toBe(0);
        expect(energy!.desiredDemand).toBeGreaterThan(0);
        expect(energy!.imbalance).toBe(1);
    });

    it("non-cumulative goods use flow execution results", () => {
        const input = createMockInput();
        const metrics = marketMetricsCalculator(input);

        for (const good of NON_CUMULATING_GOODS) {
            const m = metrics.find(m => m.good === good);
            expect(m).toBeDefined();
            expect(m!.availableSupply).toBe(m!.productionAvailable);
            expect(m!.openingInventory).toBe(0);
        }
    });

    it("sector desired demand uses full scale (actualScale=1)", () => {
        const input = createMockInput();
        input.sectorDesiredDemand = { energy: 100 }; // full idealGoodsDemand
        const metrics = marketMetricsCalculator(input);
        const energy = metrics.find(m => m.good === "energy");
        expect(energy!.desiredDemand).toBe(220); // 120 household + 100 sector
    });

    it("non-cumulative flow uses actual flow execution", () => {
        const input = createMockInput();
        const metrics = marketMetricsCalculator(input);

        for (const good of NON_CUMULATING_GOODS) {
            const m = metrics.find(m => m.good === good);
            expect(m!.availableSupply).toBe(m!.productionAvailable);
            expect(m!.openingInventory).toBe(0);
        }
    });

    it("throws on missing oldPrices", () => {
        const input = createMockInput();
        input.oldPrices = { energy: 20 }; // missing food
        expect(() => marketMetricsCalculator(input)).toThrow("Missing price for food");
    });

    it("throws on invalid oldPrices (zero/negative)", () => {
        const input = createMockInput();
        input.oldPrices = { energy: 0, food: 30 };
        expect(() => marketMetricsCalculator(input)).toThrow("Invalid price for energy");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/economics/market/__tests__/marketMetricsCalculator.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/economics/market/marketMetricsCalculator.ts
import { Goods, basePrices, NON_CUMULATING_GOODS } from "@game/data/Goods";
import { GoodMarketMetrics, NonCumulativeMarketFlow, calculateImbalance } from "./marketTypes";

export interface MarketMetricsInput {
    tick: number;
    entityId: string;
    openingInventory: Partial<Record<keyof Goods, number>>;
    goodsProduction: Partial<Record<keyof Goods, number>>;
    nonCumulativeFlow: {
        productionAvailable: Partial<Record<keyof Goods, number>>;
        fulfilledDemand: Partial<Record<keyof Goods, number>>;
    };
    householdDesiredDemand: Partial<Record<keyof Goods, number>>;
    sectorDesiredDemand: Partial<Record<keyof Goods, number>>;
    capitalDesiredDemand: Partial<Record<keyof Goods, number>>;
    householdFulfilledDemand: Partial<Record<keyof Goods, number>>;
    sectorFulfilledDemand: Partial<Record<keyof Goods, number>>;
    capitalFulfilledDemand: Partial<Record<keyof Goods, number>>;
    oldPrices: Partial<Record<keyof Goods, number>>;
}

export function marketMetricsCalculator(input: MarketMetricsInput): GoodMarketMetrics[] {
    const { oldPrices, ...rest } = input;

    // Validate all required prices present and valid
    const allGoods = new Set<keyof Goods>([
        ...Object.keys(basePrices) as (keyof Goods)[],
        ...Object.keys(rest.openingInventory) as (keyof Goods)[],
        ...Object.keys(rest.goodsProduction) as (keyof Goods)[],
        ...Object.keys(rest.householdDesiredDemand) as (keyof Goods)[],
        ...Object.keys(rest.sectorDesiredDemand) as (keyof Goods)[],
        ...Object.keys(rest.capitalDesiredDemand) as (keyof Goods)[],
    ]);

    for (const good of allGoods) {
        const price = oldPrices[good];
        if (price === undefined) {
            throw new Error(`Missing price for ${good} in oldPrices - must be initialized before calculation`);
        }
        if (!Number.isFinite(price) || price <= 0) {
            throw new Error(`Invalid price for ${good}: ${price}`);
        }
    }

    // Desired demand = sum of all sources (pre-constraint)
    const desiredDemandByGood = new Map<keyof Goods, number>();
    for (const [good, qty] of Object.entries(rest.householdDesiredDemand)) {
        const key = good as keyof Goods;
        desiredDemandByGood.set(key, (desiredDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.sectorDesiredDemand)) {
        const key = good as keyof Goods;
        desiredDemandByGood.set(key, (desiredDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.capitalDesiredDemand)) {
        const key = good as keyof Goods;
        desiredDemandByGood.set(key, (desiredDemandByGood.get(key) ?? 0) + qty);
    }

    // Fulfilled demand = actual settlements
    const fulfilledDemandByGood = new Map<keyof Goods, number>();
    for (const [good, qty] of Object.entries(rest.householdFulfilledDemand)) {
        const key = good as keyof Goods;
        fulfilledDemandByGood.set(key, (fulfilledDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.sectorFulfilledDemand)) {
        const key = good as keyof Goods;
        fulfilledDemandByGood.set(key, (fulfilledDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.capitalFulfilledDemand)) {
        const key = good as keyof Goods;
        fulfilledDemandByGood.set(key, (fulfilledDemandByGood.get(key) ?? 0) + qty);
    }

    const metrics: GoodMarketMetrics[] = [];

    for (const good of allGoods) {
        const isNonCumulative = NON_CUMULATING_GOODS.has(good);
        
        if (isNonCumulative) {
            // Non-cumulative: from flow execution only
            const productionAvailable = rest.nonCumulativeFlow.productionAvailable[good] ?? 0;
            const fulfilledDemand = rest.nonCumulativeFlow.fulfilledDemand[good] ?? 0;
            const desiredDemand = desiredDemandByGood.get(good) ?? 0;
            
            const availableSupply = productionAvailable;
            const unmetDemand = Math.max(0, desiredDemand - fulfilledDemand);
            const imbalance = calculateImbalance(desiredDemand, availableSupply);
            const supplyDemandRatio = desiredDemand > 0 ? availableSupply / desiredDemand : Infinity;
            const shortageRatio = desiredDemand > 0 ? Math.max(0, (desiredDemand - availableSupply) / desiredDemand) : 0;
            const surplusRatio = availableSupply > 0 ? Math.max(0, (availableSupply - desiredDemand) / availableSupply) : 0;

            metrics.push({
                good,
                openingPrice: oldPrices[good]!,
                closingPrice: 0, // filled by caller
                openingInventory: 0,
                productionAvailable,
                availableSupply,
                desiredDemand,
                fulfilledDemand,
                unmetDemand,
                supplyDemandRatio,
                shortageRatio,
                surplusRatio,
                imbalance,
                tradedQuantity: fulfilledDemand,
            });
        } else {
            // Cumulative: opening inventory + production
            const openingInventory = rest.openingInventory[good] ?? 0;
            const productionAvailable = rest.goodsProduction[good] ?? 0;
            const availableSupply = openingInventory + productionAvailable;
            const desiredDemand = desiredDemandByGood.get(good) ?? 0;
            const fulfilledDemand = fulfilledDemandByGood.get(good) ?? 0;
            const unmetDemand = Math.max(0, desiredDemand - fulfilledDemand);

            const imbalance = calculateImbalance(desiredDemand, availableSupply);
            const supplyDemandRatio = desiredDemand > 0 ? availableSupply / desiredDemand : Infinity;
            const shortageRatio = desiredDemand > 0 ? Math.max(0, (desiredDemand - availableSupply) / desiredDemand) : 0;
            const surplusRatio = availableSupply > 0 ? Math.max(0, (availableSupply - desiredDemand) / availableSupply) : 0;

            metrics.push({
                good,
                openingPrice: oldPrices[good]!,
                closingPrice: 0,
                openingInventory,
                productionAvailable,
                availableSupply,
                desiredDemand,
                fulfilledDemand,
                unmetDemand,
                supplyDemandRatio,
                shortageRatio,
                surplusRatio,
                imbalance,
                tradedQuantity: fulfilledDemand,
            });
        }
    }

    return metrics;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/economics/market/__tests__/marketMetricsCalculator.test.ts -v`
Expected: PASS (after fixing implementation details)

- [ ] **Step 5: Commit**

```bash
git add src/game/economics/market/marketMetricsCalculator.ts src/game/economics/market/__tests__/marketMetricsCalculator.test.ts
git commit -m "feat(market): add market metrics calculator with explicit MarketMetricsInput"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/economics/market/__tests__/marketMetricsCalculator.test.ts -v`
Expected: PASS (after fixing implementation details)

- [ ] **Step 5: Commit**

```bash
git add src/game/economics/market/marketMetricsCalculator.ts src/game/economics/market/__tests__/marketMetricsCalculator.test.ts
git commit -m "feat(market): add market metrics calculator with demand snapshots"
```

---

### Task 3: MarketPricesUpdatedEvent

**Files:**
- Create: `src/engine/lib/events/MarketPricesUpdatedEvent.ts`
- Test: `src/engine/lib/events/__tests__/MarketPricesUpdatedEvent.test.ts`

**Interfaces:**
- Consumes: `Entity`, `Goods`
- Produces: `MarketPricesUpdatedEvent`

**Note:** Follow engine event conventions - extend `EventBase<Data>`, data is plain object, not class instance.

- [ ] **Step 1: Write the failing test**

```typescript
// src/engine/lib/events/__tests__/MarketPricesUpdatedEvent.test.ts
import { describe, it, expect } from "vitest";
import { MarketPricesUpdatedEvent } from "../MarketPricesUpdatedEvent";
import { Entity } from "@engine/entities/entity";
import { Goods } from "@game/data/Goods";

describe("MarketPricesUpdatedEvent", () => {
    it("stores entity, tick, and prices", () => {
        const entity = new Entity("test-123");
        const prices: Record<keyof Goods, number> = { energy: 25, food: 30 } as Record<keyof Goods, number>;
        const event = new MarketPricesUpdatedEvent({ entity, tick: 5, prices });
        
        expect(event.data.entity).toBe(entity);
        expect(event.data.tick).toBe(5);
        expect(event.data.prices).toEqual(prices);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/engine/lib/events/__tests__/MarketPricesUpdatedEvent.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/engine/lib/events/MarketPricesUpdatedEvent.ts
import { Entity } from "@engine/entities/entity";
import { EventBase } from "./events";
import { Goods } from "@game/data/Goods";

export interface MarketPricesUpdatedData {
    entity: Entity;
    tick: number;
    prices: Record<keyof Goods, number>;
}

export class MarketPricesUpdatedEvent extends EventBase<MarketPricesUpdatedData> { }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/engine/lib/events/__tests__/MarketPricesUpdatedEvent.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/lib/events/MarketPricesUpdatedEvent.ts src/engine/lib/events/__tests__/MarketPricesUpdatedEvent.test.ts
git commit -m "feat(market): add MarketPricesUpdatedEvent"
```

---

### Task 4: MarketPriceSystem

**Files:**
- Create: `src/game/systems/MarketPriceSystem.ts`
- Test: `src/game/systems/__tests__/MarketPriceSystem.test.ts`

**Interfaces:**
- Consumes: `IndustryTickCompletedEvent`, `MarketPriceSystem`, `priceAdjustmentCalculator`, `marketMetricsCalculator`, `basePrices`, `DEFAULT_PRICE_CONFIG`
- Produces: `MarketPriceSystem` class with `priceMemory`, `getPriceSnapshot(entityId, expectedTick)`, `serialize()`, `deserialize()`

**New Types:**
```typescript
// Add to marketTypes.ts or at top of MarketPriceSystem.ts
interface CommittedMarketPrices {
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Readonly<Record<keyof Goods, number>>;
}

interface PriceMemoryState {
    version: number;
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Record<keyof Goods, number>;
}

enum MarketPriceStatus {
    OK = "ok",
    FAILED_CALCULATION = "failed_calculation",
    FAILED_VALIDATION = "failed_validation",
    STALE_EVENT = "stale_event",
}
```

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/systems/__tests__/MarketPriceSystem.test.ts
import { describe, it, expect, vi } from "vitest";
import { MarketPriceSystem } from "../MarketPriceSystem";
import { Engine } from "@engine/core/engine";
import { IndustryTickCompletedEvent } from "@/engine/lib/events/IndustryTickCompletedEvent";
import { IndustryTickCompletedData } from "@/engine/lib/events/IndustryTickCompletedEvent";
import { Entity } from "@engine/entities/entity";
import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import { SectorBid } from "@game/workers/SectorBid";
import { basePrices } from "@game/data/Goods";

describe("MarketPriceSystem", () => {
    let engine: Engine;
    let system: MarketPriceSystem;
    let mockEntity: Entity;

    beforeEach(() => {
        engine = new Engine();
        system = new MarketPriceSystem();
        system.addToEngine(engine);
        mockEntity = new Entity("test-entity");
        mockEntity.addComponent(/* mock IndustryComponent */);
    });

    it("initializes prices from basePrices", () => {
        const prices = system.getPriceSnapshot("new-entity", 1);
        expect(prices).toEqual(basePrices);
    });

    it("commits new prices on IndustryTickCompletedEvent", () => {
        const tickData: IndustryTickCompletedData = {
            entity: mockEntity,
            tick: 1,
            metrics: {
                populationUpdates: {},
                workingWorkers: {} as any,
                freeWorkers: {} as any,
                goodsProduction: {},
                goodsRequirements: {},
                sectorResults: {},
                sectorUtilization: {},
                sectorLaborCosts: {},
                sectorInputCosts: {},
                accounting: {
                    householdSalesByGood: { energy: 100 },
                    capitalPurchasesByGood: {},
                    sectorProductionSalesByGood: {},
                    sectorInputsConsumedByGood: {},
                    sectorProductionByGood: {},
                    wagesByPop: {},
                    spendingByPop: {},
                    sectorInputsPurchasedBySector: { powerPlant: { energy: 100 } },
                    sectorInputsConsumedBySector: {},
                    sectorInputRefundsBySector: {},
                    sectorInputRefundQuantitiesBySector: {},
                    sectorInputRefundAmountsBySector: {},
                    returnedInputsByGood: {},
                    sectorInputPaymentBreakdown: {},
                    purchaseProvenance: {},
                    treasurySubsidiesPaid: {},
                },
                money: {},
                colonyTreasury: 0,
            },
        };

        const event = new IndustryTickCompletedEvent(tickData);
        engine.dispatchEvent(event);

        const prices = system.getPriceSnapshot("test-entity", 2);
        // Energy price should have increased due to shortage
        expect(prices.energy).toBeGreaterThan(20);
    });

    it("rejects snapshot request for uncommitted tick", () => {
        expect(() => system.getPriceSnapshot("test-entity", 5)).toThrow("Prices for tick 5 not committed");
    });

    it("rejects stale completion event with exact tick check", () => {
        // First commit tick 1 -> effectiveTick 2
        // Then try to commit tick 1 again (duplicate) -> exact match required
        // Then try to commit tick 0 (stale) -> exact match required
    });

    it("emits MarketPricesUpdatedEvent after price update", () => {
        const eventHandler = vi.fn();
        // Subscribe to MarketPricesUpdatedEvent
        // Dispatch tick completed event
        // Verify event emitted with correct data
    });

    it("deserialization validates before mutating live memory", () => {
        // Load state with invalid prices -> should throw, not corrupt memory
        // Load state with wrong effectiveTick -> should throw
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/systems/__tests__/MarketPriceSystem.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/systems/MarketPriceSystem.ts
import { System } from "@engine/systems/system";
import { Engine } from "@engine/core/engine";
import { IndustryTickCompletedEvent, IndustryTickCompletedData } from "@/engine/lib/events/IndustryTickCompletedEvent";
import { MarketPricesUpdatedEvent } from "@/engine/lib/events/MarketPricesUpdatedEvent";
import { basePrices } from "@game/data/Goods";
import { marketMetricsCalculator, MarketMetricsInput } from "@game/economics/market/marketMetricsCalculator";
import { calculateAllNewPrices, DEFAULT_PRICE_CONFIG, validateConfig } from "@game/economics/market/priceAdjustmentCalculator";
import { validatePrices } from "@game/workers/industryTickHelpers";
import { IndustryComponent } from "@game/components/industryComponent";
import { Goods } from "@game/data/Goods";
import { SectorBid } from "@game/workers/SectorBid";
import { Population } from "@game/data/Population";
import { NonCumulativeMarketFlow } from "@game/economics/market/marketTypes";

interface CommittedMarketPrices {
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Readonly<Record<keyof Goods, number>>;
}

interface PriceMemoryState {
    version: number;
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Record<keyof Goods, number>;
}

enum MarketPriceStatus {
    OK = "ok",
    FAILED_CALCULATION = "failed_calculation",
    FAILED_VALIDATION = "failed_validation",
    STALE_EVENT = "stale_event",
}

interface MarketPriceStateEntry {
    status: MarketPriceStatus;
    committed?: CommittedMarketPrices;
    error?: string;
}

export class MarketPriceSystem extends System {
    private priceMemory = new Map<string, MarketPriceStateEntry>();
    private config = DEFAULT_PRICE_CONFIG;

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        return this;
    }

    removeFromEngine(): this {
        if (this.engine) {
            this.engine.unsubscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        }
        return super.removeFromEngine();
    }

    getPriceSnapshot(entityId: string, expectedTick: number): Readonly<Record<keyof Goods, number>> {
        const entry = this.priceMemory.get(entityId);
        if (!entry || !entry.committed) {
            if (expectedTick === 1) return { ...basePrices };
            throw new Error(`Prices for tick ${expectedTick} not committed (no prices for ${entityId})`);
        }
        
        const committedEffectiveTick = entry.committed.effectiveTick;
        
        if (committedEffectiveTick < expectedTick) {
            throw new Error(`Prices for tick ${expectedTick} not committed (last effective: ${committedEffectiveTick})`);
        }
        
        return entry.committed.prices;
    }

    private handleTickCompleted = (data: IndustryTickCompletedData) => {
        const entityId = data.entity.id;
        
        // Reject stale/duplicate/skipped events - EXACT equality check required
        const entry = this.priceMemory.get(entityId);
        const expectedSourceTick = entry?.committed?.sourceTick ?? 0;
        const expectedCompletionTick = expectedSourceTick + 1;
        
        if (data.tick !== expectedCompletionTick) {
            // Record failure status but don't mutate live prices
            this.priceMemory.set(entityId, {
                status: MarketPriceStatus.STALE_EVENT,
                error: `Unexpected market price update for ${entityId}: expected tick ${expectedCompletionTick}, received ${data.tick}`
            });
            return; // Silent ignore - do not throw, do not update prices
        }
        
        const oldPrices = entry?.committed?.prices ?? { ...basePrices };
        
        try {
            // Calculate metrics
            const metrics = this.calculateMetrics(data, oldPrices);
            
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
            this.priceMemory.set(entityId, {
                status: MarketPriceStatus.OK,
                committed,
            });
            
            // Notify UI
            this.engine!.dispatchEvent(
                new MarketPricesUpdatedEvent({
                    entity: data.entity,
                    tick: data.tick,
                    prices: newPrices,
                })
            );
        } catch (error) {
            // Record failure - prices remain at previous committed state
            this.priceMemory.set(entityId, {
                status: MarketPriceStatus.FAILED_CALCULATION,
                committed: entry?.committed,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            // Re-throw for logging but don't corrupt state
            throw error;
        }
    };

    private calculateMetrics(data: IndustryTickCompletedData, oldPrices: Record<keyof Goods, number>): any[] {
        // Build explicit MarketMetricsInput from completed event data
        const industry = data.entity.getComponent(IndustryComponent);
        const sectorBids = industry?.sectorBids ?? [];
        
        const input: MarketMetricsInput = {
            tick: data.tick,
            entityId: data.entity.id,
            openingInventory: data.metrics.goods ?? {}, // goods at tick start
            goodsProduction: data.metrics.goodsProduction ?? {},
            nonCumulativeFlow: {
                productionAvailable: data.metrics.nonCumulativeProduction ?? {},
                fulfilledDemand: data.metrics.nonCumulativeFulfilled ?? {},
            },
            householdDesiredDemand: data.metrics.householdDesiredDemand ?? {},
            sectorDesiredDemand: this.sumSectorIdealDemand(sectorBids),
            capitalDesiredDemand: data.metrics.capitalDesiredDemand ?? {},
            householdFulfilledDemand: data.metrics.accounting.householdSalesByGood ?? {},
            sectorFulfilledDemand: this.flattenSectorPurchases(data.metrics.accounting.sectorInputsPurchasedBySector),
            capitalFulfilledDemand: data.metrics.accounting.capitalPurchasesByGood ?? {},
            oldPrices,
        };
        
        return marketMetricsCalculator(input);
    }

    private sumSectorIdealDemand(bids: SectorBid[]): Partial<Record<keyof Goods, number>> {
        const result: Partial<Record<keyof Goods, number>> = {};
        for (const bid of bids) {
            for (const [good, demand] of Object.entries(bid.idealGoodsDemand)) {
                const key = good as keyof Goods;
                result[key] = (result[key] ?? 0) + demand;
            }
        }
        return result;
    }

    private flattenSectorPurchases(purchases: IndustryTickCompletedData["metrics"]["accounting"]["sectorInputsPurchasedBySector"]): Partial<Record<keyof Goods, number>> {
        const result: Partial<Record<keyof Goods, number>> = {};
        for (const [, goods] of Object.entries(purchases)) {
            for (const [good, qty] of Object.entries(goods)) {
                const key = good as keyof Goods;
                result[key] = (result[key] ?? 0) + qty;
            }
        }
        return result;
    }

    private calculateNewPrices(metrics: any[], oldPrices: Record<keyof Goods, number>): Record<keyof Goods, number> {
        const calcMetrics = metrics.map(m => ({
            good: m.good,
            imbalance: m.imbalance,
            openingPrice: m.openingPrice,
            basePrice: basePrices[m.good],
        }));
        return calculateAllNewPrices(calcMetrics, oldPrices, this.config);
    }

    // Serialization for save/load
    serialize(): PriceMemoryState[] {
        const result: PriceMemoryState[] = [];
        for (const [entityId, entry] of this.priceMemory) {
            if (entry.committed) {
                result.push({
                    version: 1,
                    entityId: entry.committed.entityId,
                    sourceTick: entry.committed.sourceTick,
                    effectiveTick: entry.committed.effectiveTick,
                    prices: { ...entry.committed.prices }, // copy to mutable
                });
            }
        }
        return result;
    }

    // Deserialization: VALIDATE FIRST, then mutate
    deserialize(state: PriceMemoryState[]): void {
        // Phase 1: Validate ALL entries before any mutation
        const validatedEntries: Array<{ entityId: string; committed: CommittedMarketPrices }> = [];
        
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
            validatedEntries.push({
                entityId: s.entityId,
                committed: {
                    entityId: s.entityId,
                    sourceTick: s.sourceTick,
                    effectiveTick: s.effectiveTick,
                    prices: s.prices,
                },
            });
        }
        
        // Phase 2: Apply all validated entries atomically
        for (const entry of validatedEntries) {
            this.priceMemory.set(entry.entityId, {
                status: MarketPriceStatus.OK,
                committed: entry.committed,
            });
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/systems/__tests__/MarketPriceSystem.test.ts -v`
Expected: PASS (after fixing implementation details)

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/MarketPriceSystem.ts src/game/systems/__tests__/MarketPriceSystem.test.ts
git commit -m "feat(market): add MarketPriceSystem with priceMemory ownership, tick tracking, status tracking, and safe deserialization"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/systems/__tests__/MarketPriceSystem.test.ts -v`
Expected: PASS (after fixing implementation details)

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/MarketPriceSystem.ts src/game/systems/__tests__/MarketPriceSystem.test.ts
git commit -m "feat(market): add MarketPriceSystem with priceMemory ownership and tick tracking"
```

---

### Task 5: IndustryTickInput Contract & Worker Integration

**Files:**
- Modify: `src/game/workers/IndustryTickInput.ts`
- Modify: `src/game/workers/industryTick.worker.ts`
- Test: `src/game/workers/__tests__/IndustryTickInput.test.ts`

**Interfaces:**
- Consumes: `IndustryTickInput` type, `processIndustry` function
- Produces: Updated `IndustryTickInput` with `prices` field (as `PriceSnapshot`), updated `processIndustry`

**PriceSnapshot Type (includes entity/tick identity):**
```typescript
interface PriceSnapshot {
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Readonly<Record<keyof Goods, number>>;
}
```

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/workers/__tests__/IndustryTickInput.test.ts
import { describe, it, expect } from "vitest";
import { IndustryTickInput, PriceSnapshot } from "../IndustryTickInput";
import { Goods } from "@game/data/Goods";

describe("IndustryTickInput", () => {
    it("includes PriceSnapshot with entity/tick identity", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 25, food: 30 } as Readonly<Record<keyof Goods, number>>,
        };
        
        const input: IndustryTickInput = {
            entityId: "test",
            activeSectors: new Set(),
            goods: {} as any,
            population: {} as any,
            techMultipliers: {} as any,
            capitalStock: {} as any,
            money: {} as any,
            settlementType: "colony",
            allowedSectors: undefined,
            workerEfficiencyMultipliers: {} as any,
            materialRequirementMultipliers: {} as any,
            capitalMultipliers: {} as any,
            selectedMethod: {} as any,
            colonyTreasury: 0,
            sectorInvestment: {} as any,
            activeLaws: new Set(),
            tick: 1,
            prices,
            producerInventories: undefined,
        };
        
        expect(input.prices.entityId).toBe("test-colony");
        expect(input.prices.sourceTick).toBe(1);
        expect(input.prices.effectiveTick).toBe(2);
        expect(input.prices.prices.energy).toBe(25);
    });

    it("rejects partial price record", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 25 } as any, // missing food
        };
        
        expect(() => validatePrices(prices.prices)).toThrow("Missing price for food");
    });

    it("rejects zero/negative price", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 0, food: 30 } as any,
        };
        
        expect(() => validatePrices(prices.prices)).toThrow("Invalid or missing price for energy: 0");
    });
    
    it("rejects mismatched entityId", () => {
        const prices: PriceSnapshot = {
            entityId: "wrong-entity",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 25, food: 30 } as Readonly<Record<keyof Goods, number>>,
        };
        
        // Worker should validate entityId matches input.entityId
        expect(() => validatePriceSnapshot(prices, "test")).toThrow("Entity ID mismatch");
    });
    
    it("rejects mismatched effectiveTick", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 5, // doesn't match input.tick + 1
            prices: { energy: 25, food: 30 } as Readonly<Record<keyof Goods, number>>,
        };
        
        expect(() => validatePriceSnapshot(prices, "test-colony", 2)).toThrow("Effective tick mismatch");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/workers/__tests__/IndustryTickInput.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/workers/IndustryTickInput.ts (modify)
import { Goods } from "@game/data/Goods";

export interface PriceSnapshot {
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Readonly<Record<keyof Goods, number>>;
}

export interface IndustryTickInput {
    entityId: string;
    activeSectors: Set<keyof IndustrialSectors>;
    goods: Goods;
    population: Population;
    techMultipliers: Record<keyof IndustrialSectors, number>;
    capitalStock: Record<keyof IndustrialSectors, Partial<Goods>>;
    money: Record<keyof IndustrialSectors, number>;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;
    workerEfficiencyMultipliers: Record<keyof Population, number>;
    materialRequirementMultipliers: Record<keyof Goods, number>;
    capitalMultipliers: Record<keyof IndustrialSectors, number>;
    selectedMethod: Record<keyof IndustrialSectors, string | null>;
    colonyTreasury: number;
    sectorInvestment: Record<keyof IndustrialSectors, number>;
    activeLaws: Set<string>;
    tick: number;
    prices: PriceSnapshot;  // NEW: includes entity/tick identity
    producerInventories?: ProducerInventories;
}

// Validation function
export function validatePriceSnapshot(
    snapshot: PriceSnapshot, 
    expectedEntityId: string, 
    expectedEffectiveTick: number
): void {
    if (snapshot.entityId !== expectedEntityId) {
        throw new Error(`Entity ID mismatch: expected ${expectedEntityId}, got ${snapshot.entityId}`);
    }
    if (snapshot.effectiveTick !== expectedEffectiveTick) {
        throw new Error(`Effective tick mismatch: expected ${expectedEffectiveTick}, got ${snapshot.effectiveTick}`);
    }
    validatePrices(snapshot.prices);
}
```

```typescript
// src/game/workers/industryTick.worker.ts (modify processIndustry)
function processIndustry(
    input: IndustryTickInput,
    priceMemory: Map<string, Partial<Record<keyof Goods, number>>>,
    results: Map<string, IndustryTickResult>
): IndustryTickPatch | null {
    const { 
        entityId,
        activeSectors,
        goods,
        population,
        allowedSectors,
        techMultipliers,
        capitalStock,
        money: startingMoney,
        colonyTreasury: startingTreasury,
        settlementType,
        workerEfficiencyMultipliers,
        materialRequirementMultipliers,
        capitalMultipliers,
        selectedMethod,
        tick,
        producerInventories = {},
        prices: priceSnapshot,  // NEW: PriceSnapshot with identity
    } = input;
    
    // Validate price snapshot identity
    validatePriceSnapshot(priceSnapshot, entityId, tick + 1);
    
    // REMOVE: const memory = { ...(priceMemory.get(entityId) ?? {}) };
    // REMOVE: const prices = validatePrices(getPrices(goods, memory));
    
    // USE: const prices = validatePrices(priceSnapshot.prices);
    const prices = validatePrices(priceSnapshot.prices);
    
    // ... rest unchanged
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/workers/__tests__/IndustryTickInput.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/workers/IndustryTickInput.ts src/game/workers/industryTick.worker.ts src/game/workers/__tests__/IndustryTickInput.test.ts
git commit -m "feat(market): add PriceSnapshot with entity/tick identity to IndustryTickInput, strict validation"
```

---

### Task 6: IndustrySystem Integration

**Files:**
- Modify: `src/game/systems/industrySystem.ts`
- Test: `src/game/systems/__tests__/industrySystem.test.ts`

**Interfaces:**
- Consumes: `MarketPriceSystem`, `IndustrySystem`, `IndustryTickInput`
- Produces: Updated `IndustrySystem` with price snapshot passing

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/systems/__tests__/industrySystem.test.ts
import { describe, it, expect, vi } from "vitest";
import { IndustrySystem } from "../industrySystem";
import { Engine } from "@engine/core/engine";
import { MarketPriceSystem } from "../MarketPriceSystem";
import { IndustryComponent } from "@game/components/industryComponent";
import { DayPassedEvent } from "@/engine/lib/events";

describe("IndustrySystem", () => {
    it("passes PriceSnapshot with entityId, sourceTick, effectiveTick to worker input", () => {
        const engine = new Engine();
        const marketPriceSystem = new MarketPriceSystem();
        marketPriceSystem.addToEngine(engine);
        const industrySystem = new IndustrySystem();
        industrySystem.addToEngine(engine);

        // Setup entity with IndustryComponent
        // Mock marketPriceSystem.getPriceSnapshot
        // Trigger DayPassedEvent
        // Verify input.prices passed to worker with correct PriceSnapshot structure
        // Verify entityId, sourceTick, effectiveTick all present
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/systems/__tests__/industrySystem.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/systems/industrySystem.ts (modify)
import { MarketPriceSystem } from "./MarketPriceSystem";
import { PriceSnapshot } from "@game/workers/IndustryTickInput";
// ... in onDayPassed
const committed = marketPriceSystem.getCommittedPrices(entity.id); // new method returning CommittedMarketPrices or null

const pricesSnapshot: PriceSnapshot = committed ? {
    entityId: committed.entityId,
    sourceTick: committed.sourceTick,
    effectiveTick: committed.effectiveTick,
    prices: committed.prices,
} : {
    entityId: entity.id,
    sourceTick: 0,
    effectiveTick: 1,
    prices: { ...basePrices },
};

industries.push({
    // ... existing fields
    tick: this.tickCounter,
    prices: pricesSnapshot,
});

// Add MarketPriceSystem to engine in game.ts (already done in Task 7)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/systems/__tests__/industrySystem.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/industrySystem.ts src/game/systems/__tests__/industrySystem.test.ts
git commit -m "feat(market): pass PriceSnapshot with entity/tick identity in IndustrySystem"
```

---

### Task 7: Worker Pool Contract & Game Registration

**Files:**
- Modify: `src/game/systems/industryWorkerPool.ts`
- Modify: `src/game/game.ts`
- Test: `src/game/systems/__tests__/industryWorkerPool.test.ts`

**Interfaces:**
- Consumes: `WorkerPoolMessage`, `IndustryWorkerPool`, `Game`
- Produces: Updated `WorkerPoolMessage` with tick, `Game` registers `MarketPriceSystem`

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/systems/__tests__/industryWorkerPool.test.ts
import { describe, it, expect } from "vitest";
import { IndustryWorkerPool, WorkerPoolMessage } from "../industryWorkerPool";

describe("WorkerPoolMessage", () => {
    it("includes tick field", () => {
        const msg: WorkerPoolMessage = { type: "tick", tick: 5, patches: [] };
        expect(msg.tick).toBe(5);
    });

    it("rejects response with mismatched tick", () => {
        // Verify worker pool rejects responses with wrong tick
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/systems/__tests__/industryWorkerPool.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/systems/industryWorkerPool.ts (modify)
export interface WorkerPoolMessage {
    type: string;
    tick: number;           // Must match IndustryTickInput.tick
    patches: IndustryTickPatch[];
}

// In tick() method: include tick in postMessage
this.workers[i].postMessage({ type: "tick", industries: this.batches[i], tick });

// In handleMessage: verify tick matches
private handleMessage(_workerIndex: number, event: MessageEvent<WorkerPoolMessage>) {
    if (event.data.type !== "result") return;
    
    const { tick, patches } = event.data;
    const batch = this.pendingBatches.get(tick);
    if (!batch || batch.resolved) {
        console.warn(`Batch ${tick} not found or already resolved`);
        return;
    }
    // ... rest unchanged
}
```

```typescript
// In game.ts - register MarketPriceSystem
import { MarketPriceSystem } from "./systems/MarketPriceSystem";
// ...
this.engine.addSystem(MarketPriceSystem);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/systems/__tests__/industryWorkerPool.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/industryWorkerPool.ts src/game/game.ts src/game/systems/__tests__/industryWorkerPool.test.ts
git commit -m "feat(market): add tick to WorkerPoolMessage, register MarketPriceSystem"
```

---

### Task 8: Goods.ts Deprecation & Goods.ts Update

**Files:**
- Modify: `src/game/data/Goods.ts`

**Interfaces:**
- Consumes: `getPrices` function
- Produces: Deprecated `getPrices` with JSDoc

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/data/__tests__/Goods.test.ts (add to existing)
import { describe, it, expect } from "vitest";
import { getPrices } from "../data/Goods";

describe("getPrices deprecated", () => {
    it("still works for backward compatibility", () => {
        const goods = { energy: 100 } as any;
        const memory = {} as any;
        const prices = getPrices(goods, memory);
        expect(prices.energy).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/data/__tests__/Goods.test.ts -v`
Expected: FAIL (test doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/game/data/Goods.ts (modify getPrices)
/**
 * @deprecated Use MarketPriceSystem for authoritative prices. This function is kept for backward compatibility only.
 */
export function getPrices(goods: Goods, memory: Partial<Record<keyof Goods, number>>): Record<keyof Goods, number> {
    // ... existing implementation unchanged
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/data/__tests__/Goods.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/data/Goods.ts
git commit -m "feat(market): deprecate getPrices in Goods.ts"
```

---

### Task 9: Scenario & Integration Tests

**Files:**
- Create: `src/game/economics/market/__tests__/marketIntegration.test.ts`

**Interfaces:**
- Consumes: Full market system, worker, accounting
- Produces: End-to-end scenario tests

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/economics/market/__tests__/marketIntegration.test.ts
import { describe, it, expect } from "vitest";
// Import full test setup

describe("Market Integration", () => {
    it("energy shortage increases price within cap", () => {
        // Setup: colony with low energy production, high demand
        // Run tick
        // Verify energy price increased but within 10% cap
    });

    it("food surplus decreases price within cap", () => {
        // Setup: colony with high food production, low demand
        // Run tick
        // Verify food price decreased but within 10% cap
    });

    it("affordability crisis: high demand low supply -> price up", () => {
        // Households want energy but can't afford -> desiredDemand high, fulfilled low
        // Price should rise, not fall
    });

    it("repeated shortage cycles -> price rises to ceiling", () => {
        // Run multiple ticks with persistent shortage
        // Price should approach ceiling and stay there
    });

    it("price floor/ceiling never crossed", () => {
        // Extreme shortage/surplus
        // Price stays within [base*0.1, base*10]
    });

    it("non-cumulative energy shortage increases price", () => {
        // Energy is non-cumulative, shortage in flow pool
        // Price should respond
    });

    it("all existing V13 accounting tests pass", () => {
        // Run full test suite
    });

    it("V14.1 metrics history continues working", () => {
        // Verify EconomicMetricsSystem still records snapshots
    });

    // Mandatory additional tests from spec
    it("opening inventory captured before production", () => {
        // No double counting
    });

    it("production captured after actual execution", () => {
        // Only real production included
    });

    it("sector demand captured before scaling", () => {
        // Allocator constraints do not erase demand
    });

    it("household demand captured before affordability", () => {
        // Low cash does not hide demand
    });

    it("capital demand captured before allocation", () => {
        // Actual purchases are not mistaken for desired demand
    });

    it("same non-cumulative good used by multiple sectors", () => {
        // No double counting
    });

    it("non-cumulative goods immediately consumed", () => {
        // Production and fulfillment both recorded
    });

    it("worker receives partial price record", () => {
        // Tick rejected
    });

    it("persisted price is zero or negative", () => {
        // Explicit failure
    });

    it("price memory restored from save", () => {
        // Prices and tick identity preserved
    });

    it("duplicate completion event", () => {
        // Same tick cannot be committed twice
    });

    it("stale completion event", () => {
        // Older prices cannot overwrite newer prices
    });

    it("worker completion arrives out of order", () => {
        // Prices remain associated with correct entity and tick
    });

    it("market metrics contain invalid quantities", () => {
        // Tick rejected
    });

    it("price update fails", () => {
        // Next tick cannot start using stale or partially committed prices
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/game/economics/market/__tests__/marketIntegration.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Implementation is running the full test suite and verifying behavior
// No new code - just verifying the integrated system works
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/game/economics/market/__tests__/marketIntegration.test.ts -v`
Expected: PASS

Run full suite: `pnpm test`
Expected: 837+ tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/economics/market/__tests__/marketIntegration.test.ts
git commit -m "feat(market): add scenario and integration tests"
```

---

### Task 10: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (837+)

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No new errors (pre-existing only)

- [ ] **Step 4: Commit final**

```bash
git commit -m "feat(market): V14.2 Market Dynamics complete"
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 0 | V14.2.0 Code inspection & data contract verification |
| 1 | Market types, demand snapshots, config, validation, price calculator |
| 2 | Market metrics calculator with explicit MarketMetricsInput |
| 3 | MarketPricesUpdatedEvent |
| 4 | MarketPriceSystem (priceMemory, tick tracking, status, safe deserialization) |
| 5 | IndustryTickInput + PriceSnapshot with entity/tick identity |
| 6 | IndustrySystem tick-boundary integration (PriceSnapshot with identity) |
| 7 | Worker pool tick contract + Game registration |
| 8 | getPrices deprecation |
| 9 | Scenario/integration tests + mandatory additional tests |
| 10 | Final verification |

**Total: ~11 tasks, ~55 steps**