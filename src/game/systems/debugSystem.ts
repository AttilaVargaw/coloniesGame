import { System } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DebugToggleCommand } from "../commands/DebugToggleCommand";
import { DebugManager } from "@engine/lib/debugManager";
import { Queue } from "@/engine/lib/commandQueue";

export class DebugSystem extends System {
    private debugManager?: DebugManager

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.debugManager = engine.getDebugManager()

        engine.registerCommandQueue(DebugToggleCommand)

        return this
    }

    removeFromEngine(): this {
        this.engine?.removeCommandQueue(DebugToggleCommand)
        this.debugManager = undefined
        super.removeFromEngine()

        return this
    }

    update(_dt: number) {
        if(!this.engine) return

        const commands = this.engine.getCommands(DebugToggleCommand) as Queue<DebugToggleCommand>
        if(!commands) {
            return
        }

        for(const command of [...commands]) {
            this.debugManager?.toggle(command.data.flag)
        }

        commands.clear()
    }
}
