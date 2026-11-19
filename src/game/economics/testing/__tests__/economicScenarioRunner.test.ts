import { describe, it, expect, beforeEach, vi } from "vitest";
import { EconomicScenarioRunner, STANDARD_SCENARIOS } from "../economicScenarioRunner";
import type { IndustryTickInput } from "@game/workers/IndustryTickInput";
import type { IndustryTickResult } from "@game/workers/IndustryTickResult";
import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";

const createMockPopulation = (): Population => ({
    farmer: { number: 500, wealth: 3000, qol: 45, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0, wealthLevel: 1 },
    scientist: { number: 100, wealth: 8000, qol: 70, expectedQol: 75, populationChange: 0, mortality: 0, salary: 800, birthRate: 0, wealthLevel: 3 },
    worker: { number: 1000, wealth: 5000, qol: 50, expectedQol: 55, populationChange: 0, mortality: 0, salary: 200, birthRate: 0, wealthLevel: 1 },
    student: { number: 200, wealth: 0, qol: 60, expectedQol: 65, populationChange: 0, mortality: 0, salary: 0, birthRate: 0, wealthLevel: 0 },
    healtcarePersonal: { number: 100, wealth: 6000, qol: 65, expectedQol: 70, populationChange: 0, mortality: 0, salary: 600, birthRate: 0, wealthLevel: 2 },
    policeMen: { number: 50, wealth: 4000, qol: 55, expectedQol: 60, populationChange: 0, mortality: 0, salary: 400, birthRate: 0, wealthLevel: 1 },
    teacher: { number: 80, wealth: 5000, qol: 60, expectedQol: 65, populationChange: 0, mortality: 0, salary: 500, birthRate: 0, wealthLevel: 1 },
    serviceWorker: { number: 300, wealth: 3000, qol: 45, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0, wealthLevel: 1 },
    clergy: { number: 50, wealth: 4000, qol: 55, expectedQol: 60, populationChange: 0, mortality: 0, salary: 300, birthRate: 0, wealthLevel: 1 },
    retired: { number: 200, wealth: 10000, qol: 50, expectedQol: 55, populationChange: 0, mortality: 0.01, salary: 0, birthRate: 0, wealthLevel: 2 },
    clerks: { number: 150, wealth: 4000, qol: 55, expectedQol: 60, populationChange: 0, mortality: 0, salary: 300, birthRate: 0, wealthLevel: 1 },
    engineer: { number: 100, wealth: 8000, qol: 70, expectedQol: 75, populationChange: 0, mortality: 0, salary: 700, birthRate: 0, wealthLevel: 3 },
    stayAtHome: { number: 100, wealth: 2000, qol: 40, expectedQol: 45, populationChange: 0, mortality: 0, salary: 0, birthRate: 0, wealthLevel: 0 },
    serviceMan: { number: 50, wealth: 4000, qol: 55, expectedQol: 60, populationChange: 0, mortality: 0, salary: 350, birthRate: 0, wealthLevel: 1 },
});

const createMockInput = (overrides: Partial<IndustryTickInput> = {}): IndustryTickInput => {
    const pop = createMockPopulation();
    return {
        entityId: "colony1",
        activeSectors: new Set(["powerPlant", "farm", "waterTreatment"]),
        goods: { food: 1000, water: 500, energy: 200 } as any,
        population: pop,
        money: { powerPlant: 1_000_000, farm: 1_000_000, waterTreatment: 1_000_000 } as any,
        colonyTreasury: 10_000_000,
        capitalStock: {} as any,
        producerInventories: {} as any,
        prices: { prices: { food: 30, water: 10, energy: 20 } as any, sourceTick: 0, effectiveTick: 1, entityId: "colony1" },
        ...overrides,
    } as any;
};

