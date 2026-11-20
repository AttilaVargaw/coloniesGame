import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { IndustryTickCompletedEvent } from "@/engine/lib/events/IndustryTickCompletedEvent";
import { Engine } from "@/engine/core/engine";
import { Goods, NON_CUMULATING_GOODS, basePrices } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import type { IndustryTickPatch } from "../workers/IndustryTickPatch";
import type { SectorResult } from "../systems/generateIndustrialSector";
import { IndustryWorkerPool } from "./industryWorkerPool";
import { MarketPriceSystem } from "./MarketPriceSystem";
import type { IndustrialSectors } from "../components/Factories";
import { laws } from "./laws";
import { PriceSnapshot } from "../workers/IndustryTickInput";

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    // eslint-disable-next-line class-methods-use-this,no-empty-function
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    private workerPool: IndustryWorkerPool | null = null;
    private tickCounter = 0;
    private latestAppliedTick = new Map<string, number>();

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

    private getPriceSnapshot(entityId: string): PriceSnapshot {
        const marketPriceSystem = this.engine?.getSystem(MarketPriceSystem);
        if (!marketPriceSystem) {
            // Fallback to base prices if MarketPriceSystem not registered
            return {
                entityId,
                sourceTick: 0,
                effectiveTick: 1,
                prices: { ...basePrices },
            };
        }
        const committed = marketPriceSystem.getCommittedPrices(entityId);
        if (committed) {
            return {
                entityId: committed.entityId,
                sourceTick: committed.sourceTick,
                effectiveTick: committed.effectiveTick,
                prices: committed.prices,
            };
        }
        return {
            entityId,
            sourceTick: 0,
            effectiveTick: 1,
            prices: { ...basePrices },
        };
    }

    private handleWorkerMessage = (event: { type: string; tick: number; patches: IndustryTickPatch[] }) => {
        if(event.type !== "result") {
            return
        }

        const patchesMap = new Map(event.patches.map((r) => [r.entityId, r]));

        for(const { entity, industry } of this.nodes) {
            const patch = patchesMap.get(entity.id);
            if(!patch) {
                continue
            }

            // Reject stale patches from previous ticks
            const lastTick = this.latestAppliedTick.get(entity.id) ?? -1;
            if(patch.tick <= lastTick) {
                continue;
            }

            applyPatch(industry, patch);
            this.latestAppliedTick.set(entity.id, patch.tick);
            this.engine?.reindexEntity(entity);

            // Emit tick-completed event with metrics for economic history
            if (patch.metrics) {
                this.engine?.dispatchEvent(
                    new IndustryTickCompletedEvent({
                        entity,
                        tick: patch.tick,
                        metrics: patch.metrics,
                    })
                );
            }

            // Emit general update event for UI/reactivity
            this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity));
        }
    };

    private onDayPassed = () => {
        this.ensureWorkerPool();
        this.tickCounter++;

        const industries = this.nodes.map(({ entity, industry }) => {
            const techMultipliers: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
            const capitalStock: Record<keyof IndustrialSectors, Partial<Goods>> = {} as Record<keyof IndustrialSectors, Partial<Goods>>;
            const money = industry.money;
            const sectorGoods = {} as Record<keyof IndustrialSectors, Goods>;

            const bannedSectors = new Set<keyof IndustrialSectors>();
            const lawMultiplier: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
            for(const sectorKey of industry.activeSectors) {
                lawMultiplier[sectorKey] = 1;
            }
            for(const lawId of industry.activeLaws) {
                const law = laws.get(lawId);
                if(!law) continue;
                for(const effect of law.effects) {
                    if(effect.type === "disable_sector" && effect.sector) {
                        bannedSectors.add(effect.sector as keyof IndustrialSectors);
                    }
                    if(effect.type === "efficiency_penalty" && effect.sector) {
                        const s = effect.sector as keyof IndustrialSectors;
                        lawMultiplier[s] = (lawMultiplier[s] ?? 1) * effect.value;
                    }
                }
            }
            const effectiveActiveSectors = new Set([...industry.activeSectors].filter(s => !bannedSectors.has(s)));

            for(const sectorKey of effectiveActiveSectors) {
                techMultipliers[sectorKey] = (industry.techMultipliers[sectorKey] ?? 1) * (lawMultiplier[sectorKey] ?? 1);
                capitalStock[sectorKey] = industry.capitalStock[sectorKey] ?? {};
                //@ts-ignore
                // sectorGoods[sectorKey] = industry.sectorGoods[sectorKey] ?? createStarterWarehouse(0);
            }

            return {
                entityId: entity.id,
                activeSectors: effectiveActiveSectors,
                goods: industry.goods,
                population: industry.population,
                techMultipliers,
                capitalStock,
                money,
                sectorGoods,
                settlementType: industry.settlementType,
                allowedSectors: [...effectiveActiveSectors],
                workerEfficiencyMultipliers: industry.workerEfficiencyMultipliers,
                materialRequirementMultipliers: industry.materialRequirementMultipliers,
                capitalMultipliers: industry.capitalMultipliers,
                selectedMethod: industry.selectedMethod,
                colonyTreasury: industry.colonyTreasury,
                sectorInvestment: industry.sectorInvestment,
                activeLaws: industry.activeLaws,
                tick: this.tickCounter,
                producerInventories: industry.producerInventories ?? {},
                prices: this.getPriceSnapshot(entity.id),
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
        
        // Reindex existing entities that have IndustryComponent
        for (const entity of engine.getAllEntities()) {
            if (entity.getComponent(IndustryComponent)) {
                engine.reindexEntity(entity);
            }
        }
        
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }
}

function applyPatch(industry: IndustryComponent, patch: IndustryTickPatch) {
    // Handle non-cumulative goods: compute net flow from production - requirements
    // Do NOT mutate the incoming patch
    const goodsUpdate: Partial<Goods> = { ...patch.goods };
    if(goodsUpdate) {
        for(const key in goodsUpdate) {
            if(NON_CUMULATING_GOODS.has(key as keyof Goods)) {
                goodsUpdate[key as keyof Goods] = 
                    (patch.goodsProduction?.[key as keyof Goods] ?? 0) - 
                    (patch.goodsRequirements?.[key as keyof Goods] ?? 0);
            }
        }
    }
    mergeRecord(industry.goods, goodsUpdate);

    mergeRecord(industry.goodsRequirements, patch.goodsRequirements)
    mergeRecord(industry.goodsProduction, patch.goodsProduction)
    mergeRecord(industry.sectorProfits, patch.sectorProfits)
    mergeRecord(industry.sectorRevenue, patch.sectorRevenue)
    mergeRecord(industry.sectorLaborCosts, patch.sectorLaborCosts)
    mergeRecord(industry.sectorInputCosts, patch.sectorInputCosts)
    mergeRecord(industry.populationProfits, patch.populationProfits)
    mergeRecord(industry.wages, patch.wages)
    mergeRecord(industry.sectorUtilization, patch.sectorUtilization)
    mergeRecord(industry.sectorStopReason, patch.sectorStopReason)
    mergeRecord(industry.capitalStock, patch.capitalStock)
    if(patch.money) {
        for(const [key, value] of Object.entries(patch.money)) {
            industry.money[key as keyof IndustrialSectors] = value;
        }
    }
    if(patch.colonyTreasury !== undefined) {
        industry.colonyTreasury = patch.colonyTreasury;
    }
    if(patch.householdMoney !== undefined) {
        industry.householdMoney = patch.householdMoney;
    }

    mergeWorkerRecord(industry.workingWorkers, patch.workingWorkers)
    mergeWorkerRecord(industry.freeWorkers, patch.freeWorkers)

    applyPopulationPatch(industry, patch.populationUpdates)

    applySectorResultsPatch(industry, patch.sectorResults, patch.sectorProfits)
}

function mergeRecord<T extends Record<string, any>>(
    target: T,
    patch?: Partial<T>
) {
    if(!patch) return
    for(const key in patch) {
        const value = patch[key as keyof T]
        if(value !== undefined) {
            target[key as keyof T] = value
        }
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

        if(update.requirements !== undefined) {
            industry.populationRequirements[key as keyof Population] = update.requirements;
        }
    }
}

function applySectorResultsPatch(
    industry: IndustryComponent,
    results: { changed: Record<string, SectorResult>; removed: string[] } | undefined,
    sectorProfits: Record<string, number> | undefined
) {
    if(!results) {
        return
    }

    for(const [name, sector] of Object.entries(results.changed)) {
        industry.sectorResults.set(name, sector)
    }
    for(const name of results.removed) {
        industry.sectorResults.delete(name)
    }

    if(sectorProfits) {
        for(const [name, profit] of Object.entries(sectorProfits)) {
            industry.sectorProfits[name as keyof IndustrialSectors] = profit
        }
    }
}
