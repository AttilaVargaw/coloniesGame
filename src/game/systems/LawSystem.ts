import { IndustryComponent } from "@game/components/industryComponent";
import { System } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent } from "@/engine/lib/events";
import { EnactLawCommand, RepealLawCommand } from "@game/commands/IndustryPolicyCommand";
import { Queue } from "@/engine/lib/commandQueue";

export class LawSystem extends System {
    private enactCommands: Queue<EnactLawCommand> | null = null
    private repealCommands: Queue<RepealLawCommand> | null = null

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        this.engine?.removeCommandQueue(EnactLawCommand);
        this.engine?.removeCommandQueue(RepealLawCommand);
        super.removeFromEngine();
        this.enactCommands = null;
        this.repealCommands = null;
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(DayPassedEvent, this.onDayPassed);
        engine.registerCommandQueue(EnactLawCommand);
        engine.registerCommandQueue(RepealLawCommand);
        this.enactCommands = engine.getCommands(EnactLawCommand);
        this.repealCommands = engine.getCommands(RepealLawCommand);
        return this;
    }

    private onDayPassed = () => {
        if(!this.enactCommands || !this.repealCommands) {
            return
        }
        for(const cmd of [...this.enactCommands]) {
            this.handleEnact(cmd);
        }
        this.enactCommands.clear();
        for(const cmd of [...this.repealCommands]) {
            this.handleRepeal(cmd);
        }
        this.repealCommands.clear();
    };

    private handleEnact(command: EnactLawCommand) {
        const entity = this.engine?.getEntityById(command.entityId);
        if(!entity) return;
        const industry = entity.getComponent(IndustryComponent);
        if(!industry) return;
        industry.activeLaws.add(command.lawId);
        this.engine?.reindexEntity(entity);
    }

    private handleRepeal(command: RepealLawCommand) {
        const entity = this.engine?.getEntityById(command.entityId);
        if(!entity) return;
        const industry = entity.getComponent(IndustryComponent);
        if(!industry) return;
        industry.activeLaws.delete(command.lawId);
        this.engine?.reindexEntity(entity);
    }
}
