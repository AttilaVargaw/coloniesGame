import { ColorComponent } from "@engine/components/colorComponent"
import { LabelComponent } from "@engine/components/label"
import { PositionComponent, WorldPosition } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { createEntity } from "@/engine/lib/entityRegistry"
import { MapMarker } from "../data/MapMarker"

export function createMarker({
    offset,
    color,
    radius,
    label,
    labelColor = "red",
    textSize = 18,
    name,
    emitLight,
}: MapMarker) {
    const marker = createEntity(name)
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new ColorComponent(color, "", emitLight))
        .addComponent(new RadiusComponent(radius))

    if(label) {
        marker.addComponent(new LabelComponent(label, textSize, offset ?? { x: radius * 2 + 10, y: 0, z: 0 } as WorldPosition, labelColor))
    }

    return marker
}