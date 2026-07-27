import { ColorComponent } from "@/engine/components/colorComponent";
import { PositionComponent } from "@/engine/components/position";
import { RadiusComponent } from "@/engine/components/radiusComponent";
import { Engine } from "@/engine/core/engine";
import { Entity } from "@/engine/entities/entity";
import { soiRatios, applyComponents, soiFromRadius } from "./helpers";

export function createSoiCircle(colony: Entity, archetype: keyof typeof soiRatios, engine: Engine) {
    return applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiFromRadius(colony.getComponent(RadiusComponent)!, archetype).radius),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    );
}
