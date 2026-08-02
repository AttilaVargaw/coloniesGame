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

        camera.begin();

        node.setColor(ctx);
        ctx.translate(...getAbsolute(node.entity!, this.engine!));
        ctx.font = `${node.label.size}px Roboto`;
        ctx.fillText(node.label.text, node.label.offset.x, node.label.offset.y);

        camera.end();
    }
}
