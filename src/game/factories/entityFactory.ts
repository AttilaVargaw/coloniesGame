import { Entity } from "@engine/entities/entity";
import { ClickableComponent } from "@engine/components/clickableComponent";
import { ColorComponent } from "@engine/components/colorComponent";
import { LabelComponent } from "@engine/components/label";
import { PositionComponent } from "@engine/components/position";
import { RadiusComponent } from "@engine/components/radiusComponent";
import { HoverableComponent } from "@game/systems/cursorSystem";
import { JumpDriveComponent, SensorSuiteComponent } from "../components/vessel";
import { SelectionSystem } from "@game/systems/selectionSystem";
import { setShipPath } from "@game/systems/moveSystem";
import { MapSystem } from "@game/systems/mapSystem";
import { Star, Colony } from "../data/types";
import { IndustryComponent } from "../components/industryComponent";
import { Engine } from "@/engine/core/engine";
import { SelectionChangedEvent } from "@/engine/lib/events";
import { OrbitComponent } from "@engine/components/orbitComponent";
import { SoiComponent } from "@engine/components/soiComponent";
import { PathComponent } from "../components/pathComponent";

const bodyColor = new ColorComponent("grey")

export function createSpaceship(engine: Engine, { name }: { name: string }) {
    const ship = engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new JumpDriveComponent())
        .addComponent(new SensorSuiteComponent(3))
        .addComponent(new ColorComponent("red"))
        .addComponent(new RadiusComponent(6))
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

export function createSolarSystem(engine: Engine, { x, y, planets, soi }: Star) {
    const star = createStar(engine, { x: x * 100, y: y * 100, soi: soi ?? 2000 })

    const binaryPairNames = new Set(["Caprica", "Gemenon"])
    let pairCreated = false

    for(const [, planet] of planets) {
        if (binaryPairNames.has(planet.name) && !pairCreated) {
            const capricaData = planets.get("Caprica")!
            const gemenonData = planets.get("Gemenon")!

            const barycentreOrbitRadius = (capricaData.radius + gemenonData.radius) * 50 / 2
            const barycentreAngularSpeed = 1.5 / Math.sqrt(barycentreOrbitRadius)
            const barycentre = engine.createEntity()
                .addComponent(new PositionComponent(0, 0))
                .addComponent(new OrbitComponent(
                    star.id,
                    barycentreOrbitRadius,
                    barycentreAngularSpeed,
                    Math.random() * Math.PI * 2
                ))
                .addComponent(new RadiusComponent(4))
                .addComponent(new ColorComponent("rgba(255,255,255,0.4)"))
            engine.addEntity(barycentre, star)

            const { bodyA, bodyB } = createBinaryOrbitPair(
                engine, barycentre,
                capricaData.name,
                gemenonData.name,
                60
            )

            bodyA.removeComponent(ColorComponent)
            bodyA.addComponent(new ColorComponent("green"))
            bodyA.removeComponent(RadiusComponent)
            bodyA.addComponent(new RadiusComponent(10))
            bodyA.addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
            bodyA.addComponent(new ClickableComponent(true, { width: 40, height: 40 }, () => {
                engine.dispatchEvent(new SelectionChangedEvent({ data: bodyA, type: "colony" }))
            }))
            if (capricaData.population) {
                bodyA.addComponent(new IndustryComponent(capricaData.population, 80, capricaData.population, 1))
            }
            if (capricaData.patronGod) {
                bodyA.addModifier(capricaData.patronGod)
            }

            bodyB.removeComponent(ColorComponent)
            bodyB.addComponent(new ColorComponent("green"))
            bodyB.removeComponent(RadiusComponent)
            bodyB.addComponent(new RadiusComponent(10))
            bodyB.addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
            bodyB.addComponent(new ClickableComponent(true, { width: 40, height: 40 }, () => {
                engine.dispatchEvent(new SelectionChangedEvent({ data: bodyB, type: "colony" }))
            }))
            if (gemenonData.population) {
                bodyB.addComponent(new IndustryComponent(gemenonData.population, 80, gemenonData.population, 1))
            }
            if (gemenonData.patronGod) {
                bodyB.addModifier(gemenonData.patronGod)
            }

            pairCreated = true
            continue
        }

        const colony = createColony(engine, planet, star)!
        const orbitRadius = planet.radius * 50
        const angularSpeed = 1.5 / Math.sqrt(orbitRadius)
        colony.addComponent(new OrbitComponent(
            star.id,
            orbitRadius,
            angularSpeed,
            Math.random() * Math.PI * 2
        ))
    }

    return star
}

