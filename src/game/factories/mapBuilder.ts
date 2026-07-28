/* eslint-disable @typescript-eslint/no-unused-vars */
import { PositionComponent } from "@engine/components/position";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { PathComponent } from "../components/pathComponent";
import { SoiComponent } from "@engine/components/soiComponent";
import { MapCreationData } from "../data/gameData";
import { StartState } from "../data/StartState";
import { Engine } from "@/engine/core/engine";
import type { Entity } from "@engine/entities/entity";
import { applyComponents } from "./helpers";
import { RadiusComponent } from "@/engine/components/radiusComponent";
import { ColorComponent } from "@/engine/components/colorComponent";
import { TWO_PI } from "../constants";
import { WaypointGrid, DEFAULT_RINGS } from "./waypointGrid";
import { createBody } from "./createBody";

export function init(engine: Engine) {
    const viewportSystem = engine.getSystem(ViewportSystem)
    viewportSystem.sortOnEveryEntityAddition = false

    const root = engine.createEntity(MapCreationData.name)
    applyComponents(root,
        new PositionComponent(0, 0, 0),
        new RadiusComponent(10),
        new SoiComponent(0),
        new PathComponent(),
        new ColorComponent("red"),
    )
    const map = createBody(MapCreationData, root, engine)

    // for(const body of MapCreationData.children!) {
    //     const cx = starData.x * UNIVERSE_SCALE
    //     const cy = starData.y * UNIVERSE_SCALE

    //     const star = createSolarSystem(engine, starData)
    //     StartState.map.attractors.set(starData.name, star)

    //     const starSceneNode = engine.getSceneNode(star)
    //     if(!starSceneNode) continue
    //     const attractors: Entity[] = [star]

    //     for(const childEntity of starSceneNode.collectDescendants()) {
    //         if(
    //             childEntity !== star &&
    //             childEntity.getComponent(SoiComponent) &&
    //             childEntity.getComponent(PathComponent)
    //         ) {
    //             attractors.push(childEntity)
    //             StartState.map.attractors.set(childEntity.id, childEntity)
    //         }
    //     }

    //     const grid = new WaypointGrid(starName, star, DEFAULT_RINGS)
    //     StartState.map.grids.set(starName, grid)

    //     createWaypoints(engine, grid, starSceneNode!)
    //     linkAngularNeighbors(grid)
    //     linkRadialNeighbors(grid)
    //     linkAttractors(grid, attractors, cx, cy)
    //     deduplicateLinks(grid)

    // if(starData.binaryPairs) {
    //     for(const binaryPair of starData.binaryPairs) {
    //         const [first, second] = binaryPair[0].split("-")
    //         createBinaryOrbitPair(engine, cocalus, starData.planets.get(first)!, starData.planets.get(second)!, binaryPair[1])
    //     }
    // }

    //     // stars.set(starName, star)
    // }

    // linkStarBridges()

    viewportSystem.sortOnEveryEntityAddition = true
}

function createWaypoints(
    engine: Engine,
    grid: WaypointGrid,
    starSceneNode: NonNullable<ReturnType<typeof engine.getSceneNode>>
): void {
    for(let ringIdx = 0; ringIdx < grid.getRingCount(); ringIdx++) {
        const ring = grid.rings[ringIdx]
        for(let angleIdx = 0; angleIdx < ring.waypointCount; angleIdx++) {
            const angle = (angleIdx / ring.waypointCount) * ring.spread
            const wx = Math.cos(angle) * ring.radius
            const wy = Math.sin(angle) * ring.radius
            const key = grid.getKey(ringIdx, angleIdx)

            if(StartState.map.waypoints.has(key)) continue

            const waypoint = engine.createEntity()
                .addComponent(new PositionComponent(wx, wy))
                .addComponent(new PathComponent())
            engine.addEntity(waypoint)

            const wpNode = engine.getSceneNode(waypoint)
            if(wpNode) starSceneNode.addChild(wpNode)

            StartState.map.waypoints.set(key, waypoint)
            grid.waypoints.set(key, waypoint)
        }
    }
}

function linkAngularNeighbors(grid: WaypointGrid): void {
    for(let ringIdx = 0; ringIdx < grid.getRingCount(); ringIdx++) {
        const ring = grid.rings[ringIdx]
        const count = ring.waypointCount

        for(let angleIdx = 0; angleIdx < count; angleIdx++) {
            const wp = grid.getWaypoint(ringIdx, angleIdx)!
            const wpPath = wp.getComponent(PathComponent)!
            const nextAngleIdx = (angleIdx + 1) % count
            const prevAngleIdx = (angleIdx - 1 + count) % count

            const next = grid.getWaypoint(ringIdx, nextAngleIdx)
            const prev = grid.getWaypoint(ringIdx, prevAngleIdx)
            if(next) wpPath.linked.push(next.getComponent(PathComponent)!)
            if(prev) wpPath.linked.push(prev.getComponent(PathComponent)!)
        }
    }
}

