import type { IndustrialSectors } from "../components/Factories";
import { SettlementType } from "../components/industryComponent";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import type { IndustryTickInput } from "../workers/IndustryTickInput";
import { ColonyConfig, DEFAULT_CONFIG, seedCapitalStock } from "./economyConfigGenerator";

export function generateColonyConfig(
	config: Partial<ColonyConfig> = {},
	capitalStockMultipliers?: Partial<Record<keyof IndustrialSectors, number>>,
	occupationStarterRatioOverride?: Partial<Record<keyof Population, number>>
): IndustryTickInput {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const { populationSize, activeSectors, starterMoneyPerSector, capitalStockMultiplier } = cfg;

	const goods = createStarterWarehouse(populationSize);
	for(const key of Object.keys(goods) as (keyof Goods)[]) {
		goods[key] *= cfg.initialGoodsMultipliers.get(key) ?? 50_000;
	}
	const population = createStarterPopulation(populationSize, occupationStarterRatioOverride);

	const money: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const capitalStock: Record<keyof IndustrialSectors, Partial<Goods>> = {} as Record<keyof IndustrialSectors, Partial<Goods>>;
	const techMultipliers: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const sectorInvestment: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const selectedMethod: Record<keyof IndustrialSectors, string | null> = {} as Record<keyof IndustrialSectors, string | null>;

	for(const sector of activeSectors) {
		const sectorMultiplier = capitalStockMultipliers?.[sector] ?? capitalStockMultiplier;
		money[sector] = starterMoneyPerSector * sectorMultiplier;
		capitalStock[sector] = seedCapitalStock(sector, sectorMultiplier);
		techMultipliers[sector] = 1;
		sectorInvestment[sector] = 0;
		selectedMethod[sector] = null;
	}

	return {
		entityId: "test-colony",
		activeSectors: new Set(activeSectors),
		goods,
		population,
		techMultipliers,
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
		tick: 0,
		producerInventories: {},
	};
}
