import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";
import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import type { IndustryTickPatch } from "../workers/IndustryTickPatch";
import type { IndustryTickInput } from "../workers/IndustryTickInput";
import type { SectorResult } from "../systems/generateIndustrialSector";
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

        this.workerPool?.tick(industries);
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
    mergeRecord(industry.goods, patch.goods)
    mergeRecord(industry.goodsRequirements, patch.goodsRequirements)
    mergeRecord(industry.goodsProduction, patch.goodsProduction)
    mergeRecord(industry.sectorProfits, patch.sectorProfits)
    mergeRecord(industry.populationProfits, patch.populationProfits)
    mergeRecord(industry.sectorUtilization, patch.sectorUtilization)
    mergeRecord(industry.sectorWealth, patch.sectorWealth)
    mergeRecord(industry.sectorCapital, patch.sectorCapital)

    mergeWorkerRecord(industry.workingWorkers, patch.workingWorkers)
    mergeWorkerRecord(industry.freeWorkers, patch.freeWorkers)

    applyPopulationPatch(industry, patch.populationUpdates)

    applySectorResultsPatch(industry, patch.sectorResults)

    if(patch.sectors) {
        industry.sectors = { ...industry.sectors, ...patch.sectors }
    }
}

function mergeRecord<T extends Record<string, any>>(
    target: T,
    patch: Partial<T> | undefined
) {
    if(!patch) return
    for(const key in patch) {
        target[key as keyof T] = patch[key as keyof T]!
    }
}

function mergeWorkerRecord(
    target: Record<keyof Population, PopulationBreakdown>,
    patch: Partial<Record<keyof Population, Partial<PopulationBreakdown>>> | undefined
) {
    if(!patch) return
    for(const key in patch) {
        const update = patch[key as keyof Population]!
        target[key as keyof Population] = {
            ...target[key as keyof Population],
            ...update,
        }
    }
}

function applyPopulationPatch(
    industry: IndustryComponent,
    updates: Partial<Record<keyof Population, {
        qol?: number
        expectedQol?: number
        populationChange?: number
        wealth?: number
        number?: number
        requirements?: Partial<Goods>
    }>> | undefined
) {
    if(!updates) return

    for(const [key, update] of Object.entries(updates)) {
        const pop = industry.population[key as keyof Population]
        if(!pop) continue

        if(update.qol !== undefined) pop.qol = update.qol
        if(update.expectedQol !== undefined) pop.expectedQol = update.expectedQol
        if(update.populationChange !== undefined) pop.populationChange = update.populationChange
        if(update.wealth !== undefined) pop.wealth = update.wealth
        if(update.number !== undefined) pop.number = update.number
    }

    industry.populationRequirements = {} as Record<keyof Population, Partial<Record<keyof Goods, number>>>
    for(const [key, update] of Object.entries(updates)) {
        industry.populationRequirements[key as keyof Population] = update.requirements ?? {}
    }
}

function applySectorResultsPatch(
    industry: IndustryComponent,
    results: { changed: Record<string, SectorResult>; removed: string[] } | undefined
) {
    if(!results) return

    for(const [name, sector] of Object.entries(results.changed)) {
        industry.sectorResults[name] = sector
    }
    for(const name of results.removed) {
        delete industry.sectorResults[name]
    }
}
