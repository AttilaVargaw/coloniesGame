import { System } from "../system"
import { BaseRenderer } from "./renderers/baseRenderer"
import { ProjectedPoint } from "@/lib/camera"
import { ShapeRenderer } from "./renderers/shapeRenderer"
import { CircleRenderer } from "./renderers/circleRenderer"
import { LabelRenderer } from "./renderers/labelRenderer"
import { RectRenderer } from "./renderers/rectRenderer"

interface RenderEntry {
    renderer: BaseRenderer<any>
    node: any
    projected: ProjectedPoint
}

export class RenderScheduler extends System {
    private readonly rendererClasses = [
        ShapeRenderer,
        CircleRenderer,
        LabelRenderer,
        RectRenderer,
    ]

    update(_dt: number): void {
        if (!this.engine) {
            return
        }

        const allEntries: RenderEntry[] = []

        for (const rendererClass of this.rendererClasses) {
            const renderer = this.engine.getSystem(rendererClass as new (...args: any[]) => BaseRenderer<any>) as BaseRenderer<any> | undefined
            if (!renderer) {
                continue
            }

            renderer.projectNodes()

            for (const { node, projected } of renderer.getProjectedCacheEntries()) {
                allEntries.push({ renderer, node, projected })
            }
        }

        allEntries.sort((a, b) => b.projected.depth - a.projected.depth)

        for (const entry of allEntries) {
            entry.renderer.drawNode(entry.node, _dt)
        }
    }
}
