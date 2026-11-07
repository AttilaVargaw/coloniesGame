import { Goods } from "../data/Goods.ts";
import { Population } from "../data/Population.ts";
import { createStarterWarehouse } from "../factories/createStarterWarehouse.ts";
import { createStarterPopulation } from "../data/getPopulationBreakdown.ts";
import { industrySectorBlueprints } from "../systems/sectorBlueprints.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import { SettlementType } from "../components/industryComponent.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";

/**
 * A curated set of sectors that form a self-sustaining economy loop:
 * power → water → farm → food, mine → metal → construction, plus services.
 */
export const BASIC_SECTORS: (keyof IndustrialSectors)[] = [
	"mine",
	"oilRig",
	"forestry",
	"farm",
	"fishery",
	"foodFactory",
	"meat",
	"waterTreatment",
	"powerPlant",
	"nuclearSector",
	"metalFactory",
	"lumberMill",
	"machineryFactory",
	"medicineFactory",
	"consumerFactory",
	"furnitureFactory",
	"ammunitionFactory",
	"weaponFactory",
	"construction",
	"services",
	"tourism",
	"education",
	"healthcare",
	"chemical",
	"bank",
	"religion",
	"lawEnforcement",
	"alternativeMedicine",
	"recycling",
	"government",
	"automotive",
	"electronics",
	"railroadVehicles",
	"aircraft",
	"clothing",
	"ships",
	"postalServices",
	"paperFactory",
	"entertainmentIndustry",
	"informationTechnology",
	"drinkIndustry",
	"retail",
	"railroadInfrastructure",
	"shipInfrastructure",
	"aircraftInfrastructure",
	"automotiveInfrastructure",
	"defense",
	"militaryVehicles",
	"greenEnergy",
];

export interface ColonyConfig {
	populationSize: number;
	activeSectors: (keyof IndustrialSectors)[];
	starterMoneyPerSector: number;
	capitalStockMultiplier: number;
	initialGoodsMultiplier: number;
}

const DEFAULT_CONFIG: ColonyConfig = {
	populationSize: 50_000_000,
	activeSectors: BASIC_SECTORS,
	starterMoneyPerSector: 50_000_000,
	capitalStockMultiplier: 1,
	initialGoodsMultiplier: 50_000,
};

/** Seed capital stock so capitalRatio doesn't start at 0. */
function seedCapitalStock(
	sector: keyof IndustrialSectors,
	multiplier: number
): Partial<Goods> {
	const config = industrySectorBlueprints.get(sector);
	if(!config?.capitalGoods) return {};

	const stock: Partial<Goods> = {};
	for(const [goodKey, requiredPerUnit] of Object.entries(config.capitalGoods)) {
		stock[goodKey as keyof Goods] = requiredPerUnit * multiplier;
	}
	return stock;
}

export function generateColonyConfig(config: Partial<ColonyConfig> = {}): IndustryTickInput {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const { populationSize, activeSectors, starterMoneyPerSector, capitalStockMultiplier } = cfg;

	const goods = createStarterWarehouse(populationSize);
	// Scale initial goods to give the economy a buffer before first production cycle
	for(const key of Object.keys(goods) as (keyof Goods)[]) {
		goods[key] *= cfg.initialGoodsMultiplier;
	}
	const population = createStarterPopulation(populationSize);

	const money: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const capitalStock: Record<keyof IndustrialSectors, Partial<Goods>> = {} as Record<keyof IndustrialSectors, Partial<Goods>>;
	const techMultipliers: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const laborAssigned: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const sectorInvestment: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const selectedMethod: Record<keyof IndustrialSectors, string | null> = {} as Record<keyof IndustrialSectors, string | null>;

	for(const sector of activeSectors) {
		money[sector] = starterMoneyPerSector;
		capitalStock[sector] = seedCapitalStock(sector, capitalStockMultiplier);
		techMultipliers[sector] = 1;
		laborAssigned[sector] = 0;
		sectorInvestment[sector] = 0;
		selectedMethod[sector] = null;
	}

	return {
		entityId: "test-colony",
		activeSectors: new Set(activeSectors),
		goods,
		population,
		techMultipliers,
		laborAssigned,
		capitalStock,
		money,
		settlementType: "colony" as SettlementType,
		allowedSectors: [...activeSectors],
		workerEfficiencyMultipliers: Object.fromEntries(
			Object.keys(population).map((k) => [k, 1])
		) as Record<keyof Population, number>,
		materialRequirementMultipliers: Object.fromEntries(
			Object.keys(goods).map((k) => [k, 1])
		) as Record<keyof Goods, number>,
		capitalMultipliers: Object.fromEntries(
			Array.from(activeSectors).map((k) => [k, 1])
		) as Record<keyof IndustrialSectors, number>,
		selectedMethod,
		colonyTreasury: 0,
		sectorInvestment,
		activeLaws: new Set(),
	};
}

const numSectors = BASIC_SECTORS.length;

export function generateRandomConfig(seed: number, populationSize: number): IndustryTickInput {
	let s = seed;
	const next = () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};

	const starterMoneyPerSector = Math.round(1_000_000 + next() * 10_000_000);
	const capitalStockMultiplier = 1 + next() * 20;

	const shuffled = [...BASIC_SECTORS].sort(() => next() - 0.5);
	const count = Math.floor(numSectors + next() * (shuffled.length - numSectors + 1));
	const activeSectors = shuffled.slice(0, count);

	return generateColonyConfig({
		populationSize,
		activeSectors,
		starterMoneyPerSector,
		capitalStockMultiplier,
		initialGoodsMultiplier: 500,
	});
}
