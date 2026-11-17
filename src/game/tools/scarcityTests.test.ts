import { describe, expect, it } from "vitest";
import { allocateLabor } from "../workers/laborAllocation";
import { allocateGoods } from "../workers/goodsAllocation";
import { allocateBudget } from "../workers/budgetAllocation";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import { Population } from "../data/Population.ts";
import type { Goods as GoodsType } from "../data/Goods.ts";

function sumValues(values: Iterable<number>): number {
	return [...values].reduce((sum, value) => sum + value, 0);
}

const SectorId = (id: string) => id as keyof IndustrialSectors;

const availableWorkers: Record<keyof Population, number> = {
	farmer: 100,
	scientist: 50,
	worker: 200,
	student: 30,
	healtcarePersonal: 20,
	policeMen: 15,
	teacher: 10,
	serviceWorker: 25,
	clergy: 5,
	retired: 40,
	clerks: 15,
	engineer: 10,
	stayAtHome: 100,
	serviceMan: 10,
};

const availableGoods: Record<keyof GoodsType, number> = {
	food: 1000,
	water: 500,
	energy: 300,
	machinery: 200,
	buildings: 100,
	oil: 400,
	metals: 150,
	tylium: 80,
	consumerGoods: 300,
	agriculturalGoods: 200,
	tourism: 0,
	services: 0,
	fissionMaterial: 50,
	medicine: 60,
	lumber: 90,
	spaceShips: 10,
	nuclearWeapons: 0,
	vehicles: 30,
	environmentFactor: 0,
	faith: 0,
	lawEnforcement: 0,
	healthcare: 0,
	chemicals: 40,
	waste: 0,
	governance: 0,
	logistics: 0,
	paper: 70,
	entertainment: 0,
	education: 0,
	defense: 0,
	monetaryServices: 0,
	mobility: 0,
	militaryEquipment: 0,
};

