import { PositionComponent } from "../../../components/position";
import { LabelComponent } from "../../../components/label";
import { ColorComponent } from "@engine/components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { LabelNode } from "./labelNode";
import { BaseRenderer } from "./baseRenderer";
import { ProjectedPoint } from "@/lib/camera";
import { Vector3 } from "@/lib/Vector3";

const MAX_LABEL_SCREEN_SIZE = 48;

export class LabelRenderer extends BaseRenderer<LabelNode> {
    beginFrame(): void {
    }
    endFrame(): void {
    }
    protected getCullMargin(_node: LabelNode): number {
        return 0
    }
    protected shouldCullNode(_node: LabelNode, _projected: ProjectedPoint, _worldPos: Vector3): boolean {
        return false
    }
    protected shouldSkipProjection(_node: LabelNode, _cameraScale: number): boolean {
        return false
    }

    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, ColorComponent, LabelComponent],
            (e) => new LabelNode(e, e.getComponent(PositionComponent)!, e.getComponent(ColorComponent)!, e.getComponent(LabelComponent)!),
        )
    }

    static getCullMargin(node: LabelNode): number {
        return node.label.size
    }

    drawNodes(node: LabelNode, _dt?: number, ctx?: CanvasRenderingContext2D): void {
        const { projected } = this.getProjected(node)
        const context = ctx ?? this.viewportSystem.camera.context;

        context.save()
        node.setColor(context);
        const screenSize = Math.min(MAX_LABEL_SCREEN_SIZE, node.label.size * projected.scale)
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
