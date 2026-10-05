import { SystemWithNodes } from "@engine/systems/system"
import { TextureComponent } from "@engine/components/textureComponent"
import { RotationComponent } from "@/game/components/rotationComponent"
import { EntityNode } from "@engine/entities/entityNode"
import { Engine } from "@/engine/core/engine"
import { isVisible, VisibleBounds } from "@engine/systems/viewportSystem/renderers/isVisible"
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem"
import { Entity } from "@/engine/entities/entity"
import { RadiusComponent } from "@/engine/components/radiusComponent"

export class SpinNode extends EntityNode {
    constructor(public rotation: RotationComponent, entity: Entity) {
        super(entity)
    }
}

export class SpinSystem extends SystemWithNodes<SpinNode> {
    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        engine.registerNodeType(
            SpinNode,
            new Set([RotationComponent, TextureComponent]),
            (entity) => new SpinNode(
                entity.getComponent(RotationComponent)!,
                entity
            )
        )

        this.nodes = engine.getNodeList(SpinNode)

        return this
    }

    removeFromEngine(): this {
        this.engine?.unregisterNodeType(SpinNode)
        super.removeFromEngine()
        return this
    }

    protected updateNode(node: SpinNode, dt?: number): void {
        const entity = node.entity
        const rotation = node.rotation
        const texture = entity.getComponent(TextureComponent)

        rotation.angle += (rotation.speed * ((dt ?? 0) / 1000)) 
        rotation.angle %= Math.PI * 2

        if(texture) {
            texture.rotation = rotation.angle % (Math.PI * 2)
        }
    }

    update(dt: number): void {
        if(!this.engine) return

        const camera = this.engine.getSystem(ViewportSystem)?.camera
        if(!camera) {
            super.update(dt)
            return
        }

        const bounds: VisibleBounds = {
            left: 0,
            right: camera.cssWidth,
            top: 0,
            bottom: camera.cssHeight,
        }

        for(const node of this.nodes) {
            const radius = node.entity.getComponent(RadiusComponent)
            const margin = radius ? radius.radius : 0
            if(isVisible(bounds, margin, node.entity, this.engine)) {
                this.updateNode(node, dt)
            }
        }
    }
}
