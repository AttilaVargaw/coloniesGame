import { EntityComponent } from "@engine/entities/entityComponent";
import { Goods } from "../data/Goods";
import { Population, baseSalaries } from "../data/Population";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import type { SectorResult } from "../systems/generateIndustrialSector";
import { ColonyType } from "../constants";
import type { IndustrialSectors } from "./Factories";
import { industrySectorBlueprints } from "../systems/sectorBlueprints";

export type SettlementType = "colony" | "outpost" | "hydrocarbonRefinery";

// Producer inventories track goods produced by each sector for source-aware procurement
// Key: producer sector name, Value: goods quantities
export type ProducerInventories = Record<string, Partial<Record<keyof Goods, number>>>;

export class IndustryComponent extends EntityComponent {
    public goodsChange: Goods
    public populationChange: Population
    public goodsRequirements: Partial<Goods>
    public goodsProduction: Partial<Goods>
    public workingWorkers: Population
    public freeWorkers: Population
    public sectorUtilization: Record<keyof IndustrialSectors, number>
    public sectorStopReason: Record<keyof IndustrialSectors, string>
    public sectorResults: Map<string, SectorResult>
    public sectorProfits: Record<keyof IndustrialSectors, number>
    public sectorRevenue: Record<keyof IndustrialSectors, number>
    public sectorLaborCosts: Record<keyof IndustrialSectors, number>
    public sectorInputCosts: Record<keyof IndustrialSectors, number>
    public populationProfits: Record<keyof Population, number>
    public wages: Record<keyof Population, number>
    public populationRequirements: Record<keyof Population, Partial<Record<keyof Goods, number>>>
    public techMultipliers: Record<keyof IndustrialSectors, number>
    public laborAssigned: Record<keyof IndustrialSectors, number>
    public activeSectors: Set<keyof IndustrialSectors>
    public capitalStock: Record<keyof IndustrialSectors, Partial<Goods>>
    public money: Record<keyof IndustrialSectors, number>
    // public sectorGoods: Partial<Record<keyof IndustrialSectors, Partial<Goods>>>

    // Producer inventories for source-aware procurement
    public producerInventories: ProducerInventories = {};

    // ---- Gamification fields ----
    public workerEfficiencyMultipliers: Record<keyof Population, number>
    public materialRequirementMultipliers: Record<keyof Goods, number>
    public capitalMultipliers: Record<keyof IndustrialSectors, number>
    public selectedMethod: Record<keyof IndustrialSectors, string | null>
    public sectorInvestment: Record<keyof IndustrialSectors, number>
    public activeLaws: Set<string>
    public householdMoney: number = 0

    constructor(
        public activeSectorKeys: Set<keyof IndustrialSectors>,
        public readonly goods: Goods,
        public readonly population: Population,
        public colonyType: ColonyType,
        public settlementType: SettlementType = "colony",
        public starterMoney: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>,
        public starterCapitalStock: Partial<Record<keyof IndustrialSectors, Partial<Goods>>> = {},
        public colonyTreasury: number = 0,
        public starterSectorGoods: Record<keyof IndustrialSectors, Partial<Goods>>
    ) {
        super()
        this.householdMoney = 0;

        this.activeSectors = activeSectorKeys
        this.goodsChange = createEmptyWarehouse()
        this.populationChange = createStarterPopulation(0)
        this.goodsRequirements = createEmptyWarehouse()
        this.goodsProduction = createEmptyWarehouse()
        this.workingWorkers = createStarterPopulation(0)
        this.freeWorkers = createStarterPopulation(0)
        this.sectorUtilization = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.sectorStopReason = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, ""])
        ) as Record<keyof IndustrialSectors, string>;
        this.sectorResults = new Map();
        this.sectorProfits = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.sectorRevenue = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.sectorLaborCosts = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.sectorInputCosts = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.populationProfits = Object.fromEntries(
            Object.keys(population).map(key => [key, 0])
        ) as Record<keyof Population, number>;
        this.wages = Object.fromEntries(
            Object.keys(population).map(key => [key, baseSalaries[key as keyof Population] ?? 0])
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
            Array.from(activeSectorKeys).map(key => [key, starterCapitalStock[key] ?? {}])
        ) as Record<keyof IndustrialSectors, Partial<Goods>>;
        this.money = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, starterMoney[key] ?? 0])
        ) as Record<keyof IndustrialSectors, number>;
        // this.sectorGoods = starterSectorGoods || Object.fromEntries(
        //     Array.from(activeSectorKeys).map(key => [key, createStarterWarehouse(0)])
        // ) as Record<keyof IndustrialSectors, Goods>;

        this.workerEfficiencyMultipliers = Object.fromEntries(
            Object.keys(population).map(key => [key, 1])
        ) as Record<keyof Population, number>;
        this.materialRequirementMultipliers = Object.fromEntries(
            Object.keys(createEmptyWarehouse()).map(key => [key, 1])
        ) as Record<keyof Goods, number>;
        this.capitalMultipliers = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 1])
        ) as Record<keyof IndustrialSectors, number>;
        this.selectedMethod = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, industrySectorBlueprints.get(key)?.productionMethods?.keys().next().value ?? null])
        ) as Record<keyof IndustrialSectors, string | null>;
        this.sectorInvestment = Object.fromEntries(
            Array.from(activeSectorKeys).map(key => [key, 0])
        ) as Record<keyof IndustrialSectors, number>;
        this.activeLaws = new Set();
        this.producerInventories = {};
    }
}
