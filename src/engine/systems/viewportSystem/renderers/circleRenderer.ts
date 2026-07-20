import { World } from "../../../core/world";
import { CircleNode } from "./circleNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { sortByDepth } from "@/lib/sortByIndex";
import { isVisible } from "./isVisible";
import { ViewportSystem } from "../viewportSystem";

export class CircleRenderer extends SystemWithNodes<CircleNode> {
    protected filterNodes: ((node: CircleNode) => boolean) = (node) => {
        const { camera } = (this.parent as ViewportSystem).viewport;
        return isVisible(node.position, camera.visibleBounds, node.radius.radius);
    };

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(CircleNode)
        //engine.subscribe("entityAdded", this.onEntityAdded)

        return this
    }

    protected registerNodes(engine: World): this {
        engine.registerNodeType(CircleNode,
            new Set([PositionComponent, RadiusComponent, ColorComponent]),
            (entity) => new CircleNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(RadiusComponent)!,
                entity.getComponent(ColorComponent)
            )
        )

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(CircleNode)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    updateNode = (circle: CircleNode) => {
        const { camera } = (this.parent as ViewportSystem).viewport;

        const ctx = camera.context

        ctx.save();
        circle.setColor(ctx);
        ctx.translate(...circle.position.getAbsolute());
        ctx.beginPath();
        ctx.arc(0, 0, circle.radius.radius, 0, Math.PI * 2);
        ctx.closePath();
        circle.draw(ctx);
        ctx.restore();
    }

    private onEntityAdded = () => {
        if(this.sortOnEveryEntityAddition) {
            this.nodes.sort(sortByDepth)
        }
    }
}
