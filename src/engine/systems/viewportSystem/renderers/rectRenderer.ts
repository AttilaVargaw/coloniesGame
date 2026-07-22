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

        ctx.save();
        rect.setColor(ctx);
        ctx.translate(...getAbsolute(rect.entity!, this.engine!));
        ctx.fillRect(-rect.size.width / 2, -rect.size.height / 2, rect.size.width, rect.size.height);
        rect.draw(ctx)
        ctx.restore();
    }
}
