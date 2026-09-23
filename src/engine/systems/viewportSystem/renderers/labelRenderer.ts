import { PositionComponent } from "../../../components/position";
import { LabelComponent } from "../../../components/label";
import { ColorComponent } from "@engine/components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { LabelNode } from "./labelNode";
import { BaseRenderer } from "./baseRenderer";

export class LabelRenderer extends BaseRenderer<LabelNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, ColorComponent, LabelComponent],
            (e) => new LabelNode(e, e.getComponent(PositionComponent)!, e.getComponent(ColorComponent)!, e.getComponent(LabelComponent)!),
        )
    }

    protected getCullMargin(node: LabelNode): number {
        return node.label.size
    }

    protected updateNode(node: LabelNode, _dt?: number): void {
        const { projected } = this.getProjected(node)
        const ctx = this.viewportSystem.viewport.camera.context;

        ctx.save()
        node.setColor(ctx);
        const screenSize = node.label.size * projected.scale
        const offsetX = (node.label.offset.x || 0) * projected.scale
        const offsetY = (node.label.offset.y || 0) * projected.scale

        ctx.font = `${screenSize}px Chronosfer`;
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = screenSize * 0.25
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0

        const lines = node.label.text.split("\n")
        const lineHeight = screenSize * 1.2
        const totalHeight = lines.length * lineHeight

        let y = projected.y + offsetY - totalHeight / 2 + lineHeight / 2
        for(const line of lines) {
            ctx.fillText(line, projected.x + offsetX, y);
            y += lineHeight
        }
        ctx.restore()
    }
}
