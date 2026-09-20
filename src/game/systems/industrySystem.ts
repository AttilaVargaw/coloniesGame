import { Entity } from "@/engine/entities/entity";
import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { IndustrialSectors } from "../components/Factories";
import type { IndustryTickInput, IndustryTickResult } from "../workers/industryTick.worker";
import { UpgradeSectorCommand } from "../commands/UpgradeSectorCommand";
import { sectorUpgradeCosts } from "./sectorUpgradeCosts";

const workerUrl = new URL("../workers/industryTick.worker.ts", import.meta.url);

function createIndustryWorker(onMessage: MessageEventTarget<Worker>["onmessage"]) {
    const worker = new Worker(workerUrl, { type: "module" })

    worker.onmessage = onMessage
    worker.onerror = (event) => {
        console.error("Industry worker error:", event.message);
    };

    return worker;
}

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    private worker: Worker | null = null;

    private ensureWorker() {
        if(!this.worker) {
            this.worker = createIndustryWorker(this.handleWorkerMessage);
        }
    }

    private processUpgradeCommands() {
        const commands = this.engine?.getCommands(UpgradeSectorCommand);
        if (!commands) return;

        for (const cmd of [...commands]) {
            const upgradeCmd = cmd as UpgradeSectorCommand;
            const node = this.nodes.find(n => n.entity.id === upgradeCmd.entityId);
            if (!node) continue;

            this.tryUpgradeSector(node.entity, node.industry, upgradeCmd.sectorName);
        }
    }

    private processAutoUpgrades() {
        for (const { entity, industry } of this.nodes) {
            for (const sectorName of Object.keys(industry.autoUpgradeSectors) as (keyof IndustrialSectors)[]) {
                if (industry.autoUpgradeSectors[sectorName]) {
                    this.tryUpgradeSector(entity, industry, sectorName, true);
                }
            }
        }
    }

    private tryUpgradeSector(entity: Entity, industry: IndustryComponent, sectorName: keyof IndustrialSectors, requireProfit = false) {
        const currentLevel = industry.sectors[sectorName];
        const cost = Math.round(sectorUpgradeCosts[sectorName] * Math.max(1, currentLevel));

        if (requireProfit) {
            const lastProfit = industry.sectorProfits[sectorName] ?? 0;
            if (lastProfit <= 0) return;
        }

        if (industry.sectorWealth[sectorName] >= cost) {
            industry.sectorWealth[sectorName] -= cost;
            industry.sectors = {
                ...industry.sectors,
                [sectorName]: currentLevel + 1,
            };
            this.engine?.reindexEntity(entity);
        }
    }

    private handleWorkerMessage = (event: MessageEvent<{ type: string; results: IndustryTickResult[] }>) => {
        if(event.data.type !== "result") {
            return
        }

        const resultsMap = new Map(event.data.results.map((r) => [r.entityId, r]));

        for(const { entity, industry } of this.nodes) {
            const result = resultsMap.get(entity.id);
            if(!result) continue;

            industry.goodsRequirements = result.goodsRequirements;
            industry.goodsProduction = result.goodsProduction;
            industry.workingWorkers = result.workingWorkers;
            industry.freeWorkers = result.freeWorkers;

            for(const [key, update] of Object.entries(result.populationUpdates) as [keyof Population, IndustryTickResult["populationUpdates"][keyof Population]][]) {
            const pop = industry.population[key];
            if(!pop) continue;

            pop.qol = update.qol;
            pop.expectedQol = update.expectedQol;
            pop.populationChange = update.populationChange;
            pop.wealth = Math.max(0, update.wealth);
            const populationChange = Number.isFinite(update.populationChange) ? update.populationChange : 0;
            pop.number = Math.max(0, pop.number + populationChange);
            }

            for (const [sector, profit] of Object.entries(result.sectorProfits)) {
                const sectorKey = sector as keyof IndustrialSectors;
                const maintenance = result.sectorMaintenance?.[sectorKey] ?? 0;
                const currentWealth = industry.sectorWealth[sectorKey] ?? 0;
                const targetWealth = Math.max(0, currentWealth + profit - maintenance);
                const sectorWealthSmoothing = 0.5;
                const smoothedWealth = currentWealth + (targetWealth - currentWealth) * sectorWealthSmoothing;
                industry.sectorWealth[sectorKey] = smoothedWealth;
                industry.sectorProfits[sectorKey] = profit;

                const currentLevel = industry.sectors[sectorKey];
                if (currentLevel > 1 && smoothedWealth < maintenance * 3) {
                    industry.sectors = {
                        ...industry.sectors,
                        [sectorKey]: currentLevel - 1,
                    };
                    industry.sectorWealth[sectorKey] = Math.max(0, smoothedWealth - Math.round(maintenance * 0.5));
                }
            }

            for (const [group, profit] of Object.entries(result.populationProfits)) {
                const groupKey = group as keyof Population;
                industry.populationProfits[groupKey] = profit;
            }

            for (const [sector, utilization] of Object.entries(result.sectorUtilization)) {
                const sectorKey = sector as keyof IndustrialSectors;
                industry.sectorUtilization[sectorKey] = utilization;
            }

            industry.sectorResults = result.sectorResults;

            industry.populationRequirements = {} as Record<keyof Population, Partial<Record<keyof Goods, number>>>;
            for(const [key, update] of Object.entries(result.populationUpdates)) {
                industry.populationRequirements[key as keyof Population] = update.requirements as Partial<Record<keyof Goods, number>>;
            }

            industry.goodsChange = result.goodsChange;
            for(const it in industry.goods) {
                industry.goods[it as keyof Goods] = Math.max(0, industry.goods[it as keyof Goods] + industry.goodsChange[it as keyof Goods]);
            }

            this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity));
        }
    };

    private onDayPassed = () => {
        this.processUpgradeCommands();
        this.processAutoUpgrades();
        this.ensureWorker();

        const industries: IndustryTickInput[] = [];
        for(const { entity, industry } of this.nodes) {
            industries.push({
                entityId: entity.id,
                sectors: industry.sectors,
                goods: { ...industry.goods },
                population: structuredClone(industry.population),
                sectorWealth: { ...industry.sectorWealth },
            });
        }

        this.worker!.postMessage({ type: "tick", industries });
    };

    removeFromEngine(): this {
        if(this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.engine?.unregisterNodeType(IndustryNode);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        super.removeFromEngine();
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(IndustryNode,
            new Set([IndustryComponent]),
            (entity) => new IndustryNode(
                entity.getComponent(IndustryComponent)!,
                entity
            )
        ).subscribe(DayPassedEvent, this.onDayPassed);
        engine.registerCommandQueue(UpgradeSectorCommand);
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }
}
