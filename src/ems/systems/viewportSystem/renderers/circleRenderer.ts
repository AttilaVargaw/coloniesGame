import { Engine } from "../../../engine";
import { CircleNode } from "./circleNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { shortByIndex } from "@/lib/shortByIndex";
import { transverseAndSumPositionComponents } from "../transverseAndSumPositionComponents";

export class CircleRenderer extends SystemWithNodes<CircleNode> {
    addToEngine(engine: Engine) {
        engine.registerNodeType(CircleNode,
            new Set([PositionComponent, RadiusComponent, ColorComponent]),
            (entity) => new CircleNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(RadiusComponent)!,
                entity.getComponent(ColorComponent)
            )
        )
        this.nodes = engine.getNodeList(CircleNode)
        engine.subscribe("entityAdded", this.onEntityAdded)
        super.addToEngine(engine)
    }

    removeFromEngine() {
        if(!this.engine) return
        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.engine.unregisterNodeType(CircleNode)
        this.nodes.length = 0
        super.removeFromEngine()
    }

    render(ctx: CanvasRenderingContext2D) {
        for(const circle of this.nodes) {
            ctx.save();
            circle.setColor(ctx);
            ctx.translate(...transverseAndSumPositionComponents(circle.position));
            ctx.beginPath();
            ctx.arc(0, 0, circle.radius.radius, 0, Math.PI * 2);
            ctx.closePath();
            circle.draw(ctx);
            ctx.restore();
        }
    }

    private onEntityAdded = () => {
        this.nodes.sort(shortByIndex)
    }
}
