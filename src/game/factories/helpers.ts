import { Entity } from "@engine/entities/entity"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { LabelComponent } from "@engine/components/label"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { Engine } from "@/engine/core/engine"
import type { EntityComponent } from "@engine/entities/entityComponent"

export const bodyColor = new ColorComponent("grey")

export function createLabel(engine: Engine, text: string, fontSize = 18, color = "white", x = 0, y = 0, z = 0) {
    return applyComponents(engine.createEntity(),
        new LabelComponent(text, fontSize),
        new ColorComponent(color),
        new PositionComponent(x, y, z)
    )
}

export function applyComponents(entity: Entity, ...components: EntityComponent[]) {
    for(const component of components) {
        entity.addComponent(component)
    }
    return entity
}

export function createBody(
    engine: Engine,
    { color, radius, hoverCursor, clickWidth, clickHeight, onClick }:
    { color: string, radius: number, hoverCursor: "default" | "pointer" | "none" | "not-allowed", clickWidth: number, clickHeight: number, onClick: () => void }
) {
    return applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(radius),
        new ColorComponent(color),
        new HoverableComponent(hoverCursor, { width: clickWidth, height: clickHeight }),
        new ClickableComponent(true, { width: clickWidth, height: clickHeight }, onClick)
    )
}
