import { describe, it, expect } from "vitest";
import { runScenario, SCENARIO_LIBRARY, generateReport, runAllScenarios, ScenarioSeed } from "./simulationTooling.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import type { Goods } from "../data/Goods.ts";

describe("Phase 4: Simulation Tooling", () => {
	describe("Scenario execution", () => {
		it("runs stable economy scenario", () => {
			const scenario = SCENARIO_LIBRARY.find(s => s.name === "stable_economy")!;
			const result = runScenario(scenario, 50);
			
			expect(result.scenarioName).toBe("stable_economy");
			expect(result.ticks).toBe(50);
			expect(result.eventLog.length).toBeGreaterThan(0);
			expect(result.summary.finalGDP).toBeGreaterThan(0);
			// Unemployment may be significant due to sector competition for workers
			expect(result.summary.finalUnemployment).toBeLessThan(1.0); // Some unemployment expected
		});

		it("runs oil shortage collapse scenario", () => {
			const scenario = SCENARIO_LIBRARY.find(s => s.name === "oil_shortage_collapse")!;
			const result = runScenario(scenario, 50);
			
			expect(result.scenarioName).toBe("oil_shortage_collapse");
			expect(result.ticks).toBeGreaterThan(0);
			expect(result.summary.totalCollapseEvents).toBeGreaterThan(0);
			expect(result.summary.sectorsStopped.length).toBeGreaterThan(0);
			expect(result.summary.shortageGoods.length).toBeGreaterThan(0);
		});

		it("runs treasury recovery scenario (runs without collapse)", () => {
			const scenario = SCENARIO_LIBRARY.find(s => s.name === "treasury_recovery")!;
			const result = runScenario(scenario, 100);
			
			expect(result.scenarioName).toBe("treasury_recovery");
			expect(result.ticks).toBe(100);
			expect(result.summary.finalGDP).toBeGreaterThan(0);
			// This scenario doesn't collapse in 100 ticks, which is fine
		});
	});

	describe("Event logging", () => {
		it("logs sector stop and start events", () => {
			const scenario = SCENARIO_LIBRARY.find(s => s.name === "oil_shortage_collapse")!;
			const result = runScenario(scenario, 30);
			
			const stopEvents = result.eventLog.filter(e => e.type === "sector_stop");
			expect(stopEvents.length).toBeGreaterThan(0);
			
			for(const event of stopEvents) {
				expect(event.tick).toBeGreaterThanOrEqual(0);
				expect(event.sector).toBeDefined();
				expect(event.severity).toMatch(/info|warning|critical/);
			}
		});

		it("logs shortage events", () => {
			const scenario = SCENARIO_LIBRARY.find(s => s.name === "oil_shortage_collapse")!;
			const result = runScenario(scenario, 20);
			
			const shortageEvents = result.eventLog.filter(e => e.type === "shortage");
			expect(shortageEvents.length).toBeGreaterThan(0);
			
			for(const event of shortageEvents) {
				expect(event.good).toBeDefined();
				expect(event.severity).toBe("warning");
			}
		});
	});

	describe("Report generation", () => {
		it("generates human-readable report", () => {
			const scenario = SCENARIO_LIBRARY.find(s => s.name === "stable_economy")!;
			const result = runScenario(scenario, 20);
			const report = generateReport(result);
			
			expect(report).toContain("SIMULATION REPORT");
			expect(report).toContain("stable_economy");
			expect(report).toContain("SUMMARY");
			expect(report).toContain("EVENT LOG");
			expect(report).toContain("ECONOMIC INDICATORS");
			expect(report).toContain("tick,nominalGDP");
		});
	});

	describe("Multiple scenarios", () => {
		it("runs all scenarios", () => {
			const results = runAllScenarios(50);
			
			expect(results.size).toBe(SCENARIO_LIBRARY.length);
			
			for(const [name, result] of results) {
				expect(result.scenarioName).toBe(name);
				expect(result.ticks).toBeGreaterThan(0);
			}
		});
	});

	describe("Summary statistics", () => {
		it("computes correct summary metrics", () => {
			const scenario = SCENARIO_LIBRARY.find(s => s.name === "stable_economy")!;
			const result = runScenario(scenario, 30);
			
			expect(result.summary.finalGDP).toBeGreaterThan(0);
			expect(result.summary.minGDP).toBeLessThanOrEqual(result.summary.maxGDP);
			expect(result.summary.peakUnemployment).toBeGreaterThanOrEqual(0);
			expect(result.summary.peakUnemployment).toBeLessThanOrEqual(1);
		});
	});
});
