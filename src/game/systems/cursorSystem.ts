import { World } from "@engine/core/world";
import { SystemWithNodes } from "@game/systems/system";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { PositionComponent, WorldPosition } from "@engine/components/position";
import { PositionNode } from "@engine/systems/viewportSystem/positionNode";
import { EntityComponent } from "@engine/entities/entityComponent";
import { isContained } from "@lib/isContained";

export class HoverableComponent extends EntityComponent {
    constructor(
        public cursor: "default" | "pointer" | "none" | "not-allowed" = "pointer",
        public size: { width: number, height: number }) {
        super()
    }
}

export class HoverableNode extends PositionNode {
    constructor(public position: PositionComponent, public hoverable: HoverableComponent) {
        super(position);
    }
}

export class CursorSystem extends SystemWithNodes<HoverableNode> {
    protected updateNode(_node: HoverableNode, _dT?: number): void {
    }
    removeFromEngine(): this {
        this.engine?.unregisterNodeType(HoverableNode);
        super.removeFromEngine();

        return this
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine);

        engine.registerNodeType(HoverableNode, new Set([HoverableComponent]), (entity) =>
            new HoverableNode(
                entity.getComponent(PositionComponent)!,
                entity.getComponent(HoverableComponent)!
            )
        );

        this.nodes = engine.getNodeList(HoverableNode)

        return this
    }

    update(_dt: number) {
        if(!this.engine) return

        const mouseMovedCommand = this.engine.events.get("mouseMoved")!
        if(!mouseMovedCommand.length) return

        const mouseHit = [...this.engine.events.get("mouseMoved")!].some(({ data }) => {
            const { camera } = this.engine!.getSystem(ViewportSystem)!.viewport
            const { x, y } = camera.screenToWorld(data.x, data.y)

            for(const hoverableNode of this.nodes) {
                const { hoverable: { size, cursor } } = hoverableNode

                if(isContained({ x, y } as WorldPosition, { position: hoverableNode.position, size })) {
                    document.body.style.cursor = cursor;
                    return true
                }
            }

            return false
        })

        if(!mouseHit) {
            const { cursor } = document.body.style

            if(cursor !== 'default' && cursor !== "grabbing") {
                document.body.style.cursor = 'default';
            }
        }

        mouseMovedCommand.clear()
    }

}