# Phase 1 — Industry Simulation State Audit

Generated from source review of `industryTick.worker.ts`, `buildSectorBid.ts`, `sectorExecution.ts`, `industryTickHelpers.ts`, `wageSystem.ts`, `capitalSystem.ts`, `Goods.ts`, `Population.ts`.

## 1. State Variables — Units and Ownership

### Colony-Level State (persisted across ticks via `SimState` / `IndustryTickResult`)

| Variable | Type | Units | Owner | Source File |
|---|---|---|---|---|
| `priceMemory` | `Partial<Record<Good, number>>` | currency units per good | Colony | `industryTick.worker.ts:24` |
| `wageMemory` | `Partial<Record<Population, number>>` | currency units per worker | Colony | `industryTick.worker.ts:25` |
| `lastResults` | `Map<entityId, IndustryTickResult>` | full tick snapshot | Worker (global) | `industryTick.worker.ts:23` |
| `colonyPriceMemory` | `Map<entityId, Partial<Record<Good, number>>>` | currency per good | Worker (global) | `industryTick.worker.ts:24` |
| `colonyWageMemory` | `Map<entityId, Partial<Record<Population, number>>>` | currency per worker | Worker (global) | `industryTick.worker.ts:25` |

### Per-Tick Input State (`IndustryTickInput`)

| Variable | Type | Units | Notes |
|---|---|---|---|
| `entityId` | string | colony identifier | |
| `activeSectors` | `Set<IndustrialSectors>` | set of sector names | which sectors are allowed to operate |
| `goods` | `Goods` | quantity of each good | colony stock at start of tick |
| `population` | `Population` | per-type breakdown | number, wealth, qol, expectedQol, birthRate |
| `techMultipliers` | `Record<Sector, number>` | dimensionless multiplier | sector technology level |
| `laborAssigned` | `Record<Sector, number>` | worker count | pre-assigned labor per sector |
| `capitalStock` | `Record<Sector, Partial<Good>>` | capital good quantity | machinery, buildings, etc. per sector |
| `money` | `Record<Sector, number>` | currency | sector operating budget |
| `settlementType` | `SettlementType` | enum | colony type |
| `allowedSectors` | `Sector[] \| undefined` | sector list | additional restriction for outposts/refineries |
| `workerEfficiencyMultipliers` | `Record<Population, number>` | dimensionless | labor productivity modifier |
| `materialRequirementMultipliers` | `Record<Good, number>` | dimensionless | input cost modifier |
| `capitalMultipliers` | `Record<Sector, number>` | dimensionless | capital productivity modifier |
| `selectedMethod` | `Record<Sector, string \| null>` | method name | production method override |
| `colonyTreasury` | number | currency | colony-level treasury (input only, not used in worker) |
| `sectorInvestment` | `Record<Sector, number>` | currency | investment budget per sector |
| `activeLaws` | `Set<string>` | law IDs | gameplay laws |

### Per-Tick Output State (`IndustryTickResult`)

| Variable | Type | Units | Notes |
|---|---|---|---|
| `goodsRequirements` | `Partial<Goods>` | quantity | total demand (sector + population + capital replenishment) |
| `goodsProduction` | `Partial<Goods>` | quantity | total production output |
| `workingWorkers` | `Population` | worker count | workers employed this tick |
| `freeWorkers` | `Population` | worker count | workers remaining after allocation |
| `populationUpdates` | `Record<Population, {qol, expectedQol, populationChange, wealth, number, requirements}>` | per-type | demographic updates |
| `goods` | `Goods` | quantity | colony stock at end of tick |
| `sectorProfits` | `Record<string, number>` | currency | revenue - inputCosts - laborCosts |
| `sectorRevenue` | `Record<string, number>` | currency | sales revenue |
| `sectorLaborCosts` | `Record<string, number>` | currency | wages paid |
| `sectorInputCosts` | `Record<string, number>` | currency | goods purchased |
| `populationProfits` | `Record<string, number>` | currency | income - expenses |
| `sectorUtilization` | `Record<string, number>` | 0..1 | actualScale per sector |
| `sectorStopReason` | `Record<string, string>` | text | why a sector stopped |
| `wages` | `Record<Population, number>` | currency per worker | adjusted salaries used this tick |
| `sectorResults` | `Record<string, SectorResult>` | detailed | consumed/produced goods, workers employed |
| `capitalStock` | `Record<string, Partial<Good>>` | quantity | updated capital after wear/decay/replenishment/investment |
| `money` | `Record<string, number>` | currency | updated sector money pools |

## 2. Wealth Semantics (P1.2)

