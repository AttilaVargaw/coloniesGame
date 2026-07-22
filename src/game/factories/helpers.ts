import { Entity } from "@engine/entities/entity"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { LabelComponent } from "@engine/components/label"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { Engine } from "@/engine/core/engine"
import type { EntityComponent } from "@engine/entities/entityComponent"
import { MouseEvent } from "react"
import { SoiComponent } from "@/engine/components/soiComponent"

export const PlanetArchetypes = {
    earth: "earth",
    mercury: "mercury",
    venus: "venus",
    mars: "mars",
    jupiter: "jupiter",
    saturn: "saturn",
    uranus: "uranus",
    neptune: "neptune",
} as const

// Pluto is not a planet anymore
export const soiRatios = {
    earth: 145.2,
    mercury: 45.9,
    venus: 100,
    mars: 170,
    jupiter: 689,
    saturn: 940,
    uranus: 2040,
    neptune: 3525,
} as const

export const bodyColor = new ColorComponent("grey")

export function calculateSoi(radius: number, archetype: keyof typeof soiRatios) {
    return radius * soiRatios[archetype]
}

export function soiFromRadius(radiusComponent: RadiusComponent, archetype: keyof typeof soiRatios = "earth") {
    if(!radiusComponent) {
        return new SoiComponent(0)
    }

    return new SoiComponent(calculateSoi(radiusComponent.radius, archetype))
}

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
        { color: string, radius: number, hoverCursor: "default" | "pointer" | "none" | "not-allowed", clickWidth: number, clickHeight: number, onClick?: (event: { target: Entity, event: MouseEvent, worldX?: number, worldY?: number }) => void }
) {
    return applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(radius),
        new ColorComponent(color),
        new HoverableComponent(hoverCursor, { width: clickWidth, height: clickHeight }),
        new ClickableComponent(true, { width: clickWidth, height: clickHeight }, onClick)
    )
}
