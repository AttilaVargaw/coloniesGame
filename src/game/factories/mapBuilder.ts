import { PositionComponent } from "@engine/components/position";
import { ColorComponent } from "@engine/components/colorComponent";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { PathComponent } from "../components/pathComponent";
import { createSector, createSolarSystem, createSpaceship } from "./entityFactory";
import { solarSystems } from "../data/gameData";
import { StartState } from "../data/types";
import { Engine } from "@/engine/core/engine";

const BASE_SECTORS = 6
const MAX_RINGS = 12
const RING_RADIUS = 100

const RING_COLORS = [
    new ColorComponent("rgba(120, 120, 120, 0.35)", "rgba(180, 180, 180, 0.6)"),
    new ColorComponent("rgba(90, 90, 90, 0.35)", "rgba(140, 140, 140, 0.6)"),
    new ColorComponent("rgba(60, 60, 60, 0.35)", "rgba(100, 100, 100, 0.6)"),
    new ColorComponent("rgba(40, 40, 40, 0.35)", "rgba(80, 80, 80, 0.6)"),
]

export function init(engine: Engine, _mapSize: number) {
    const viewportSystem = engine.getSystem(ViewportSystem)
    viewportSystem.sortOnEveryEntityAddition = false

    for(const [, star] of solarSystems) {
        const cx = star.x * 100
        const cy = star.y * 100

        const centerPath = new PathComponent()
        const centerSector = createSector(engine, { x: cx, y: cy, visible: false })!
        centerSector.addComponent(centerPath)
        engine.addEntity(centerSector)

        StartState.map.sectors.set(`${star.x}:${star.y}`, centerSector)

        const rings = new Map<number, Map<number, PathComponent>>()

        for(let ring = 1; ring <= MAX_RINGS; ring++) {
            const sectorsInThisRing = ring * BASE_SECTORS
            const radius = ring * RING_RADIUS
            const ringMap = new Map<number, PathComponent>()

            for(let s = 0; s < sectorsInThisRing; s++) {
                const angle = (2 * Math.PI * s / sectorsInThisRing) - Math.PI / 2
                const sx = cx + Math.cos(angle) * radius
                const sy = cy + Math.sin(angle) * radius

                const path = new PathComponent()
                ringMap.set(s, path)

                const sector = createSector(engine, { x: sx, y: sy, visible: true, color: RING_COLORS[(ring - 1) % RING_COLORS.length] })!

                const label = engine.createEntity()
                    label.addComponent(new PositionComponent(-45, 0, -2, label))
                engine.addEntity(label, sector)

                sector.addComponent(path)

                const key = `${Math.round(sx / 100)}:${Math.round(sy / 100)}`
                StartState.map.sectors.set(key, sector)
            }

            for(let s = 0; s < sectorsInThisRing; s++) {
                const prev = (s - 1 + sectorsInThisRing) % sectorsInThisRing
                const next = (s + 1) % sectorsInThisRing
                ringMap.get(s)!.neighbours.prev = ringMap.get(prev)!
                ringMap.get(s)!.neighbours.next = ringMap.get(next)!
            }

            rings.set(ring, ringMap)
        }

        for(let ring = 1; ring < MAX_RINGS; ring++) {
            const inner = rings.get(ring)!
            const outer = rings.get(ring + 1)!
            const innerCount = ring * BASE_SECTORS
            const outerCount = (ring + 1) * BASE_SECTORS

            for(let s = 0; s < innerCount; s++) {
                const outerIndex = Math.round(s * outerCount / innerCount) % outerCount
                const nextOuterIndex = Math.round((s + 1) * outerCount / innerCount) % outerCount

                inner.get(s)!.linked.push(outer.get(outerIndex)!)
                outer.get(outerIndex)!.linked.push(inner.get(s)!)

                if (nextOuterIndex !== outerIndex) {
                    inner.get(s)!.linked.push(outer.get(nextOuterIndex)!)
                    outer.get(nextOuterIndex)!.linked.push(inner.get(s)!)
                }
            }
        }

        for(let s = 0; s < rings.get(1)!.size; s++) {
            centerPath.linked.push(rings.get(1)!.get(s)!)
            rings.get(1)!.get(s)!.linked.push(centerPath)
        }
    }

    for(const [systemName, star] of solarSystems) {
        const solarSystem = createSolarSystem(engine, star, StartState.map.sectors)!

        if(systemName === "Helios Alpha") {
            const starEntity = solarSystem[0]
            const starNode = engine.getSceneNode(starEntity)
            const starSector = starNode?.parentRef?.entity
            if(starSector) {
                const minerva = createSpaceship(engine, { name: "Minerva" })!
                const minervaNode = engine.getSceneNode(minerva)!
                const sectorNode = engine.getSceneNode(starSector)!
                minervaNode.setParent(sectorNode)
            }
        }
    }

    viewportSystem.sortOnEveryEntityAddition = true
}
