import { Engine } from "../../../engine";
import { LabelNode } from "./labelNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { LabelComponent } from "../../../components/label";
import { shortByIndex } from "@/lib/shortByIndex";
import { transverseAndSumPositionComponents } from "../transverseAndSumPositionComponents";
import { ViewportSystem } from "../viewportSystem";

export class LabelRenderer extends SystemWithNodes<LabelNode> {
    protected updateNode(node: LabelNode, _dT?: number): void {
        const ctx = (this.parent as ViewportSystem).viewport.camera.context

        ctx.save();
        node.setColor(ctx);
        ctx.translate(...transverseAndSumPositionComponents(node.position));
        ctx.font = `${node.label.size}px Roboto`;
        ctx.fillText(node.label.text, 24, 0);
        //label.draw(ctx);
        ctx.restore();
    }

    protected registerNodes(engine: Engine): this {
        engine.registerNodeType(LabelNode,
            new Set([PositionComponent, LabelComponent]),
            (entity) => new LabelNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(LabelComponent)!,
            )
        )

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(LabelNode)

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(LabelNode)
        engine.subscribe("entityAdded", this.onEntityAdded)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) return this
        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    private onEntityAdded = () => {
        this.nodes.sort(shortByIndex)
    }
}
