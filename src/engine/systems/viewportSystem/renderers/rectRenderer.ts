import { World } from "../../../core/world";
import { RectNode } from "./rectNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { sortByDepth } from "@/lib/sortByIndex";
import { isVisible } from "./isVisible";
import { ViewportSystem } from "../viewportSystem";
import { getAbsolute } from "@/engine/lib/getAbsolute";

export class RectRenderer extends SystemWithNodes<RectNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    protected filterNodes: ((node: RectNode) => boolean) = (node) => {
        const { camera } = this.viewportSystem.viewport;
        const margin = Math.max(node.size.width, node.size.height) / 2;
        return isVisible( camera.visibleBounds, margin, node.entity!, this.engine!);
    };
    protected updateNode(rect: RectNode, _dT?: number): void {
        const { camera } = this.viewportSystem.viewport;

        const ctx = camera.context;

        ctx.save();
        rect.setColor(ctx);
        ctx.translate(...getAbsolute(rect.entity!, this.engine!));
        ctx.fillRect(-rect.size.width / 2, -rect.size.height / 2, rect.size.width, rect.size.height);
        rect.draw(ctx)
        ctx.restore();
    }

    protected registerNodes(engine: World): this {
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

    addToEngine(engine: World): this {
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
            this.nodes.sort(sortByDepth)
        }
    }
}
