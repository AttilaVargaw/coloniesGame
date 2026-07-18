import { Engine } from "../../../engine";
import { RectNode } from "./rectNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { shortByIndex } from "@/lib/shortByIndex";
import { transverseAndSumPositionComponents } from "../transverseAndSumPositionComponents";

export class RectRenderer extends SystemWithNodes<RectNode> {
    addToEngine(engine: Engine) {
        engine.registerNodeType(RectNode,
            new Set([PositionComponent, SizeComponent]),
            (entity) => new RectNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(SizeComponent)!,
                entity.getComponent(ColorComponent)!,
            )
        )
        this.nodes = engine.getNodeList(RectNode)
        engine.subscribe("entityAdded", this.onEntityAdded)
        super.addToEngine(engine)
    }

    removeFromEngine() {
        if(!this.engine) return
        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.engine.unregisterNodeType(RectNode)
        this.nodes.length = 0
        super.removeFromEngine()
    }

    render(ctx: CanvasRenderingContext2D) {
        for(const rect of this.nodes) {
            ctx.save();
            rect.setColor(ctx);
            ctx.translate(...transverseAndSumPositionComponents(rect.position));
            ctx.fillRect(-rect.size.width / 2, -rect.size.height / 2, rect.size.width, rect.size.height);
            rect.draw(ctx)
            ctx.restore();
        }
    }

    private onEntityAdded = () => {
        this.nodes.sort(shortByIndex)
    }
}
