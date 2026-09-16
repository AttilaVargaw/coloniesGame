import { SystemWithNodes } from "@engine/systems/system";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { EntityComponent } from "@engine/entities/entityComponent";
import { EntityNode } from "@engine/entities/entityNode";
import { Entity } from "@/engine/entities/entity";
import type { Engine } from "@/engine/core/engine";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { SelectionChangedEvent } from "@/engine/lib/events";

export class CameraFollowComponent extends EntityComponent {
    constructor(
        public target: Entity | null = null,
        public offset: [number, number, number] = [0, 0, 0],
        public smoothFactor: number = 1,
    ) {
        super()
    }
}

export class CameraFollowNode extends EntityNode {
    constructor(public follow: CameraFollowComponent, entity: Entity) {
        super(entity);
    }
}

export class CameraFollowSystem extends SystemWithNodes<CameraFollowNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        engine.registerNodeType(
            CameraFollowNode,
            new Set([CameraFollowComponent]),
            (entity) => new CameraFollowNode(
                entity.getComponent(CameraFollowComponent)!,
                entity
            )
        )

        engine.subscribe(SelectionChangedEvent, this.onSelectionChanged as (data: unknown) => void)

        this.nodes = engine.getNodeList(CameraFollowNode)

        return this
    }

    removeFromEngine(): this {
        if(this.engine) {
            this.engine.unsubscribe(SelectionChangedEvent, this.onSelectionChanged as (data: unknown) => void)
            this.engine.unregisterNodeType(CameraFollowNode)
        }
        super.removeFromEngine()
        return this
    }

    private onSelectionChanged = (eventData: { data: Entity, type: string }) => {
        for(const node of this.nodes) {
            node.follow.target = eventData.data
        }
    }

    protected updateNode(node: CameraFollowNode, _dT?: number): void {
        if(!this.engine) return

        const viewport = this.viewportSystem.viewport
        if(!viewport) return

        // if(this.viewportSystem.isDragging) {
        //     return
        // }

        const camera = viewport.camera
        const { target, offset, smoothFactor } = node.follow

        if(!target) return

        const [tx, ty, tz] = getAbsolute(target, this.engine)
        const [ox, oy, oz] = offset
        const targetX = tx + ox
        const targetY = ty + oy
        const targetZ = tz + oz

        if(smoothFactor < 1) {
            const [cx, cy, cz] = camera.lookAt
            camera.moveTo(
                cx + (targetX - cx) * smoothFactor,
                cy + (targetY - cy) * smoothFactor,
                cz + (targetZ - cz) * smoothFactor,
            )
        } else {
            camera.moveTo(targetX, targetY, targetZ)
        }
    }
}
