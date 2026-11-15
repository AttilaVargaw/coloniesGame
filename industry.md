# Industry Simulation — Non-Linear Model

The industry simulation is a **discrete-time, non-linear, coupled economic system** running in a Web Worker (`src/game/workers/industryTick.worker.ts`). It is indexed by tick `t`, colony `e`, sector `s`, good `g`, and population type `p`.

All `clamp`, `min`, `max`, and `Math.max(0, ·)` operations are the sources of non-linearity. `capitalRatio` is explicitly **uncapped** (AGENTS.md), so surplus capital scales output above 1×.

---

## 1. State (per colony / per sector)

- `G[e,g,t]` — colony good stock
- `K[e,s,g,t]` — capital stock per sector
- `M[e,s,t]` — sector money pool
- `W[e,p,t]` — wage memory (damped)
- `P[e,g,t]` — price memory (damped)
- `Pop[e,p,t] = {number, wealth, qol, expectedQol, birthRate}`

---

## 2. Prices (damped toward scarcity target)

```
baseline_g  = max(basePrice_g * 10, 1)
adj_g       = baseline_g / G[e,g,t]            if G > 0, else 10
adj_g       = clamp(adj_g, 0.1, 10)
target_g    = basePrice_g * adj_g
P[e,g,t+1]  = clamp(P[e,g,t] + 0.3*(target_g - P[e,g,t]),
                    0.1*base_g, 10*base_g)
```

Scarcity (`G → 0`) raises price toward `10× base`; surplus lowers it toward `0.1× base`. Damping factor `0.3`, clamped to `[0.1, 10] × base`.

Source: `src/game/data/Goods.ts:168` (`getPrices`)

---

## 3. Wages (damped toward market-clearing target)

```
workerMarketRatio_p = min(1, available_p / Σ_s idealWorkerDemand[s,p,t])
mult_p              = clamp(1/ratio_p, 0.5, 2.0)   if ratio > 0 else 2.0
targetWage_p        = baseSalary_p * mult_p
W[e,p,t+1]          = W[e,p,t] + 0.3*(targetWage_p - W[e,p,t])
```

Wage multiplier clamped to `[0.5, 2.0]`, damping `0.3`.

Source: `src/game/workers/wageSystem.ts:17` (`updateWageMemory`)

---

## 4. Population consumption & QoL

```
budget_p     = W[e,p,t] + wealth_p * WEALTH_DRAWDOWN_RATE
qol_p        = highest QOL level affordable at budget_p   (linear interp between levels)
qol̃_p        = clamp(qol_p(t) + (qol_p - qol_p(t))*0.03, 0, 80)
req_g(p)     = interpolated cumulative good requirement at qol̃_p * number_p
consumption_g += req_g(p)
             + extra (student→education: 1, retired→healthcare: 2) * number_p

income_p     = W[e,p,t] * number_p
expenses_p   = Σ_g req_g(p) * P_g
targetWealth = wealth_p + income_p - expenses_p
wealth_p(t+1)= max(0, wealth_p + 0.5*(targetWealth - wealth_p))

popChange    = clamp(populationGrowth(expectedQol) * number/365 * birthRate,
                     -0.001*number, 0.001*number)
number_p(t+1)= max(0, number_p + popChange)
```

QoL smoothed with factor `0.03`, wealth with `0.5`, population change clamped to `±0.001 × number` per day.

Source: `src/game/workers/industryTickHelpers.ts:20` (`computePopulationConsumption`)

---

## 5. Sector bid (`buildSectorBid`)

Capital ratio (uncapped — can exceed 1):

```
capitalRatio_s = min_{g∈capitalGoods_s} ( K[e,s,g,t] / required_g )   [=1 if no capital goods]
```

Costs at `inputLevel = 1` (0 if stopped):

```
adjWorkerReq_p  = workerReq_p / (workerEffMult_p * methodWorkerMult)
adjGoodsReq_g   = goodsReq_g * (materialMult_g * methodMaterialMult)
costPerUnit_s   = Σ_g adjGoodsReq_g * P_g + Σ_p adjWorkerReq_p * W_p
budgetRatio_s   = min(1, (M[e,s,t] + investment) / costPerUnit_s)
outputLevel_s   = techMult_s * effMult_s          (0 if stopped)
```

Demands:

```
idealWorkerDemand_p    = adjWorkerReq_p * inputLevel * capitalRatio_s
idealGoodsDemand_g     = adjGoodsReq_g   * inputLevel * capitalRatio_s
idealGoodsProduction_g = goodsProduction_g * outputLevel_s
```

