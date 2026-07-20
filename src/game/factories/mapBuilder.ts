import { World } from "@engine/core/world";
import { PositionComponent } from "@engine/components/position";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { PathComponent } from "../components/pathComponent";
import { createSector, createSolarSystem, createSpaceship } from "./entityFactory";
import { solarSystems } from "../data/gameData";
import { StartState } from "../data/types";

const a = 2 * Math.PI / 6;
const r = 0.4;

export function init(engine: World, mapSize: number) {
    const viewPort = engine.getSystem(ViewportSystem)
    viewPort.sortOnEveryEntityAddition = false

    for(let col = 0, y = r, j = 0; y + r * Math.cos(a) < mapSize; y += 2 ** ((j + 1) % 2) * r * Math.sin(a), j = 0, ++col) {
        for(let row = 0, x = r; x + r * (1 + Math.cos(a)) < mapSize; x += r * (1 + Math.cos(a)), y += (-1) ** j++ * r * Math.sin(a), row++) {
            const offsetCoords = [col, row] as [number, number]

            function offsetToAxial([x, y]: [number, number]) {
                return [x - (y - (y & 1)) / 2, y]
            }

            const axialCord = offsetToAxial(offsetCoords)

            const prev = StartState.map.sectors.get(`${axialCord[0] - 1}:${axialCord[1]}`)?.getComponent(PathComponent) ?? null
            const prevUp = StartState.map.sectors.get(`${axialCord[0]}:${axialCord[1] - 1}`)?.getComponent(PathComponent) ?? null

            const nextUp = StartState.map.sectors.get(`${axialCord[0] + 1}:${axialCord[1] - 1}`)?.getComponent(PathComponent) ?? null
            const prevDown = StartState.map.sectors.get(`${axialCord[0] - 1}:${axialCord[1] + 1}`)?.getComponent(PathComponent) ?? null

            const pathComponent = new PathComponent({
                next: null,
                prev,
                prevDown: null,
                prevUp,
                nextUp: null,
                nextDown: null
            })

            if(prev) {
                prev.neighbours.next = pathComponent
            }
            if(prevUp) {
                prevUp.neighbours.nextDown = pathComponent
            }
            if(prevDown) {
                prevDown.neighbours.nextUp = pathComponent
            }
            if(nextUp) {
                nextUp.neighbours.prevDown = pathComponent
            }

            const sector = createSector(engine, { x: y, y: x, visible: true })!.addChild(engine.createEntity()
                .addComponent(new PositionComponent(-45, 0, -2))
            )
                .addComponent(pathComponent)

            StartState.map.sectors.set(axialCord.join(":"), sector)
            engine.addEntity(sector)
        }
    }

    for(const [, star] of solarSystems) {
        const solarSystem = createSolarSystem(engine, star, StartState.map.sectors)!

        for(const body of solarSystem) {
            engine.addEntity(body)
        }
    }

    const minerva = createSpaceship(engine, { name: "Minerva" })!

    StartState.map.sectors.get("0:10")!.addChild(minerva)
    engine.addEntity(minerva)

    viewPort.sortOnEveryEntityAddition = true
}
