import { DateComponent } from "./ems/components/dateComponent"
import { ViewportComponent } from "./ems/components/viewportComponent"
import { Engine } from "./ems/engine"
import { Entity } from "./ems/entities/entity"
import { ButtonPressSystem } from "./ems/systems/buttonPressSystem"
import { ClickableSystem } from "./ems/systems/clickable"
import { CursorSystem } from "./ems/systems/cursorSystem"
import { DateSystem } from "./ems/systems/dateSystem"
import { IndustrySystem } from "./ems/systems/industrySystem"
import { MapSystem } from "./ems/systems/mapSystem"
import { MoveSystem } from "./ems/systems/moveSystem"
import { SelectionSystem } from "./ems/systems/selectionSystem"
import { ViewportSystem } from "./ems/systems/viewportSystem/viewportSystem"
import { Star } from "./gameData"
import Camera from "./lib/camera"

export const renderingContextSettings = {
    alpha: false,
    desynchronized: true,
    colorSpace: "srgb",
} as CanvasRenderingContext2DSettings

export class Game {
    readonly engine: Engine = new Engine
    private gameLoopId?: number

    constructor(public renderingContext: CanvasRenderingContext2D, public solarSystems: Map<string, Star>) {
        this.engine
            .addSystem(IndustrySystem)
            .addSystem(DateSystem)
            .addSystem(ButtonPressSystem)
            .addSystem(ViewportSystem)
            .addSystem(MoveSystem)
            .addSystem(SelectionSystem)
            .addSystem(CursorSystem)
            .addSystem(MapSystem)
            .addSystem(ClickableSystem)
            .addEntity(this.engine.createEntity().addComponent(new ViewportComponent(new Camera(renderingContext, { initialPosition: [1500, 1500], distance: 3000, fieldOfView: Math.PI / 4.0, scaleX: 1.0, scaleY: 1.0, minDistance: 100, maxDistance: 12000 }))))
            .addEntity(this.engine.createEntity().addComponent(new DateComponent(0)))
            .subscribe("selectionChanged", ({ type }: { entity: Entity, type: string }) => {
                if(type === "colony") {
                    document.body.style.cursor = 'default';
                    //setCurrentColony(entity)
                }
            })

        this.engine.getSystem(MapSystem)!.init({ solarSystems, mapSize: 48 })

        let previousTime = 0.

        const update = (time: number) => {
            if(!this.engine) {
                return
            }

            const dt = time - previousTime;

            previousTime = time

            this.engine.update(Math.min(500, dt))

            this.gameLoopId = requestAnimationFrame(update)

            this.engine.dispatchEvent("updateDone", dt)
        }

        this.gameLoopId = requestAnimationFrame(time => {
            previousTime = time;

            this.gameLoopId = requestAnimationFrame(update)
        })
    }

    destruct(): void {
        if(!this.engine) {
            return
        }

        this.engine.destruct()

        if(this.gameLoopId !== undefined) {
            cancelAnimationFrame(this.gameLoopId)
        }
        // this.engine = undefined
    }
}