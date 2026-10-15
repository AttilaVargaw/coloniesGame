import { PositionComponent } from "../../../components/position";
import { LabelComponent } from "../../../components/label";
import { ColorComponent } from "@engine/components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { LabelNode } from "./labelNode";
import { BaseRenderer } from "./baseRenderer";
import { ProjectedPoint } from "@/lib/camera";
import type { vec3 } from "gl-matrix";

const MAX_LABEL_SCREEN_SIZE = 48;
const MIN_LABEL_SCREEN_SIZE = 12;

export class LabelRenderer extends BaseRenderer<LabelNode> {
    beginFrame(): void {
    }
    endFrame(): void {
    }
    protected getCullMargin(_node: LabelNode): number {
        // Label sizes are clamped screen pixels, not world-proportional, so the
        // viewport-bounds pre-check cannot express their true extent. Bypass it
        // entirely and let shouldCullNode do the precise box check.
        return Number.POSITIVE_INFINITY
    }
    protected shouldCullNode(node: LabelNode, projected: ProjectedPoint, _worldPos: vec3): boolean {
        const camera = this.viewportSystem.camera
        if(!camera) {
            return false
        }

        const size = Math.min(MAX_LABEL_SCREEN_SIZE, Math.max(MIN_LABEL_SCREEN_SIZE, node.label.size * projected.scale))
        const lines = node.label.text.split("\n").length
        const totalHeight = lines * size * 1.2
        const offsetX = (node.label.offset.x || 0) * projected.scale
        const offsetY = (node.label.offset.y || 0) * projected.scale

        const cx = projected.x + offsetX
        const cy = projected.y + offsetY
        const halfHeight = totalHeight / 2
        const halfWidth = node.label.text.length * size * 0.6 / 2

        const b = camera.visibleBounds
        return (
            cx + halfWidth <= b.left ||
            cx - halfWidth >= b.right ||
            cy + halfHeight <= b.top ||
            cy - halfHeight >= b.bottom
        )
    }
    protected shouldSkipProjection(_node: LabelNode, _cameraDistance: number, _cameraScale: number): boolean {
        return false
    }

    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, ColorComponent, LabelComponent],
            (e) => new LabelNode(e, e.getComponent(PositionComponent)!, e.getComponent(ColorComponent)!, e.getComponent(LabelComponent)!),
        )
    }

    drawNodes(context: CanvasRenderingContext2D): void {
        for(const { node, projected } of this.getProjectedCacheEntries()) {
            context.save()
            node.setColor(context);
            const screenSize = Math.min(MAX_LABEL_SCREEN_SIZE, Math.max(MIN_LABEL_SCREEN_SIZE, node.label.size * projected.scale))
            const offsetX = (node.label.offset.x || 0) * projected.scale
            const offsetY = (node.label.offset.y || 0) * projected.scale

            context.font = `${screenSize}px Chronosfer`;
            context.shadowColor = "rgba(0, 0, 0, 0.8)"
            context.shadowBlur = screenSize * 0.25
            context.shadowOffsetX = 0
            context.shadowOffsetY = 0

            const lines = node.label.text.split("\n")
            const lineHeight = screenSize * 1.2
            const totalHeight = lines.length * lineHeight

            let y = projected.y + offsetY - totalHeight / 2 + lineHeight / 2
            for(const line of lines) {
                context.fillText(line, projected.x + offsetX, y);
                y += lineHeight
            }
            context.restore()
        }
    }
}
