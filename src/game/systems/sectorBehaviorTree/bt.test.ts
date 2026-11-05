import { describe, it, expect, vi } from "vitest"
import {
    Sequence,
    Selector,
    Condition,
    Action,
    Inverter,
    type BTStatus,
    type BTNode,
    type SectorBlackboard,
    defaultDecisions,
} from "./bt"

function makeBlackboard(overrides: Partial<SectorBlackboard> = {}): SectorBlackboard {
    return {
        sectorName: "testSector",
        money: 1000000,
        capitalStock: {},
        sectorProfits: 0,
        sectorRevenue: 0,
        sectorLaborCosts: 0,
        sectorInputCosts: 0,
        sectorUtilization: 1,
        laborAssigned: 0,
        freeWorkers: 100,
        prices: {},
        salaries: {},
        workerMarketRatios: {},
        outputLevel: 1,
        inputLevel: 1,
        investmentPriority: 1,
        investRemaining: 1000000,
        decisions: defaultDecisions,
        ...overrides,
    }
}

function mockNode(status: BTStatus): BTNode {
    return {
        tick: vi.fn().mockReturnValue(status),
    } as unknown as BTNode
}

describe("Sequence", () => {
    it("returns SUCCESS when all children succeed", () => {
        const child1 = mockNode("SUCCESS")
        const child2 = mockNode("SUCCESS")
        const seq = new Sequence([child1, child2])

        const result = seq.tick(makeBlackboard())
        expect(result).toBe("SUCCESS")
        expect(child1.tick).toHaveBeenCalledTimes(1)
        expect(child2.tick).toHaveBeenCalledTimes(1)
    })

    it("returns FAILURE when first child fails", () => {
        const child1 = mockNode("FAILURE")
        const child2 = mockNode("SUCCESS")
        const seq = new Sequence([child1, child2])

        const result = seq.tick(makeBlackboard())
        expect(result).toBe("FAILURE")
        expect(child1.tick).toHaveBeenCalledTimes(1)
        expect(child2.tick).not.toHaveBeenCalled()
    })

    it("returns RUNNING when first child runs", () => {
        const child1 = mockNode("RUNNING")
        const child2 = mockNode("SUCCESS")
        const seq = new Sequence([child1, child2])

        const result = seq.tick(makeBlackboard())
        expect(result).toBe("RUNNING")
        expect(child1.tick).toHaveBeenCalledTimes(1)
        expect(child2.tick).not.toHaveBeenCalled()
    })

    it("returns SUCCESS for empty children", () => {
        const seq = new Sequence([])

        const result = seq.tick(makeBlackboard())
        expect(result).toBe("SUCCESS")
    })

    it("passes blackboard to children", () => {
        const blackboard = makeBlackboard({ sectorName: "mySector" })
        const child = mockNode("SUCCESS")
        const seq = new Sequence([child])

        seq.tick(blackboard)
        expect(child.tick).toHaveBeenCalledWith(blackboard)
    })
})

describe("Selector", () => {
    it("returns SUCCESS when first child succeeds", () => {
        const child1 = mockNode("SUCCESS")
        const child2 = mockNode("SUCCESS")
        const sel = new Selector([child1, child2])

        const result = sel.tick(makeBlackboard())
        expect(result).toBe("SUCCESS")
        expect(child1.tick).toHaveBeenCalledTimes(1)
        expect(child2.tick).not.toHaveBeenCalled()
    })

    it("returns SUCCESS on second child when first fails", () => {
        const child1 = mockNode("FAILURE")
        const child2 = mockNode("SUCCESS")
        const sel = new Selector([child1, child2])

        const result = sel.tick(makeBlackboard())
        expect(result).toBe("SUCCESS")
        expect(child1.tick).toHaveBeenCalledTimes(1)
        expect(child2.tick).toHaveBeenCalledTimes(1)
    })

    it("returns FAILURE when all children fail", () => {
        const child1 = mockNode("FAILURE")
        const child2 = mockNode("FAILURE")
        const sel = new Selector([child1, child2])

        const result = sel.tick(makeBlackboard())
        expect(result).toBe("FAILURE")
        expect(child1.tick).toHaveBeenCalledTimes(1)
        expect(child2.tick).toHaveBeenCalledTimes(1)
    })

    it("continues to next child when first returns RUNNING", () => {
        const child1 = mockNode("RUNNING")
        const child2 = mockNode("SUCCESS")
        const sel = new Selector([child1, child2])

        const result = sel.tick(makeBlackboard())
        // Selector treats RUNNING like non-SUCCESS and continues to next child
        expect(result).toBe("SUCCESS")
        expect(child1.tick).toHaveBeenCalledTimes(1)
        expect(child2.tick).toHaveBeenCalledTimes(1)
    })

    it("returns FAILURE for empty children", () => {
        const sel = new Selector([])

        const result = sel.tick(makeBlackboard())
        expect(result).toBe("FAILURE")
    })

    it("passes blackboard to children", () => {
        const blackboard = makeBlackboard({ sectorName: "mySector" })
        const child = mockNode("SUCCESS")
        const sel = new Selector([child])

        sel.tick(blackboard)
        expect(child.tick).toHaveBeenCalledWith(blackboard)
    })
})

