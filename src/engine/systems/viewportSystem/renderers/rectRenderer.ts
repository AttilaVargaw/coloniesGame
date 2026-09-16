import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { RectNode } from "./rectNode";
import { BaseRenderer } from "./baseRenderer";

export class RectRenderer extends BaseRenderer<RectNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, SizeComponent],
            (e) => new RectNode(e, e.getComponent(PositionComponent)!, e.getComponent(SizeComponent)!, e.getComponent(ColorComponent)!),
        )
    }

    protected getCullMargin(node: RectNode): number {
        return Math.max(node.size.width, node.size.height) / 2
    }

    protected updateNode(rect: RectNode, _dt?: number): void {
        const { projected } = this.getProjected(rect)
        const ctx = this.viewportSystem.viewport.camera.context;

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
