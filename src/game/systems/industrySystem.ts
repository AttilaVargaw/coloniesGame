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
import { sectorUpgradeCosts } from "../systems/factoryBlueprints";

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

            const industry = node.industry;
            const sectorName = upgradeCmd.sectorName;
            const currentLevel = industry.sectors[sectorName];
            const cost = Math.round(sectorUpgradeCosts[sectorName] * currentLevel);

            if (industry.sectorWealth[sectorName] >= cost) {
                industry.sectorWealth[sectorName] -= cost;
                industry.sectors = {
                    ...industry.sectors,
                    [sectorName]: currentLevel + 1,
                };
            }
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
                pop.populationChange = update.populationChange;
                pop.wealth = update.wealth;
            }

            for (const [sector, profit] of Object.entries(result.sectorProfits)) {
                const sectorKey = sector as keyof IndustrialSectors;
                industry.sectorWealth[sectorKey] = (industry.sectorWealth[sectorKey] ?? 0) + profit;
                industry.sectorProfits[sectorKey] = profit;
            }

            industry.goodsChange = result.goodsChange;
            for(const it in industry.goods) {
                industry.goods[it as keyof Goods] += industry.goodsChange[it as keyof Goods];
            }

            this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity));
        }
    };

    private onDayPassed = () => {
        this.processUpgradeCommands();
        this.ensureWorker();

        const industries: IndustryTickInput[] = [];
        for(const { entity, industry } of this.nodes) {
            industries.push({
                entityId: entity.id,
                sectors: industry.sectors,
                goods: { ...industry.goods },
                population: structuredClone(industry.population),
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
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }
}
