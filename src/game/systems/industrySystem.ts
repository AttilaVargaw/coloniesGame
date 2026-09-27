import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { IndustrialSectors } from "../components/Factories";
import type { IndustryTickInput, IndustryTickPatch } from "../workers/industryTick.worker";
import { UpgradeSectorCommand } from "../commands/UpgradeSectorCommand";
import { IndustryWorkerPool } from "./industryWorkerPool";

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    private workerPool: IndustryWorkerPool | null = null;

    private ensureWorkerPool() {
        if(!this.workerPool) {
            this.workerPool = new IndustryWorkerPool({
                workerCount: Math.min(navigator.hardwareConcurrency || 4, 8),
                onMessage: this.handleWorkerMessage,
                onError: (message) => console.error("Industry worker pool error:", message),
            });
            this.workerPool.start();
        }
    }

    private handleWorkerMessage = (event: { type: string; patches: IndustryTickPatch[] }) => {
        if(event.type !== "result") {
            return
        }

        const patchesMap = new Map(event.patches.map((r) => [r.entityId, r]));

        for(const { entity, industry } of this.nodes) {
            const patch = patchesMap.get(entity.id);
            if(!patch) continue;

            applyPatch(industry, patch);
            this.engine?.reindexEntity(entity);
            this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity));
        }
    };

    private onDayPassed = () => {
        this.ensureWorkerPool();

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

        this.workerPool!.tick(industries);
    };

    removeFromEngine(): this {
        if(this.workerPool) {
            this.workerPool.terminate();
            this.workerPool = null;
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

function applyPatch(industry: IndustryComponent, patch: IndustryTickPatch) {
    if(patch.goods) {
        for(const key in patch.goods) {
            industry.goods[key as keyof Goods] = patch.goods[key as keyof Goods]!;
        }
    }

    if(patch.goodsRequirements) {
        for(const key in patch.goodsRequirements) {
            industry.goodsRequirements[key as keyof Goods] = patch.goodsRequirements[key as keyof Goods]!;
        }
    }

    if(patch.goodsProduction) {
        for(const key in patch.goodsProduction) {
            industry.goodsProduction[key as keyof Goods] = patch.goodsProduction[key as keyof Goods]!;
        }
    }

    if(patch.workingWorkers) {
        for(const key in patch.workingWorkers) {
            const update = patch.workingWorkers[key as keyof Population]!;
            industry.workingWorkers[key as keyof Population] = {
                ...industry.workingWorkers[key as keyof Population],
                ...update,
            };
        }
    }

    if(patch.freeWorkers) {
        for(const key in patch.freeWorkers) {
            const update = patch.freeWorkers[key as keyof Population]!;
            industry.freeWorkers[key as keyof Population] = {
                ...industry.freeWorkers[key as keyof Population],
                ...update,
            };
        }
    }

    if(patch.populationUpdates) {
        for(const [key, update] of Object.entries(patch.populationUpdates)) {
            const pop = industry.population[key as keyof Population];
            if(!pop) continue;

            if(update.qol !== undefined) pop.qol = update.qol;
            if(update.expectedQol !== undefined) pop.expectedQol = update.expectedQol;
            if(update.populationChange !== undefined) pop.populationChange = update.populationChange;
            if(update.wealth !== undefined) pop.wealth = update.wealth;
            if(update.number !== undefined) pop.number = update.number;
        }

        industry.populationRequirements = {} as Record<keyof Population, Partial<Record<keyof Goods, number>>>;
        for(const [key, update] of Object.entries(patch.populationUpdates)) {
            industry.populationRequirements[key as keyof Population] = update.requirements ?? {};
        }
    }

    if(patch.sectorProfits) {
        for(const [sector, profit] of Object.entries(patch.sectorProfits)) {
            industry.sectorProfits[sector as keyof IndustrialSectors] = profit;
        }
    }

    if(patch.populationProfits) {
        for(const [group, profit] of Object.entries(patch.populationProfits)) {
            industry.populationProfits[group as keyof Population] = profit;
        }
    }

    if(patch.sectorUtilization) {
        for(const [sector, utilization] of Object.entries(patch.sectorUtilization)) {
            industry.sectorUtilization[sector as keyof IndustrialSectors] = utilization;
        }
    }

    if(patch.sectorResults) {
        for(const [name, sector] of Object.entries(patch.sectorResults.changed)) {
            industry.sectorResults[name] = sector;
        }
        for(const name of patch.sectorResults.removed) {
            delete industry.sectorResults[name];
        }
    }

    if(patch.sectors) {
        const updated = { ...industry.sectors };
        for(const [sector, level] of Object.entries(patch.sectors)) {
            updated[sector as keyof IndustrialSectors] = level;
        }
        industry.sectors = updated;
    }

    if(patch.sectorWealth) {
        for(const [sector, wealth] of Object.entries(patch.sectorWealth)) {
            industry.sectorWealth[sector as keyof IndustrialSectors] = wealth;
        }
    }

    if(patch.sectorCapital) {
        for(const [sector, capital] of Object.entries(patch.sectorCapital)) {
            industry.sectorCapital[sector as keyof IndustrialSectors] = capital;
        }
    }
}
