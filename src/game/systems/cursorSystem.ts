import { SystemWithNodes } from "@game/systems/system";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { PositionComponent } from "@engine/components/position";
import { PositionNode } from "@engine/systems/viewportSystem/positionNode";
import { EntityComponent } from "@engine/entities/entityComponent";
import { Entity } from "@/engine/entities/entity";
import { MousemoveEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";

export class HoverableComponent extends EntityComponent {
    constructor(
        public cursor: "default" | "pointer" | "none" | "not-allowed" = "pointer",
        public size: { width: number, height: number },
        entity?: Entity,
    ) {
        super(entity)
    }
}

export class HoverableNode extends PositionNode {
    constructor(public position: PositionComponent, public hoverable: HoverableComponent, entity: Entity) {
        super(position, entity);
    }
}

export class CursorSystem extends SystemWithNodes<HoverableNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    protected updateNode(_node: HoverableNode, _dT?: number): void {
    }
    removeFromEngine(): this {
        this.engine?.unregisterNodeType(HoverableNode);
        super.removeFromEngine();

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);

        engine.registerNodeType(HoverableNode, new Set([HoverableComponent]), (entity) =>
            new HoverableNode(
                entity.getComponent(PositionComponent)!,
                entity.getComponent(HoverableComponent)!,
                entity
            )
        );

        this.nodes = engine.getNodeList(HoverableNode)

        return this
    }

    update(_dt: number) {
        if(!this.engine) return

        if(this.viewportSystem.isDragging) {
            return
        }

        const mouseMovedCommand = this.engine.getEvents(MousemoveEvent)!
        if(!mouseMovedCommand.length) return

        const mouseHit = [...mouseMovedCommand].some(({ data }) => {
            const { camera } = this.viewportSystem.viewport

            for(const hoverableNode of this.nodes) {
                const { hoverable: { size, cursor } } = hoverableNode
                const projected = camera.project(hoverableNode.position.x, hoverableNode.position.y, hoverableNode.position.z)
                if (!projected) {
                    continue
                }

                const halfX = (size.width / 2) * projected.scale
                const halfY = (size.height / 2) * projected.scale

                if(
                    projected.x - halfX < data.x
                    && projected.x + halfX > data.x
                    && projected.y - halfY < data.y
                    && projected.y + halfY > data.y) {
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