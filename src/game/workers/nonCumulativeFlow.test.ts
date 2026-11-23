import { describe, it, expect } from "vitest";
import { executeNonCumulativeFlow } from "./nonCumulativeFlow";
import { SectorBid } from "./SectorBid";
import { Goods, basePrices } from "../data/Goods";
import { Population } from "../data/Population";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";

function createMockPopulation(): Population {
	const pop: Population = {
		farmer: { number: 100, wealth: 1000, wealthLevel: 1, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0 },
		scientist: { number: 50, wealth: 2000, wealthLevel: 2, qol: 60, expectedQol: 60, populationChange: 0, mortality: 0, salary: 1000, birthRate: 0 },
		worker: { number: 200, wealth: 500, wealthLevel: 1, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 200, birthRate: 0 },
		student: { number: 80, wealth: 0, wealthLevel: 0, qol: 30, expectedQol: 30, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
		healtcarePersonal: { number: 20, wealth: 1500, wealthLevel: 2, qol: 55, expectedQol: 55, populationChange: 0, mortality: 0, salary: 500, birthRate: 0 },
		policeMen: { number: 15, wealth: 800, wealthLevel: 1, qol: 45, expectedQol: 45, populationChange: 0, mortality: 0, salary: 200, birthRate: 0 },
		teacher: { number: 10, wealth: 600, wealthLevel: 1, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0 },
		serviceWorker: { number: 30, wealth: 400, wealthLevel: 1, qol: 35, expectedQol: 35, populationChange: 0, mortality: 0, salary: 200, birthRate: 0 },
		clergy: { number: 5, wealth: 300, wealthLevel: 1, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 200, birthRate: 0 },
		retired: { number: 40, wealth: 5000, wealthLevel: 3, qol: 60, expectedQol: 60, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
		clerks: { number: 25, wealth: 800, wealthLevel: 1, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0 },
		engineer: { number: 20, wealth: 2000, wealthLevel: 2, qol: 55, expectedQol: 55, populationChange: 0, mortality: 0, salary: 500, birthRate: 0 },
		stayAtHome: { number: 30, wealth: 200, wealthLevel: 1, qol: 30, expectedQol: 30, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
		serviceMan: { number: 10, wealth: 1000, wealthLevel: 1, qol: 45, expectedQol: 45, populationChange: 0, mortality: 0, salary: 200, birthRate: 0 },
	};
	return pop;
}

function createMockBid(name: string, overrides: Partial<SectorBid> = {}): SectorBid {
	const base: SectorBid = {
		name,
		level: 1,
		idealGoodsDemand: {},
		idealGoodsProduction: {},
		idealWorkerDemand: {},
		actualScale: 1,
		budgetRatio: 1,
		inputLevel: 1,
		outputLevel: 1,
		capitalMultiplier: 1,
		inputCost: 0,
		laborCost: 0,
		nonEssentialGoods: new Set<keyof Goods>(),
	};
	return { ...base, ...overrides };
}

function createMockGoods(overrides: Partial<Goods> = {}): Goods {
	return { ...createEmptyWarehouse(), ...overrides };
}

function createMockPrices(overrides: Partial<Record<keyof Goods, number>> = {}): Record<keyof Goods, number> {
	return { ...basePrices, ...overrides };
}

function createMockSalaries(): Record<keyof Population, number> {
	return {
		farmer: 200,
		scientist: 1000,
		worker: 200,
		student: 180,
		healtcarePersonal: 500,
		policeMen: 200,
		teacher: 200,
		serviceWorker: 200,
		clergy: 200,
		retired: 180,
		clerks: 500,
		engineer: 500,
		stayAtHome: 180,
		serviceMan: 200,
	};
}

describe("executeNonCumulativeFlow", () => {
	const population = createMockPopulation();
	const availableWorkers = {} as Record<keyof Population, number>;
	for (const key of Object.keys(population) as (keyof Population)[]) {
		availableWorkers[key] = key === "stayAtHome" ? 0 : population[key].number;
	}
	const salaries = createMockSalaries();
	const prices = createMockPrices();

	// Use actual non-cumulative goods from the game
	const ENERGY = "energy" as keyof Goods;
	const SERVICES = "services" as keyof Goods;
	const HEALTHCARE = "healthcare" as keyof Goods;
	const EDUCATION = "education" as keyof Goods;
	const LOGISTICS = "logistics" as keyof Goods;

	describe("reversed dependency order", () => {
		it("executes producers before consumers regardless of input order", () => {
			// Consumer needs energy from Producer
			const bids = [
				createMockBid("Consumer", {
					idealGoodsDemand: { [ENERGY]: 10 },
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 10 },
				}),
				createMockBid("Producer", {
					idealGoodsDemand: {},
					idealGoodsProduction: { [ENERGY]: 10 },
					idealWorkerDemand: { worker: 5 },
				}),
			];

			const colonyGoods = createMockGoods({ [ENERGY]: 0, [SERVICES]: 0 });
			const laborAllocations = {
				Consumer: { worker: 10 },
				Producer: { worker: 5 },
			};

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			expect(result.executedSectors.has("Consumer")).toBe(true);
			expect(result.executedSectors.has("Producer")).toBe(true);

			// Producer should have produced energy
			const producerResult = result.sectorResults.Producer;
			expect(producerResult.producedGoods[ENERGY]).toBeGreaterThan(0);
			
			// Consumer should have consumed energy
			const consumerResult = result.sectorResults.Consumer;
			expect(consumerResult.consumedGoods[ENERGY]).toBeGreaterThan(0);
		});

		it("handles reversed input order correctly", () => {
			const bids = [
				createMockBid("Consumer", {
					idealGoodsDemand: { [ENERGY]: 10 },
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 10 },
				}),
				createMockBid("Producer", {
					idealGoodsDemand: {},
					idealGoodsProduction: { [ENERGY]: 10 },
					idealWorkerDemand: { worker: 5 },
				}),
			];

			// Reverse the order
			const reversedBids = [...bids].reverse();
			const colonyGoods = createMockGoods({ [ENERGY]: 0, [SERVICES]: 0 });
			const laborAllocations = {
				Consumer: { worker: 10 },
				Producer: { worker: 5 },
			};

			const result = executeNonCumulativeFlow(reversedBids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			expect(result.executedSectors.has("Consumer")).toBe(true);
			expect(result.executedSectors.has("Producer")).toBe(true);
		});
	});

	describe("partial flow availability", () => {
		it("scales a single sector when non-cumulative inputs are limited", () => {
			// Single sector with limited energy
			const bids = [
				createMockBid("Factory", {
					idealGoodsDemand: { [ENERGY]: 10 },
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 10 },
				}),
			];

			// Only 5 energy available (need 10 for full production)
			const colonyGoods = createMockGoods({ [ENERGY]: 5, [SERVICES]: 0 });
			const laborAllocations = { Factory: { worker: 10 } };

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			const factoryResult = result.sectorResults.Factory;
			expect(factoryResult.productionRatio).toBeCloseTo(0.5); // half scale
			expect(factoryResult.consumedGoods[ENERGY]).toBe(5); // half consumption
			expect(factoryResult.producedGoods[SERVICES]).toBe(2.5); // 5 * 0.5
		});

		it("processes multiple consumers sequentially within a wave", () => {
			// Both factories need energy but produce nothing (so they don't replenish)
			// They execute sequentially - first gets available energy, second gets remainder
			const bids = [
				createMockBid("FactoryA", {
					idealGoodsDemand: { [ENERGY]: 10 },
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
				createMockBid("FactoryB", {
					idealGoodsDemand: { [ENERGY]: 10 },
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
			];

			// Only 10 energy available (need 20 total)
			const colonyGoods = createMockGoods({ [ENERGY]: 10, [SERVICES]: 0 });
			const laborAllocations = {
				FactoryA: { worker: 5 },
				FactoryB: { worker: 5 },
			};

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			// FactoryA executes first, consumes all 10 energy
			// FactoryB executes second, finds 0 energy remaining
			expect(result.sectorResults.FactoryA.productionRatio).toBe(1);
			expect(result.sectorResults.FactoryA.consumedGoods[ENERGY]).toBe(10);
			expect(result.sectorResults.FactoryB.productionRatio).toBe(0);
			// Zero-scale sectors have empty consumedGoods
			expect(result.sectorResults.FactoryB.consumedGoods[ENERGY]).toBeUndefined();
		});
	});

	describe("cumulative-input shortages", () => {
		it("limits production when cumulative inputs are insufficient", () => {
			const bids = [
				createMockBid("Factory", {
					idealGoodsDemand: { [ENERGY]: 5, [LOGISTICS]: 10 },
					idealGoodsProduction: { [SERVICES]: 8 },
					idealWorkerDemand: { worker: 10 },
				}),
			];

			// Full energy, but only half logistics
			const colonyGoods = createMockGoods({ [ENERGY]: 10, [LOGISTICS]: 5, [SERVICES]: 0 });
			const laborAllocations = { Factory: { worker: 10 } };
			const purchasedBySector = { Factory: { [LOGISTICS]: 5 } }; // only 5 logistics available for purchase

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, purchasedBySector, population, availableWorkers);

			// Should be limited by logistics (0.5 scale)
			expect(result.sectorResults.Factory.productionRatio).toBeCloseTo(0.5);
			expect(result.sectorResults.Factory.consumedGoods[LOGISTICS]).toBe(5);
			expect(result.sectorResults.Factory.consumedGoods[ENERGY]).toBe(2.5);
		});

		it("does not deduct flow goods when cumulative inputs block execution", () => {
			const bids = [
				createMockBid("Factory", {
					idealGoodsDemand: { [ENERGY]: 10, [LOGISTICS]: 10 },
					idealGoodsProduction: { [SERVICES]: 8 },
					idealWorkerDemand: { worker: 10 },
				}),
			];

			// No logistics available
			const colonyGoods = createMockGoods({ [ENERGY]: 20, [LOGISTICS]: 0, [SERVICES]: 0 });
			const laborAllocations = { Factory: { worker: 10 } };
			const purchasedBySector = { Factory: { [LOGISTICS]: 0 } };

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, purchasedBySector, population, availableWorkers);

			// Energy should NOT be consumed since finalScale = 0
			expect(result.sectorResults.Factory.productionRatio).toBe(0);
			// consumedGoods should be empty for zero-scale sectors
			expect(Object.keys(result.sectorResults.Factory.consumedGoods).length).toBe(0);
		});
	});

	describe("scaled bids", () => {
		it("applies actualScale to execution", () => {
			const bids = [
				createMockBid("Factory", {
					idealGoodsDemand: { [ENERGY]: 10 },
					idealGoodsProduction: { [SERVICES]: 8 },
					idealWorkerDemand: { worker: 10 },
					actualScale: 0.5, // Half capacity
				}),
			];

			const colonyGoods = createMockGoods({ [ENERGY]: 20, [SERVICES]: 0 });
			const laborAllocations = { Factory: { worker: 5 } }; // Only 5 workers allocated

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			// Should execute at 0.5 * 1.0 = 0.5 effective scale
			expect(result.sectorResults.Factory.productionRatio).toBeCloseTo(0.5);
			expect(result.sectorResults.Factory.consumedGoods[ENERGY]).toBe(5); // 10 * 0.5
			expect(result.sectorResults.Factory.producedGoods[SERVICES]).toBe(4); // 8 * 0.5
			const totalEmployed = Object.values(result.sectorResults.Factory.workersEmployed).reduce((a, b) => a + b, 0);
			expect(totalEmployed).toBe(5); // 10 * 0.5
		});

		it("combines actualScale with material constraints", () => {
			const bids = [
				createMockBid("Factory", {
					idealGoodsDemand: { [ENERGY]: 10 },
					idealGoodsProduction: { [SERVICES]: 8 },
					idealWorkerDemand: { worker: 10 },
					actualScale: 0.5,
				}),
			];

			// Only enough energy for 0.25 scale
			const colonyGoods = createMockGoods({ [ENERGY]: 2.5, [SERVICES]: 0 });
			const laborAllocations = { Factory: { worker: 5 } };

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			// effectiveScale = min(actualScale=0.5, flowScale=0.25) = 0.25
			expect(result.sectorResults.Factory.productionRatio).toBeCloseTo(0.25);
		});
	});

	describe("cyclic dependencies", () => {
		it("detects and blocks cyclic sectors", () => {
			// A produces energy, needs healthcare
			// B produces healthcare, needs energy
			const bids = [
				createMockBid("SectorA", {
					idealGoodsDemand: { [HEALTHCARE]: 5 },
					idealGoodsProduction: { [ENERGY]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
				createMockBid("SectorB", {
					idealGoodsDemand: { [ENERGY]: 5 },
					idealGoodsProduction: { [HEALTHCARE]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
			];

			const colonyGoods = createMockGoods({ [ENERGY]: 0, [HEALTHCARE]: 0 });
			const laborAllocations = { SectorA: { worker: 5 }, SectorB: { worker: 5 } };

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			// Both should be blocked (cyclic) and produce nothing
			expect(result.sectorResults.SectorA.productionRatio).toBe(0);
			expect(result.sectorResults.SectorB.productionRatio).toBe(0);
			// stopReason is in sectorStopReason, not sectorResults
			expect(result.sectorStopReason.SectorA).toBe("No materials");
			expect(result.sectorStopReason.SectorB).toBe("No materials");
		});

		it("propagates blocking to downstream sectors", () => {
			// A <-> B cycle, C needs A's output, D needs C's output
			const bids = [
				createMockBid("SectorA", {
					idealGoodsDemand: { [HEALTHCARE]: 5 },
					idealGoodsProduction: { [ENERGY]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
				createMockBid("SectorB", {
					idealGoodsDemand: { [ENERGY]: 5 },
					idealGoodsProduction: { [HEALTHCARE]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
				createMockBid("SectorC", {
					idealGoodsDemand: { [ENERGY]: 5 },
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
				createMockBid("SectorD", {
					idealGoodsDemand: { [SERVICES]: 5 },
					idealGoodsProduction: { [EDUCATION]: 5 },
					idealWorkerDemand: { worker: 5 },
				}),
			];

			const colonyGoods = createMockGoods({ [ENERGY]: 0, [HEALTHCARE]: 0, [SERVICES]: 0, [EDUCATION]: 0 });
			const laborAllocations = {
				SectorA: { worker: 5 },
				SectorB: { worker: 5 },
				SectorC: { worker: 5 },
				SectorD: { worker: 5 },
			};

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			// A and B blocked (cyclic), C blocked (depends on A), D blocked (depends on C)
			expect(result.sectorResults.SectorA.productionRatio).toBe(0);
			expect(result.sectorResults.SectorB.productionRatio).toBe(0);
			expect(result.sectorResults.SectorC.productionRatio).toBe(0);
			expect(result.sectorResults.SectorD.productionRatio).toBe(0);
		});
	});

	describe("labor participation", () => {
		it("excludes stayAtHome from available workers", () => {
			const bids = [
				createMockBid("Factory", {
					idealGoodsDemand: {},
					idealGoodsProduction: { [SERVICES]: 10 },
					idealWorkerDemand: { worker: 10 }, // Only worker, not stayAtHome
				}),
			];

			const colonyGoods = createMockGoods({ [SERVICES]: 0 });
			const laborAllocations = { Factory: { worker: 10 } };

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			// stayAtHome should not be in workersEmployed (not in availableWorkers)
			expect(result.sectorResults.Factory.workersEmployed.stayAtHome).toBeUndefined();
			expect(result.sectorResults.Factory.workersEmployed.worker).toBe(10);
		});

		it("tracks remaining workers correctly", () => {
			const bids = [
				createMockBid("FactoryA", {
					idealGoodsDemand: {},
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 50 },
				}),
				createMockBid("FactoryB", {
					idealGoodsDemand: {},
					idealGoodsProduction: { [SERVICES]: 5 },
					idealWorkerDemand: { worker: 50 },
				}),
			];

			const colonyGoods = createMockGoods({ [SERVICES]: 0 });
			const laborAllocations = { FactoryA: { worker: 50 }, FactoryB: { worker: 50 } };

			const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

			// 200 workers total, 100 employed
			const totalEmployed = Object.values(result.workingWorkers).reduce((sum, p) => sum + p.number, 0);
			expect(totalEmployed).toBe(100);

			// remainingWorkers initialized from availableWorkers for ALL categories
			// Total available = sum of population except stayAtHome = 605
			// 100 employed, so 505 remaining across all eligible categories
			const totalAvailable = Object.values(availableWorkers).reduce((sum, v) => sum + v, 0);
			const totalRemaining = Object.values(result.remainingWorkers).reduce((sum, p) => sum + p.number, 0);
			expect(totalRemaining).toBe(totalAvailable - totalEmployed);
		});
	});

	describe("executedSectors consistency", () => {
it("includes all processed sectors regardless of production", () => {
      const bids = [
        createMockBid("FactoryA", {
          idealGoodsDemand: { [ENERGY]: 10 },
          idealGoodsProduction: { [SERVICES]: 5 },
          idealWorkerDemand: { worker: 10 },
        }),
        createMockBid("FactoryB", {
          idealGoodsDemand: { [ENERGY]: 10 },
          idealGoodsProduction: { [SERVICES]: 5 },
          idealWorkerDemand: { worker: 10 },
        }),
      ];

      // Only enough energy for one factory
      const colonyGoods = createMockGoods({ [ENERGY]: 10, [SERVICES]: 0 });
      const laborAllocations = { FactoryA: { worker: 10 }, FactoryB: { worker: 10 } };

      const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

      // Both should be in executedSectors even though one produces nothing
      expect(result.executedSectors.has("FactoryA")).toBe(true);
      expect(result.executedSectors.has("FactoryB")).toBe(true);
      expect(result.executedSectors.size).toBe(2);
    });
  });

  describe("non-essential goods penalty", () => {
    it("skips non-essential goods from flowScale and applies penalty instead", () => {
      // Sector needs ENERGY (non-cumulative) and GOVERNANCE (non-essential)
      const bids = [
        createMockBid("OilRig", {
          idealGoodsDemand: { [ENERGY]: 10, governance: 20 as any, environmentFactor: 20 as any },
          idealGoodsProduction: { oil: 5000 },
          idealWorkerDemand: { worker: 10 },
          nonEssentialGoods: new Set(["governance", "environmentFactor"] as any),
        }),
      ];

      // All non-essential goods missing (governance, environmentFactor), but ENERGY available
      const colonyGoods = createMockGoods({ [ENERGY]: 10, governance: 0, environmentFactor: 0 });
      const laborAllocations = { OilRig: { worker: 10 } };

      const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

      // Should NOT be blocked by missing non-essential goods (flowScale skips them)
      // flowScale = 1 (ENERGY available), cumulativeRatio = 1 (no cumulative inputs)
      // Then penalty applies: 2 missing non-essential = 20% penalty
      // finalScale = 1.0 * 0.8 = 0.8
      expect(result.sectorResults.OilRig.productionRatio).toBeCloseTo(0.8, 1);
      expect(result.sectorStopReason.OilRig).toContain("Missing non-essential");
      expect(result.sectorStopReason.OilRig).toContain("-20%");
    });

    it("produces at 50% minimum when all non-essential goods missing (50% cap)", () => {
      const bids = [
        createMockBid("OilRig", {
          idealGoodsDemand: { 
            [ENERGY]: 10, 
            governance: 20 as any, 
            environmentFactor: 20 as any,
            energy: 10 as any,
            services: 5 as any,
            vehicles: 5 as any,
            water: 10 as any,
          },
          idealGoodsProduction: { oil: 5000 },
          idealWorkerDemand: { worker: 10 },
          nonEssentialGoods: new Set(["governance", "environmentFactor", "energy", "services", "vehicles", "water"] as any),
        }),
      ];

      // ENERGY available, but all 6 non-essential goods missing
      const colonyGoods = createMockGoods({ [ENERGY]: 10 });
      const laborAllocations = { OilRig: { worker: 10 } };

      const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

      // 6 missing non-essential = 60% penalty, capped at 50%
      // finalScale = 1.0 * 0.5 = 0.5
      expect(result.sectorResults.OilRig.productionRatio).toBeCloseTo(0.5, 1);
      expect(result.sectorStopReason.OilRig).toContain("-50%");
    });

    it("produces at 100% when all non-essential goods available", () => {
      const bids = [
        createMockBid("OilRig", {
          idealGoodsDemand: { [ENERGY]: 10, governance: 20 as any },
          idealGoodsProduction: { oil: 5000 },
          idealWorkerDemand: { worker: 10 },
          nonEssentialGoods: new Set(["governance"] as any),
        }),
      ];

      // Both ENERGY and governance available
      const colonyGoods = createMockGoods({ [ENERGY]: 10, governance: 20 });
      const laborAllocations = { OilRig: { worker: 10 } };

      const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, undefined, population, availableWorkers);

      // No penalty - all non-essential goods available
      expect(result.sectorResults.OilRig.productionRatio).toBeCloseTo(1.0, 1);
      expect(result.sectorStopReason.OilRig).toBe("Producing");
    });

    it("does not add non-essential goods to cumulative demand", () => {
      // Sector with both non-cumulative and non-essential goods
      const bids = [
        createMockBid("Factory", {
          idealGoodsDemand: { [ENERGY]: 10, governance: 20 as any, logistics: 5 as any },
          idealGoodsProduction: { [SERVICES]: 8 },
          idealWorkerDemand: { worker: 10 },
          nonEssentialGoods: new Set(["governance"] as any),
        }),
      ];

      // ENERGY available, governance (non-essential) missing, LOGISTICS (cumulative) missing
      const colonyGoods = createMockGoods({ [ENERGY]: 10, governance: 0, logistics: 0 });
      const purchasedBySector = { Factory: { logistics: 0 } };
      const laborAllocations = { Factory: { worker: 10 } };

      const result = executeNonCumulativeFlow(bids, colonyGoods, prices, salaries, laborAllocations, purchasedBySector, population, availableWorkers);

      // flowScale = 1 (ENERGY available, governance skipped)
      // cumulativeRatio = 0 (LOGISTICS missing)
      // finalScale = 0 (capped by cumulative), but sector should still execute (not blocked by non-essential)
      expect(result.executedSectors.has("Factory")).toBe(true);
      expect(result.sectorResults.Factory.productionRatio).toBe(0);
      // stopReason should be about cumulative shortage, not non-essential
      expect(result.sectorStopReason.Factory).toContain("No materials");
    });
  });
});