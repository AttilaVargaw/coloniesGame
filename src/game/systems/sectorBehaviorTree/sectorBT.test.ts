import { describe, it, expect } from "vitest"
import {
    HasMoney,
    IsProfitable,
    IsUnprofitable,
    HasCapitalDeficit,
    HasAdequateCapital,
    HasLaborShortage,
    HasEnoughWorkers,
    UtilizationLow,
    UtilizationHigh,
    IsStopped,
    IsRunning,
    CanAffordCapital,
} from "./sectorConditions"
import {
    EmergencyStop,
    NormalOperations,
    ReduceProduction,
    IncreaseLabor,
    BuyCapital,
    Idle,
    HireWorkers,
} from "./sectorActions"
import { buildBlackboard } from "./sectorTree"
import { Sequence, Selector, GreaterThan, LessThan, And, Or, Not, KeyExists } from "./generic"
import type { SectorBlackboard } from "./bt"

function makeBlackboard(overrides: Partial<SectorBlackboard> = {}): SectorBlackboard {
    return {
        sectorName: "test",
        money: 1000,
        capitalStock: {},
        sectorProfits: 0,
        sectorRevenue: 0,
        sectorLaborCosts: 0,
        sectorInputCosts: 0,
        sectorUtilization: 0.5,
        laborAssigned: 0,
        freeWorkers: 100,
        prices: {},
        salaries: {},
        workerMarketRatios: {},
        capitalGoods: {},
        workerRequirement: {},
        goodsProduction: {},
        outputLevel: 1,
        inputLevel: 1,
        investmentPriority: 0.5,
        investRemaining: 500,
        decisions: { laborAssigned: 0, sectorInvestment: 0, stopProduction: false, restartProduction: false, buyCapital: false },
        ...overrides,
    }
}

