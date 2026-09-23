import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MoveSystem, getActivePaths, getTodaysJumps, setShipPath, clearShipPath, clearAllPaths } from "./moveSystem"
import { Entity } from "@/engine/entities/entity"
import { PositionComponent } from "@/engine/components/position"
import { JumpDriveComponent, SensorSuiteComponent } from "@/game/components/vessel"
import { TargetSystem } from "./targetSystem"
import { SceneNode } from "@/engine/entities/sceneNode"
import { MoveNode } from "./moveSystem"
import { SoiComponent } from "@/engine/components/soiComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { PathComponent } from "@/game/components/pathComponent"
import { StartState } from "../data/StartState"

function makeMoveNode(entity: Entity, range: number): MoveNode {
    const pos = entity.getComponent(PositionComponent)!
    const drive = entity.getComponent(JumpDriveComponent)!
    const suite = new SensorSuiteComponent(range)
    return new MoveNode(entity, pos, drive, suite)
}

describe("move system waypoint queue", () => {
    let ship: Entity
    let parentTarget: Entity
    let targetAttractor: Entity
    let parentNode: SceneNode
    let shipNode: SceneNode
    let targetNode: SceneNode
    let sceneNodes: Map<Entity, SceneNode>
    let mockEngine: any

    let clearTargetMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        clearAllPaths()
        clearTargetMock = vi.fn()

        StartState.map.attractors.clear()
        StartState.map.waypoints.clear()

        parentTarget = new Entity("parent")
        parentTarget.addComponent(new PositionComponent(0, 0))
        parentTarget.addComponent(new SoiComponent(0))
        parentTarget.addComponent(new PathComponent())

        targetAttractor = new Entity("target")
        targetAttractor.addComponent(new PositionComponent(200, 0))
        targetAttractor.addComponent(new SoiComponent(300))
        targetAttractor.addComponent(new PathComponent())
        StartState.map.attractors.set("target", targetAttractor)

        ship = new Entity("ship")
        ship.addComponent(new PositionComponent(0, 0))
        ship.addComponent(new JumpDriveComponent())
        ship.addComponent(new SensorSuiteComponent(2))

        parentNode = new SceneNode(parentTarget.id, parentTarget)
        shipNode = new SceneNode(ship.id, ship)
        targetNode = new SceneNode(targetAttractor.id, targetAttractor)

        shipNode.parent = parentNode

        sceneNodes = new Map([
            [ship, shipNode],
            [parentTarget, parentNode],
            [targetAttractor, targetNode],
        ])

        mockEngine = {
            getSceneNode: (e: Entity) => sceneNodes.get(e),
            addCommand: vi.fn(),
            getSystem: (ctor: new (...args: any[]) => any) => {
                if(ctor === TargetSystem) {
                    return { clearTarget: clearTargetMock }
                }
                return undefined
            },
        }
    })

    afterEach(() => {
        clearAllPaths()
        StartState.map.attractors.clear()
        StartState.map.waypoints.clear()
    })

    it("does not queue a path of length 1 or less", () => {
        const path = [ship]
        setShipPath(ship, path)
        expect(getActivePaths()).toHaveLength(0)
        expect(ship.getComponent(JumpDriveComponent)!.target).toBeUndefined()
    })

    it("queues waypoints and sets the first as target", () => {
        const w1 = new Entity("w1")
        const w2 = new Entity("w2")
        w1.addComponent(new PositionComponent(100, 0))
        w2.addComponent(new PositionComponent(200, 0))

        const path = [ship, w1, w2]
        setShipPath(ship, path)

        const active = getActivePaths()
        expect(active).toHaveLength(1)
        expect(active[0].waypoints).toEqual([w1, w2])
        expect(ship.getComponent(JumpDriveComponent)!.target).toBe(w1)
    })

    it("clearShipPath removes the ship from the queue", () => {
        const w1 = new Entity("w1")
        w1.addComponent(new PositionComponent(100, 0))

        setShipPath(ship, [ship, w1])
        expect(getActivePaths()).toHaveLength(1)

        clearShipPath(ship)
        expect(getActivePaths()).toHaveLength(0)
        expect(ship.getComponent(JumpDriveComponent)!.target).toBeUndefined()
    })

    it("moveNodes consumes waypoints up to the sensor range", () => {
        const w1 = new Entity("w1")
        const w2 = new Entity("w2")
        const w3 = new Entity("w3")
        const w4 = new Entity("w4")
        w1.addComponent(new PositionComponent(100, 0))
        w2.addComponent(new PositionComponent(200, 0))
        w3.addComponent(new PositionComponent(300, 0))
        w4.addComponent(new PositionComponent(400, 0))

        const w1Node = new SceneNode(w1.id, w1)
        const w2Node = new SceneNode(w2.id, w2)
        const w3Node = new SceneNode(w3.id, w3)
        const w4Node = new SceneNode(w4.id, w4)

        sceneNodes.set(w1, w1Node)
        sceneNodes.set(w2, w2Node)
        sceneNodes.set(w3, w3Node)
        sceneNodes.set(w4, w4Node)

        ship.addComponent(new SensorSuiteComponent(2))
        setShipPath(ship, [ship, w1, w2, w3, w4])

        const moveSystem = new MoveSystem()
            ; (moveSystem as any).engine = mockEngine
            ; (moveSystem as any).nodes = [makeMoveNode(ship, 2)]

        moveSystem.moveNodes()

        expect(ship.getComponent(JumpDriveComponent)!.target).toBe(w3)
        expect(getActivePaths()).toHaveLength(1)
        expect(getTodaysJumps()[0].path).toEqual([parentTarget, w1, w2])
    })

    it("moveNodes clears the path and unTarget when the final waypoint is reached", () => {
        const w1 = new Entity("w1")
        w1.addComponent(new PositionComponent(100, 0))

        const w1Node = new SceneNode(w1.id, w1)
        sceneNodes.set(w1, w1Node)

        ship.addComponent(new SensorSuiteComponent(3))
        setShipPath(ship, [ship, w1])

        const moveSystem = new MoveSystem()
            ; (moveSystem as any).engine = mockEngine
            ; (moveSystem as any).nodes = [makeMoveNode(ship, 3)]

        moveSystem.moveNodes()

        expect(ship.getComponent(JumpDriveComponent)!.target).toBeUndefined()
        expect(getActivePaths()).toHaveLength(0)
        expect(getTodaysJumps()).toHaveLength(0)
        expect(clearTargetMock).toHaveBeenCalled()
    })

    it("moveNodes still reparents ships with a direct target but no queued waypoints", () => {
        ship.getComponent(JumpDriveComponent)!.target = targetAttractor
        // no waypoints in shipWaypoints
        targetAttractor.getComponent(SoiComponent)!.radius = 500

        const moveSystem = new MoveSystem()
            ; (moveSystem as any).engine = mockEngine
            ; (moveSystem as any).nodes = [makeMoveNode(ship, 1)]

        moveSystem.moveNodes()

        expect(shipNode.parent?.entity).toBe(targetAttractor)
        const orbit = ship.getComponent(OrbitComponent)
        expect(orbit).toBeDefined()
        expect(orbit!.centerEntityId).toBe(targetAttractor.id)
    })

    it("moveNodes resolves orbit to the closest attractor within SOI when no waypoints remain", () => {
        const planet = new Entity("planet")
        planet.addComponent(new PositionComponent(50, 0))
        planet.addComponent(new SoiComponent(200))
        planet.addComponent(new PathComponent())
        StartState.map.attractors.set("planet", planet)

        const planetNode = new SceneNode(planet.id, planet)
        sceneNodes.set(planet, planetNode)

        targetAttractor.getComponent(SoiComponent)!.radius = 50

        ship.addComponent(new SensorSuiteComponent(2))
        setShipPath(ship, [ship, targetAttractor, planet])

        const moveSystem = new MoveSystem()
            ; (moveSystem as any).engine = mockEngine
            ; (moveSystem as any).nodes = [makeMoveNode(ship, 2)]

        moveSystem.moveNodes()

        expect(shipNode.parent?.entity).toBe(targetAttractor)
        const orbit = ship.getComponent(OrbitComponent)
        expect(orbit).toBeDefined()
        expect(orbit!.centerEntityId).toBe(targetAttractor.id)
    })

    it("moveNodes uses click coordinates for orbit radius when the final waypoint is reached", () => {
        ship.getComponent(JumpDriveComponent)!.target = targetAttractor
        ship.getComponent(JumpDriveComponent)!.clickX = 100
        ship.getComponent(JumpDriveComponent)!.clickY = 20
        ship.addComponent(new SensorSuiteComponent(1))
        setShipPath(ship, [ship, targetAttractor])

        const moveSystem = new MoveSystem()
            ; (moveSystem as any).engine = mockEngine
            ; (moveSystem as any).nodes = [makeMoveNode(ship, 1)]

        moveSystem.moveNodes()

        const orbit = ship.getComponent(OrbitComponent)
        expect(orbit).toBeDefined()
        expect(orbit!.centerEntityId).toBe(targetAttractor.id)
        expect(orbit!.radius).toBeCloseTo(Math.hypot(100 - 200, 20))
        expect(orbit!.meanAnomaly).toBeCloseTo(Math.atan2(20, 100 - 200))
    })
})
