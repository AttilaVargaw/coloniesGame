import { PositionComponent } from "../../../components/position";
import { LabelComponent } from "../../../components/label";
import { ColorComponent } from "@engine/components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { LabelNode } from "./labelNode";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { isVisible } from "./isVisible";
import { BaseRenderer } from "./baseRenderer";

export class LabelRenderer extends BaseRenderer<LabelNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, ColorComponent, LabelComponent],
            (e) => new LabelNode(e, e.getComponent(PositionComponent)!, e.getComponent(ColorComponent)!, e.getComponent(LabelComponent)!),
        )
    }

    protected filterNodes = (node: LabelNode) => {
        const { viewport: { camera } } = this.viewportSystem;

        return isVisible(camera.visibleBounds, node.label.size, node.entity!, this.engine!);
    };

    protected updateNode(node: LabelNode, _dt?: number): void {
        const { viewport: { camera } } = this.viewportSystem;
        const ctx = camera.context;

        const [wx, wy, wz] = getAbsolute(node.entity!, this.engine!)
        const projected = camera.project(wx, wy, wz)
        if (!projected) {
            return
        }

        ctx.save()
        node.setColor(ctx);
        const screenSize = node.label.size * projected.scale
        const offsetX = (node.label.offset.x || 0) * projected.scale
        const offsetY = (node.label.offset.y || 0) * projected.scale

        ctx.font = `${screenSize}px Roboto`;
        ctx.fillText(node.label.text, projected.x + offsetX, projected.y + offsetY);
        ctx.restore()
    }
}
