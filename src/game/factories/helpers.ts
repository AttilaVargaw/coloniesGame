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
    baricenter: 1,
    luna: 10
} as const

export const massByArchetype = {
    earth: 1,
    kobol: 1,
    mercury: 1,
    venus: 0.81,
    mars: 3,
    jupiter: 318,
    saturn: 95,
    uranus: 100,
    neptune: 150,
    sol: 333000,
    baricenter: 0,
    luna: 0.012 * 1000000
} as const

export type PlanetArchetype = keyof typeof soiRatios

export function descartesToPolar(orbitAngle: number, orbitRadius: number): [number, number, number] {
    return [
        Math.cos(orbitAngle) * orbitRadius,
        Math.sin(orbitAngle) * orbitRadius,
        0
    ]
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

export function createEntityClickHandler(
    engine: Engine,
    getShip: () => Entity | undefined,
    targetEntity: Entity,
    options: {
        type: "colony" | "attractor" | "ship"
        orbitSelection?: boolean
    }
) {
    const { type, orbitSelection = false } = options

    return ({ event: { shiftKey }, worldX, worldY }: { event: { shiftKey: boolean }, worldX: number, worldY: number }) => {
        if(!engine) return

        if(shiftKey) {
            const ship = getShip()
            if(!ship) return

            const targetSystem = engine.getSystem(TargetSystem)
            if(orbitSelection) {
                targetSystem?.setTargetForOrbitSelection(ship, targetEntity, worldX, worldY)
            } else {
                targetSystem?.setTarget(ship, targetEntity, worldX, worldY)
            }
        } else {
            engine.dispatchEvent(new SelectionChangedEvent({ data: targetEntity, type }))
        }
    }
}

export function createColonyClickHandler(engine: Engine, targetEntity: Entity) {
    return createEntityClickHandler(
        engine,
        () => engine.getSystem(SelectionManager)?.currentSelection,
        targetEntity,
        { type: "colony", orbitSelection: true }
    )
}

export function createAttractorClickHandler(engine: Engine, targetEntity: Entity) {
    return createEntityClickHandler(
        engine,
        () => engine.getSystem(SelectionManager)?.currentSelection,
        targetEntity,
        { type: "attractor", orbitSelection: true }
    )
}

export function createShipClickHandler(engine: Engine, targetEntity: Entity) {
    return createEntityClickHandler(
        engine,
        () => engine.getSystem(SelectionManager)?.currentSelection,
        targetEntity,
        { type: "ship" }
    )
}
