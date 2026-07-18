import { Engine } from "../../../engine";
import { LabelNode } from "./labelNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { LabelComponent } from "../../../components/label";
import { shortByIndex } from "@/lib/shortByIndex";
import { transverseAndSumPositionComponents } from "../transverseAndSumPositionComponents";

export class LabelRenderer extends SystemWithNodes<LabelNode> {
    addToEngine(engine: Engine) {
        engine.registerNodeType(LabelNode,
            new Set([PositionComponent, LabelComponent]),
            (entity) => new LabelNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(LabelComponent)!,
            )
        )
        this.nodes = engine.getNodeList(LabelNode)
        engine.subscribe("entityAdded", this.onEntityAdded)
        super.addToEngine(engine)
    }

    removeFromEngine() {
        if(!this.engine) return
        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.engine.unregisterNodeType(LabelNode)
        this.nodes.length = 0
        super.removeFromEngine()
    }

    render(ctx: CanvasRenderingContext2D) {
        for(const label of this.nodes) {
            ctx.save();
            label.setColor(ctx);
            ctx.translate(...transverseAndSumPositionComponents(label.position));
            ctx.font = `${label.label.size}px Roboto`;
            ctx.fillText(label.label.text, 24, 0);
            //label.draw(ctx);
            ctx.restore();
        }
    }

    private onEntityAdded = () => {
        this.nodes.sort(shortByIndex)
    }
}
