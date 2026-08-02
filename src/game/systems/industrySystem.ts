import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";
import { getLowestRatio, Goods } from "../data/Goods";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { IndustrialSectors } from "../components/Factories";
import { Population } from "../data/Population";
import { createStarterPopulation } from "../data/getPopulationBreakdown";

export const generateIndustrialSector = ({ name, workerRequirement, goodsRequirements, goodsProduction }: { name: keyof Partial<IndustrialSectors>, workerRequirement: Partial<Population>, goodsRequirements: Partial<Goods>, goodsProduction: Partial<Goods> }) => {
    const reducer = ({ workerRatio, remainingWorkers, remainingGoods, sumGoodsProduction, sumGoodsRequirements, workingWorkers }: { remainingGoods: Goods, remainingWorkers: Population, workerRatio: number, sumGoodsRequirements: Partial<Goods>, sumGoodsProduction: Partial<Goods>, workingWorkers: Population }, sectorLevels: IndustrialSectors,) => {
        const lowestRatio = Math.min(
            getLowestRatio(workerRequirement, remainingWorkers, sectorLevels[name as keyof IndustrialSectors], workerRatio) || 0,
            getLowestRatio(goodsRequirements, remainingGoods, sectorLevels[name as keyof IndustrialSectors], workerRatio) || 0
        )

        const productionRatio = lowestRatio * sectorLevels[name as keyof IndustrialSectors]

        return {
            workingWorkers: {
                ...Object.entries(workerRequirement)
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: workingWorkers[key as keyof Population] + value * productionRatio }), workingWorkers)
            },
            remainingWorkers: {
                ...Object.entries(workerRequirement)
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: remainingWorkers[key as keyof Population] - value * productionRatio }), remainingWorkers)
            },
            remainingGoods: {
                ...Object.entries(goodsRequirements)
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: remainingGoods[key as keyof Goods] - value * productionRatio }), remainingGoods),
                ...Object.entries(goodsProduction)
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: remainingGoods[key as keyof Goods] + value * productionRatio }), remainingGoods),
            },
            sumGoodsRequirements: {
                ...Object.entries(goodsRequirements).reduce((acc, [key, value]) => ({
                    ...acc,
                    [key]: (acc[key as keyof Goods] ?? 0) + value * productionRatio
                }), sumGoodsRequirements)
            },
            sumGoodsProduction: {
                ...Object.entries(goodsProduction).reduce((acc, [key, value]) => ({
                    ...acc,
                    [key]: (acc[key as keyof Goods] ?? 0) + value * productionRatio
                }), sumGoodsProduction)
            }
        }
    }

    return reducer
}

type IndustryReducer = ReturnType<typeof generateIndustrialSector>
type IndustryReducerReturn = ReturnType<IndustryReducer>

const createIndustryReducers = {
    agriculturalFactory: generateIndustrialSector({ name: "agriculturalFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { agriculturalGoods: 1 } }),
    ammunitionFactory: generateIndustrialSector({ name: "ammunitionFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { ammunition: 1 } }),
    buildingSector: generateIndustrialSector({ name: "buildingSector", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    consumerFactory: generateIndustrialSector({ name: "consumerFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { consumerGoods: 1 } }),
    electricityFactory: generateIndustrialSector({ name: "electricityFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { electricity: 1 } }),
    foodFactory: generateIndustrialSector({ name: "foodFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { food: 1 } }),
    furnitureFactory: generateIndustrialSector({ name: "furnitureFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    machineryFactory: generateIndustrialSector({ name: "machineryFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { machinery: 1 } }),
    medicineFactory: generateIndustrialSector({ name: "medicineFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { medicine: 1 } }),
    metalFactory: generateIndustrialSector({ name: "metalFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: {} }),
    nuclearWeaponFactory: generateIndustrialSector({ name: "nuclearWeaponFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { nuclearWeapons: 1 } }),
    environmentFactor: generateIndustrialSector({ name: "environmentFactor", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { environmentFactor: 1 } }),
    forestry: generateIndustrialSector({ name: "forestry", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { wood: 1 } }),
    oilFactory: generateIndustrialSector({ name: "oilFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { oil: 1 } }),
    oilRig: generateIndustrialSector({ name: "oilRig", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { oil: 1 } }),
    orbitalBuildingSector: generateIndustrialSector({ name: "orbitalBuildingSector", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    orbitalFactory: generateIndustrialSector({ name: "orbitalFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    spaceport: generateIndustrialSector({ name: "spaceport", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    spaceTransport: generateIndustrialSector({ name: "spaceTransport", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    uraniumFactory: generateIndustrialSector({ name: "uraniumFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { uranium: 1 } }),
    weaponFactory: generateIndustrialSector({ name: "weaponFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { weapons: 1 } }),
    services: generateIndustrialSector({ name: "services", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { services: 1 } }),
    tourism: generateIndustrialSector({ name: "tourism", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { tourism: 1 } }),
    waterFactory: generateIndustrialSector({ name: "waterFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { water: 1 } }),
} satisfies Record<keyof IndustrialSectors, IndustryReducer>

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

            // const fertility = (industry.goods.happiness - 0.5) / 15000
            //industry.population.student += fertility * industry.population

            const { sumGoodsProduction, sumGoodsRequirements, workingWorkers, remainingWorkers } = Object.entries(createIndustryReducers).reduce((acc, [, reducer]) => reducer({
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
            //industry.goodsChange = remainingGoods
            industry.workingWorkers = workingWorkers
            industry.freeWorkers = remainingWorkers
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
