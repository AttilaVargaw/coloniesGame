import { Engine } from "../engine"
import { SystemWithNodes } from "./system"
import { EventHandlerComponent } from "../components/EventHandlerComponent";
import { ButtonPressNode } from "./ButtonPressNode";

export class ButtonPressSystem extends SystemWithNodes<ButtonPressNode> {
    protected updateNode(_node: ButtonPressNode, _dt: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unregisterNodeType(ButtonPressNode)

        super.removeFromEngine()

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        this.nodes = engine.getNodeList(ButtonPressNode)

        return this
    }

    protected registerNodes(engine: Engine): this {
        this.engine = engine.registerNodeType(ButtonPressNode, new Set([EventHandlerComponent]), (entity) =>
            new ButtonPressNode(
                entity,
                entity.getComponent(EventHandlerComponent)!
            ))

        return this
    }
    
    protected unregisterNodeTypes(): this | undefined {
        this.engine?.unregisterNodeType(ButtonPressNode)
        this.engine = undefined

        return this
    }

    update(_dt: number) {
        if(!this.engine) return

        const nodes = this.engine.getNodeList(ButtonPressNode)

        for(const { data } of this.engine.events.get("keydown")!) {
            for(const { eventHandler: { button, fn } } of nodes) {
                if(button === data.key) {
                    fn(data)
                }
            }
        }

        this.engine.events.get("keydown")!.clear()
    }
}