describe("sector conditions", () => {
    describe("HasMoney", () => {
        it("returns true when money > 0", () => {
            const bb = makeBlackboard({ money: 100 })
            expect(new HasMoney().check(bb)).toBe(true)
        })
        it("returns false when money <= 0", () => {
            expect(new HasMoney().check(makeBlackboard({ money: 0 }))).toBe(false)
            expect(new HasMoney().check(makeBlackboard({ money: -100 }))).toBe(false)
        })
    })

    describe("IsProfitable / IsUnprofitable", () => {
        it("IsProfitable true when sectorProfits > 0", () => {
            expect(new IsProfitable().check(makeBlackboard({ sectorProfits: 1 }))).toBe(true)
        })
        it("IsProfitable false when sectorProfits <= 0", () => {
            expect(new IsProfitable().check(makeBlackboard({ sectorProfits: 0 }))).toBe(false)
            expect(new IsProfitable().check(makeBlackboard({ sectorProfits: -100 }))).toBe(false)
        })
        it("IsUnprofitable true when sectorProfits < 0", () => {
            expect(new IsUnprofitable().check(makeBlackboard({ sectorProfits: -1 }))).toBe(true)
        })
        it("IsUnprofitable false when sectorProfits >= 0", () => {
            expect(new IsUnprofitable().check(makeBlackboard({ sectorProfits: 0 }))).toBe(false)
            expect(new IsUnprofitable().check(makeBlackboard({ sectorProfits: 100 }))).toBe(false)
        })
    })

    describe("HasCapitalDeficit / HasAdequateCapital", () => {
        it("HasCapitalDeficit false when no capitalGoods", () => {
            expect(new HasCapitalDeficit().check(makeBlackboard({ capitalGoods: undefined }))).toBe(false)
        })
        it("HasCapitalDeficit false when no capital entries", () => {
            expect(new HasCapitalDeficit().check(makeBlackboard({ capitalGoods: {} }))).toBe(false)
        })
        it("HasCapitalDeficit true when min adequacy < 0.5", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 40 }, // 40 / (1*100) = 0.4 < 0.5
            })
            expect(new HasCapitalDeficit().check(bb)).toBe(true)
        })
        it("HasCapitalDeficit false when min adequacy >= 0.5", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 60 }, // 60 / 100 = 0.6 >= 0.5
            })
            expect(new HasCapitalDeficit().check(bb)).toBe(false)
        })
        it("HasAdequateCapital true when no capitalGoods", () => {
            expect(new HasAdequateCapital().check(makeBlackboard({ capitalGoods: undefined }))).toBe(true)
        })
        it("HasAdequateCapital true when min adequacy >= 0.5", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 60 },
            })
            expect(new HasAdequateCapital().check(bb)).toBe(true)
        })
        it("HasAdequateCapital false when min adequacy < 0.5", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 40 },
            })
            expect(new HasAdequateCapital().check(bb)).toBe(false)
        })
    })

    describe("HasLaborShortage / HasEnoughWorkers", () => {
        it("HasLaborShortage false when no workerRequirement", () => {
            expect(new HasLaborShortage().check(makeBlackboard({ workerRequirement: undefined }))).toBe(false)
        })
        it("HasLaborShortage true when any worker ratio < 0.8", () => {
            const bb = makeBlackboard({
                workerRequirement: { worker: 1 },
                workerMarketRatios: { worker: 0.5 },
            })
            expect(new HasLaborShortage().check(bb)).toBe(true)
        })
        it("HasLaborShortage false when all ratios >= 0.8", () => {
            const bb = makeBlackboard({
                workerRequirement: { worker: 1 },
                workerMarketRatios: { worker: 0.9 },
            })
            expect(new HasLaborShortage().check(bb)).toBe(false)
        })
        it("HasEnoughWorkers true when no workerRequirement", () => {
            expect(new HasEnoughWorkers().check(makeBlackboard({ workerRequirement: undefined }))).toBe(true)
        })
        it("HasEnoughWorkers false when any ratio < 0.8", () => {
            const bb = makeBlackboard({
                workerRequirement: { worker: 1 },
                workerMarketRatios: { worker: 0.5 },
            })
            expect(new HasEnoughWorkers().check(bb)).toBe(false)
        })
    })

    describe("UtilizationLow / UtilizationHigh", () => {
        it("UtilizationLow true when sectorUtilization < 0.3", () => {
            expect(new UtilizationLow().check(makeBlackboard({ sectorUtilization: 0.2 }))).toBe(true)
            expect(new UtilizationLow().check(makeBlackboard({ sectorUtilization: 0.3 }))).toBe(false)
        })
        it("UtilizationHigh true when sectorUtilization > 0.9", () => {
            expect(new UtilizationHigh().check(makeBlackboard({ sectorUtilization: 0.95 }))).toBe(true)
            expect(new UtilizationHigh().check(makeBlackboard({ sectorUtilization: 0.9 }))).toBe(false)
        })
    })

    describe("IsStopped / IsRunning", () => {
        it("IsStopped true when outputLevel <= 0", () => {
            expect(new IsStopped().check(makeBlackboard({ outputLevel: 0 }))).toBe(true)
            expect(new IsStopped().check(makeBlackboard({ outputLevel: -1 }))).toBe(true)
        })
        it("IsStopped false when outputLevel > 0", () => {
            expect(new IsStopped().check(makeBlackboard({ outputLevel: 1 }))).toBe(false)
        })
        it("IsRunning true when outputLevel > 0", () => {
            expect(new IsRunning().check(makeBlackboard({ outputLevel: 1 }))).toBe(true)
        })
        it("IsRunning false when outputLevel <= 0", () => {
            expect(new IsRunning().check(makeBlackboard({ outputLevel: 0 }))).toBe(false)
            expect(new IsRunning().check(makeBlackboard({ outputLevel: -1 }))).toBe(false)
        })
    })

    describe("CanAffordCapital", () => {
        it("returns false when no capitalGoods", () => {
            expect(new CanAffordCapital().check(makeBlackboard({ capitalGoods: undefined }))).toBe(false)
        })
        it("returns false when all needed <= 0", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 200 }, // needed = 100 - 200 = -100 <= 0
                prices: { machinery: 50 },
            })
            expect(new CanAffordCapital().check(bb)).toBe(false)
        })
        it("returns true when can afford cheapest needed good", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1, electronics: 1 },
                capitalStock: { machinery: 0, electronics: 0 },
                prices: { machinery: 10, electronics: 100 },
                money: 1000,
                investRemaining: 2000,
            })
            // machinery: needed=100, cost=1000; electronics: needed=100, cost=10000
            // cheapest = 1000 <= money(1000) && < Infinity => true
            expect(new CanAffordCapital().check(bb)).toBe(true)
        })
        it("returns false when cheapest cost > money", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 0 },
                prices: { machinery: 2000 },
                money: 1000,
            })
            expect(new CanAffordCapital().check(bb)).toBe(false)
        })
    })
})

