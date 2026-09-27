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
import { createIndustryWorker } from "./industryWorker";

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    private worker: Worker | null = null;

    private ensureWorker() {
        if(!this.worker) {
            this.worker = createIndustryWorker(this.handleWorkerMessage);
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

            applyResult(industry, result);
            this.engine?.reindexEntity(entity);
            this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity));
        }
    };

    private onDayPassed = () => {
        this.ensureWorker();

        const upgradeSectors: Record<string, string[]> = {};
        const autoUpgradeSectors: Record<string, Record<string, boolean>> = {};

        for(const { entity, industry } of this.nodes) {
            upgradeSectors[entity.id] = [];
            autoUpgradeSectors[entity.id] = { ...industry.autoUpgradeSectors };
        }

        const commands = this.engine?.getCommands(UpgradeSectorCommand);

        if(commands) {
            for(const cmd of [...commands]) {
                const list = upgradeSectors[cmd.entityId];
                if(!list) continue;

                const entity = this.nodes.find(n => n.entity.id === cmd.entityId);
                if(!entity) continue;

                const { settlementType, allowedSectors } = entity.industry;
                if((settlementType === "outpost" || settlementType === "hydrocarbonRefinery") && allowedSectors && !allowedSectors.includes(cmd.sectorName)) {
                    continue;
                }

                list.push(cmd.sectorName);
            }
        }

        commands.clear();

        const industries: IndustryTickInput[] = [];
        for(const { entity, industry } of this.nodes) {
            industries.push({
                entityId: entity.id,
                sectors: industry.sectors,
                goods: industry.goods,
                population: industry.population,
                sectorWealth: industry.sectorWealth,
                sectorCapital: industry.sectorCapital,
                upgradeSectors: upgradeSectors[entity.id],
                autoUpgradeSectors: autoUpgradeSectors[entity.id],
                settlementType: industry.settlementType,
                allowedSectors: industry.allowedSectors,
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
        this.engine?.removeCommandQueue(UpgradeSectorCommand);
        super.removeFromEngine();
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(
            IndustryNode,
            new Set([IndustryComponent]),
            (entity) => new IndustryNode(entity.getComponent(IndustryComponent)!, entity)
        ).subscribe(DayPassedEvent, this.onDayPassed);
        engine.registerCommandQueue(UpgradeSectorCommand);
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }
}

function applyResult(industry: IndustryComponent, result: IndustryTickResult) {
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
        pop.wealth = update.wealth;
        pop.number = update.number;
    }

    for(const [sector, profit] of Object.entries(result.sectorProfits)) {
        const sectorKey = sector as keyof IndustrialSectors;
        industry.sectorProfits[sectorKey] = profit;
    }

    for(const [group, profit] of Object.entries(result.populationProfits)) {
        const groupKey = group as keyof Population;
        industry.populationProfits[groupKey] = profit;
    }

    for(const [sector, utilization] of Object.entries(result.sectorUtilization)) {
        const sectorKey = sector as keyof IndustrialSectors;
        industry.sectorUtilization[sectorKey] = utilization;
    }

    industry.sectorResults = result.sectorResults;
    industry.sectorWealth = result.sectorWealth;
    industry.sectorCapital = result.sectorCapital;
    industry.sectors = result.sectors;

    industry.populationRequirements = {} as Record<keyof Population, Partial<Record<keyof Goods, number>>>;
    for(const [key, update] of Object.entries(result.populationUpdates)) {
        industry.populationRequirements[key as keyof Population] = update.requirements as Partial<Record<keyof Goods, number>>;
    }

    for(const key in result.goods) {
        industry.goods[key as keyof Goods] = result.goods[key as keyof Goods];
    }
}
