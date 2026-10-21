import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";
import { Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import type { IndustryTickPatch } from "../workers/IndustryTickPatch";
import type { SectorResult } from "../systems/generateIndustrialSector";
import { IndustryWorkerPool } from "./industryWorkerPool";
import type { IndustrialSectors } from "../components/Factories";

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    // eslint-disable-next-line class-methods-use-this,no-empty-function
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
            if(!patch) {
                continue
            }

            applyPatch(industry, patch);
            this.engine?.reindexEntity(entity);
            this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity));
        }
    };

    private onDayPassed = () => {
        this.ensureWorkerPool();

        const industries = this.nodes.map(({ entity, industry }) => {
            const techMultipliers: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
            const laborAssigned: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
            const capitalStock: Record<keyof IndustrialSectors, Partial<Goods>> = {} as Record<keyof IndustrialSectors, Partial<Goods>>;

            for(const sectorKey of industry.activeSectors) {
                techMultipliers[sectorKey] = industry.techMultipliers[sectorKey] ?? 1;
                laborAssigned[sectorKey] = industry.laborAssigned[sectorKey] ?? 0;
                capitalStock[sectorKey] = industry.capitalStock[sectorKey] ?? {};
            }

            return {
                entityId: entity.id,
                activeSectors: industry.activeSectors,
                goods: industry.goods,
                population: industry.population,
                techMultipliers,
                laborAssigned,
                capitalStock,
                settlementType: industry.settlementType,
                allowedSectors: [...industry.activeSectors]
            };
        });

        this.workerPool?.tick(industries);
    };

    removeFromEngine(): this {
        if(this.workerPool) {
            this.workerPool.terminate();
            this.workerPool = null;
        }
        this.engine?.unregisterNodeType(IndustryNode);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
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
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }
}

function applyPatch(industry: IndustryComponent, patch: IndustryTickPatch) {
    for(const key in patch.goods) {
        if(!NON_CUMULATING_GOODS.has(key as keyof Goods)) {
            continue
        }

        patch.goods[key as keyof Goods] = (patch.goodsProduction?.[key as keyof Goods] || 0) - (patch.goodsRequirements?.[key as keyof Goods] || 0)
    }

    mergeRecord(industry.goods, patch.goods)
    mergeRecord(industry.goodsRequirements, patch.goodsRequirements)
    mergeRecord(industry.goodsProduction, patch.goodsProduction)
    mergeRecord(industry.sectorProfits, patch.sectorProfits)
    mergeRecord(industry.populationProfits, patch.populationProfits)
    mergeRecord(industry.sectorUtilization, patch.sectorUtilization)
    mergeRecord(industry.capitalStock, patch.capitalStock)

    mergeWorkerRecord(industry.workingWorkers, patch.workingWorkers)
    mergeWorkerRecord(industry.freeWorkers, patch.freeWorkers)

    applyPopulationPatch(industry, patch.populationUpdates)

    applySectorResultsPatch(industry, patch.sectorResults)
}

function mergeRecord<T extends Record<string, any>>(
    target: T,
    patch?: Partial<T>
) {
    if(!patch) return
    for(const key in patch) {
        target[key as keyof T] = patch[key as keyof T]!
    }
}

function mergeWorkerRecord(
    target: Record<keyof Population, PopulationBreakdown>,
    patch?: Partial<Record<keyof Population, Partial<PopulationBreakdown>>>
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
    if(!results) {
        return
    }

    for(const [name, sector] of Object.entries(results.changed)) {
        industry.sectorResults[name] = sector
    }
    for(const name of results.removed) {
        delete industry.sectorResults[name]
    }
}