Source: `src/game/workers/buildSectorBid.ts:89`

---

## 6. Market ratios & actual scale

```
workerRatio_p = min(1, available_p / Σ_s idealWorkerDemand[s,p])
actualScale_s = min(budgetRatio_s, workerRatio_s)      [goods constraint currently commented out]
```

Source: `src/game/workers/industryTick.worker.ts:381` (`calculateMarketRatios`), `:407` (`computeActualScale`)

---

## 7. Sector execution (at `actualScale`)

```
employed_p    = min(idealWorkerDemand_p * actualScale, remainingWorkers_p)
consumed_g    = idealGoodsDemand_g   * actualScale
produced_g    = idealGoodsProduction_g * actualScale
revenue_s     = Σ_g produced_g * P_g
inputCosts_s  = Σ_g consumed_g * P_g
laborCosts_s  = Σ_p employed_p * W_p
profit_s      = revenue_s - inputCosts_s - laborCosts_s
utilization_s = actualScale
```

Source: `src/game/workers/sectorExecution.ts:40` (`executeSectors`)

---

## 8. Capital (`processCapital`)

Per sector, each tick:

```
if productionRatio > 0:   wear  capital goods   (ApplyWear)
if decay > 0:             decay capital goods   (ApplyDecay)
if losses && canAfford:   replenish losses      (buy capital goods → replenishmentDelta_g < 0)
for each capital good g:
    if belowTargetStock(g) && canAfford: invest g   (investAmounts_g < 0)

K[e,s,g,t+1] = K[e,s,g,t] - wear - decay + replenish + invest
M[e,s]      -= moneySpent_s
```

Source: `src/game/workers/capitalSystem.ts:23` (`processCapital`)

---

## 9. Colony goods balance (`finalizeGoods`)

```
Δ_g = -bought_g + Σ_s produced_g + replenishmentDelta_g   (replenishmentDelta ≤ 0)
G[e,g,t+1] = max(0, G[e,g,t] + production - requirements - populationConsumption)
waste[t+1] = max(0, waste[t] + 0.05*totalPop - 0.05*waste[t])
```

Source: `src/game/workers/industryTick.worker.ts:432` (`finalizeGoods`)

---

## 10. Money flow

```
M[e,s] += revenue_s - laborCosts_s        (input costs deducted at purchase)
M[e,s] -= moneySpent_s                     (capital)
M[e,s] += Σ_g (producedShare[s,g] * consumption_g * P_g)   (population spending by production share)
```

Source: `src/game/workers/industryTick.worker.ts:296` and `:303` (`distributePopulationSpending`)

---

## 11. Iteration (per tick)

The bid → buy → execute loop runs up to `MAX_ITERATIONS = 3` rounds. Prices are recomputed from remaining colony goods each round (`P = getPrices(currentGoods)`), and it stops early when goods change by less than `CONVERGENCE_THRESHOLD = 0.005` of total scale.

Source: `src/game/workers/industryTick.worker.ts:122`

---

## Why non-linear

| Source | Location | Effect |
|--------|----------|--------|
| `budgetRatio = min(1, ·)` | `buildSectorBid.ts:135` | hard output cap at 1× |
| `actualScale = min(budgetRatio, workerRatio)` | `sectorExecution.ts:429` | min-kink |
| `capitalRatio = min(stock/required)` uncapped | `buildSectorBid.ts:149` | multiplicative gain > 1× possible |
| `P ∝ 1/stock` (clamped) | `Goods.ts:178` | hyperbola / scarcity singularity |
| Wage `mult = clamp(1/ratio, 0.5, 2)` | `wageSystem.ts:30` | kinked inverse |
| Goods floors `max(0, ·)` | `finalizeGoods.ts:442` | ReLU |
| `waste = max(0, waste + prod - decay)` | `finalizeGoods.ts:448` | ReLU |
| Behavior-tree stop/shutdown decisions | `industryTick.worker.ts:152` | regime switches |
| Damped memory (wages, prices) | `wageSystem.ts`, `Goods.ts` | history-dependence |
| Iterative price discovery | `industryTick.worker.ts:132` | prices depend on prior-round outcomes |

Output is not a linear function of inputs; sectors couple through shared goods and labor markets, and capital stock feeds back into next tick's `capitalRatio`. It is a bounded, discrete-event, feedback-driven dynamical system.