export function createColony(engine: Engine, { name, population, patronGod, soi }: Colony, parent: Entity) {
    const colony = engine.createEntity()
        .addComponent(new PositionComponent(0, 0, 0))
        .addComponent(new RadiusComponent(10))
        .addComponent(new SoiComponent(soi ?? 100))
        .addComponent(new PathComponent())

    if(population) {
        if(patronGod) {
            colony.addModifier(patronGod)
        }

        colony.addComponent(new ColorComponent("green"))
            .addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
            .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, ({ event: { shiftKey } }) => {
                if(!engine) {
                    return
                }

                if(shiftKey) {
                    const selectionSystem = engine.getSystem(SelectionSystem)
                    const selection = selectionSystem?.currentSelection()
                    if(selection) {
                        const target = colony
                        selectionSystem?.onTargetChanged(target)
                        const mapSystem = engine.getSystem(MapSystem)
                        const selectionSceneNode = engine.getSceneNode(selection)!
                        const selectionsParent = selectionSceneNode.parentRef!.entity
                        const path = mapSystem?.findPath(selectionsParent, target)
                        if(path && path.length > 1) {
                            setShipPath(selection, path)
                        } else {
                            const drive = selection.getComponent(JumpDriveComponent)
                            if(drive) {
                                drive.target = target
                            }
                        }
                    }
                } else {
                    engine.dispatchEvent(new SelectionChangedEvent({ data: colony, type: "colony" }))
                }
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

export function createStar(engine: Engine, { x, y, soi }: { x: number, y: number, soi: number }) {
    const star = engine.createEntity()
        .addComponent(new PositionComponent(x, y))
        .addComponent(new RadiusComponent(20))
        .addComponent(new ColorComponent("yellow"))
        .addComponent(new HoverableComponent("not-allowed", { width: 100, height: 100 },))
        .addComponent(new SoiComponent(soi))
        .addComponent(new PathComponent())
    engine.addEntity(star)

    return star
}

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    nameA: string,
    nameB: string,
    separation: number
) {
    const angleA = Math.random() * Math.PI * 2
    const binaryAngularSpeed = 1.5 / Math.sqrt(separation / 2)

    const bodyA = engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new RadiusComponent(15))
        .addComponent(new ColorComponent("cyan"))
        .addComponent(new HoverableComponent("pointer", { width: 30, height: 30 }))
        .addComponent(
            new ClickableComponent(true, { width: 30, height: 30 }, () => {
                engine.dispatchEvent(
                    new SelectionChangedEvent({ data: bodyA, type: "colony" })
                );
            })
        )
        .addComponent(
            new OrbitComponent(parent.id, separation / 2, binaryAngularSpeed, angleA)
        )
        .addComponent(new SoiComponent(100))
        .addComponent(new PathComponent())

    const bodyB = engine.createEntity()
        .addComponent(new PositionComponent(0, 0))
        .addComponent(new RadiusComponent(15))
        .addComponent(new ColorComponent("magenta"))
        .addComponent(new HoverableComponent("pointer", { width: 30, height: 30 }))
        .addComponent(
            new ClickableComponent(true, { width: 30, height: 30 }, () => {
                engine.dispatchEvent(
                    new SelectionChangedEvent({ data: bodyB, type: "colony" })
                );
            })
        )
        .addComponent(
            new OrbitComponent(parent.id, separation / 2, binaryAngularSpeed, angleA + Math.PI)
        )
        .addComponent(new SoiComponent(100))
        .addComponent(new PathComponent())

    const labelA = engine.createEntity()
        .addComponent(new LabelComponent(nameA, 14))
        .addComponent(new ColorComponent("white"))
        .addComponent(new PositionComponent(0, -25, 0));

    const labelB = engine.createEntity()
        .addComponent(new LabelComponent(nameB, 14))
        .addComponent(new ColorComponent("white"))
        .addComponent(new PositionComponent(0, -25, 0));

    engine.addEntity(bodyA, parent).addEntity(labelA, bodyA);
    engine.addEntity(bodyB, parent).addEntity(labelB, bodyB);

    return { bodyA, bodyB };
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