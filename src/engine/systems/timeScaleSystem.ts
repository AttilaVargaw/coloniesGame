import { SystemWithNodes } from "@engine/systems/system";
import { TimeScaleNode } from "./timeScaleNode";
import { TimeScaleComponent } from "@engine/components/timeScaleComponent";
import { SetTimeScaleCommand } from "@/engine/lib/SetTimeScaleCommand";
import { Engine } from "@/engine/core/engine";
import { Queue } from "../lib/commandQueue";

export class TimeScaleSystem extends SystemWithNodes<TimeScaleNode> {
    // eslint-disable-next-line class-methods-use-this,no-empty-function
    protected updateNode(_node: TimeScaleNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unregisterNodeType(TimeScaleNode);
        this.engine?.removeCommandQueue(SetTimeScaleCommand);
        super.removeFromEngine();

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);

        engine.registerNodeType(TimeScaleNode, new Set([TimeScaleComponent]), (entity) =>
            new TimeScaleNode(
                entity,
                entity.getComponent(TimeScaleComponent)!,
            )
        );

        this.nodes = engine.getNodeList(TimeScaleNode)
        this.engine?.registerCommandQueue(SetTimeScaleCommand);

        return this
    }

    update(_dt: number) {
        if(!this.engine) return

        const commands = this.engine.getCommands(SetTimeScaleCommand) as Queue<SetTimeScaleCommand>
        if(!commands) {
            return
        }

        for(const command of [...commands]) {
            const node = this.nodes[0]
            if(node) {
                node.timeScale.multiplier = command.multiplier
            }
        }

        commands.clear()
    }
}
