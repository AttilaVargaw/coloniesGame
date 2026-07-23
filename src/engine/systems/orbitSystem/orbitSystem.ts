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

        orbit.meanAnomaly = (orbit.meanAnomaly + orbit.angularSpeed * dt / 1000) % (Math.PI * 2)
        if(orbit.meanAnomaly < 0) orbit.meanAnomaly += Math.PI * 2

        const E = this.solveKepler(orbit.meanAnomaly, orbit.eccentricity)
        const a = orbit.radius
        const r = a * (1 - orbit.eccentricity * Math.cos(E))

        const theta = 2 * Math.atan2(
            Math.sqrt(1 + orbit.eccentricity) * Math.sin(E / 2),
            Math.sqrt(Math.max(0.0001, 1 - orbit.eccentricity)) * Math.cos(E / 2)
        )

        const position = entity.getComponent(PositionComponent)!
        position.x = r * Math.cos(theta)
        position.y = r * Math.sin(theta)
    }

    private solveKepler(meanAnomaly: number, e: number): number {
        if(e < 1e-6) return meanAnomaly

        let E = meanAnomaly
        for(let i = 0; i < 20; i++) {
            const dE = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E))
            E -= dE
            if(Math.abs(dE) < 1e-9) break
        }
        return E
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