describe("Condition", () => {
    it("returns SUCCESS when check returns true", () => {
        class TrueCondition extends Condition {
            check(): boolean { return true }
        }
        const cond = new TrueCondition()

        const result = cond.tick(makeBlackboard())
        expect(result).toBe("SUCCESS")
    })

    it("returns FAILURE when check returns false", () => {
        class FalseCondition extends Condition {
            check(): boolean { return false }
        }
        const cond = new FalseCondition()

        const result = cond.tick(makeBlackboard())
        expect(result).toBe("FAILURE")
    })

    it("passes blackboard to check", () => {
        const blackboard = makeBlackboard()
        let receivedBlackboard: SectorBlackboard | null = null
        class TrackingCondition extends Condition {
            check(bb: SectorBlackboard): boolean {
                receivedBlackboard = bb
                return true
            }
        }
        const cond = new TrackingCondition()

        cond.tick(blackboard)
        expect(receivedBlackboard).toBe(blackboard)
    })
})

describe("Action", () => {
    it("returns status from execute", () => {
        class SuccessAction extends Action {
            execute(): BTStatus { return "SUCCESS" }
        }
        const action = new SuccessAction()

        const result = action.tick(makeBlackboard())
        expect(result).toBe("SUCCESS")
    })

    it("can return FAILURE from execute", () => {
        class FailureAction extends Action {
            execute(): BTStatus { return "FAILURE" }
        }
        const action = new FailureAction()

        const result = action.tick(makeBlackboard())
        expect(result).toBe("FAILURE")
    })

    it("can return RUNNING from execute", () => {
        class RunningAction extends Action {
            execute(): BTStatus { return "RUNNING" }
        }
        const action = new RunningAction()

        const result = action.tick(makeBlackboard())
        expect(result).toBe("RUNNING")
    })

    it("passes blackboard to execute", () => {
        const blackboard = makeBlackboard()
        let receivedBlackboard: SectorBlackboard | null = null
        class TrackingAction extends Action {
            execute(bb: SectorBlackboard): BTStatus {
                receivedBlackboard = bb
                return "SUCCESS"
            }
        }
        const action = new TrackingAction()

        action.tick(blackboard)
        expect(receivedBlackboard).toBe(blackboard)
    })
})

describe("Inverter", () => {
    it("inverts SUCCESS to FAILURE", () => {
        const child = mockNode("SUCCESS")
        const inv = new Inverter(child)

        const result = inv.tick(makeBlackboard())
        expect(result).toBe("FAILURE")
    })

    it("inverts FAILURE to SUCCESS", () => {
        const child = mockNode("FAILURE")
        const inv = new Inverter(child)

        const result = inv.tick(makeBlackboard())
        expect(result).toBe("SUCCESS")
    })

    it("passes RUNNING through unchanged", () => {
        const child = mockNode("RUNNING")
        const inv = new Inverter(child)

        const result = inv.tick(makeBlackboard())
        expect(result).toBe("RUNNING")
    })

    it("passes blackboard to child", () => {
        const blackboard = makeBlackboard()
        const child = mockNode("SUCCESS")
        const inv = new Inverter(child)

        inv.tick(blackboard)
        expect(child.tick).toHaveBeenCalledWith(blackboard)
    })
})

describe("defaultDecisions", () => {
    it("has expected default values", () => {
        expect(defaultDecisions.laborAssigned).toBe(0)
        expect(defaultDecisions.sectorInvestment).toBe(0)
        expect(defaultDecisions.stopProduction).toBe(false)
        expect(defaultDecisions.restartProduction).toBe(false)
        expect(defaultDecisions.buyCapital).toBe(false)
    })
})
