import { IndustryComponent } from "@game/components/industryComponent";
import { System } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { SelectProductionMethodCommand, AllocateBudgetCommand } from "@game/commands/IndustryPolicyCommand";
import { Queue } from "@/engine/lib/commandQueue";

export class IndustryPolicySystem extends System {
    private selectMethodCommands: Queue<SelectProductionMethodCommand> | null = null
    private allocateBudgetCommands: Queue<AllocateBudgetCommand> | null = null

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }
        this.engine?.removeCommandQueue(SelectProductionMethodCommand);
        this.engine?.removeCommandQueue(AllocateBudgetCommand);
        super.removeFromEngine();
        this.selectMethodCommands = null;
        this.allocateBudgetCommands = null;
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerCommandQueue(SelectProductionMethodCommand);
        engine.registerCommandQueue(AllocateBudgetCommand);
        this.selectMethodCommands = engine.getCommands(SelectProductionMethodCommand);
        this.allocateBudgetCommands = engine.getCommands(AllocateBudgetCommand);
        return this;
    }

    update(_dt: number): void {
        if(!this.selectMethodCommands || !this.allocateBudgetCommands) {
            return
        }
        for(const cmd of [...this.selectMethodCommands]) {
            this.handleSelectMethod(cmd);
        }
        this.selectMethodCommands.clear();
        for(const cmd of [...this.allocateBudgetCommands]) {
            this.handleAllocateBudget(cmd);
        }
        this.allocateBudgetCommands.clear();
    }

    private handleSelectMethod(command: SelectProductionMethodCommand) {
        const entity = this.engine?.getEntityById(command.entityId);

        if(!entity) {
            return
        }
        const industry = entity.getComponent(IndustryComponent);
        if(!industry) {
            return
        }

        industry.selectedMethod[command.sector] = command.methodId;
        this.engine?.reindexEntity(entity);
        this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity))
    }

    private handleAllocateBudget(command: AllocateBudgetCommand) {
        const entity = this.engine?.getEntityById(command.entityId);
        if(!entity) return;
        const industry = entity.getComponent(IndustryComponent);
        if(!industry) return;
        if(industry.colonyTreasury < command.amount) return;
        industry.colonyTreasury -= command.amount;
        industry.sectorInvestment[command.sector] = (industry.sectorInvestment[command.sector] ?? 0) + command.amount;
        this.engine?.reindexEntity(entity);
        this.engine?.dispatchEvent(new IndustryUpdatedEvent(entity))
    }
}
