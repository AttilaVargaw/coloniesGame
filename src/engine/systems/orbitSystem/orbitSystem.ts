import type { Engine } from "../../core/engine";
import { SystemWithNodes } from "../system";
import { OrbitNode } from "./orbitNode";
import { PositionComponent } from "../../components/position";
import { OrbitComponent } from "../../components/orbitComponent";
import { TWO_PI } from "@/engine/lib/cameraConstants";
import { TimeScaleNode } from "../timeScaleNode";
import { precomputeOrbitalTrig } from "./orbitalTrig";

function solveKepler(meanAnomaly: number, e: number): number {
    if(e < 1e-6) {
        return meanAnomaly
    }

    let E = meanAnomaly
    for(let i = 0; i < 20; i++) {
        const dE = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E))
        E -= dE
        if(Math.abs(dE) < 1e-9) {
            break
        }
    }
    return E
}
export class OrbitSystem extends SystemWithNodes<OrbitNode> {
    protected updateNode(node: OrbitNode, dt: number): void {
        const { orbit, entity } = node

        if(!node.orbit.radius || !this.engine) {
            return
        }

        const sceneNode = this.engine.getSceneNode(entity)
        const parentEntity = sceneNode?.parent?.entity

        if(!parentEntity) {
            console.warn('[OrbitSystem] No parent for entity', entity.id, 'orbit radius', orbit.radius, 'angularSpeed', orbit.angularSpeed)
            return
        }

        const timeScaleNode = this.engine.getNodeList(TimeScaleNode)[0]
        const multiplier = timeScaleNode?.timeScale.multiplier ?? 1

        orbit.meanAnomaly = (orbit.meanAnomaly + orbit.angularSpeed * multiplier * dt / 1000) % TWO_PI
        if(orbit.meanAnomaly < 0) {
            orbit.meanAnomaly += TWO_PI
        }

        const E = solveKepler(orbit.meanAnomaly, orbit.eccentricity)
        const r = orbit.radius * (1 - orbit.eccentricity * Math.cos(E))

        const theta = 2 * Math.atan2(
            Math.sqrt(1 + orbit.eccentricity) * Math.sin(E / 2),
            Math.sqrt(Math.max(0.0001, 1 - orbit.eccentricity)) * Math.cos(E / 2)
        )

        const position = entity.getComponent(PositionComponent)!
        const { cosI, sinI, cosA, sinA, cosL, sinL } = precomputeOrbitalTrig(orbit)

        const rx = r * Math.cos(theta)
        const ry = r * Math.sin(theta)
        const x1 = rx * cosA - ry * sinA
        const y1 = rx * sinA + ry * cosA
        position.x = x1 * cosL - y1 * cosI * sinL
        position.z = x1 * sinL + y1 * cosI * cosL
        position.y = y1 * sinI
    }

    protected registerNodes(engine: Engine): this {
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

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        this.nodes = this.engine!.getNodeList(OrbitNode)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }
}
