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

    const newSpaceship = engine.createEntity()

    return newSpaceship
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new JumpDriveComponent())
        .addComponent(new SensorSuiteComponent())
        .addComponent(new ColorComponent("red"))
        .addComponent(new RadiusComponent(10))
        .addChild(engine.createEntity()
            .addComponent(new PositionComponent(0, 0, -1))
            .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, ({ target, event: { shiftKey } }) => {
                const selectionSystem = engine.getSystem(SelectionSystem)

                if(shiftKey) {
                    selectionSystem?.onTargetChanged(target.parent!)
                } else {
                    selectionSystem?.onSelectionChanged({ entity: target.parent!, type: "ship" })
                }
            })))
        .addChild(
            engine.createEntity()
                .addComponent(new LabelComponent(name, 18))
                .addComponent(new ColorComponent("red"))
                .addComponent(new PositionComponent(0, 0, 0)))
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

    const ret = engine.createEntity()
        .addComponent(new PositionComponent(0, 0, 0))
        .addComponent(new RadiusComponent(20))
        .setParent(parent)

    if(population) {
        patronGod && ret.addModifier(patronGod)
        ret.addComponent(new ColorComponent("green"))
            .addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
            .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, () => {
                if(!engine) {
                    return
                }

                engine.dispatchEvent("selectionChanged", { data: ret, type: "colony" })
            })).addComponent(new IndustryComponent(population, 80, population, 1))
    } else {
        ret.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
            .addComponent(bodyColor)
    }

    return ret.addChild(
        engine.createEntity()
            .addComponent(new LabelComponent(name, 18))
            .addComponent(new ColorComponent("white"))
            .addComponent(new PositionComponent(0, 0, 0)))
}

export function createSector(engine: World, { x, y, visible }: { x: number, y: number, visible: boolean }) {
    if(!engine) return null

    const sector = engine.createEntity()
        .addComponent(new PositionComponent((x * 100), (y * 100)))
        .addChild(engine.createEntity()
            .addComponent(new PositionComponent(0, 0, -1))
            .addComponent(new ClickableComponent(true, { width: 60, height: 60 }, ({ target, event: { shiftKey } }) => {
                const selectionSystem = engine.getSystem(SelectionSystem)!
                if(shiftKey) {
                    const selection = selectionSystem.currentSelection()

                    if(selection) {
                        selectionSystem.onTargetChanged(target.parent!)
                        selection.getComponent(JumpDriveComponent)!.target = target
                    }
                } else {
                    if(target.children.size) {
                        return
                    }
                    selectionSystem.unselect()
                    selectionSystem.unTarget()
                }
            }
            ))
        )

    if(visible) {
        sector.addComponent(sectorColor)
            .addComponent(sectorShape)
    }

    return sector
}

export function createStar(engine: World, parent: Entity) {
    if(!engine) return null

    return engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new RadiusComponent(50))
        .addComponent(new ColorComponent("yellow"))
        .addComponent(new HoverableComponent("not-allowed", { width: 100, height: 100 },))
        .setParent(parent)
}

export function createBody(engine: World, { name, radius }: { x: number, y: number, name: string, radius: number }, parent: Entity) {
    if(!engine) return null

    return engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addChild(
            engine.createEntity()
                .addComponent(new LabelComponent(name, 18))
                .addComponent(new ColorComponent("white"))
                .addComponent(new PositionComponent(0, 0, 0))
        )
        .addComponent(new RadiusComponent(radius))
        .addComponent(new ColorComponent("grey"))
        .setParent(parent)
}
