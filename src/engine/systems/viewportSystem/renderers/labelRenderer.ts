import { World } from "../../../core/world";
import { LabelNode } from "./labelNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { LabelComponent } from "../../../components/label";
import { sortByDepth } from "@/lib/sortByIndex";
import { isVisible } from "./isVisible";
import { ViewportSystem } from "../viewportSystem";
import { ColorComponent } from "@engine/components/colorComponent";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { EntityAddedEvent } from "@/engine/lib/events";

export class LabelRenderer extends SystemWithNodes<LabelNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    protected filterNodes: ((node: LabelNode) => boolean) = (node) => {
        const { viewport: { camera } } = this.viewportSystem;

        return isVisible(camera.visibleBounds, node.label.size, node.entity!, this.engine!);
    };

    protected updateNode(node: LabelNode, _dt?: number): void {
        const ctx = this.viewportSystem.viewport.camera.context;

        ctx.save();
        node.setColor(ctx);
        ctx.translate(...getAbsolute(node.entity!, this.engine!));
        ctx.font = `${node.label.size}px Roboto`;
        ctx.fillText(node.label.text, 24, 0);
        //label.draw(ctx);
        ctx.restore();
    }

    protected registerNodes(engine: World): this {
        engine.registerNodeType(LabelNode,
            new Set([PositionComponent, ColorComponent, LabelComponent]),
            (entity) => new LabelNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(ColorComponent)!,
                entity.getComponent(LabelComponent)!
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

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(LabelNode)
        //engine.subscribe("entityAdded", this.onEntityAdded)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) return this
        this.engine.unsubscribe(EntityAddedEvent, this.onEntityAdded)
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
