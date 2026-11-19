# Economic Simulation Accounting Fixes Implementation Plan (Final v14 — Implementation Ready)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 accounting inconsistencies in the economic simulation tick pipeline with strict separation of physical inventory, economic consumption, and monetary transfers.

**Architecture:** Incremental fixes to `industryTick.worker.ts`, `capitalSystem.ts`, `transactionLedger.ts`, `industryTickHelpers.ts`, `provenanceSettlement.ts`. Each fix targets a specific accounting invariant.

**Tech Stack:** TypeScript, Vitest, existing factory/test patterns

**Spec:** This plan (self-contained)

## Global Constraints
- All monetary/quantity values: `Number.isFinite()` and `>= 0`
- Scale-aware tolerance: `Math.max(1e-6, 1e-9 * max(1, values))` for aggregates; `Math.max(1e-9, 1e-10 * max(1, values))` for per-unit
- Per-entity warehouse provenance tracking; no global warehouse
- Non-cumulative goods (`NON_CUMULATING_GOODS`) excluded from warehouse pools; allocated via incremental readiness-and-clearing with SCC cycle detection
- Gross procurement ledger (Approach A): purchases + refunds from single shared provenance settlement; refunds routed to original sources with physical returns
- Capital: record actual `moneySpent[sector]` in monetary ledger; physical audit in `CapitalProcessResult.purchasesBySector`
- Household reservation: subtracted once from sector purchasing pool; physical inventory unchanged
- Settlement calculated ONCE after sector execution, used everywhere
- 818 existing tests must pass

---

### Task 0: Provenance Settlement Helper (Foundation)

**Files:** Create `src/game/workers/provenanceSettlement.ts`, test `provenanceSettlement.test.ts`

**Interfaces:** Consumes `purchaseProvenance`, `sectorResults.consumedGoods`; Produces `ProvenanceSettlement` (consumed, refunded per source) used by ALL downstream

**Key Implementation:**
```typescript
export function settleProvenance(
  purchaseProvenance: PurchaseProvenance,
  sectorResults: Record<string, { consumedGoods: Record<string, number> }>
): ProvenanceSettlement {
  // 1. Validate complete input structure BEFORE iterating:
  //    - purchaseProvenance must be a valid object
  //    - Every sector and good key must be valid
  //    - Every source quantity must be finite and nonnegative
  //    - Sum of source quantities must be finite
  
  // 2. Reverse check: every positive consumption must have provenance for that sector and good
  //    - Positive consumption without provenance: throw
  //    - Zero consumption without provenance: allowed
  //    - Negative or non-finite consumption: throw
  //    - Missing `consumedGoods` for a sector = treat as empty (consumed nothing)
  //    - Unknown producers and malformed producer maps: throw
  
  // 3. Iterate purchaseProvenance, validate structure, producers map, finite totals
  // 4. SCALE-AWARE physical tolerance: Math.max(1e-12, 1e-10 * max(1, totalPurchased))
  // 5. Proportional allocation: consumed = purchased * (consumedQty / totalPurchased)
  // 7. Invariant: purchased = consumed + refunded per source (within physical tolerance)
  // 8. Edge case: if provenance has zero total purchased but consumption > 0, throw
}
```

**Tests:** Reverse validation (positive=throw, zero=allowed, negative=throw, missing consumedGoods=empty, unknown producer=throw), malformed inputs, aggregate overflow, zero consumption/purchase, finite quantities, invariant `purchased = consumed + refunded` per source.

---

### Task 1: Source-Aware Household Sales Stock (CORRECTED Equations + Producer Procurement Priority + Ownership)

**Files:** `industryTick.worker.ts:395-405, 582-591, 644-657`, test `industryTick.worker.test.ts`

**Key Corrections:**
- **Equation:** `W_closing = W_opening - W_grossPurchased + W_refunded` (NOT `W_opening - W_consumed + W_refunded`)
- Physical stock unchanged by logical reservation
- Producer inventories: deep clone from `input.producerInventories` at ALL nesting levels, apply `P_closing = P_opening - P_consumed + P_refunded`
- Household sales stock = physical warehouse stock BEFORE household sales
- **Producer procurement:** `buySectorInputs()` receives BOTH `goodsForSectors` (warehouse) AND `producerInventories`
- **Procurement priority: WAREHOUSE-FIRST** - allocate against warehouse stock first, then producer inventory
- **Producer identity:** provenance keys identify actual producer accounts (not just sector categories); distinguish warehouse vs each specific producer
- Allocate against actual source availability, record source of every purchased unit, decrement corresponding physical source exactly once

