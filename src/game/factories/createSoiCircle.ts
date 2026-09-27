import { RadiusComponent } from "@/engine/components/radiusComponent";
import { Entity } from "@/engine/entities/entity";
import { soiRatios, soiFromRadius } from "./helpers";
import { createCircle } from "../systems/createCircle";

export function createSoiCircle(colony: Entity, archetype: keyof typeof soiRatios) {
    return createCircle(
        "rgba(0, 255, 255, 0.25)",
        soiFromRadius(colony.getComponent(RadiusComponent)!, archetype).radius)
}
