import { SystemWithNodes } from "@engine/systems/system"
import { TextureComponent } from "@engine/components/textureComponent"
import { RotationComponent } from "@/game/components/rotationComponent"
import { AsteroidBeltComponent } from "@/game/components/asteroidBeltComponent"
import { EntityNode } from "@engine/entities/entityNode"
import { Engine } from "@/engine/core/engine"
import { isVisible, VisibleBounds } from "@engine/systems/viewportSystem/renderers/isVisible"
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem"
import { Entity } from "@/engine/entities/entity"

export class AsteroidSpinNode extends EntityNode {
    constructor(public rotation: RotationComponent, entity: Entity) {
        super(entity)
    }
}

export class AsteroidSpinSystem extends SystemWithNodes<AsteroidSpinNode> {
    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        engine.registerNodeType(
            AsteroidSpinNode,
            new Set([AsteroidBeltComponent]),
            (entity) => new AsteroidSpinNode(
                entity.getComponent(RotationComponent)!,
                entity
            )
        )

        this.nodes = engine.getNodeList(AsteroidSpinNode)

        return this
    }

    removeFromEngine(): this {
        this.engine?.unregisterNodeType(AsteroidSpinNode)
        super.removeFromEngine()
        return this
    }

    protected updateNode(node: AsteroidSpinNode, dt?: number): void {
        const entity = node.entity
        const rotation = node.rotation
        const texture = entity.getComponent(TextureComponent)
        if (!texture) return

        rotation.angle += rotation.speed * ((dt ?? 0) / 1000)
        texture.rotation = rotation.angle % (Math.PI * 2)
    }

    update(dt: number): void {
        if (!this.engine) return

        const camera = this.engine.getSystem(ViewportSystem)?.viewport?.camera
        if (!camera) {
            super.update(dt)
            return
        }

        const bounds: VisibleBounds = {
            left: 0,
            right: camera.cssWidth,
            top: 0,
            bottom: camera.cssHeight,
        }

        const visibleParents = new Map<string, boolean>()

        for (const node of this.nodes) {
            const sceneNode = this.engine.getSceneNode(node.entity)
            const parent = sceneNode?.parent?.entity
            if (!parent) continue

            let isVisibleResult = visibleParents.get(parent.id)
            if (isVisibleResult === undefined) {
                isVisibleResult = isVisible(bounds, 0, parent, this.engine)
                visibleParents.set(parent.id, isVisibleResult)
            }

            if (isVisibleResult) {
                this.updateNode(node, dt)
            }
        }
    }
}