describe("sector actions", () => {
    describe("EmergencyStop", () => {
        it("stops production, zeroes labor and investment", () => {
            const bb = makeBlackboard({
                decisions: { laborAssigned: 100, sectorInvestment: 500, stopProduction: false, restartProduction: false, buyCapital: true },
            })
            const result = new EmergencyStop().execute(bb)
            expect(result).toBe("SUCCESS")
            expect(bb.decisions.stopProduction).toBe(true)
            expect(bb.decisions.laborAssigned).toBe(0)
            expect(bb.decisions.sectorInvestment).toBe(0)
            expect(bb.decisions.buyCapital).toBe(false)
        })
    })

    describe("NormalOperations", () => {
        it("restarts production, clears investment", () => {
            const bb = makeBlackboard({
                decisions: { laborAssigned: 0, sectorInvestment: 0, stopProduction: true, restartProduction: false, buyCapital: true },
            })
            const result = new NormalOperations().execute(bb)
            expect(result).toBe("SUCCESS")
            expect(bb.decisions.stopProduction).toBe(false)
            expect(bb.decisions.restartProduction).toBe(true)
            expect(bb.decisions.buyCapital).toBe(false)
        })
    })

    describe("ReduceProduction", () => {
        it("reduces laborAssigned to 75%", () => {
            const bb = makeBlackboard({ laborAssigned: 100 })
            const result = new ReduceProduction().execute(bb)
            expect(result).toBe("SUCCESS")
            expect(bb.decisions.laborAssigned).toBe(75)
            expect(bb.decisions.sectorInvestment).toBe(0)
        })
        it("floors laborAssigned", () => {
            const bb = makeBlackboard({ laborAssigned: 1 })
            new ReduceProduction().execute(bb)
            expect(bb.decisions.laborAssigned).toBe(0) // Math.floor(0.75) = 0
        })
    })

    describe("IncreaseLabor", () => {
        it("increases laborAssigned by up to 50, capped by freeWorkers", () => {
            const bb = makeBlackboard({ laborAssigned: 100, freeWorkers: 200 })
            new IncreaseLabor().execute(bb)
            expect(bb.decisions.laborAssigned).toBe(150)
        })
        it("caps at freeWorkers", () => {
            const bb = makeBlackboard({ laborAssigned: 100, freeWorkers: 30 })
            new IncreaseLabor().execute(bb)
            expect(bb.decisions.laborAssigned).toBe(30)
        })
        it("keeps laborAssigned when no free workers", () => {
            const bb = makeBlackboard({ laborAssigned: 100, freeWorkers: 0 })
            new IncreaseLabor().execute(bb)
            expect(bb.decisions.laborAssigned).toBe(100)
        })
    })

    describe("BuyCapital", () => {
        it("returns FAILURE when no capitalGoods", () => {
            const bb = makeBlackboard({ capitalGoods: undefined })
            expect(new BuyCapital().execute(bb)).toBe("FAILURE")
        })
        it("returns FAILURE when investmentPriority < 0.3", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 0 },
                prices: { machinery: 10 },
                money: 1000,
                investRemaining: 2000,
                investmentPriority: 0.2,
            })
            expect(new BuyCapital().execute(bb)).toBe("FAILURE")
        })
        it("returns FAILURE when investRemaining <= 0", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 0 },
                prices: { machinery: 10 },
                money: 1000,
                investRemaining: 0,
                investmentPriority: 0.5,
            })
            expect(new BuyCapital().execute(bb)).toBe("FAILURE")
        })
        it("returns FAILURE when can't afford best good", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1 },
                capitalStock: { machinery: 0 },
                prices: { machinery: 2000 },
                money: 1000,
                investRemaining: 500,
                investmentPriority: 0.5,
            })
            expect(new BuyCapital().execute(bb)).toBe("FAILURE")
        })
        it("returns SUCCESS and deducts from investRemaining when affordable", () => {
            const bb = makeBlackboard({
                capitalGoods: { machinery: 1, electronics: 1 },
                capitalStock: { machinery: 0, electronics: 50 },
                prices: { machinery: 10, electronics: 100 },
                money: 1000,
                investRemaining: 2000,
                investmentPriority: 0.5,
            })
            // machinery: needed=100, cost=1000; electronics: needed=50, cost=5000
            // cheapest = machinery at 1000
            expect(new BuyCapital().execute(bb)).toBe("SUCCESS")
            expect(bb.decisions.sectorInvestment).toBe(1000)
            expect(bb.decisions.buyCapital).toBe(true)
            expect(bb.decisions.restartProduction).toBe(true)
            expect(bb.investRemaining).toBe(1000)
        })
    })

    describe("Idle", () => {
        it("returns SUCCESS without changes", () => {
            const bb = makeBlackboard()
            const before = { ...bb.decisions }
            expect(new Idle().execute(bb)).toBe("SUCCESS")
            expect(bb.decisions).toEqual(before)
        })
    })

    describe("HireWorkers", () => {
        it("increases laborAssigned by up to 25, capped by freeWorkers", () => {
            const bb = makeBlackboard({ laborAssigned: 100, freeWorkers: 200 })
            new HireWorkers().execute(bb)
            expect(bb.decisions.laborAssigned).toBe(125)
        })
        it("caps at freeWorkers", () => {
            const bb = makeBlackboard({ laborAssigned: 100, freeWorkers: 10 })
            new HireWorkers().execute(bb)
            expect(bb.decisions.laborAssigned).toBe(10) // Math.min(10, 125) = 10
        })
    })
})

