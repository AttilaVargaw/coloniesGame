import { InfoComponent } from "@engine/components/infoComponent";
import type { Entity } from "@engine/entities/entity";
import type { BodyBlueprint } from "./types";
import { solarisAlpha } from "./heliosAlpha";
import { solarisBeta } from "./heliosBeta";
import { heliosGamma } from "./heliosGamma";
import { heliosDelta } from "./heliosDelta";

export function createPatronGodModifier({ name, description, onAdd, onRemove, modifiers }: { modifiers?: Record<string, string>, description: string, name: string, onAdd: (entity: Entity) => Entity, onRemove: (entity: Entity) => Entity }) {
    const nameComponent = new InfoComponent({ patronGod: name, description, ...modifiers })

    return {
        onAdd: (entity: Entity) => onAdd(entity).addComponent(nameComponent),
        onRemove: (entity: Entity) => onRemove(entity.removeComponent(InfoComponent)),
    }
}

export const MapCreationData = {
    angle: 0,
    archetype: "kobol",
    color: "red",
    name: "universe-root",
    radius: 10,
    orbit: { radius: 0, angle: 0, eccentricity: 0 },
    vessels: [],
    binaryPairs: [{
        separation: 1,
        orbit: {
            radius: 1,
            angle: 0
        },
        bodies: [
            solarisBeta,
            solarisAlpha,
        ]
    }, {
        separation: 1,
        orbit: {
            angle: Math.PI,
            radius: 1
        },
        bodies: [
            heliosGamma,
            heliosDelta,
        ]
    }]
} as const as BodyBlueprint