function linkRadialNeighbors(grid: WaypointGrid): void {
    for(let ringIdx = 1; ringIdx < grid.getRingCount(); ringIdx++) {
        const ring = grid.rings[ringIdx]
        const prevRing = grid.rings[ringIdx - 1]
        const count = ring.waypointCount
        const prevCount = prevRing.waypointCount

        for(let angleIdx = 0; angleIdx < count; angleIdx++) {
            const wp = grid.getWaypoint(ringIdx, angleIdx)!
            const wpPath = wp.getComponent(PathComponent)!
            const angle = (angleIdx / count) * ring.spread

            const prevAngleIdx = Math.round((angle / prevRing.spread) * prevCount) % prevCount
            const prev = grid.getWaypoint(ringIdx - 1, prevAngleIdx)
            if(prev) wpPath.linked.push(prev.getComponent(PathComponent)!)
        }
    }
}

function linkAttractors(
    grid: WaypointGrid,
    attractors: Entity[],
    cx: number,
    cy: number
): void {
    for(const attractor of attractors) {
        const attractorSoi = attractor.getComponent(SoiComponent)!.radius
        const attractorPos = attractor.getComponent(PositionComponent)!
        const attractorPath = attractor.getComponent(PathComponent)!

        const distFromStar = Math.hypot(attractorPos.x - cx, attractorPos.y - cy)

        let closestRingIdx = 0
        let closestDist = Infinity
        for(let ringIdx = 0; ringIdx < grid.getRingCount(); ringIdx++) {
            const ringDist = Math.abs(grid.rings[ringIdx].radius - distFromStar)
            if(ringDist < closestDist) {
                closestDist = ringDist
                closestRingIdx = ringIdx
            }
        }

        const ringsToCheck = new Set<number>([closestRingIdx])
        if(closestRingIdx > 0) {
            ringsToCheck.add(closestRingIdx - 1)
        }
        if(closestRingIdx < grid.getRingCount() - 1) {
            ringsToCheck.add(closestRingIdx + 1)
        }

        for(const ringIdx of ringsToCheck) {
            const ring = grid.rings[ringIdx]

            for(let angleIdx = 0; angleIdx < ring.waypointCount; angleIdx++) {
                const wp = grid.getWaypoint(ringIdx, angleIdx)!
                const wpPos = wp.getComponent(PositionComponent)!
                const wpWorldX = cx + wpPos.x
                const wpWorldY = cy + wpPos.y
                const dist = Math.hypot(wpWorldX - attractorPos.x, wpWorldY - attractorPos.y)

                if(dist <= attractorSoi) {
                    const wpPath = wp.getComponent(PathComponent)!
                    attractorPath.linked.push(wpPath)
                    wpPath.linked.push(attractorPath)
                }
            }
        }
    }
}

function deduplicateLinks(grid: WaypointGrid): void {
    for(const [, wp] of grid.waypoints) {
        const wpPath = wp.getComponent(PathComponent)!
        const unique = new Set(wpPath.linked)
        wpPath.linked = Array.from(unique)
    }
}

// function linkStarBridges(): void {
//     const stars = Array.from(map.solarSystems.values())
//     const BRIDGE_THRESHOLD = 5000

//     for(let i = 0; i < stars.length; i++) {
//         for(let j = i + 1; j < stars.length; j++) {
//             const starA = stars[i]
//             const starB = stars[j]
//             const ax = starA.x * UNIVERSE_SCALE
//             const ay = starA.y * UNIVERSE_SCALE
//             const bx = starB.x * UNIVERSE_SCALE
//             const by = starB.y * UNIVERSE_SCALE
//             const dist = Math.hypot(ax - bx, ay - by)

//             if(dist < BRIDGE_THRESHOLD) {
//                 const gridA = StartState.map.grids.get(starA.name)!
//                 const gridB = StartState.map.grids.get(starB.name)!
//                 bridgeGrids(gridA, gridB)
//             }
//         }
//     }
// }

function bridgeGrids(gridA: WaypointGrid, gridB: WaypointGrid): void {
    const outerRingA = gridA.rings[gridA.getRingCount() - 1]
    const outerRingB = gridB.rings[gridB.getRingCount() - 1]

    const starA = gridA.starEntity
    const starB = gridB.starEntity
    const posA = starA.getComponent(PositionComponent)!
    const posB = starB.getComponent(PositionComponent)!

    const angleToB = Math.atan2(posB.y - posA.y, posB.x - posA.x)
    const angleToA = Math.atan2(posA.y - posB.y, posA.x - posB.x)

    const normalizedAngleToB = ((angleToB % TWO_PI) + TWO_PI) % TWO_PI
    const normalizedAngleToA = ((angleToA % TWO_PI) + TWO_PI) % TWO_PI

    const angleIdxA = Math.round((normalizedAngleToB / TWO_PI) * outerRingA.waypointCount) % outerRingA.waypointCount
    const angleIdxB = Math.round((normalizedAngleToA / TWO_PI) * outerRingB.waypointCount) % outerRingB.waypointCount

    const wpA = gridA.getWaypoint(gridA.getRingCount() - 1, angleIdxA)
    const wpB = gridB.getWaypoint(gridB.getRingCount() - 1, angleIdxB)

    if(wpA && wpB) {
        const pathA = wpA.getComponent(PathComponent)!
        const pathB = wpB.getComponent(PathComponent)!
        pathA.linked.push(pathB)
        pathB.linked.push(pathA)
    }
}
