import { Colony, Star, StartState } from "@/gameData";
import { Engine } from "../engine";
import { SystemWithNodes } from "./system";
import { ClickableComponent } from "../components/clickableComponent";
import { ColorComponent } from "../components/colorComponent";
import { IndustryComponent } from "../components/industryComponent";
import { LabelComponent } from "../components/label";
import { PositionComponent } from "../components/position";
import { RadiusComponent } from "../components/radiusComponent";
import { ShapeComponent } from "../components/ShapeComponent";
import { Entity } from "../entities/entity";
import { HoverableComponent } from "./cursorSystem";
import { JumpDriveComponent, SensorSuiteComponent } from "./moveSystem";
import { SelectionSystem } from "./selectionSystem";
import { EntityComponent } from "../entities/entityComponent";
import { EntityNode } from "../entities/entityNode";
import { ViewportSystem } from "./viewportSystem/viewportSystem";

const sectorColor = new ColorComponent("", "grey")
const sectorShape = new ShapeComponent(6, 40)
const colonyColor = new ColorComponent("green")
const bodyColor = new ColorComponent("grey")

const a = 2 * Math.PI / 6;
const r = 0.4;

// function MoveCordOnHex([x, y]: [number, number], hour: "x" | "y" | "z", r: number) {
//     // const z = -x - y
//     switch(hour) {
//         case "x": return [x + r, y - r]
//         case "y": return [x, y + r]
//         case "z": return [x - r, y]
//     }
// }

class PathComponent extends EntityComponent {
    constructor(
        public neighbours: {
            next: PathComponent | null,
            prev: PathComponent | null,
            prevDown: PathComponent | null,
            prevUp: PathComponent | null,
            nextUp: PathComponent | null,
            nextDown: PathComponent | null
        } = {
                next: null,
                prev: null,
                prevDown: null,
                prevUp: null,
                nextUp: null,
                nextDown: null
            },
        entity?: Entity,
    ) {
        super(entity)
    }
}

class PathNode extends EntityNode {
    constructor(public path: PathComponent) {
        super()
    }
}

// function XYToXYZ([x, y]: [number, number]): [number, number, number] {
//     const fixedIndex = Math.ceil(y + x / 2)

//     return [fixedIndex, x - fixedIndex, -x]
// }

export class MapSystem extends SystemWithNodes<PathNode> {
    protected updateNode(_node: PathNode, _dT?: number): void {
    }
    removeFromEngine() {
        if(!this.engine) {
            return this
        }

        this.clear()
        super.removeFromEngine()

        return this
    }
    // mapNodes = new Map<string, MapNode>()
    // pathNodes = new Map<string, PathNode>()