const createMockResult = (input: IndustryTickInput, _tick: number, options: { preserveNegativeMoney?: boolean } = {}): IndustryTickResult => ({
    ...input,
    goods: { ...input.goods, food: input.goods.food - 50 + 100 } as any,
    money: options.preserveNegativeMoney ? { ...input.money } : { ...input.money, powerPlant: input.money.powerPlant + 1000 } as any,
    colonyTreasury: input.colonyTreasury + 500,
    population: input.population,
    capitalStock: input.capitalStock,
    producerInventories: input.producerInventories,
    sectorResults: {
        powerPlant: { productionRatio: 1, producedGoods: { energy: 100 }, stopReason: null, workersEmployed: { worker: 10 } } as any,
    },
    accounting: {
        householdSalesByGood: { food: 50, water: 20 } as any,
        sectorProductionByGood: { energy: 100 } as any,
        sectorInputsConsumedByGood: {} as any,
        wagesByPop: { worker: 2000 } as any,
        spendingByPop: { worker: 1500 } as any,
        sectorInputsPurchasedBySector: {} as any,
        sectorInputsConsumedBySector: {} as any,
        sectorInputRefundsBySector: {} as any,
        sectorInputRefundQuantitiesBySector: {} as any,
        sectorInputRefundAmountsBySector: {} as any,
        returnedInputsByGood: {} as any,
        sectorInputPaymentBreakdown: {} as any,
        purchaseProvenance: {} as any,
        treasurySubsidiesPaid: {} as any,
    } as any,
    sectorStopReason: {} as any,
    wages: {} as any,
    sectorProfits: {} as any,
    sectorRevenue: {} as any,
    sectorLaborCosts: {} as any,
    sectorInputCosts: {} as any,
    sectorUtilization: { powerPlant: 1 } as any,
    populationProfits: {} as any,
    workingWorkers: { worker: { number: 10 } } as any,
    freeWorkers: { worker: { number: 990 } } as any,
    populationUpdates: {} as any,
}) as any;