**Population wealth is per-capita**, stored in `PopulationBreakdown.wealth`.

- `WEALTH_DRAWDOWN_RATE = 0.01` (1% of wealth available per day) — `Population.ts:20`
- Budget per person: `salary + wealth * 0.01` — `Population.ts:139`
- Wealth update: `wealth + (targetWealth - wealth) * 0.5` — `industryTickHelpers.ts:63` (damping 0.5)
- `targetWealth = wealth + income - expenses` — `industryTickHelpers.ts:62`
- `wealth = Math.max(0, smoothedWealth)` — floored at 0

**Sector money is an accumulated operating budget** (not pure profit):
- Starts from `startingMoney[name]` (input)
- Each iteration: `roundMoney[name] = newMoney[name] ?? startingMoney[name]` — carried forward
- After execution: `newMoney[name] += revenue - laborCosts` — `industryTick.worker.ts:300`
- After population spending: `distributePopulationSpending` adds revenue — `industryTick.worker.ts:303`
- After capital: `newMoney[name] -= moneySpent[name]` — `industryTick.worker.ts:322`
- Can go negative (no explicit floor check in worker; validation checks `< -1_000_000`)

## 3. Tick Execution Order (P1.3)

The tick lifecycle in `industryTick.worker.ts:processIndustry`:

1. **Price computation**: `getPrices(goods, priceMemory)` — reads colony goods stock, updates price memory
2. **Wage computation**: `buildAdjustedSalaries(wageMemory)` — reads wage memory
3. **Population consumption**: `computePopulationConsumption(population, adjustedSalaries, prices)` — computes QoL, requirements, wealth, population change
4. **Industry behavior tree**: `createIndustryTree(blackboard).tick(blackboard)` — sets emergency stops, shutdowns, investment priorities
5. **Iterative market clearing** (up to `MAX_ITERATIONS = 3` rounds):
   a. Carry forward sector money from previous round
   b. Sector behavior trees: `createSectorTree(blackboard).tick(blackboard)` — sets stopProduction, laborAssigned, sectorInvestment
   c. `buildSectorBid(...)` — computes idealWorkerDemand, idealGoodsDemand, idealGoodsProduction, budgetRatio, outputLevel
   d. `calculateMarketRatios(bids, population)` — workerMarketRatios = min(1, available / totalDemand)
   e. `updateWageMemory(wageMemory, workerMarketRatios)` — **MUTATES persistent wage memory during iteration**
   f. `computeActualScale(bid, workerMarketRatios)` — actualScale = min(budgetRatio, workerRatio)
   g. `buySectorInputs(bids, currentGoods, roundMoney, currentPrices)` — **MUTATES currentGoods (depletes inventory)**
   h. `executeSectors(bids, ...)` — computes production, consumption, revenue, costs, profits
   i. `getPrices(currentGoods, memory)` — **recomputes prices from remaining goods; mutates price memory**
   j. Convergence check: if goods barely changed, break
6. **Money settlement**: `newMoney[name] += revenue - laborCosts` — `industryTick.worker.ts:300`
7. **Population spending**: `distributePopulationSpending(...)` — adds sector revenue from population purchases — `industryTick.worker.ts:303`
8. **Capital processing**: `processCapital(...)` — wear, decay, replenishment, investment — `industryTick.worker.ts:312`
9. **Capital cost deduction**: `newMoney[name] -= moneySpent[name]` — `industryTick.worker.ts:322`
10. **Goods delta**: `computeColonyGoodsDelta(...)` — bought + produced + replenishment — `industryTick.worker.ts:325`
11. **Finalize goods**: `finalizeGoods(...)` — apply production, requirements, consumption, waste — `industryTick.worker.ts:345`
12. **Build patch**: `buildPatch(last, result)` — shallow diff for network sync

## 4. Money Flow Diagram (P1.4)

```
Starting sector money (input)
    │
    ├─► [Iteration loop] Sector buys input goods ──► sectorMoney -= toBuy * price
    │                                                    colonyGoods -= toBuy
    │
    ├─► executeSectors:
    │      revenue   = producedGoods * prices
    │      laborCosts = employedWorkers * wages
    │      inputCosts = consumedGoods * prices
    │      profit    = revenue - inputCosts - laborCosts
    │
    ├─► newMoney[name] += revenue - laborCosts      (worker.ts:300)
    │
    ├─► distributePopulationSpending:
    │      populationSpending = consumption * prices
    │      sectorRevenueShare = spending * (sectorProduction / totalProduction)
    │      newMoney[name] += sectorRevenueShare       (worker.ts:303)
    │
    ├─► processCapital:
    │      moneySpent = wear + decay + replenishment + investment
    │      newMoney[name] -= moneySpent[name]         (worker.ts:322)
    │
    ▼
Ending sector money (output)
```

