import { IndustryComponent } from "@game/components/industryComponent";
import { World } from "@engine/core/world";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent } from "@/engine/lib/events";

const ORE_PER_LABOR = 0.5
const BASE_CIVILIAN_GOODS_PER_REFINED = 0.1
const HAPPINESS_GOODS_THRESHOLD = 0.01
const POPULATION_TAX_RATE = 0.1
const INDUSTRY_TAX_RATE = 0.05

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unregisterNodeType(IndustryNode)
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed)
        super.removeFromEngine()
        return this
    }

    private onDayPassed = () => {
        for(const node of this.nodes) {
            const ind = node.industry

            // 1. Mine ore
            const oreMined = ind.laborForce * ORE_PER_LABOR
            ind.ore += oreMined

            // 2. Refine ore → tylium
            const refined = Math.min(ind.ore, ind.refineryCapacity)
            ind.ore -= refined
            ind.tylium += refined

            // 3. Collect taxes
            const populationTax = ind.population * POPULATION_TAX_RATE * ind.taxRate
            const industryTax = ind.tylium * INDUSTRY_TAX_RATE * ind.taxRate
            ind.credits += populationTax + industryTax

            // 4. Pay maintenance costs
            if(ind.maintenanceCosts > 0 && ind.credits >= ind.maintenanceCosts) {
                ind.credits -= ind.maintenanceCosts
            } else if(ind.maintenanceCosts > 0) {
                ind.credits = 0
            }

            // 5. Allocate tylium between civilian and military (conceptual)
            const totalAlloc = ind.civilianAllocation + ind.militaryAllocation
            const safeTotal = totalAlloc > 0 ? totalAlloc : 1
            const civilianFuel = ind.tylium * (ind.civilianAllocation / safeTotal)
            const militaryFuel = ind.tylium * (ind.militaryAllocation / safeTotal)

            // 6. Civilian goods → happiness
            const goodsPerCapita = (civilianFuel * BASE_CIVILIAN_GOODS_PER_REFINED) / Math.max(1, ind.population)
            ind.happiness = Math.min(1, Math.max(0, ind.happiness + (goodsPerCapita - HAPPINESS_GOODS_THRESHOLD) * 0.1))

            // 7. Military: process build queue (consumes ore, tylium, credits)
            if(ind.buildOrders.length > 0 && militaryFuel > 0) {
                const perOrder = militaryFuel / ind.buildOrders.length
                for(const order of [...ind.buildOrders]) {
                    const orePortion = Math.min(order.oreCost - order.orePaid, ind.ore / ind.buildOrders.length)
                    const creditPortion = Math.min(order.creditCost - order.creditsPaid, ind.credits / ind.buildOrders.length)
                    const tyliumPortion = Math.min(order.tyliumCost - order.tyliumPaid, perOrder)

                    order.orePaid += orePortion
                    order.tyliumPaid += tyliumPortion
                    order.creditsPaid += creditPortion
                    ind.ore -= orePortion
                    ind.tylium -= tyliumPortion
                    ind.credits -= creditPortion

                    if(order.orePaid >= order.oreCost && order.tyliumPaid >= order.tyliumCost && order.creditsPaid >= order.creditCost) {
                        order.remainingDays = Math.max(0, order.remainingDays - 1)
                        if(order.remainingDays <= 0) {
                            ind.buildOrders = ind.buildOrders.filter(o => o !== order)
                        }
                    }
                }
            }

            // 8. Deduct tylium used for civilian goods
            ind.tylium -= civilianFuel

            // 9. Population growth
            const fertility = (ind.happiness - 0.5) / 15000
            ind.population += fertility * ind.population
        }
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        engine.registerNodeType(IndustryNode,
            new Set([IndustryComponent]),
            (entity) => new IndustryNode(
                entity.getComponent(IndustryComponent)!,
                entity
            )
        ).subscribe(DayPassedEvent, this.onDayPassed)
        this.nodes = engine.getNodeList(IndustryNode)
        return this
    }
}
