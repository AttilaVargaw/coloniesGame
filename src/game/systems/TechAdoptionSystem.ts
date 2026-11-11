import { TechAdoptionNode } from "@game/systems/TechAdoptionNode";
import { TechAdoptionComponent } from "@game/components/TechAdoptionComponent";
import { TechResearchComponent } from "@game/components/TechResearchComponent";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { TechAdoptionProgressEvent, TechFullyAdoptedEvent } from "@game/events/techEvents";
import { getTech } from "@game/data/Techs";
import { IndustryComponent } from "@game/components/industryComponent";
import { createEmptyWarehouse } from "@game/factories/createStarterWarehouse";
import { Queue } from "@/engine/lib/commandQueue";
import type { IndustrialSectors } from "../components/Factories";
import type { Population } from "../data/Population";
import type { Goods } from "../data/Goods";

type TechAdoptionState = {
    techId: string;
    inventedAt: number;
    model: "logistic" | "linear" | "instant";
    adoptionSpeed: number;
    currentAdoption: number;
};

export class TechAdoptionSystem extends SystemWithNodes<TechAdoptionNode> {
    private techAdoptionProgressEvents: Queue<TechAdoptionProgressEvent> | null = null
    private techFullyAdoptedEvents: Queue<TechFullyAdoptedEvent> | null = null
    private dayCounter: number = 0

    protected updateNode(_node: TechAdoptionNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine?.unregisterNodeType(TechAdoptionNode);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        this.engine?.unsubscribe(IndustryUpdatedEvent, this.onIndustryUpdated);
        super.removeFromEngine();

        this.techAdoptionProgressEvents = null;
        this.techFullyAdoptedEvents = null;

        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(
            TechAdoptionNode,
            new Set([TechAdoptionComponent]),
            (entity) => new TechAdoptionNode(entity.getComponent(TechAdoptionComponent)!, entity)
        );

        engine.subscribe(DayPassedEvent, this.onDayPassed);
        engine.subscribe(IndustryUpdatedEvent, this.onIndustryUpdated);

        this.techAdoptionProgressEvents = engine.getEvents(TechAdoptionProgressEvent);
        this.techFullyAdoptedEvents = engine.getEvents(TechFullyAdoptedEvent);

        this.nodes = engine.getNodeList(TechAdoptionNode);

        return this;
    }

    private onDayPassed = () => {
        this.dayCounter++;
        this.advanceAllAdoptions();
    };

    private onIndustryUpdated = () => {
        this.advanceAllAdoptions();
    };

    private advanceAllAdoptions() {
        if(!this.techAdoptionProgressEvents || !this.techFullyAdoptedEvents) {
            return
        }

        for(const { entity, adoption } of this.nodes) {
            const research = entity.getComponent(TechResearchComponent);
            if(!research) continue;

            const industry = entity.getComponent(IndustryComponent);
            if(!industry) continue;

            let industryChanged = false;

            for(const [techId, state] of adoption.adoptionStates) {
                if(state.currentAdoption >= 1) continue;

                const tech = getTech(techId);
                if(!tech) continue;

                const daysSinceInvention = this.dayCounter - state.inventedAt;
                const newAdoption = this.calculateAdoption(tech, state, daysSinceInvention);

                if(newAdoption !== state.currentAdoption) {
                    state.currentAdoption = newAdoption;

                    this.engine?.dispatchEvent(new TechAdoptionProgressEvent({
                        techId,
                        entityId: entity.id,
                        adoption: newAdoption,
                    }));

                    if(newAdoption >= 1) {
                        this.engine?.dispatchEvent(new TechFullyAdoptedEvent({
                            techId,
                            entityId: entity.id,
                        }));
                    }

                    // Apply tech effects to industry component
                    this.applyTechEffects(industry, tech, newAdoption);
                    industryChanged = true;
                }
            }

            if(industryChanged) {
                this.engine?.reindexEntity(entity);
            }
        }

        this.techAdoptionProgressEvents?.clear()
        this.techFullyAdoptedEvents?.clear()
    };

    private applyTechEffects(industry: IndustryComponent, tech: any, adoption: number) {
        const effectStrength = adoption; // 0..1

        for(const effect of tech.effects) {
            switch(effect.type) {
                case "sector_efficiency": {
                    const sectorKey = effect.sector as keyof IndustrialSectors;
                    const sectors = effect.sector === "all"
                        ? Array.from(industry.activeSectors)
                        : [sectorKey];
                    for(const s of sectors) {
                        if(industry.techMultipliers[s] === undefined) continue;
                        const current = industry.techMultipliers[s];
                        industry.techMultipliers[s] = current * (1 + (effect.multiplier - 1) * effectStrength);
                    }
                    break;
                }
                case "capital_multiplier": {
                    const sectorKey = effect.sector as keyof IndustrialSectors;
                    if(industry.capitalMultipliers[sectorKey] === undefined) continue;
                    industry.capitalMultipliers[sectorKey] = 1 + (effect.multiplier - 1) * effectStrength;
                    break;
                }
                case "worker_efficiency": {
                    const workerKey = effect.worker as keyof Population;
                    if(industry.workerEfficiencyMultipliers[workerKey] === undefined) continue;
                    industry.workerEfficiencyMultipliers[workerKey] = effect.multiplier ** effectStrength;
                    break;
                }
                case "material_requirement": {
                    const goodKey = effect.good as keyof Goods;
                    if(industry.materialRequirementMultipliers[goodKey] === undefined) continue;
                    industry.materialRequirementMultipliers[goodKey] = 1 - (1 - effect.reduction) * effectStrength;
                    break;
                }
                case "unlock_sector": {
                    const sectorKey = effect.sector as keyof IndustrialSectors;
                    if(industry.activeSectors.has(sectorKey)) continue;
                    industry.activeSectors.add(sectorKey);
                    this.initializeSector(industry, sectorKey);
                    break;
                }
                case "unlock_good": {
                    // Goods are always available; unlocks are informational for now.
                    break;
                }
            }
        }
    }

    private initializeSector(industry: IndustryComponent, sectorKey: keyof IndustrialSectors) {
        industry.techMultipliers[sectorKey] = 1;
        industry.laborAssigned[sectorKey] = 0;
        industry.capitalStock[sectorKey] = {};
        industry.money[sectorKey] = 0;
        // industry.sectorGoods[sectorKey] = { ...createStarterWarehouse(0) };
        industry.sectorUtilization[sectorKey] = 0;
        industry.sectorProfits[sectorKey] = 0;
        industry.selectedMethod[sectorKey] = null;
        industry.capitalMultipliers[sectorKey] = 1;
        industry.sectorInvestment[sectorKey] = 0;
    }

    private calculateAdoption(tech: any, _state: TechAdoptionState, daysSince: number): number {
        if(daysSince <= 0) return 0;

        if(tech.adoptionModel === "linear") {
            return Math.min(1, daysSince / tech.adoptionSpeed);
        }

        // Logistic / S-curve
        const k = 4 / tech.adoptionSpeed;
        const t0 = tech.adoptionSpeed / 2;
        const x = k * (daysSince - t0);
        return 1 / (1 + Math.exp(-x));
    }
}
