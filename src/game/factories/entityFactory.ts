import { World } from "@engine/core/world";
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
import { Star, Colony } from "../data/types";
import { IndustryComponent } from "../components/industryComponent";

const sectorColor = new ColorComponent("", "grey")
const sectorShape = new ShapeComponent(6, 40)
const bodyColor = new ColorComponent("grey")

export function createSpaceship(engine: World, { name }: { name: string }) {
    if(!engine) return null

    const ship = engine.createEntity()
    ship.addComponent(new PositionComponent(0, 0))
    ship.addComponent(new JumpDriveComponent())
    ship.addComponent(new SensorSuiteComponent())
    ship.addComponent(new ColorComponent("red"))
    ship.addComponent(new RadiusComponent(10))
    engine.addEntity(ship)

    const clickArea = engine.createEntity()
    clickArea.addComponent(new PositionComponent(0, 0, -1))
    clickArea.addComponent(new ClickableComponent(true, { width: 40, height: 40 }, ({ target, event: { shiftKey } }) => {
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
    label.addComponent(new LabelComponent(name, 18))
    label.addComponent(new ColorComponent("red"))
    label.addComponent(new PositionComponent(0, 0, 0))
    engine.addEntity(label, ship)

    return ship
}

export function createSolarSystem(engine: World, { planets, x, y }: Star, sectors: Map<string, Entity>) {
    const startPoint = sectors.get([x, y].join(":"))!
    const ret: Entity[] = []
    ret.push(createStar(engine, startPoint)!)

    for(const [, planet] of planets) {
        const sector = sectors.get(([x + planet.radius, y]).join(":"))!
        ret.push(createColony(engine, planet, sector)!)
    }

    return ret
}

export function createColony(engine: World, { name, population, patronGod }: Colony, parent: Entity) {
    if(!engine) return null

    const colony = engine.createEntity()
    colony.addComponent(new PositionComponent(0, 0, 0))
    colony.addComponent(new RadiusComponent(20))

    if(population) {
        patronGod && colony.addModifier(patronGod)

        colony.addComponent(new ColorComponent("green"))
            .addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
            .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, () => {
                if(!engine) {
                    return
                }

                engine.dispatchEvent("selectionChanged", { data: colony, type: "colony" })
            })).addComponent(new IndustryComponent(population, 80, population, 1))
    } else {
        colony.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
            .addComponent(bodyColor)
    }

    const label = engine.createEntity()
    label.addComponent(new LabelComponent(name, 18))
    label.addComponent(new ColorComponent("white"))
    label.addComponent(new PositionComponent(0, 0, 0))
    engine.addEntity(colony, parent)
    engine.addEntity(label, colony)

    return colony
}

export function createSector(engine: World, { x, y, visible }: { x: number, y: number, visible: boolean }) {
    if(!engine) return null

    const sector = engine.createEntity()
    sector.addComponent(new PositionComponent((x * 100), (y * 100)))

    const clickArea = engine.createEntity()
    clickArea.addComponent(new PositionComponent(0, 0, -1))
    clickArea.addComponent(new ClickableComponent(true, { width: 60, height: 60 }, ({ target, event: { shiftKey } }) => {
        const selectionSystem = engine.getSystem(SelectionSystem)!
        const targetSceneNode = engine.getSceneNode(target)!

        if(shiftKey) {
            const selection = selectionSystem.currentSelection()

            if(selection) {
                selectionSystem.onTargetChanged(targetSceneNode.parentRef!.entity)
                selection.getComponent(JumpDriveComponent)!.target = target
            }
        } else {
            if(targetSceneNode.childrenRef.size) {
                return
            }
            selectionSystem.unselect()
            selectionSystem.unTarget()
        }
    }
    ))
    engine.addEntity(clickArea, sector)

    if(visible) {
        sector.addComponent(sectorColor)
        sector.addComponent(sectorShape)
    }

    engine.addEntity(sector)

    return sector
}

export function createStar(engine: World, parent: Entity) {
    if(!engine) return null

    const star = engine.createEntity()
    star.addComponent(new PositionComponent(0, 0))
    star.addComponent(new RadiusComponent(50))
    star.addComponent(new ColorComponent("yellow"))
    star.addComponent(new HoverableComponent("not-allowed", { width: 100, height: 100 },))
    engine.addEntity(star, parent)

    return star
}

export function createBody(engine: World, { name, radius }: { x: number, y: number, name: string, radius: number }, parent: Entity) {
    if(!engine) return null

    const body = engine.createEntity()
    body.addComponent(new PositionComponent(0, 0))
    body.addComponent(new RadiusComponent(radius))
    body.addComponent(new ColorComponent("grey"))
    engine.addEntity(body, parent)

    const label = engine.createEntity()
    label.addComponent(new LabelComponent(name, 18))
    label.addComponent(new ColorComponent("white"))
    label.addComponent(new PositionComponent(0, 0, 0))
    engine.addEntity(label, body)

    return body
}
