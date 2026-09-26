import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { BaseRenderer } from "./baseRenderer";
import { RenderableNode } from "./renderableNode";
import { Entity } from "../../../entities/entity";
import { BuildableComponent } from "@/game/components/buildableComponent";

export class BuildableMarkerNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public radius: RadiusComponent,
        public color: ColorComponent,
        public buildable: BuildableComponent,
    ) {
        super(color, entity);
    }
}

export class BuildableMarkerRenderer extends BaseRenderer<BuildableMarkerNode> {
    private time = 0;

    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, RadiusComponent, ColorComponent, BuildableComponent],
            (e) => new BuildableMarkerNode(e, e.getComponent(PositionComponent)!, e.getComponent(RadiusComponent)!, e.getComponent(ColorComponent)!, e.getComponent(BuildableComponent)!),
        )
    }

    protected getCullMargin(node: BuildableMarkerNode): number {
        return node.radius.radius * 1.5;
    }

    protected updateNode(node: BuildableMarkerNode, dt?: number): void {
        if (dt) {
            this.time += dt;
        }

        const { projected } = this.getProjected(node)
        const ctx = this.viewportSystem.viewport.camera.context;
        const screenRadius = node.radius.radius * projected.scale;

        ctx.save()
        ctx.translate(projected.x, projected.y)

        const orbitRadius = screenRadius * 1.6;
        const dotRadius = screenRadius * 0.18;
        const segments = 3;
        const phaseOffset = this.time * 0.0015;

        for (let i = 0; i < segments; i++) {
            const angle = phaseOffset + (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * orbitRadius;
            const y = Math.sin(angle) * orbitRadius;

            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = "#facc15";
            ctx.fill();
        }

        ctx.restore()
    }
}
