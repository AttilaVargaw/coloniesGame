import { TechResearchNode } from "@game/systems/TechResearchNode";
import { TechResearchComponent } from "@game/components/TechResearchComponent";
import { TechAdoptionComponent } from "@game/components/TechAdoptionComponent";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent } from "@/engine/lib/events";
import { TechResearchedEvent } from "@game/events/techEvents";
import { getTech } from "@game/data/Techs";
import { ResearchCommand, CancelResearchCommand } from "@game/commands/ResearchCommand";
import { Queue } from "@/engine/lib/commandQueue";
import { Entity } from "@/engine/entities/entity";

export class TechSystem extends SystemWithNodes<TechResearchNode> {
    private techResearchedEvents: Queue<TechResearchedEvent> | null = null

    private researchCommands: Queue<ResearchCommand> | null = null
    private cancelResearchCommands: Queue<CancelResearchCommand> | null = null
    private dayCounter: number = 0

    protected updateNode(_node: TechResearchNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine?.unregisterNodeType(TechResearchNode);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        this.engine?.removeCommandQueue(ResearchCommand);
        this.engine?.removeCommandQueue(CancelResearchCommand);
        super.removeFromEngine();

        this.techResearchedEvents = null;
        this.researchCommands = null;
        this.cancelResearchCommands = null;

        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(
            TechResearchNode,
            new Set([TechResearchComponent]),
            (entity) => new TechResearchNode(entity.getComponent(TechResearchComponent)!, entity)
        );

        engine.subscribe(DayPassedEvent, this.onDayPassed);

        engine.registerCommandQueue(ResearchCommand);
        engine.registerCommandQueue(CancelResearchCommand);

        this.techResearchedEvents = engine.getEvents(TechResearchedEvent);
        this.researchCommands = engine.getCommands(ResearchCommand);
        this.cancelResearchCommands = engine.getCommands(CancelResearchCommand);

        this.nodes = engine.getNodeList(TechResearchNode);

        return this;
    }

    private onDayPassed = () => {
        this.dayCounter++;

        if(!this.researchCommands || !this.cancelResearchCommands) {
            return
        }

        for(const cmd of [...this.researchCommands]) {
            this.handleResearchCommand(cmd);
        }
        this.researchCommands.clear();

        for(const cmd of [...this.cancelResearchCommands]) {
            this.handleCancelResearchCommand(cmd);
        }
        this.cancelResearchCommands.clear();

        // Advance research progress for all entities currently researching
        for(const { entity, research } of this.nodes) {
            if(!research.currentTech) continue;

            const tech = getTech(research.currentTech);
            if(!tech) continue;

            const researchPointsPerDay = research.researchPointsPerDay + 1;

            research.progress += researchPointsPerDay / (tech.cost.researchPoints / tech.cost.days);

            if(research.progress >= 1) {
                this.completeResearch(entity, research.currentTech);
                research.currentTech = undefined;
                research.progress = 0;
            }
        }

        this.techResearchedEvents?.clear()
    };

    private handleResearchCommand(command: ResearchCommand) {
        const entity = this.engine?.getEntityById(command.entityId);
        if(!entity) return;

        const research = entity.getComponent(TechResearchComponent);
        if(!research) return;

        const tech = getTech(command.techId);
        if(!tech) return;

        // Check prerequisites
        for(const prereq of tech.prerequisites || []) {
            if(!research.researched.has(prereq)) {
                return;
            }
        }

        // Don't start if already researching
        if(research.currentTech) return;

        research.currentTech = command.techId;
        research.progress = 0;
    }

    private handleCancelResearchCommand(command: CancelResearchCommand) {
        const entity = this.engine?.getEntityById(command.entityId);
        if(!entity) return;

        const research = entity.getComponent(TechResearchComponent);
        if(!research) return;

        research.currentTech = undefined;
        research.progress = 0;
    }

    private completeResearch(entity: Entity, techId: string) {
        const research = entity.getComponent(TechResearchComponent);
        if(!research) return;

        research.researched.add(techId);
        research.currentTech = undefined;
        research.progress = 0;

        const tech = getTech(techId);
        if(!tech) return;

        // Ensure TechAdoptionComponent exists
        let adoption = entity.getComponent(TechAdoptionComponent);
        if(!adoption) {
            entity.addComponent(new TechAdoptionComponent());
            this.engine?.reindexEntity(entity);
            adoption = entity.getComponent(TechAdoptionComponent);
        }
        if(!adoption) return;

        // Initialize adoption state
        adoption.adoptionStates.set(techId, {
            techId,
            inventedAt: this.dayCounter,
            model: tech.adoptionModel,
            adoptionSpeed: tech.adoptionSpeed,
            currentAdoption: 0,
        });

        this.engine?.dispatchEvent(new TechResearchedEvent({ techId, entityId: entity.id }));

        // Apply unlock effects immediately
        for(const _unlock of tech.unlocks || []) {
            // Could dispatch unlock events here
        }
    }
}
