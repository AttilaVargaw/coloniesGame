import { Entity } from "@engine/entities/entity";
import { ClickableComponent } from "@engine/components/clickableComponent";
import { ColorComponent } from "@engine/components/colorComponent";
import { LabelComponent } from "@engine/components/label";
import { PositionComponent } from "@engine/components/position";
import { RadiusComponent } from "@engine/components/radiusComponent";
import { ShapeComponent } from "@engine/components/ShapeComponent";
import { HoverableComponent } from "@game/systems/cursorSystem";
import { JumpDriveComponent, SensorSuiteComponent } from "../components/vessel";
import { SelectionSystem } from "@game/systems/selectionSystem";
import { clearShipPath, setShipPath } from "@game/systems/moveSystem";
import { MapSystem } from "@game/systems/mapSystem";
import { Star, Colony } from "../data/types";
import { IndustryComponent } from "../components/industryComponent";
import { Engine } from "@/engine/core/engine";
import { SelectionChangedEvent } from "@/engine/lib/events";
import { OrbitComponent } from "@engine/components/orbitComponent";

const sectorColor = new ColorComponent("", "grey")
const sectorShape = new ShapeComponent(6, 40)
const bodyColor = new ColorComponent("grey")

export function createSpaceship(engine: Engine, { name }: { name: string }) {
    const ship = engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new JumpDriveComponent())
        .addComponent(new SensorSuiteComponent(3))
        .addComponent(new ColorComponent("red"))
        .addComponent(new RadiusComponent(10))
        .addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))

    engine.addEntity(ship)

    const clickArea = engine.createEntity()
        .addComponent(new PositionComponent(0, 0, -1))
        .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, ({ target, event: { shiftKey } }) => {
            const selectionSystem = engine.getSystem(SelectionSystem)
            const targetSceneNode = engine.getSceneNode(target)!

            if(shiftKey) {
                selectionSystem?.onTargetChanged(targetSceneNode.parentRef!.entity)
            } else {
                selectionSystem?.onSelectionChanged({ entity: targetSceneNode.parentRef!.entity, type: "ship" })
            }
        }))
    engine.addEntity(clickArea, ship)

    const label = engine.createEntity()
        .addComponent(new LabelComponent(name, 18))
        .addComponent(new ColorComponent("red"))
        .addComponent(new PositionComponent(0, 0, 0))
    engine.addEntity(label, ship)

    return ship
}

export function createSolarSystem(engine: Engine, { planets, x, y }: Star, sectors: Map<string, Entity>) {
    const startPoint = sectors.get([x, y].join(":"))!
    const star = createStar(engine, startPoint)!
    const ret: Entity[] = [star]

    for(const [, planet] of planets) {
        const colony = createColony(engine, planet, star)!
        colony.addComponent(new OrbitComponent(
            star.id,
            planet.radius * 50,
            0,
            Math.random() * Math.PI * 2
        ))
        ret.push(colony)
    }

    return ret
}

export function createColony(engine: Engine, { name, population, patronGod }: Colony, parent: Entity) {
    const colony = engine.createEntity()
        .addComponent(new PositionComponent(0, 0, 0))
        .addComponent(new RadiusComponent(20))

    if(population) {
        if(patronGod) {
            colony.addModifier(patronGod)
        }

        colony.addComponent(new ColorComponent("green"))
            .addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
            .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, () => {
                if(!engine) {
                    return
                }

                engine.dispatchEvent(new SelectionChangedEvent({ data: colony, type: "colony" }))
            })).addComponent(new IndustryComponent(population, 80, population, 1))
    } else {
        colony.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
            .addComponent(bodyColor)
    }

    const label = engine.createEntity()
        .addComponent(new LabelComponent(name, 18))
        .addComponent(new ColorComponent("white"))
        .addComponent(new PositionComponent(0, 0, 0))

    engine.addEntity(colony, parent)
        .addEntity(label, colony)

    return colony
}

export function createSector(engine: Engine, { x, y, visible }: { x: number, y: number, visible: boolean }) {
    const sector = engine.createEntity()
    sector.addComponent(new PositionComponent((x * 100), (y * 100)))

    const clickArea = engine.createEntity()
        .addComponent(new PositionComponent(0, 0, -1))
        .addComponent(new ClickableComponent(true, { width: 60, height: 60 }, ({ target, event: { shiftKey } }) => {
            const selectionSystem = engine.getSystem(SelectionSystem)!
            const targetSceneNode = engine.getSceneNode(target)!

            if(shiftKey) {
                const selection = selectionSystem.currentSelection()!
                const selectionsParent = engine.getSceneNode(selection)!.parentRef!.entity

                if(selection) {
                    const targetEntity = targetSceneNode.parentRef!.entity
                    selectionSystem.onTargetChanged(targetEntity)
                    const mapSystem = engine.getSystem(MapSystem)!
                    const path = mapSystem.findPath(selectionsParent, targetEntity)
                    if(path.length > 1) {
                        setShipPath(selection, path)
                    } else {
                        selection.getComponent(JumpDriveComponent)!.target = target
                    }
                }
            } else {
                if(targetSceneNode.childrenRef.size) {
                    return
                }
                const currentSelection = selectionSystem.currentSelection()
                selectionSystem.unselect()
                selectionSystem.unTarget()
                if(currentSelection) {
                    clearShipPath(currentSelection)
                }
            }
        }
        ))

    if(visible) {
        sector.addComponent(sectorColor)
            .addComponent(sectorShape)
    }

    engine.addEntity(sector)
        .addEntity(clickArea, sector)

    return sector
}

export function createStar(engine: Engine, parent: Entity) {
    const star = engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new RadiusComponent(20))
        .addComponent(new ColorComponent("yellow"))
        .addComponent(new HoverableComponent("not-allowed", { width: 100, height: 100 },))
    engine.addEntity(star, parent)

    return star
}

export function createBody(engine: Engine, { name, radius }: { x: number, y: number, name: string, radius: number }, parent: Entity) {
    const body = engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new RadiusComponent(radius))
        .addComponent(new ColorComponent("grey"))
    engine.addEntity(body, parent)

    const label = engine.createEntity()
    label.addComponent(new LabelComponent(name, 18))
        .addComponent(new ColorComponent("white"))
        .addComponent(new PositionComponent(0, 0, 0))
    engine.addEntity(label, body)

    return body
}
