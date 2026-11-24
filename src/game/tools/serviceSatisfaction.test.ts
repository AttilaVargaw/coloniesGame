import { describe, it, expect } from "vitest";
import { generateValidatedColonyConfig, DEFAULT_CONFIG } from "./economyConfigGenerator.ts";
import { industrySectorBlueprints } from "../systems/sectorBlueprints.ts";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { computePopulationConsumption, ESSENTIAL_SERVICE_SECTORS } from "../workers/industryTickHelpers.ts";
import { baseSalaries, Population } from "../data/Population.ts";
import { basePrices } from "../data/Goods.ts";

describe("service satisfaction", () => {
    it("generator finds config where service production meets demand", () => {
        // Patch the generator to log attempts
        const originalGenerate = generateValidatedColonyConfig;
        const { config, validation } = generateValidatedColonyConfig(DEFAULT_CONFIG, { ticks: 50 });

        console.log("Validation:", validation.viable, "ticks:", validation.ticksSurvived);
        if(!validation.viable) {
            console.log("Failed good:", validation.failedGood);
            console.log("Failed sector:", validation.failedSector);
        }

        // Simulate one tick and check actual production
        const state = createSimState();
        const result = simulateTick(config, state);

        // Compute population consumption using base salaries
        const { populationConsumption } = computePopulationConsumption(config.population, baseSalaries, basePrices);

        console.log("\n--- Population Consumption ---");
        for(const [good, amount] of Object.entries(populationConsumption)) {
            console.log(`  ${good}: ${amount.toFixed(0)}`);
        }

        // Check service sector production
        console.log("\n--- Service Sector Production ---");
        const serviceProduction: Partial<Record<string, number>> = {};
        for(const sector of ESSENTIAL_SERVICE_SECTORS) {
            const sectorResult = result.sectorResults?.[sector];
            if(sectorResult?.producedGoods) {
                for(const [good, amount] of Object.entries(sectorResult.producedGoods)) {
                    serviceProduction[good] = (serviceProduction[good] ?? 0) + amount;
                }
            }
        }

        for(const [good, amount] of Object.entries(serviceProduction)) {
            console.log(`  ${good}: ${(amount ?? 0).toFixed(0)}`);
        }

        // Check satisfaction
        console.log("\n--- Satisfaction Check ---");
        for(const [good, demand] of Object.entries(populationConsumption)) {
            const supply = serviceProduction[good] ?? 0;
            const pct = demand > 0 ? (supply / demand * 100).toFixed(1) : "N/A";
            console.log(`  ${good}: demand=${demand.toFixed(0)}, supply=${supply.toFixed(0)}, ${pct}%`);
        }

        expect(validation.viable).toBe(true);
    });
});
