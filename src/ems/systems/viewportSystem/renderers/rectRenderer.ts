import { Engine } from "../../../engine";
import { RectNode } from "./rectNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { shortByDepth } from "@/lib/shortByIndex";
import { isVisible } from "./isVisible";
import { ViewportSystem } from "../viewportSystem";

export class RectRenderer extends SystemWithNodes<RectNode> {
    protected filterNodes: ((node: RectNode) => boolean) = (node) => {
        const { camera } = (this.parent as ViewportSystem).viewport;
        const margin = Math.max(node.size.width, node.size.height) / 2;
        return isVisible(node.position, camera.visibleBounds, margin);
    };
    protected updateNode(rect: RectNode, _dT?: number): void {
        const { camera } = (this.parent as ViewportSystem).viewport;

        const ctx = camera.context;

        ctx.save();
        rect.setColor(ctx);
        ctx.translate(...rect.position.getAbsolute());
        ctx.fillRect(-rect.size.width / 2, -rect.size.height / 2, rect.size.width, rect.size.height);
        rect.draw(ctx)
        ctx.restore();
    }

    protected registerNodes(engine: Engine): this {
        engine.registerNodeType(RectNode,
            new Set([PositionComponent, SizeComponent]),
            (entity) => new RectNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(SizeComponent)!,
                entity.getComponent(ColorComponent)!,
            )
        )

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(RectNode)

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(RectNode)
        engine.subscribe("entityAdded", this.onEntityAdded)

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

    private onEntityAdded = () => {
        if(this.sortOnEveryEntityAddition) {
            this.nodes.sort(shortByDepth)
        }
    }
}