describe("Scarcity — multiple sectors competing for the same input", () => {
	describe("Goods allocation under scarcity", () => {
		it("two sectors competing for same input split stock proportionally", () => {
			const reqs = [
				{ sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 1 },
				{ sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
			];

			const result = allocateGoods({
				availableGoods: { ...availableGoods, food: 100 },
				sectorRequests: reqs,
			});

			expect(result.allocation[SectorId("sectorA")]?.food).toBe(50);
			expect(result.allocation[SectorId("sectorB")]?.food).toBe(50);
			expect(result.unmetDemand[SectorId("sectorA")]?.food).toBe(50);
			expect(result.unmetDemand[SectorId("sectorB")]?.food).toBe(50);
		});

		it("high-priority sector gets full demand, low-priority gets remainder", () => {
			const reqs = [
				{ sectorId: SectorId("high"), idealDemand: { food: 2 }, priority: 100 },
				{ sectorId: SectorId("low"), idealDemand: { food: 100 }, priority: 1 },
			];

			const result = allocateGoods({
				availableGoods: { ...availableGoods, food: 10 },
				sectorRequests: reqs,
			});

			expect(result.allocation[SectorId("high")]?.food).toBe(2);
			expect(result.allocation[SectorId("low")]?.food).toBe(8);
		});

		it("zero stock: every requested good gets zero allocation, full unmet demand", () => {
			const reqs = [
				{ sectorId: SectorId("sectorA"), idealDemand: { food: 100, water: 50 }, priority: 1 },
				{ sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
			];

			const result = allocateGoods({
				availableGoods: { ...availableGoods, food: 0, water: 0 },
				sectorRequests: reqs,
			});

			expect(result.allocation[SectorId("sectorA")]?.food).toBe(0);
			expect(result.allocation[SectorId("sectorA")]?.water).toBe(0);
			expect(result.allocation[SectorId("sectorB")]?.food).toBe(0);

			expect(result.unmetDemand[SectorId("sectorA")]?.food).toBe(100);
			expect(result.unmetDemand[SectorId("sectorA")]?.water).toBe(50);
			expect(result.unmetDemand[SectorId("sectorB")]?.food).toBe(100);
		});

		it("total allocation never exceeds available stock", () => {
			const reqs = [
				{ sectorId: SectorId("sectorA"), idealDemand: { food: 1000 }, priority: 10 },
				{ sectorId: SectorId("sectorB"), idealDemand: { food: 1000 }, priority: 1 },
			];

			const result = allocateGoods({
				availableGoods: { ...availableGoods, food: 150 },
				sectorRequests: reqs,
			});

			const totalAllocated =
				(result.allocation[SectorId("sectorA")]?.food ?? 0) +
				(result.allocation[SectorId("sectorB")]?.food ?? 0);

			expect(totalAllocated).toBeLessThanOrEqual(150);
			expect(result.allocation[SectorId("sectorA")]?.food).toBeLessThanOrEqual(1000);
			expect(result.allocation[SectorId("sectorB")]?.food).toBeLessThanOrEqual(1000);
		});

		it("results are identical when request order is reversed (order independence)", () => {
			const reqsForward = [
				{ sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 2 },
				{ sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
			];
			const reqsReverse = [
				{ sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
				{ sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 2 },
			];

			const forward = allocateGoods({
				availableGoods: { ...availableGoods, food: 100 },
				sectorRequests: reqsForward,
			});
			const reverse = allocateGoods({
				availableGoods: { ...availableGoods, food: 100 },
				sectorRequests: reqsReverse,
			});

			expect(forward.allocation[SectorId("sectorA")]?.food ?? 0).toBeCloseTo(
				reverse.allocation[SectorId("sectorA")]?.food ?? 0,
				8,
			);
			expect(forward.allocation[SectorId("sectorB")]?.food ?? 0).toBeCloseTo(
				reverse.allocation[SectorId("sectorB")]?.food ?? 0,
				8,
			);
		});

		it("fractional stock: allocations sum to available stock exactly", () => {
			const reqs = [
				{ sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 1 },
				{ sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
			];

			const result = allocateGoods({
				availableGoods: { ...availableGoods, food: 99.5 },
				sectorRequests: reqs,
			});

			const a = result.allocation[SectorId("sectorA")]?.food ?? 0;
			const b = result.allocation[SectorId("sectorB")]?.food ?? 0;
			expect(a + b).toBeCloseTo(99.5, 8);
		});
	});

	describe("Labor allocation under scarcity", () => {
		it("two sectors competing for same worker type split workers proportionally", () => {
			const reqs = [
				{ sectorId: SectorId("sectorA"), idealDemand: { worker: 100 }, priority: 1 },
				{ sectorId: SectorId("sectorB"), idealDemand: { worker: 100 }, priority: 1 },
			];

			const result = allocateLabor({
				availableWorkers: { ...availableWorkers, worker: 100 },
				sectorRequests: reqs,
			});

			expect(result.allocation[SectorId("sectorA")]?.worker).toBe(50);
			expect(result.allocation[SectorId("sectorB")]?.worker).toBe(50);
			expect(result.unmetDemand[SectorId("sectorA")]?.worker).toBe(50);
			expect(result.unmetDemand[SectorId("sectorB")]?.worker).toBe(50);
		});

		it("stayAtHome excluded from labor pool gets zero allocation", () => {
			const workersWithoutStayAtHome = {
				...availableWorkers,
				stayAtHome: 0,
			};
			const reqs = [
				{ sectorId: SectorId("farm"), idealDemand: { stayAtHome: 100 }, priority: 1 },
			];

			const result = allocateLabor({
				availableWorkers: workersWithoutStayAtHome,
				sectorRequests: reqs,
			});

			expect(result.allocation[SectorId("farm")]?.stayAtHome ?? 0).toBe(0);
			expect(result.unmetDemand[SectorId("farm")]?.stayAtHome).toBe(100);
		});

		it("aggregate labor never exceeds available population per category", () => {
			const reqs = [
				{ sectorId: SectorId("sectorA"), idealDemand: { worker: 1000 }, priority: 10 },
				{ sectorId: SectorId("sectorB"), idealDemand: { worker: 1000 }, priority: 1 },
			];

			const result = allocateLabor({
				availableWorkers: { ...availableWorkers, worker: 150 },
				sectorRequests: reqs,
			});

			const totalAllocated =
				(result.allocation[SectorId("sectorA")]?.worker ?? 0) +
				(result.allocation[SectorId("sectorB")]?.worker ?? 0);

			expect(totalAllocated).toBeLessThanOrEqual(150);
		});

		it("labor allocation order-independent", () => {
			const reqsForward = [
				{ sectorId: SectorId("sectorA"), idealDemand: { worker: 100 }, priority: 2 },
				{ sectorId: SectorId("sectorB"), idealDemand: { worker: 100 }, priority: 1 },
			];
			const reqsReverse = [
				{ sectorId: SectorId("sectorB"), idealDemand: { worker: 100 }, priority: 1 },
				{ sectorId: SectorId("sectorA"), idealDemand: { worker: 100 }, priority: 2 },
			];

			const forward = allocateLabor({
				availableWorkers: { ...availableWorkers, worker: 100 },
				sectorRequests: reqsForward,
			});
			const reverse = allocateLabor({
				availableWorkers: { ...availableWorkers, worker: 100 },
				sectorRequests: reqsReverse,
			});

			expect(forward.allocation[SectorId("sectorA")]?.worker ?? 0).toBeCloseTo(
				reverse.allocation[SectorId("sectorA")]?.worker ?? 0,
				8,
			);
		});
	});

	describe("Budget allocation under scarcity", () => {
		it("budgetRatio scales with operating cash vs total cost", () => {
			const reqs = [
				{ sectorId: SectorId("rich"), sectorMoney: 1000, totalOperatingCostAtFullScale: 100 },
				{ sectorId: SectorId("poor"), sectorMoney: 50, totalOperatingCostAtFullScale: 100 },
				{ sectorId: SectorId("broke"), sectorMoney: 0, totalOperatingCostAtFullScale: 100 },
			];

			const result = allocateBudget({ sectorRequests: reqs });

			expect(result.allocation[SectorId("rich")]?.budgetRatio).toBe(1);
			expect(result.allocation[SectorId("poor")]?.budgetRatio).toBe(0.5);
			expect(result.allocation[SectorId("broke")]?.budgetRatio).toBe(0);
		});

		it("zero total operating cost gets budgetRatio 1 even with zero money", () => {
			const reqs = [
				{ sectorId: SectorId("free"), sectorMoney: 0, totalOperatingCostAtFullScale: 0 },
			];

			const result = allocateBudget({ sectorRequests: reqs });
			expect(result.allocation[SectorId("free")]?.budgetRatio).toBe(1);
		});

		it("rejects duplicate sector ID", () => {
			const reqs = [
				{ sectorId: SectorId("sector"), sectorMoney: 100, totalOperatingCostAtFullScale: 50 },
				{ sectorId: SectorId("sector"), sectorMoney: 50, totalOperatingCostAtFullScale: 25 },
			];

			expect(() => allocateBudget({ sectorRequests: reqs })).toThrow(
				"Duplicate budget request for sector",
			);
		});

		it("rejects negative sector money", () => {
			const reqs = [
				{ sectorId: SectorId("sector"), sectorMoney: -50, totalOperatingCostAtFullScale: 100 },
			];

			expect(() => allocateBudget({ sectorRequests: reqs })).toThrow(
				"Invalid operating cash",
			);
		});

		it("rejects non-finite sector money", () => {
			const reqs = [
				{ sectorId: SectorId("sector"), sectorMoney: NaN, totalOperatingCostAtFullScale: 100 },
			];

			expect(() => allocateBudget({ sectorRequests: reqs })).toThrow(
				"Invalid operating cash",
			);
		});
	});

	describe("Integration — sector execution under scarcity", () => {
		it("insufficient operating cash: sector scales down proportionally", () => {
			const state = createSimState();
			const input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: ["powerPlant", "forestry", "government", "services", "oilRig"],
					starterMoneyPerSector: 20_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			input.goods.oil = 10_000;
			input.goods.environmentFactor = 10_000;
			input.goods.governance = 10_000;

			const result = simulateTick(input, state);

			const sectorResult = result.sectorResults["powerPlant"];
			expect(sectorResult).toBeDefined();
			// With only 20_000 money and total operating cost ~248_800,
			// budgetRatio should be ~0.0804 and production should scale down.
			const expectedBudgetRatio = 20_000 / 248_800;
			expect(sectorResult!.productionRatio).toBeCloseTo(expectedBudgetRatio, 2);
			expect(result.sectorStopReason["powerPlant"]).toBe("Low budget");
		});

		it("zero input stock: sector cannot consume inputs, production stops", () => {
			const state = createSimState();
			const input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: ["farm", "foodFactory", "waterTreatment", "forestry", "government", "chemical", "services", "powerPlant"],
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			// Zero out water — farm and waterTreatment need it
			input.goods.water = 0;
			input.goods.environmentFactor = 10_000;
			input.goods.governance = 10_000;
			input.goods.energy = 10_000;

			const result = simulateTick(input, state);

			const farmResult = result.sectorResults["farm"];
			expect(farmResult).toBeDefined();
			// With no water, farm production should be 0
			expect(farmResult!.productionRatio).toBe(0);
			expect(result.sectorStopReason["farm"]).toBe("No materials");
		});

		it("multiple sectors compete for scarce input, at least one produces", () => {
			const state = createSimState();
			const input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: ["farm", "foodFactory", "forestry", "government", "chemical", "waterTreatment", "services", "powerPlant"],
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			// Make water scarce — both farm and foodFactory need it
			input.goods.water = 10;

			const result = simulateTick(input, state);

			// Both sectors should have results (or be stopped), but no crash
			let totalProduction = 0;
			for (const name of input.activeSectors) {
				const sectorResult = result.sectorResults[name];
				expect(sectorResult).toBeDefined();
				if (sectorResult) {
					expect(sectorResult.productionRatio).toBeGreaterThanOrEqual(0);
					expect(sectorResult.productionRatio).toBeLessThanOrEqual(1);
					totalProduction += sumValues(
						Object.values(sectorResult.producedGoods),
					);
				}
			}

			// At least one sector should produce something with scarce water
			expect(totalProduction).toBeGreaterThan(0);

			// Money and inventory should remain finite and nonnegative
			for (const [, balance] of Object.entries(result.money)) {
				expect(Number.isFinite(balance)).toBe(true);
				expect(balance).toBeGreaterThanOrEqual(0);
			}
			for (const [, qty] of Object.entries(result.goods)) {
				expect(Number.isFinite(qty)).toBe(true);
				expect(qty).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Stay-at-home exclusion — integration", () => {
		it("stayAtHome receives no sector employment and is not double-counted", () => {
			const state = createSimState();
			const input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: ["farm", "foodFactory", "waterTreatment", "forestry", "government", "chemical", "powerPlant", "services"],
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			const stayAtHomePop = input.population.stayAtHome.number;
			const result = simulateTick(input, state);

			// stayAtHome must not be employed by any sector
			for (const name of input.activeSectors) {
				const sectorResult = result.sectorResults[name];
				const workersEmployed = sectorResult?.workersEmployed ?? {};
				const stayAtHomeEmployed = workersEmployed.stayAtHome ?? 0;
				expect(stayAtHomeEmployed).toBe(0);
			}

			// Total employment by population category never exceeds available population
			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const available = input.population[popKey].number;
				let totalEmployed = 0;
				for (const name of input.activeSectors) {
					const sectorResult = result.sectorResults[name];
					const workersEmployed = sectorResult?.workersEmployed ?? {};
					totalEmployed += workersEmployed[popKey] ?? 0;
				}
				expect(totalEmployed).toBeLessThanOrEqual(available + 1e-9);
			}

			// Wage payments correspond to actual employment
			const totalWages = sumValues(
				Object.values(result.accounting.wagesByPop),
			);
			const totalLaborCosts = sumValues(
				Object.values(result.sectorLaborCosts),
			);
			expect(Math.abs(totalWages - totalLaborCosts)).toBeLessThan(1e-6);

			// stayAtHome wages are zero
			const stayAtHomeWages = result.accounting.wagesByPop.stayAtHome ?? 0;
			expect(stayAtHomeWages).toBe(0);

			// Population count for stayAtHome is preserved (not consumed by labor)
			const closingStayAtHome = result.population.stayAtHome.number;
			expect(closingStayAtHome).toBe(stayAtHomePop);
		});
	});
});
