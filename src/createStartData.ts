// import { ClickableComponent } from "./ems/components/clickableComponent"
// import { ColorComponent } from "./ems/components/colorComponent"
// import { IndustryComponent } from "./ems/components/industryComponent"
// import { LabelComponent } from "./ems/components/label"
// import { PositionComponent } from "./ems/components/position"
// import { RadiusComponent } from "./ems/components/radiusComponent"
// import { ShapeComponent } from "./ems/components/ShapeComponent"
// import { Engine } from "./ems/engine"
// import { Entity } from "./ems/entities/entity"
// import { HoverableComponent } from "./ems/systems/cursorSystem"
// import { JumpDriveComponent, SensorSuiteComponent } from "./ems/systems/moveSystem"
// import { SelectionSystem } from "./ems/systems/selectionSystem"
// import { Colony, solarSystems, Star, StartState } from "./gameData"

// const a = 2 * Math.PI / 6;
// const r = 0.4;
// const mapSize = 48
// const colonyColor = new ColorComponent("green")
// const bodyColor = new ColorComponent("grey")

// function MoveCordOnHex([x, y, z]: [number, number, number], hour: "x" | "y" | "z", r: number) {
//     switch(hour) {
//         case "x": return `${x + r}:${y - r}:${z}`
//         case "y": return `${x}:${y + r}:${z - r}`
//         case "z": return `${x - r}:${y}:${z + r}`
//     }
// }

// export function createStartData(engine: Engine) {
//     const createSpaceship = ({ name }: { name: string }) => {
//         const newSpaceship = engine.createEntity()

//         return newSpaceship
//             .addComponent(new LabelComponent(name, { fill: "red" }, 18))
//             .addComponent(new PositionComponent(0, 0))
//             .addComponent(new JumpDriveComponent())
//             .addComponent(new SensorSuiteComponent())
//             .addComponent(new ColorComponent("red"))
//             .addComponent(new RadiusComponent(10))
//             .addChild(engine.createEntity()
//                 .addComponent(new PositionComponent(0, 0, -1))
//                 .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, ({ engine, target, data: { event: { shiftKey } } }) => {
//                     if(shiftKey) {
//                         engine.getSystem(SelectionSystem).onTargetChanged(target._parent!)
//                     } else {
//                         engine.getSystem(SelectionSystem).onSelectionChanged(target._parent!)
//                     }
//                 })))
//         // .addComponent(new SelectableComponent(newSpaceship, 40, "red"))
//     }

//     function createSolarSystem({ planets, x, y, z }: Star) {
//         const startPoint = StartState.map.sectors.get([x, y, z].join(":"))!
//         const ret = Array<Entity>(planets.size + 1)
//         let i = 0
//         ret[i++] = createStar(startPoint)

//         for(const [, planet] of planets) {
//             const sector = StartState.map.sectors.get(MoveCordOnHex([x, y, z], "x", planet.radius))!
//             ret[i++] = createColony(planet, sector)
//         }

//         return ret
//     }

//     function createColony({ name, population, patronGod }: Colony, parent: Entity) {
//         const ret = engine.createEntity()
//             .addComponent(new PositionComponent(0, 0, 0))
//             .addComponent(new RadiusComponent(20))
//             .addComponent(new LabelComponent(name, { fill: "white" }, 18))
//             .setParent(parent)

//         if(population) {
//             patronGod && ret.addModifier(patronGod)
//             ret.addComponent(new IndustryComponent(population, 0.8, population * 2, 1))
//                 .addComponent(colonyColor)
//                 .addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
//                 .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, () => {
//                     engine.dispatchEvent("selectionChanged", ret)
//                 }))
//         } else {
//             ret.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
//                 .addComponent(bodyColor)
//         }

//         return ret
//     }

//     const sectorColor = new ColorComponent("", "grey")
//     const sectorShape = new ShapeComponent(6, 40)

//     function createSector({ x, y, visible }: { x: number, y: number, visible: boolean }) {
//         const sector = engine.createEntity()
//             .addComponent(new PositionComponent((x * 100), (y * 100)))
//             .addChild(engine.createEntity()
//                 .addComponent(new PositionComponent(0, 0, -1))
//                 .addComponent(new ClickableComponent(true, { width: 60, height: 60 }, ({ engine, target, data: { event: { shiftKey } } }) => {
//                     const selectionSystem = engine.getSystem(SelectionSystem)!
//                     if(shiftKey) {
//                         const selection = selectionSystem.selector?._parent

//                         if(selection) {
//                             selectionSystem.onTargetChanged(target._parent!)
//                             selection.getComponent(JumpDriveComponent)!.target = target
//                         }
//                     } else {
//                         if(target.children.size) {
//                             return
//                         }
//                         selectionSystem.unselect()
//                         selectionSystem.unTarget()
//                         //engine.getSystem(SelectionSystem).onSelectionChanged(target._parent!)
//                     }
//                 })))

//         if(visible) {
//             sector.addComponent(sectorColor)
//                 .addComponent(sectorShape)
//         }

//         return sector
//     }

//     function createStar(parent: Entity) {
//         return engine.createEntity()
//             .addComponent(new PositionComponent(0, 0))
//             // .addComponent(new LabelComponent(name, "white", 18))
//             .addComponent(new RadiusComponent(50))
//             .addComponent(new ColorComponent("yellow"))
//             .addComponent(new HoverableComponent("not-allowed", { width: 100, height: 100 },))
//             .setParent(parent)
//     }

//     function createBody({ x, y, name, radius }: { x: number, y: number, name: string, radius: number }, parent: Entity) {
//         return engine.createEntity()
//             .addComponent(new PositionComponent(0, 0))
//             .addComponent(new LabelComponent(name, { fill: "white" }, 18))
//             .addComponent(new RadiusComponent(radius))
//             .addComponent(new ColorComponent("grey"))
//             .setParent(parent)
//     }

//     for(let sY = 0, y = r, j = 0; y + r * Math.cos(a) < mapSize; y += 2 ** ((j + 1) % 2) * r * Math.sin(a), j = 0, ++sY) {
//         for(let sX = 0, x = r; x + r * (1 + Math.cos(a)) < mapSize; x += r * (1 + Math.cos(a)), y += (-1) ** j++ * r * Math.sin(a), sX++) {
//             const fixedIndex = Math.ceil(sY + sX / 2)

//             const sector = createSector({ x: y, y: x, visible: true}).addChild(engine.createEntity()
//                 .addComponent(new PositionComponent(-45, 0, -2))
//                 //.addComponent(new LabelComponent(`${fixedIndex}:${sX - fixedIndex}:${-sX}`, { fill: "white" }, 18)),
//             )

//             StartState.map.sectors.set(`${fixedIndex}:${sX - fixedIndex}:${-sX}`, sector)
//             engine.addEntity(sector)
//         }
//     }

//     return StartState
// }