**Implementation:**
```typescript
// Calculate settlement ONCE:
const { consumed, refunded } = settleProvenance(purchaseProvenance, sectorResults);

// Aggregate per-source totals from settlement
// Warehouse: W_closing = W_opening - W_grossPurchased + W_refunded
// Producer: P_closing = P_opening - P_consumed + P_refunded (deep clone from input at ALL nesting levels)
// HouseholdSalesStock = physicalWarehouseStock (reservation already subtracted from sector pool)
```

**Test:** Verify `W_closing = 100 - 40 + 6.67 = 66.67` (NOT 73.34); producer `20 - 16.67 + 3.33 = 6.66`; household sales stock = 66.67. Verify producer inventory decremented exactly once per refund. Verify warehouse-first procurement. Verify producer identity preserved in provenance.

---

### Task 2: Genuine Incremental Readiness-and-Clearing Execution (SINGLE Execution Path, Multi-Input Scale, Correct Allocation Quantities, Zero-Scale Handling)

**Files:** `industryTick.worker.ts`, test `industryTick.worker.test.ts`

**Key Architecture:**
- **SIMULTANEOUS proportional allocation** from pool SNAPSHOT (not sequential)
- **Partial supply readiness**: sector can execute if ANY non-cumulative input available > 0
- **Multi-input scale**: `flowScale = min(electricityAvail/electricityReq, waterAvail/waterReq, 1)` — applies to ALL non-cumulative inputs; existing production logic does NOT double-scale
- **Allocation quantities**: sector receives `allocated_i = flowScale * required_i`; remaining flow stays in pool for other consumers
- **Zero-scale handling**: if `flowScale > 0`, execute with scaled allocations; if `flowScale = 0`, do not execute production; return zero-production result with zero flow consumption; do not repeatedly select that sector in readiness loop
- **SCC cycle detection** (Tarjan's) for cycles only; blocked vs cyclic distinction
- **SINGLE execution path**: `executeSingleSector` uses EXISTING production logic; NO sector executes twice
- **Flow pool**: shared decrementing pool, decremented by ACTUAL allocations from snapshot

**Algorithm:**
1. Filter non-cumulative goods from all warehouse pools (`goodsForSectors[good] = 0`)
2. Build sector nodes with cumulative inputs, ideal non-cumulative demand (at actualScale)
3. Build dependency graph (iterate KEYS for self-loop detection)
4. Tarjan's SCC to identify cyclic SCCs (size > 1 or self-loop on keys)
5. Kahn's algorithm on SCC DAG for execution order
6. Mark cyclic SCCs (execute with zero non-cumulative) and blocked downstream sectors
7. **Readiness loop**: find executable sectors (cumulative inputs + any flow available > 0)
8. **SIMULTANEOUS allocation from pool SNAPSHOT**: proportional across ALL eligible consumers, decrement pool by actual allocated
9. **Multi-input scale**: `flowScale = min(avail_i / req_i)` for all non-cumulative inputs; cap at 1; existing production logic uses this scale WITHOUT additional scaling
9. **Zero-scale handling**: if `flowScale > 0`, execute with scaled allocations; if `flowScale = 0`, do not execute production; return zero-production result with zero flow consumption; do not repeatedly select that sector in readiness loop
9. Execute sectors with allocated inputs using `executeSingleSector` (EXISTING production logic)
10. Add realized non-cumulative outputs to flow pool
11. Cyclic SCCs: execute with zero non-cumulative inputs
12. Blocked downstream: execute with zero non-cumulative inputs
11. **SINGLE execution path**: `executeSingleSector` results are FINAL; NO re-execution in `executeSectors`

**Self-loop fix:** Iterate `Object.keys(node.idealNonCumulativeDemand)` (keys, not values)

**Alternative producers:** Graph connects consumer to specific producers; SCC detection identifies genuine cycles (no alternative producer for required good).

**Allocation vs scale distinction:** Allocation = `allocated_i = flowScale * required_i`; remaining flow = `available_i - allocated_i` stays in pool for other consumers.

**Zero-scale handling:** if `flowScale > 0`, execute with scaled allocations; if `flowScale = 0`, do not execute production; return zero-production result with zero flow consumption; do not repeatedly select that sector in readiness loop.

**Tests:** Simultaneous allocation, partial supply (50 supply vs 80 demand), multi-input scale (50/80 electricity, 30/60 water), SCC cycle detection, blocked vs cyclic distinction, proportional allocation from snapshot, scale reduction with partial supply, allocation quantities consistent with scale, remaining flow in pool, zero-scale sectors don't execute or consume.

---

### Task 3: Gross Procurement + Refunds (EXPLICIT Inverse Ledger Arithmetic + Metadata)

**Files:** `industryTick.worker.ts:485-501, 1012-1049`, `transactionLedger.ts`, test

**Key Corrections:**
- **Refund orientation**: `buyer = originalSource` (credits), `seller = consumingSector` (debits)
- **EXPLICIT inverse ledger arithmetic**: `input_refund` transaction type has REVERSED delta semantics in `TransactionLedger.applyDeltas()`:
  - `buyer` (originalSource) → CREDITED (+amount)
  - `seller` (consumingSector) → DEBITED (-amount)
- **Refund metadata consistency**: `buyerWealthBefore/After` and `sellerWealthBefore/After` follow REVERSED semantics (buyer wealth increases, seller wealth decreases)
- Physical refunds applied ONCE via shared settlement
- Single shared `settleProvenance` for purchases, refunds, ledger, physical returns

**Implementation:**
```typescript
// GROSS purchases from purchaseProvenance (buyer=consumer, seller=source)
ledger.record({ type: "goods_purchase", buyerId: consumer, sellerId: "colony_treasury"|producer, ... });

// REFUNDS from refundedProvenance with INVERSE delta semantics
// In TransactionLedger.applyDeltas(): input_refund applies REVERSED deltas
// buyer (originalSource) → CREDITED (+amount)
// seller (consumingSector) → DEBITED (-amount)
ledger.record({ 
  type: "input_refund", 
  buyerId: "colony_treasury"|producer,  // originalSource
  sellerId: consumer, 
  ... 
});

// Physical refunds: route to original source using shared settlement
// Warehouse refunds → currentGoods; Producer refunds → producer inventory (via Task 1)
```

**Test:** Verify refund orientation: treasury/producer CREDITED (+amount), consumer DEBITED; physical returns match. Verify metadata: buyer wealth increases, seller wealth decreases.

---

### Task 4: Capital Purchases (Inspect processCapital First)

**Files:** `capitalSystem.ts`, `industryTick.worker.ts:853-876, 1127-1150`, test

**Key:** NO automatic treasury credit; INSPECT `processCapital` contract first

**Implementation:**
```typescript
// Extend return type:
CapitalProcessResult = { newCapitalStock, moneySpent, remainingGoods, purchasesBySector }

// INSPECT processCapital() contract FIRST:
// Does it mutate newMoney/newTreasury? Return deltas? 
// DO NOT add treasury credit without verification

// Record in ledger using ACTUAL moneySpent (NOT qty * price)
for (const [sector, amount] of Object.entries(moneySpent)) {
  ledger.record({ type: "capital_purchase", buyerId: sector, sellerId: "colony_treasury", amount });
}
// Physical audit in result.capitalPurchasesBySector (NOT ledger)
```

---

### Task 5: Household Clearing Account Verification

**Files:** `industryTick.worker.ts:1089-1125, 1178`, test

**Implementation:** Verify `household_sales` delta = 0 AND recorded spending/revenue match independent totals; complete population cash reconciliation (wages + subsidies + transfers - spending).

---

### Task 6: Centralized Scale-Aware Tolerances

**Files:** `industryTickHelpers.ts` (export `nearlyEqual`), test `industryTickHelpers.test.ts`

**Implementation:**
```typescript
export function nearlyEqual(actual, expected, absTol=1e-6, relTol=1e-9) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  if (!Number.isFinite(absTol) || absTol < 0) return false;
  if (!Number.isFinite(relTol) || relTol < 0) return false;
  const tol = Math.max(absTol, relTol * Math.max(1, Math.abs(actual), Math.abs(expected)));
  return Math.abs(actual - expected) <= tol;
}
```
**Apply ONLY to aggregate reconciliations** (spending/revenue, wage bill, household cash, validateTickResult household cash). Keep per-unit checks unchanged.

**Test fix:** `nearlyEqual(-100, -100.00000001) = true`, `nearlyEqual(-100, -100.001) = false`.

---

### Task 7: Explicit Financial Validation

**Files:** `industryTick.worker.ts:1479-1598`, test

**Key:** Separate refund fields (`RefundQuantitiesBySector`, `RefundAmountsBySector`); bidirectional cross-field reconciliation; malformed structure handling; validate `purchased = consumed + refunded` per sector/good.

---

### Task 8: Atomic TransactionLedger (NONNEGATIVE Balances Per-Transaction, FULLY SPECIFIED Arithmetic & Types)

**Files:** `transactionLedger.ts`, test `transactionLedger.test.ts`

**Key Corrections:**
- **Subsidy orientation**: treasury pays sector → `buyer="colony_treasury", seller="sector"`
- **NONNEGATIVE balance invariant PER-TRANSACTION**: all accounts must close >= 0; reject transaction that would make any account negative; adjust test opening balances to ensure nonnegative closing
- **PER-TRANSACTION validation**: calculate temporary deltas → calculate resulting balances → reject non-finite or negative resulting balances → only then commit
- **FULLY SPECIFIED test arithmetic** with opening balances and every transaction:
  ```
  Opening: sectorA=1000, treasury=600, sectorB=0, population:worker=300, household_sales=0
  
  1. goods_purchase: sectorA pays sectorB 50
  2. treasury_subsidy: treasury pays sectorA 50
  3. capital_purchase: sectorA pays treasury 100
  4. wage_payment: sectorA pays population:worker 200
  5. population_spending: population:worker pays household_sales 50
  6. population_spending: household_sales pays sectorA 30
  
  Expected closing (all >= 0):
  - sectorA: 1000 - 50 + 50 - 100 - 200 + 30 = 730
  - sectorB: 0 + 50 = 50
  - treasury: 600 - 50 + 100 = 650
  - population:worker: 300 - 50 + 200 = 450
  - household_sales: 0 + 50 - 30 = 20
  ```
- **GENUINE overflow**: build balance near `Number.MAX_VALUE` then overflow
- **Preserve ALL existing types** from actual implementation
- **Pre-mutation validation**: temp deltas → validate finite + final accumulated finite → apply atomically
- **Metadata validation**: buyer/seller wealth before/after must match transaction delta (REVERSED for `input_refund`)
- **Self-transfers**: zero net delta
- **getAccountDeltas()** returns copy (`new Map(this.accountDeltas)`)
- **input_refund** has REVERSED delta semantics (buyer=source CREDITED, seller=consumer DEBITED) with matching metadata
- **Two separate test scenarios**:
  - TransactionLedger arithmetic test: can contain nonzero clearing-account balance (but all balances >= 0)
  - Complete household clearing test: must finish at zero with nonnegative balances

---

### Task 9: Integration & Full Verification

**Steps:** Run full test suite (818+ tests), typecheck (`pnpm build`), lint (`pnpm lint`), e2e if available.

---

## Final Implementation Order

| Order | Task | Gate |
|-------|------|------|
| 0 | Provenance settlement | Full structural validation; reverse check (positive=throw, zero=allowed, negative=throw, missing consumedGoods=empty, unknown producer=throw); malformed input; finite aggregates; scale-aware physical tolerance; zero-purchase+positive-consumption throws |
| 1 | Source-aware household stock | CORRECT equations (`W_open - W_gross + W_ref`); deep clone producers at ALL levels; WAREHOUSE-FIRST procurement; per-source inventories explicit; producer identity preserved |
| 2 | Non-cumulative flow | SIMULTANEOUS proportional from SNAPSHOT; partial supply; multi-input scale (min ratio); SCC cycles; blocked vs cyclic; single execution path; scale reduction; allocation = flowScale * required; zero-scale = zero output, don't reselect |
| 3 | Gross procurement + refunds | EXPLICIT inverse ledger arithmetic for input_refund; refund metadata consistent with reversed semantics; physical returns ONCE via shared settlement |
| 4 | Capital monetary + physical | INSPECT processCapital; NO double credit; physical audit in result |
| 5 | Household clearing | Zero delta + independent totals + COMPLETE population cash |
| 6 | Scale-aware tolerances | Aggregate only; corrected negative test; scale-aware physical tolerance in Task 0 |
| 7 | Explicit validation | Separate refund fields; bidirectional cross-field reconciliation; malformed handling |
| 8 | Atomic ledger | NONNEGATIVE balances PER-TRANSACTION; FULLY SPECIFIED arithmetic; all types; correct subsidy; GENUINE overflow; metadata; inverse input_refund; metadata consistent with reversed semantics |
| 9 | Integration verification | All accounts; exclude derived householdMoney |

**Recommendation:** **Native** execution (highly sequential, shared files, context continuity critical).

**Start with Task 0:** Implement `provenanceSettlement.ts` and its tests, run tests, commit.