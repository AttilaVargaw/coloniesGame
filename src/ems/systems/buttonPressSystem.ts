import { Engine } from "../engine"
import { SystemWithNodes } from "./system"
import { EventHandlerComponent } from "../components/EventHandlerComponent";
import { ButtonPressNode } from "./ButtonPressNode";

export class ButtonPressSystem extends SystemWithNodes<ButtonPressNode> {
    removeFromEngine(): void {
        this.engine?.unregisterNodeType(ButtonPressNode)

        super.removeFromEngine()
    }

    addToEngine(engine: Engine) {
        this.engine = engine.registerNodeType(ButtonPressNode, new Set([EventHandlerComponent]), (entity) => ({
            entity,
            eventHandler: entity.getComponent(EventHandlerComponent)!
        }))

        this.nodes = engine.getNodeList(ButtonPressNode)
    }

    update() {
        if(!this.engine) return

        const nodes = this.engine.getNodeList(ButtonPressNode)

        for(const { data } of this.engine.commands.get("keydown")!) {
            for(const { eventHandler: { button, fn } } of nodes) {
                if(button === data.key) {
                    fn(data)
                }
            }
        }

        this.engine.commands.get("keydown")!.length = 0
    }
}