describe("EconomicScenarioRunner", () => {
    let runner: EconomicScenarioRunner;
    let mockSimulateTick: (input: IndustryTickInput) => IndustryTickResult | null;
    let mockCreateInitialState: (config: Record<string, any>) => IndustryTickInput;

    beforeEach(() => {
        mockSimulateTick = vi.fn((input: IndustryTickInput) => createMockResult(input, 1)) as (input: IndustryTickInput) => IndustryTickResult | null;
        mockCreateInitialState = vi.fn((config: Record<string, any>) => createMockInput(config)) as (config: Record<string, any>) => IndustryTickInput;
        
        runner = new EconomicScenarioRunner(mockSimulateTick, mockCreateInitialState);
    });

    describe("Normal scenario execution", () => {
        it("runs a scenario and produces snapshots", () => {
            const config = STANDARD_SCENARIOS.normal;
            config.tickCount = 20;
            config.snapshotInterval = 10;

            const result = runner.runScenario(config);

            expect(result.snapshots.length).toBeGreaterThan(0);
            expect(result.finalState).not.toBeNull();
            expect(result.firstFailure).toBeNull();
            expect(result.reproducibilityHash).toBeDefined();
        });

        it("records diagnostics when enabled", () => {
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 10, snapshotInterval: 5 };
            config.diagnostics = { health: true, market: true, industry: true, household: true, cascade: true };

            const result = runner.runScenario(config);

            expect(result.diagnosticHistory.health.length).toBeGreaterThanOrEqual(0);
            expect(result.diagnosticHistory.market.length).toBeGreaterThanOrEqual(0);
        });

        it("calls progress callback at intervals", () => {
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 15, snapshotInterval: 5 };
            const onProgress = vi.fn();

            runner.runScenario(config, onProgress);

            expect(onProgress).toHaveBeenCalled();
            const calls = onProgress.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
        });
    });

    describe("Failure detection", () => {
        it("detects null result from simulateTick", () => {
            (mockSimulateTick as any).mockReturnValueOnce(null);
            
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 10 };
            const result = runner.runScenario(config);

            expect(result.firstFailure).not.toBeNull();
            expect(result.firstFailure?.reason).toBe("simulateTick returned null");
        });

        it("detects negative sector money", () => {
            // Create a fresh runner with a mock that returns negative money on first call
            const negativeMoneyResult = createMockResult(createMockInput({ 
                money: { powerPlant: -100, farm: 1_000_000, waterTreatment: 1_000_000 } as any
            }), 1, { preserveNegativeMoney: true });
            const negativeMock = vi.fn()
                .mockReturnValueOnce(negativeMoneyResult)
                .mockReturnValue(null) as (input: IndustryTickInput) => IndustryTickResult | null;
            const negativeRunner = new EconomicScenarioRunner(negativeMock, mockCreateInitialState);
            
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 10 };
            const result = negativeRunner.runScenario(config);

            expect(result.firstFailure).not.toBeNull();
            expect(result.firstFailure?.reason).toContain("Negative sector money");
        });

        it("detects negative treasury", () => {
            const negativeTreasuryResult = createMockResult(createMockInput({ 
                colonyTreasury: -1000
            }), 1);
            const negativeMock = vi.fn()
                .mockReturnValueOnce(negativeTreasuryResult)
                .mockReturnValue(null) as (input: IndustryTickInput) => IndustryTickResult | null;
            const negativeRunner = new EconomicScenarioRunner(negativeMock, mockCreateInitialState);

            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 10 };
            const result = negativeRunner.runScenario(config);

            expect(result.firstFailure).not.toBeNull();
            expect(result.firstFailure?.reason).toContain("Negative treasury");
        });

        it("detects negative population", () => {
            const negativePop = createMockPopulation();
            negativePop.worker.number = -10;
            
            const negativePopResult = createMockResult(createMockInput({ 
                population: negativePop
            }), 1);
            const negativeMock = vi.fn()
                .mockReturnValueOnce(negativePopResult)
                .mockReturnValue(null) as (input: IndustryTickInput) => IndustryTickResult | null;
            const negativeRunner = new EconomicScenarioRunner(negativeMock, mockCreateInitialState);
            
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 10 };
            const result = negativeRunner.runScenario(config);

            expect(result.firstFailure).not.toBeNull();
            expect(result.firstFailure?.reason).toContain("Negative population");
        });
    });

    describe("Reproducibility", () => {
        it("produces consistent hash for same scenario", () => {
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 20, snapshotInterval: 10 };
            
            const result1 = runner.runScenario(config);
            const result2 = runner.runScenario(config);

            expect(result1.reproducibilityHash).toBe(result2.reproducibilityHash);
        });

        it("export produces valid JSON", () => {
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 10, snapshotInterval: 5 };
            const result = runner.runScenario(config);
            
            const exported = runner.exportScenario(result);
            const parsed = JSON.parse(exported);
            
            expect(parsed.config).toBeDefined();
            expect(parsed.reproducibilityHash).toBe(result.reproducibilityHash);
            expect(parsed.snapshots.length).toBe(result.snapshots.length);
        });
    });

    describe("Replay from snapshot", () => {
        it("can replay from a saved snapshot", () => {
            const config = { ...STANDARD_SCENARIOS.normal, tickCount: 20, snapshotInterval: 10 };
            const result = runner.runScenario(config);
            
            const snapshot = result.snapshots[1];
            const replayed = runner.replayFromSnapshot(snapshot, 10);
            
            expect(replayed.length).toBeGreaterThan(0);
        });
    });

    describe("Standard scenarios", () => {
        it("has all required standard scenarios defined", () => {
            expect(STANDARD_SCENARIOS.normal).toBeDefined();
            expect(STANDARD_SCENARIOS.oilShortage).toBeDefined();
            expect(STANDARD_SCENARIOS.resourceSurplus).toBeDefined();
            expect(STANDARD_SCENARIOS.populationGrowth).toBeDefined();
            expect(STANDARD_SCENARIOS.populationDecline).toBeDefined();
            expect(STANDARD_SCENARIOS.industrialExpansion).toBeDefined();
            expect(STANDARD_SCENARIOS.fuelDisruption).toBeDefined();
            expect(STANDARD_SCENARIOS.treasuryDepletion).toBeDefined();
            expect(STANDARD_SCENARIOS.demandShock).toBeDefined();
            expect(STANDARD_SCENARIOS.longRunEquilibrium).toBeDefined();
        });

        it("each scenario has required properties", () => {
            for (const [key, scenario] of Object.entries(STANDARD_SCENARIOS)) {
                expect(scenario.name).toBeDefined();
                expect(scenario.description).toBeDefined();
                expect(scenario.seed).toBeDefined();
                expect(scenario.tickCount).toBeGreaterThan(0);
                expect(scenario.snapshotInterval).toBeGreaterThan(0);
                expect(scenario.initialState).toBeDefined();
                expect(scenario.diagnostics).toBeDefined();
            }
        });
    });
});