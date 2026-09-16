import { Entity } from "@engine/entities/entity"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { SelectionManager } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { Engine } from "@/engine/core/engine"
import type { EntityComponent } from "@engine/entities/entityComponent"
import { SoiComponent } from "@/engine/components/soiComponent"
import { UNIVERSE_SCALE } from "../constants"


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
    sol: 10000,
    baricenter: 1
} as const

export type PlanetArchetype = keyof typeof soiRatios

export function descartesToPolar(orbitAngle: number, orbitRadius: number) {
    return [
        Math.cos(orbitAngle) * orbitRadius,
        Math.sin(orbitAngle) * orbitRadius,
        0
    ] as [number, number, number]
}

export function calculateSoi(radius: number, archetype: keyof typeof soiRatios) {
    return radius * soiRatios[archetype] * UNIVERSE_SCALE
}

export function soiFromRadius(radiusComponent: RadiusComponent, archetype: keyof typeof soiRatios = "kobol") {
    if(!radiusComponent) {
        return new SoiComponent(0)
    }

    return new SoiComponent(calculateSoi(radiusComponent.radius, archetype))
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
            const selectionSystem = engine.getSystem(SelectionManager)
            const selection = selectionSystem?.currentSelection
            if(selection) {
                targetSystem?.setTargetForOrbitSelection(selection, targetEntity, worldX, worldY)
            }
        } else {
            engine.dispatchEvent(new SelectionChangedEvent({ data: targetEntity, type: "colony" }))
        }
    }
}

export function createAttractorClickHandler(engine: Engine, targetEntity: Entity) {
    return ({ event: { shiftKey }, worldX, worldY }: { event: { shiftKey: boolean }, worldX: number, worldY: number }) => {
        if(!engine) return

        if(shiftKey) {
            const targetSystem = engine.getSystem(TargetSystem)
            const selectionSystem = engine.getSystem(SelectionManager)
            const selection = selectionSystem?.currentSelection
            if(selection) {
                targetSystem?.setTargetForOrbitSelection(selection, targetEntity, worldX, worldY)
            }
        } else {
            engine.dispatchEvent(new SelectionChangedEvent({ data: targetEntity, type: "attractor" }))
        }
    }
}