    createSpaceship({ name }: { name: string }) {
        if(!this.engine) return null

        const newSpaceship = this.engine.createEntity()

        return newSpaceship
            .addComponent(new PositionComponent(0, 0))
            .addComponent(new JumpDriveComponent())
            .addComponent(new SensorSuiteComponent())
            .addComponent(new ColorComponent("red"))
            .addComponent(new RadiusComponent(10))
            .addChild(this.engine.createEntity()
                .addComponent(new PositionComponent(0, 0, -1))
                .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, ({ target, event: { shiftKey } }) => {
                    const selectionSystem = this.engine?.getSystem(SelectionSystem)

                    if(shiftKey) {
                        selectionSystem?.onTargetChanged(target.parent!)
                    } else {
                        selectionSystem?.onSelectionChanged({ entity: target.parent!, type: "ship" })
                    }
                })))
            .addChild(
                this.engine.createEntity()
                    .addComponent(new LabelComponent(name, 18))
                    .addComponent(new ColorComponent("red"))
                    .addComponent(new PositionComponent(0, 0, 0)))
    }

    createSolarSystem({ planets, x, y }: Star) {
        const startPoint = StartState.map.sectors.get([x, y].join(":"))!
        const ret = Array<Entity>(planets.size + 1)
        let i = 0
        ret[i++] = this.createStar(startPoint)!

        for(const [, planet] of planets) {
            const sector = StartState.map.sectors.get(([x + planet.radius, y]).join(":"))!
            ret[i++] = this.createColony(planet, sector)!
        }

        return ret
    }

    createColony({ name, population, patronGod }: Colony, parent: Entity) {
        if(!this.engine) return null

        const ret = this.engine.createEntity()
            .addComponent(new PositionComponent(0, 0, 0))
            .addComponent(new RadiusComponent(20))
            // .addComponent(new LabelComponent(name, 18, "white"))
            .setParent(parent)

        if(population) {
            patronGod && ret.addModifier(patronGod)
            ret.addComponent(new IndustryComponent(population, 0.8, population * 2, 1))
                .addComponent(colonyColor)
                .addComponent(new HoverableComponent("pointer", { width: 40, height: 40 },))
                .addComponent(new ClickableComponent(true, { width: 40, height: 40 }, () => {
                    if(!this.engine) {
                        return
                    }

                    this.engine.dispatchEvent("selectionChanged", { data: ret, type: "colony" })
                }))
        } else {
            ret.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
                .addComponent(bodyColor)
        }

        return ret.addChild(
            this.engine.createEntity()
                .addComponent(new LabelComponent(name, 18))
                .addComponent(new ColorComponent("white"))
                .addComponent(new PositionComponent(0, 0, 0)))
    }

    createSector({ x, y, visible }: { x: number, y: number, visible: boolean }) {
        if(!this.engine) return null

        const sector = this.engine.createEntity()
            .addComponent(new PositionComponent((x * 100), (y * 100)))
            .addChild(this.engine.createEntity()
                .addComponent(new PositionComponent(0, 0, -1))
                .addComponent(new ClickableComponent(true, { width: 60, height: 60 }, ({ target, event: { shiftKey } }) => {
                    const selectionSystem = this.engine?.getSystem(SelectionSystem)!
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
                        //engine.getSystem(SelectionSystem).onSelectionChanged(target._parent!)
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

    createStar(parent: Entity) {
        if(!this.engine) return null

        return this.engine.createEntity()
            .addComponent(new PositionComponent(0, 0))
            .addComponent(new RadiusComponent(50))
            .addComponent(new ColorComponent("yellow"))
            .addComponent(new HoverableComponent("not-allowed", { width: 100, height: 100 },))
            .setParent(parent)
    }

    createBody({ name, radius }: { x: number, y: number, name: string, radius: number }, parent: Entity) {
        if(!this.engine) return null

        return this.engine.createEntity()
            .addComponent(new PositionComponent(0, 0))
            .addChild(
                this.engine.createEntity()
                    .addComponent(new LabelComponent(name, 18))
                    .addComponent(new ColorComponent("white"))
                    .addComponent(new PositionComponent(0, 0, 0))
            )
            .addComponent(new RadiusComponent(radius))
            .addComponent(new ColorComponent("grey"))
            .setParent(parent)
    }
    update(_dt: number): void {

    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        // engine.registerNodeType(PathNode)

        return this
    }

    init({ solarSystems, mapSize }: { solarSystems: Map<string, Star>, mapSize: number }) {
        if(!this.engine) return this

        const viewPort = this.engine.getSystem(ViewportSystem)
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
                //const nextDown = StartState.map.sectors.get(`${axialCord[0]}:${axialCord[1] + 1}`)?.getComponent(PathComponent) ?? null
                //const next = StartState.map.sectors.get(`${axialCord[0] + 1}:${axialCord[1]}`)?.getComponent(PathComponent) ?? null

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

                const sector = this.createSector({ x: y, y: x, visible: true })!.addChild(this.engine.createEntity()
                    .addComponent(new PositionComponent(-45, 0, -2))
                    // .addComponent(new LabelComponent(axialCord.join(":"), { fill: "white" }, 18)),
                )
                    .addComponent(pathComponent)

                StartState.map.sectors.set(axialCord.join(":"), sector)
                this.engine.addEntity(sector)
            }
        }

        for(const [, star] of solarSystems) {
            // const sector = StartState.map.sectors.get(`${star.x}:${star.y}`)!
            const solarSystem = this.createSolarSystem(star)!

            for(const body of solarSystem) {
                //sector.setParent(body)
                // body.setParent(sector)
                this.engine.addEntity(body)
            }
        }

        const minerva = this.createSpaceship({ name: "Minerva" })!

        StartState.map.sectors.get("0:10")!.addChild(minerva)
        this.engine.addEntity(minerva)

        viewPort.sortOnEveryEntityAddition = true

        return this
    }

    clear() {
        if(!this.engine) return this

        // Clear all sectors and their children
        StartState.map.sectors.forEach(sector => {
            this.engine?.removeEntity(sector)
        })
        StartState.map.sectors.clear()

        return this
    }
}