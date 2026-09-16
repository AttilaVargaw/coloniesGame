import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";
import { getPrices, Goods } from "../data/Goods";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { baseSalaries, getGoodRequirementsAndQoL, Population } from "../data/Population";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { industryReducers } from "./factoryBlueprints";
import { IndustryReducerReturn } from "./generateIndustrialSector";
import { populationGrowth } from "../data/populationHelpers";

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
        for(const { industry } of this.nodes) {
            const {
                sumGoodsProduction,
                sumGoodsRequirements,
                workingWorkers,
                remainingWorkers
            } = industryReducers.reduce((acc, [, reducer]) => reducer({
                ...acc,
                workerRatio: 1,
            }, industry.sectors), {
                remainingWorkers: industry.population,
                remainingGoods: industry.goods,
                sumGoodsRequirements: createStarterWarehouse(0),
                sumGoodsProduction: createStarterWarehouse(0),
                workingWorkers: createStarterPopulation(0),
            } as IndustryReducerReturn)

            industry.goodsRequirements = sumGoodsRequirements
            industry.goodsProduction = sumGoodsProduction
            industry.workingWorkers = workingWorkers
            industry.freeWorkers = remainingWorkers

            // console.log(workingWorkers)

            Object.entries(industry.population).forEach(([key, population]) => {
                const { number } = population
                const { requirements, qol } = getGoodRequirementsAndQoL(baseSalaries[key as keyof Population], getPrices(), population)

                population.qol = qol
                population.populationChange = populationGrowth(qol) * number
                population.wealth += baseSalaries[key as keyof Population] * number

                for(const it in requirements) {
                    industry.goodsRequirements[it as keyof Goods] = requirements[it as keyof Goods] * population.number + (industry.goodsRequirements[it as keyof Goods] ?? 0)
                }
            })

            industry.goodsChange = Object.entries(industry.goodsProduction).reduce((acc, [key, value]) => {
                acc[key as keyof Goods] = value - industry.goodsRequirements[key as keyof Goods]!
                return acc
            }, createStarterWarehouse(0))

            for(const it in industry.goods) {
                industry.goods[it as keyof Goods] += industry.goodsChange[it as keyof Goods]
            }
        }
    }

    addToEngine(engine: Engine): this {
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