describe("buildBlackboard", () => {
    it("creates blackboard with defaults", () => {
        const bb = buildBlackboard("test", 500, {}, 0, 0, 0, 0, 0, 0, 0, {}, {}, {}, {}, {}, {}, 0, 0, 0.5, 100)
        expect(bb.sectorName).toBe("test")
        expect(bb.money).toBe(500)
        expect(bb.decisions).toEqual({
            laborAssigned: 0,
            sectorInvestment: 0,
            stopProduction: false,
            restartProduction: false,
            buyCapital: false,
        })
    })
})

describe("generic BT nodes", () => {
    const bb: Record<string, any> = { score: 10, name: "test" }

    describe("Sequence", () => {
        it("returns SUCCESS when all children succeed", () => {
            const node = new Sequence([
                new GreaterThan("score", 5),
                new KeyExists("name"),
            ])
            expect(node.tick(bb)).toBe("SUCCESS")
        })
        it("returns FAILURE on first child failure", () => {
            const node = new Sequence([
                new GreaterThan("score", 100),
                new KeyExists("name"),
            ])
            expect(node.tick(bb)).toBe("FAILURE")
        })
    })

    describe("Selector", () => {
        it("returns SUCCESS on first child success", () => {
            const node = new Selector([
                new GreaterThan("score", 100),
                new GreaterThan("score", 5),
            ])
            expect(node.tick(bb)).toBe("SUCCESS")
        })
        it("returns FAILURE when all children fail", () => {
            const node = new Selector([
                new GreaterThan("score", 100),
                new LessThan("score", 0),
            ])
            expect(node.tick(bb)).toBe("FAILURE")
        })
    })

    describe("GreaterThan / LessThan", () => {
        it("GreaterThan uses 0 default for missing key", () => {
            expect(new GreaterThan("missing", 0).check(bb)).toBe(false)
            expect(new GreaterThan("missing", -1).check(bb)).toBe(true)
        })
        it("LessThan uses 0 default for missing key", () => {
            expect(new LessThan("missing", 0).check(bb)).toBe(false)
            expect(new LessThan("missing", 1).check(bb)).toBe(true)
        })
        it("boundary: equal is not greater", () => {
            expect(new GreaterThan("score", 10).check(bb)).toBe(false)
            expect(new LessThan("score", 10).check(bb)).toBe(false)
        })
    })

    describe("KeyExists", () => {
        it("true when key exists", () => {
            expect(new KeyExists("score").check(bb)).toBe(true)
        })
        it("false when key missing", () => {
            expect(new KeyExists("missing").check(bb)).toBe(false)
        })
    })

    describe("And / Or / Not", () => {
        it("And true when all children true", () => {
            const node = new And([new GreaterThan("score", 5), new KeyExists("name")])
            expect(node.check(bb)).toBe(true)
        })
        it("And false when any child false", () => {
            const node = new And([new GreaterThan("score", 100), new KeyExists("name")])
            expect(node.check(bb)).toBe(false)
        })
        it("Or true when any child true", () => {
            const node = new Or([new GreaterThan("score", 100), new KeyExists("name")])
            expect(node.check(bb)).toBe(true)
        })
        it("Or false when all children false", () => {
            const node = new Or([new GreaterThan("score", 100), new LessThan("score", 0)])
            expect(node.check(bb)).toBe(false)
        })
        it("Not inverts child", () => {
            expect(new Not(new GreaterThan("score", 100)).check(bb)).toBe(true)
            expect(new Not(new GreaterThan("score", 5)).check(bb)).toBe(false)
        })
    })
})
