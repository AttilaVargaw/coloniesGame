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
import { Colony } from "@/game/data/types"
import { createBody } from "./createBody"

function makeColonyData(overrides: Partial<Colony> = {}): Colony {
    return {
        color: "blue",
        name: "Earth",
        distanceFromParent: 10,
        radius: 5,
        archetype: "earth",
        ...overrides,
    }
}

describe("createColony", () => {
    it("creates a colony entity with base components", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")

        const colony = createBody({
            engine: world,
            data: makeColonyData(),
            parent,
        })

        expect(colony).toBeDefined()

        expect(colony.getComponent(PositionComponent)).toBeDefined()
        expect(colony.getComponent(RadiusComponent)?.radius).toBe(5)
        expect(colony.getComponent(SoiComponent)?.radius).toBeCloseTo(5 * 145.2 * 0.1)
        expect(colony.getComponent(PathComponent)).toBeDefined()
    })

    it("adds interactive components when population is present", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")

        const colony = createBody({
            engine: world,
            data: makeColonyData({ population: 1000 }),
            parent,
        })

        expect(colony.getComponent(SelectableComponent)).toBeDefined()
        expect(colony.getComponent(ClickableComponent)).toBeDefined()
        expect(colony.getComponent(IndustryComponent)).toBeDefined()
    })

    it("adds orbit component and sets initial position when orbitArgs is provided", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")

        const colony = createBody({
            engine: world,
            data: makeColonyData(),
            parent,
            orbitArgs: {
                radius: 100,
                angle: 0,
                eccentricity: 0.1,
            }
        })

        const orbit = colony.getComponent(OrbitComponent)
        expect(orbit).toBeDefined()
        expect(orbit!.centerEntityId).toBe(parent.id)
        expect(orbit!.radius).toBe(100)
        expect(orbit!.eccentricity).toBe(0.1)

        const pos = colony.getComponent(PositionComponent)!
        expect(pos.x).toBeCloseTo(100)
        expect(pos.y).toBeCloseTo(0)
    })

    it("recursively creates moons inside the colony", () => {
        const world = new World() as unknown as Engine
        const parent = world.createEntity("parent")

        const moonData: Colony = {
            name: "Moon",
            distanceFromParent: 2,
            radius: 3,
            archetype: "kobol",
            color: "grey",
        }

        const colony = createBody({
            engine: world,
            data: makeColonyData({ moons: new Map([["Moon", moonData]]) }),
            parent,
            orbitArgs: { radius: 100, angle: 0 },
        })

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

        const colony = createBody({
            engine: world,
            data: makeColonyData({ vessels: [{ name: "Ship1", radius: 4, orbitRadius: 50, angle: 0 }] }),
            parent,
            orbitArgs: { radius: 100, angle: 0 },
        })

        const colonyNode = world.getSceneNode(colony)
        expect(colonyNode).toBeDefined()
        const descendants: Entity[] =
            colonyNode!.collectDescendants()

        const ship = descendants.find(e => e.getComponent(OrbitComponent)?.centerEntityId === colony.id)
        expect(ship).toBeDefined()
    })
})
