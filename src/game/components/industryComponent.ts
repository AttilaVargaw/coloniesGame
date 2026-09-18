import { EntityComponent } from "@engine/entities/entityComponent";
import { IndustrialSectors } from "./Factories";
import { Goods } from "../data/Goods";
import { Population, sumPopulation } from "../data/Population";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { createStarterSectorWealth } from "../factories/createStarterIndustry";

export type BuildOrder = {
    id: number
    name: string
    imageUrl: string
    totalDays: number
    remainingDays: number
    oreCost: number
    tyliumCost: number
    creditCost: number
    orePaid: number
    tyliumPaid: number
    creditsPaid: number
}

export class IndustryComponent extends EntityComponent {
    //public sectorChange = createStarterIndustry()
    public goodsChange: Goods
    public populationChange: Population
    public goodsRequirements: Partial<Goods>
    public goodsProduction: Partial<Goods>
    public workingWorkers: Population
    public freeWorkers: Population
    public sectorWealth: Record<keyof IndustrialSectors, number>
    public sectorProfits: Record<keyof IndustrialSectors, number>
    public populationProfits: Record<keyof Population, number>
    public autoUpgradeSectors: Partial<Record<keyof IndustrialSectors, boolean>>

    constructor(
        public sectors: IndustrialSectors,
        public readonly goods: Goods,
        public readonly population: Population,
    ) {
        super()

        this.goodsChange = createStarterWarehouse(sumPopulation(population))
        this.populationChange = createStarterPopulation(0)
        this.goodsRequirements = createStarterWarehouse(0)
        this.goodsProduction = createStarterWarehouse(0)
        this.workingWorkers = createStarterPopulation(0)
        this.freeWorkers = createStarterPopulation(0)
        this.sectorWealth = createStarterSectorWealth()
        this.sectorProfits = Object.fromEntries(
            Object.keys(sectors).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.populationProfits = Object.fromEntries(
            Object.keys(population).map(key => [key, 0])
        ) as Record<keyof Population, number>;
        this.autoUpgradeSectors = {}
    }
}
