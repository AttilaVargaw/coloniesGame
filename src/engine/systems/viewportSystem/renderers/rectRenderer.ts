import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { RectNode } from "./rectNode";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { isVisible } from "./isVisible";
import { BaseRenderer } from "./baseRenderer";

export class RectRenderer extends BaseRenderer<RectNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, SizeComponent],
            (e) => new RectNode(e, e.getComponent(PositionComponent)!, e.getComponent(SizeComponent)!, e.getComponent(ColorComponent)!),
        )
    }

    protected filterNodes = (node: RectNode) => {
        const { camera } = this.viewportSystem.viewport;
        const margin = Math.max(node.size.width, node.size.height) / 2;
        return isVisible(camera.visibleBounds, margin, node.entity!, this.engine!);
    };

    protected updateNode(rect: RectNode, _dt?: number): void {
        const { camera } = this.viewportSystem.viewport;

        const ctx = camera.context;

        const [wx, wy, wz] = getAbsolute(rect.entity!, this.engine!);
        const projected = camera.project(wx, wy, wz)
        if (!projected) {
            return
        }

        rect.setColor(ctx);
        const screenWidth = rect.size.width * projected.scale
        const screenHeight = rect.size.height * projected.scale
        ctx.fillRect(
            projected.x - screenWidth / 2,
            projected.y - screenHeight / 2,
            screenWidth,
            screenHeight
        )
        rect.draw(ctx)
    }
}
