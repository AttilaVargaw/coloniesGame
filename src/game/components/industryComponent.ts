import { EntityComponent } from "@engine/entities/entityComponent";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import type { SectorResult } from "../systems/generateIndustrialSector";
import { ColonyType } from "../constants";
import type { IndustrialSectors } from "./Factories";

export type SettlementType = "colony" | "outpost" | "hydrocarbonRefinery";

export class IndustryComponent extends EntityComponent {
    public goodsChange: Goods
    public populationChange: Population
    public goodsRequirements: Partial<Goods>
    public goodsProduction: Partial<Goods>
    public workingWorkers: Population
    public freeWorkers: Population
    public sectorUtilization: Record<keyof IndustrialSectors, number>
    public sectorResults: Record<string, SectorResult>
    public sectorProfits: Record<keyof IndustrialSectors, number>
    public populationProfits: Record<keyof Population, number>
    public populationRequirements: Record<keyof Population, Partial<Record<keyof Goods, number>>>
    public techMultipliers: Record<keyof IndustrialSectors, number>
    public laborAssigned: Record<keyof IndustrialSectors, number>
    public activeSectors: Set<keyof IndustrialSectors>
    public capitalStock: Record<keyof IndustrialSectors, Partial<Goods>>

    constructor(
        public activeSectorKeys: Set<keyof IndustrialSectors>,
        public readonly goods: Goods,
        public readonly population: Population,
        public colonyType: ColonyType,
        public settlementType: SettlementType = "colony",
    ) {
        super()

        this.activeSectors = activeSectorKeys
        this.goodsChange = createStarterWarehouse(0)
        this.populationChange = createStarterPopulation(0)
        this.goodsRequirements = createStarterWarehouse(0)
        this.goodsProduction = createStarterWarehouse(0)
        this.workingWorkers = createStarterPopulation(0)
        this.freeWorkers = createStarterPopulation(0)
        this.sectorUtilization = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.sectorResults = {};
        this.sectorProfits = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.populationProfits = Object.fromEntries(
            Object.keys(population).map(key => [key, 0])
        ) as Record<keyof Population, number>;
        this.populationRequirements = Object.fromEntries(
            Object.keys(population).map(key => [key, {}])
        ) as Record<keyof Population, Partial<Record<keyof Goods, number>>>;
        this.techMultipliers = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 1])
        ) as Record<keyof IndustrialSectors, number>;
        this.laborAssigned = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.capitalStock = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, {}])
        ) as Record<keyof IndustrialSectors, Partial<Goods>>;
    }
}
