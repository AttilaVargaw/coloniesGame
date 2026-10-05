import { Engine } from "@/engine/core/engine"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { MapSystem } from "@/game/systems/mapSystem"
import Camera from "@/lib/camera"

export function drawJumpGraph(context: CanvasRenderingContext2D, engine: Engine, camera: Camera) {
    if(!engine) {
        return
    }

    const mapSystem = engine.getSystem(MapSystem)
    if(!mapSystem) return

    const graph = mapSystem.getJumpGraph()
    if(!graph) return

    context.save()
    context.strokeStyle = "rgba(0, 255, 255, 0.4)"
    context.lineWidth = 1

    const drawn = new Set<string>()

    for(const [source, targets] of graph.adjacency) {
        for(const target of targets) {
            const key = [source.id, target.id].sort().join("->")
            if(drawn.has(key)) {
                continue

            }
            drawn.add(key)

            const s = getAbsolute(source, engine)
            const t = getAbsolute(target, engine)

            const sourceProjected = camera.project(s)
            const targetProjected = camera.project(t)

            if(!sourceProjected || !targetProjected) {
                continue
            }

            const cssWidth = camera.cssWidth
            const cssHeight = camera.cssHeight

            const minX = Math.min(sourceProjected.x, targetProjected.x)
            const maxX = Math.max(sourceProjected.x, targetProjected.x)
            const minY = Math.min(sourceProjected.y, targetProjected.y)
            const maxY = Math.max(sourceProjected.y, targetProjected.y)

            if(
                maxX < 0 ||
                minX > cssWidth ||
                maxY < 0 ||
                minY > cssHeight
            ) {
                continue
            }

            context.beginPath()
            context.moveTo(sourceProjected.x, sourceProjected.y)
            context.lineTo(targetProjected.x, targetProjected.y)
            context.stroke()
        }
    }

    context.restore()
}