import { ColorComponent } from "@/engine/components/colorComponent";
import { PositionComponent } from "@/engine/components/position";
import { RadiusComponent } from "@/engine/components/radiusComponent";
import { ThicknessComponent } from "@/engine/components/thicknessComponent";
import { Engine } from "@/engine/core/engine";

export function createCircle(engine: Engine, color: string, radius: number) {
    return engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new RadiusComponent(radius))
        .addComponent(new ColorComponent("", color))
        .addComponent(new ThicknessComponent(1))
}