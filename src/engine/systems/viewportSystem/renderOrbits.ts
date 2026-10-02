import { getAbsolute } from "@/engine/lib/getAbsolute"
import { TWO_PI } from "@/game/constants"
import { precomputeOrbitalTrig } from "../orbitSystem/orbitalTrig"
import { OrbitNode } from "../orbitSystem/orbitNode"
import Camera from "@/lib/camera"
import { Engine } from "@/engine/core/engine"

export function drawOrbits(context: CanvasRenderingContext2D, engine: Engine, camera: Camera) {
    context.save()

    context.strokeStyle = "rgba(100, 149, 237, 0.2)"
    context.lineWidth = 1

    const cssWidth = camera.cssWidth
    const cssHeight = camera.cssHeight

    for(const node of engine.getNodeList(OrbitNode)) {
        if(node.orbit.hideOrbitInDebugDrawing) {
            continue
        }

        const sceneNode = engine.getSceneNode(node.entity)
        const parentEntity = sceneNode?.parent?.entity
        if(!parentEntity) {
            continue
        }

        const [cx, cy, cz] = getAbsolute(parentEntity, engine)
        const orbit = node.orbit

        const center = camera.project(cx, cy, cz)
        if(!center) {
            continue
        }

        const boundingRadius = orbit.radius * (1 + orbit.eccentricity)
        const screenRadius = boundingRadius * center.scale

        if(
            center.x + screenRadius < 0 ||
            center.x - screenRadius > cssWidth ||
            center.y + screenRadius < 0 ||
            center.y - screenRadius > cssHeight
        ) {
            continue
        }

        const segments = Math.max(24, Math.round(screenRadius / 4))
        const { cosI, sinI, cosA, sinA, cosL, sinL } = precomputeOrbitalTrig(orbit)
        const b = orbit.semiMinorAxis
        const focusOffset = orbit.radius * orbit.eccentricity

        const points: { x: number; y: number }[] = []
        for(let i = 0; i <= segments; i++) {
            const angle = (i / segments) * TWO_PI
            const x = orbit.radius * Math.cos(angle) - focusOffset
            const y = b * Math.sin(angle)
            const rx = x * cosA - y * sinA
            const ry = x * sinA + y * cosA
            const x1 = rx * cosL - ry * cosI * sinL
            const y1 = rx * sinL + ry * cosI * cosL
            const projected = camera.project(cx + x1, cy + y1, cz + ry * sinI)
            if(projected) points.push({ x: projected.x, y: projected.y })
        }

        if(points.length < 2) continue

        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        for(let i = 1; i < points.length; i++) {
            context.lineTo(points[i].x, points[i].y)
        }
        context.stroke()
    }

    context.restore()
}