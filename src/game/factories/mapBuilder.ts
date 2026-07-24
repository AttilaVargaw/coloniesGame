import { PositionComponent } from "@engine/components/position";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { PathComponent } from "../components/pathComponent";
import { SoiComponent } from "@engine/components/soiComponent";
import { solarSystems } from "../data/gameData";
import { StartState } from "../data/types";
import { Engine } from "@/engine/core/engine";
import type { Entity } from "@engine/entities/entity";
import { createSolarSystem } from "./createSolarSystem";
import { GRID_SPACING, MAP_RADIUS, STARMAP_COORD_SCALE } from "../constants";

export function init(engine: Engine, _mapSize: number) {
    const viewportSystem = engine.getSystem(ViewportSystem)
    viewportSystem.sortOnEveryEntityAddition = false

    for(const [, starData] of solarSystems) {
        const cx = starData.x * STARMAP_COORD_SCALE
        const cy = starData.y * STARMAP_COORD_SCALE

        const star = createSolarSystem(engine, starData)
        StartState.map.attractors.set(starData.name, star)

        const starSceneNode = engine.getSceneNode(star)
        const attractors: Entity[] = [star]

        for(const childEntity of starSceneNode!.collectDescendants()) {
            if(childEntity !== star && childEntity.getComponent(SoiComponent) && childEntity.getComponent(PathComponent)) {
                attractors.push(childEntity)
                StartState.map.attractors.set(childEntity.id, childEntity)
            }
        }

        const waypointGrid = new Map<string, Entity>()

        for(let dx = -MAP_RADIUS; dx <= MAP_RADIUS; dx += GRID_SPACING) {
            for(let dy = -MAP_RADIUS; dy <= MAP_RADIUS; dy += GRID_SPACING) {
                const wx = cx + dx
                const wy = cy + dy
                const key = `${wx}:${wy}`

                if(StartState.map.waypoints.has(key)) continue

                const waypoint = engine.createEntity()
                    .addComponent(new PositionComponent(wx, wy))
                    .addComponent(new PathComponent())
                engine.addEntity(waypoint)
                StartState.map.waypoints.set(key, waypoint)
                waypointGrid.set(key, waypoint)
            }
        }

        for(const [, wp] of waypointGrid) {
            const wpPos = wp.getComponent(PositionComponent)!
            const wpPath = wp.getComponent(PathComponent)!
            const wx = wpPos.x
            const wy = wpPos.y

            for(let dx = -GRID_SPACING; dx <= GRID_SPACING; dx += GRID_SPACING) {
                for(let dy = -GRID_SPACING; dy <= GRID_SPACING; dy += GRID_SPACING) {
                    if(dx === 0 && dy === 0) continue
                    const neighborKey = `${wx + dx}:${wy + dy}`
                    const neighbor = waypointGrid.get(neighborKey)
                    if(neighbor) {
                        wpPath.linked.push(neighbor.getComponent(PathComponent)!)
                    }
                }
            }
        }

        const starSoi = star.getComponent(SoiComponent)!.radius
        const starPos = star.getComponent(PositionComponent)!
        const starPath = star.getComponent(PathComponent)!

        for(const [, wp] of waypointGrid) {
            const wpPos = wp.getComponent(PositionComponent)!
            const dist = Math.hypot(wpPos.x - starPos.x, wpPos.y - starPos.y)
            if(dist <= starSoi) {
                starPath.linked.push(wp.getComponent(PathComponent)!)
                wp.getComponent(PathComponent)!.linked.push(starPath)
            }
        }

        for(const attractor of attractors) {
            const attractorSoi = attractor.getComponent(SoiComponent)!.radius
            const attractorPos = attractor.getComponent(PositionComponent)!
            const attractorPath = attractor.getComponent(PathComponent)!

            for(const [, wp] of waypointGrid) {
                const wpPos = wp.getComponent(PositionComponent)!
                const dist = Math.hypot(wpPos.x - attractorPos.x, wpPos.y - attractorPos.y)
                if(dist <= attractorSoi) {
                    attractorPath.linked.push(wp.getComponent(PathComponent)!)
                    wp.getComponent(PathComponent)!.linked.push(attractorPath)
                }
            }
        }

        for(const [, wp] of waypointGrid) {
            const wpPath = wp.getComponent(PathComponent)!
            const unique = new Set(wpPath.linked)
            wpPath.linked = Array.from(unique)
        }
    }

    viewportSystem.sortOnEveryEntityAddition = true
}
