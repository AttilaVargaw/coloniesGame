import { describe, it, expect } from "vitest"
import type { Engine } from "@/engine/core/engine"
import { World } from "@/engine/core/world"
import { PositionComponent } from "@/engine/components/position"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { SoiComponent } from "@/engine/components/soiComponent"
import { PathComponent } from "@/game/components/pathComponent"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { IndustryComponent } from "@/game/components/industryComponent"
import { MassComponent } from "@engine/components/massComponent"
import { createBody, } from "./createBody"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { UNIVERSE_SCALE } from "../constants"

const bodyBlueprint = (overrides: Partial<BodyBlueprint> = {}): BodyBlueprint => ({
    marker: { color: "blue", radius: 5, label: "TestBody" },
    archetype: "kobol",
    orbit: { radius: 10, angle: 0 },
    name: "TestBody",
    population: 1000,
    ...overrides,
})

const homeworldBlueprint = (overrides: Partial<BodyBlueprint> = {}): BodyBlueprint => ({
    ...bodyBlueprint(),
    ...overrides,
})

describe("createBody", () => {
    it("creates a body entity with base components", async () => {
        const engine = new World() as unknown as Engine
        const parent = engine.createEntity("parent")

        const body = await createBody(bodyBlueprint(), parent, engine, 0)

        expect(body).toBeDefined()
        expect(body.getComponent(PositionComponent)).toBeDefined()
        expect(body.getComponent(RadiusComponent)?.radius).toBe(5)
        expect(body.getComponent(SoiComponent)?.radius).toBeCloseTo(5 * 145.2 * UNIVERSE_SCALE)
        expect(body.getComponent(PathComponent)).toBeDefined()
        expect(body.getComponent(OrbitComponent)).toBeDefined()
        expect(body.getComponent(TargetableComponent)).toBeDefined()
        expect(body.getComponent(MassComponent)?.mass).toBe(1)
    })

    it("adds orbit component and sets initial position", async () => {
        const engine = new World() as unknown as Engine
        const parent = engine.createEntity("planet")

        const body = await createBody(bodyBlueprint({
            orbit: { radius: 100, angle: 0, eccentricity: 0.1 },
        }), parent, engine, 0)

        const orbit = body.getComponent(OrbitComponent)
        expect(orbit).toBeDefined()
        expect(orbit!.centerEntityId).toBe(parent.id)
        expect(orbit!.radius).toBeCloseTo(2000)
        expect(orbit!.eccentricity).toBe(0.1)

        const pos = body.getComponent(PositionComponent)!
        expect(pos.x).toBeCloseTo(0)
        expect(pos.y).toBeCloseTo(0)
    })

    it("recursively creates systems inside the body", async () => {
        const engine = new World() as unknown as Engine
        const parent = engine.createEntity("parent")

        const child = bodyBlueprint({
            marker: { color: "grey", radius: 3, label: "Moon" },
            orbit: { radius: 2, angle: 0 },
        })

        const body = await createBody(bodyBlueprint({
            systems: [{ bodies: [child] }],
            orbit: { radius: 100, angle: 0 },
        }), parent, engine, 0)

        const bodyNode = engine.getSceneNode(body)
        expect(bodyNode).toBeDefined()
        const descendants = bodyNode!.collectDescendants()

        const moon = descendants.find(e => e.getComponent(OrbitComponent)?.centerEntityId === body.id)
        expect(moon).toBeDefined()
    })

    it("creates vessels attached to the body", async () => {
        const engine = new World() as unknown as Engine
        const planet = engine.createEntity("planet")

        const body = await createBody(bodyBlueprint({
            vessels: [{ marker: { color: "red", radius: 4, label: "Ship1" }, orbit: { radius: 50, angle: 0 } }],
            orbit: { radius: 100, angle: 0 },
        }), planet, engine, 0)

        const bodyNode = engine.getSceneNode(body)
        expect(bodyNode).toBeDefined()
        const descendants = bodyNode!.collectDescendants()

        const ship = descendants.find(e => e.getComponent(OrbitComponent)?.centerEntityId === body.id)
        expect(ship).toBeDefined()
    })
})

describe("createHomeworld", () => {
    it("adds interactive components when tribe is present", async () => {
        const engine = new World() as unknown as Engine
        const parent = engine.createEntity("parent")

        const colony = await createBody(homeworldBlueprint(), parent, engine, 0)

        expect(colony.getComponent(SelectableComponent)).toBeDefined()
        expect(colony.getComponent(ClickableComponent)).toBeDefined()
        expect(colony.getComponent(IndustryComponent)).toBeDefined()
    })

    it("uses population from tribe to build IndustryComponent", async () => {
        const engine = new World() as unknown as Engine
        const parent = engine.createEntity("parent")

        const population = 5000
        const colony = await createBody(homeworldBlueprint({
            population,
        }), parent, engine, 0)

        const industry = colony.getComponent(IndustryComponent)
        expect(industry).toBeDefined()
    })
})
