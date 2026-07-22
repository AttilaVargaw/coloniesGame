import { World } from "../../core/world";
import { SystemWithNodes } from "../system";
import { OrbitNode } from "./orbitNode";
import { PositionComponent } from "../../components/position";
import { OrbitComponent } from "../../components/orbitComponent";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";

export class OrbitSystem extends SystemWithNodes<OrbitNode> {
    protected updateNode(node: OrbitNode, dt: number): void {
        const { orbit, entity } = node

        if(!this.engine) return

        const sceneNode = this.engine.getSceneNode(entity)
        const parentEntity = sceneNode?.parentRef?.entity

        if(!parentEntity) {
            return
        }

        orbit.angle += orbit.angularSpeed * dt / 1000
        const twoPi = Math.PI * 2
        if(orbit.angle > twoPi || orbit.angle < -twoPi) {
            orbit.angle = orbit.angle % twoPi
        }

        const position = entity.getComponent(PositionComponent)!
        position.x = Math.cos(orbit.angle) * orbit.radius
        position.y = Math.sin(orbit.angle) * orbit.radius
    }

    update(dt: number): void {
        const nodesSnapshot = [...this.nodes]

        for(const node of nodesSnapshot) {
            if(this.filterNodes && !this.filterNodes(node)) {
                continue
            }
            this.updateNode(node, dt)
        }

        if(this.engine) {
            this.engine.addCommand(new RedrawCommand())
        }
    }

    protected registerNodes(engine: World): this {
        engine.registerNodeType(OrbitNode, new Set([OrbitComponent]), (entity) => {
            return new OrbitNode(entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(OrbitComponent)!)
        })

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(OrbitNode)

        return this
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine)

        this.nodes = this.engine!.getNodeList(OrbitNode)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) return this

        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }
}
