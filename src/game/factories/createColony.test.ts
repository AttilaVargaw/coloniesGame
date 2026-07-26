import { describe, it, expect } from "vitest"
import type { Engine } from "@/engine/core/engine"
import { World } from "@/engine/core/world"
import { Entity } from "@/engine/entities/entity"
import { PositionComponent } from "@/engine/components/position"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { SoiComponent } from "@/engine/components/soiComponent"
import { PathComponent } from "@/game/components/pathComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { IndustryComponent } from "@/game/components/industryComponent"
import { createBody } from "./createBody"
import { BodyBlueprint } from "../data/types"

function makeColonyData(overrides: Partial<BodyBlueprint> = {}): BodyBlueprint {
    return {
        tribe: undefined,
        name: "Earth",
        radius: 5,
        archetype: "earth",
        color: "blue",
        orbit: { radius: 10 },
        ...overrides,
    }
}

describe("createBody", () => {
    it("creates a colony entity with base components", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")

        const colony = createBody(
            makeColonyData(),
            parent,
            world
        )

        expect(colony).toBeDefined()

        expect(colony.getComponent(PositionComponent)).toBeDefined()
        expect(colony.getComponent(RadiusComponent)?.radius).toBe(5)
        expect(colony.getComponent(SoiComponent)?.radius).toBeCloseTo(5 * 145.2 * 0.1)
        expect(colony.getComponent(PathComponent)).toBeDefined()
    })

    it("adds interactive components when tribe is present", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")

        const colony = createBody(
            makeColonyData({
                tribe: { population: 1000, name: "Human" },
            }),
            parent,
            world
        )

        expect(colony.getComponent(SelectableComponent)).toBeDefined()
        expect(colony.getComponent(ClickableComponent)).toBeDefined()
        expect(colony.getComponent(IndustryComponent)).toBeDefined()
    })

    it("adds orbit component and sets initial position when orbit is provided", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")
        const planet = world.createEntity("planet")

        const colony = createBody(
            makeColonyData({
                orbit: { radius: 100, angle: 0, eccentricity: 0.1 },
            }),
            planet,
            world
        )

        const orbit = colony.getComponent(OrbitComponent)
        expect(orbit).toBeDefined()
        expect(orbit!.centerEntityId).toBe(planet.id)
        expect(orbit!.radius).toBeCloseTo(4000)
        expect(orbit!.eccentricity).toBe(0.1)

        const pos = colony.getComponent(PositionComponent)!
        expect(pos.x).toBeCloseTo(100)
        expect(pos.y).toBeCloseTo(0)
    })

    it("recursively creates children inside the colony", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")

        const moonData: BodyBlueprint = {
            name: "Moon",
            radius: 3,
            archetype: "kobol",
            color: "grey",
            orbit: { radius: 2 },
        }

        const colony = createBody(
            makeColonyData({
                children: [moonData],
                orbit: { radius: 100, angle: 0 },
            }),
            parent,
            world
        )

        const colonyNode = world.getSceneNode(colony)
        expect(colonyNode).toBeDefined()
        const descendants: Entity[] =
            colonyNode!.collectDescendants()

        const moon = descendants.find(e => e.getComponent(OrbitComponent)?.centerEntityId === colony.id)
        expect(moon).toBeDefined()
    })

    it("creates vessels attached to the colony", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")
        const planet = world.createEntity("planet")

        const colony = createBody(
            makeColonyData({
                vessels: [{ name: "Ship1", radius: 4, orbit: { radius: 50, angle: 0 } }],
                orbit: { radius: 100, angle: 0 },
            }),
            planet,
            world
        )

        const colonyNode = world.getSceneNode(colony)
        expect(colonyNode).toBeDefined()
        const descendants: Entity[] =
            colonyNode!.collectDescendants()

        const ship = descendants.find(e => e.getComponent(OrbitComponent)?.centerEntityId === colony.id)
        expect(ship).toBeDefined()
    })
})
