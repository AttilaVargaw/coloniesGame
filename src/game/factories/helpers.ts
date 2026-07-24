import { Entity } from "@engine/entities/entity"
import { ColorComponent } from "@engine/components/colorComponent"
import { LabelComponent } from "@engine/components/label"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { Engine } from "@/engine/core/engine"
import type { EntityComponent } from "@engine/entities/entityComponent"
import { SoiComponent } from "@/engine/components/soiComponent"

const soiRatio = 0.1

export const soiRatios = {
    earth: 145.2,
    kobol: 145.2,
    mercury: 45.9,
    venus: 100,
    mars: 170,
    jupiter: 689,
    saturn: 940,
    uranus: 2040,
    neptune: 3525,
} as const

export const bodyColor = new ColorComponent("grey", "", true)

export function calculateSoi(radius: number, archetype: keyof typeof soiRatios) {
    return radius * soiRatios[archetype] * soiRatio
}

export function soiFromRadius(radiusComponent: RadiusComponent, archetype: keyof typeof soiRatios = "kobol") {
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

export function createColonyClickHandler(engine: Engine, targetEntity: Entity) {
    return ({ event: { shiftKey }, worldX, worldY }: { event: { shiftKey: boolean }, worldX: number, worldY: number }) => {
        if(!engine) return

        if(shiftKey) {
            const targetSystem = engine.getSystem(TargetSystem)
            const selectionSystem = engine.getSystem(SelectionSystem)
            const selection = selectionSystem?.currentSelection()
            if(selection) {
                targetSystem?.setTarget(selection, targetEntity, worldX, worldY)
            }
        } else {
            engine.dispatchEvent(new SelectionChangedEvent({ data: targetEntity, type: "colony" }))
        }
    }
}