**Population money flow:**
```
wages paid to workers (laborCosts) ──► population income
wealth drawdown (1% per day)         ──► population budget
consumption = requirements * prices  ──► population expenses
targetWealth = wealth + income - expenses
smoothedWealth = wealth + 0.5 * (targetWealth - wealth)
```

**Money conservation issue**: Population spending (`distributePopulationSpending`) adds revenue to sectors but does NOT reduce population wealth. The wealth reduction happens via `expenses` in `computePopulationConsumption`, but the `targetWealth` calculation already subtracts expenses, so wealth is reduced there. However, the sector revenue from population spending is calculated from `populationSpending` (which is `consumption * prices`), and this same money is also subtracted from population wealth via expenses. This appears to be a circular flow where money goes population → sector → population (via wages), but the accounting is not explicitly paired as transactions.

## 5. Goods Flow Diagram (P1.5)

```
Starting colony goods (input)
    │
    ├─► [Iteration loop] buySectorInputs:
    │      sectorDemand = idealGoodsDemand * actualScale
    │      toBuy = min(demand, available, floor(money/price))
    │      colonyGoods -= toBuy
    │      sectorMoney -= toBuy * price
    │
    ├─► executeSectors:
    │      consumedGoods = idealGoodsDemand * actualScale   (already bought above)
    │      producedGoods = idealGoodsProduction * actualScale
    │
    ├─► computeColonyGoodsDelta:
    │      bought = goodsBefore - goodsAfter (negative = removed)
    │      delta = -bought + produced + replenishmentDelta
    │
    ├─► finalizeGoods:
    │      goods += production - requirements - populationConsumption
    │      waste = max(0, waste + 0.05*pop - 0.05*waste)
    │
    ▼
Ending colony goods (output)
```

**Non-cumulating goods** (`NON_CUMULATING_GOODS`): services, faith, lawEnforcement, healthcare, education, governance, environmentFactor, defense, entertainment, logistics, monetaryServices, tourism, energy — replaced with `max(0, production - requirements)` rather than accumulated.

## 6. Persistent Mutations Inside Iteration (P1.6)

The following persistent state is mutated **during** the iterative market-clearing loop (not just at commit):

| Mutation | Location | Effect |
|---|---|---|
| `wageMemory[wt] = dampedWage` | `industryTick.worker.ts:218-219` (`updateWageMemory`) | Wages adjusted every iteration based on candidate round's worker ratios |
| `priceMemory[key] = clampedPrice` | `industryTick.worker.ts:246` (`getPrices` called after each round) | Prices updated every iteration from remaining goods |
| `colonyWageMemory.set(entityId, wageMemory)` | `industryTick.worker.ts:219` | Persisted to global map every iteration |
| `currentGoods` (local copy) | `industryTick.worker.ts:233` | Depleted each round; carries forward |
| `currentPrices` (local) | `industryTick.worker.ts:246` | Recomputed each round |

**Consequence**: Candidate rounds that are discarded (non-final iterations) still permanently alter wage and price memory. This violates the principle that only the final result should be committed.

## 7. Known Invariants (to be enforced)

- `goods[g] >= 0` for all cumulative goods (enforced by `Math.max(0, ...)` in `finalizeGoods`)
- `goods[g] >= 0` for non-cumulating goods (enforced in `finalizeGoods`)
- `waste >= 0` (enforced)
- `population[number] >= 0` (enforced via `Math.max(0, ...)`)
- `population[wealth] >= 0` (enforced via `Math.max(0, ...)`)
- `capitalStock[g] >= 0` (not explicitly enforced; capital system may drive negative)
- `money[sector]` can go negative (validation threshold: -1,000,000)
- `budgetRatio <= 1` (enforced via `min(1, ...)`)
- `capitalRatio` is uncapped (can exceed 1.0 — AGENTS.md)
- `actualScale = min(budgetRatio, workerRatio)` (goods constraint commented out)
- Price bounds: `[0.1 * base, 10 * base]`
- Wage bounds: `[0.5 * base, 2.0 * base]`
- QoL bounds: `[0, 80]`

## 8. Non-Determinism Sources

- `Map` iteration order for `industrySectorBlueprints` (insertion-ordered in modern JS, but not guaranteed across environments)
- `Object.keys()` order (insertion-ordered for string keys in modern JS)
- Floating-point arithmetic (no epsilon handling for convergence)
- `Math.floor(sectorMoney / price)` in `buySectorInputs` — discrete goods purchasing
