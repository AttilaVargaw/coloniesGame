import { DateComponent } from "@engine/components/dateComponent"
import { ViewportComponent } from "@engine/components/viewportComponent"
import { World } from "@engine/core/world"
import { ButtonPressSystem } from "@engine/systems/buttonPressSystem"
import { ClickableSystem } from "@engine/systems/clickable"
import { CursorSystem } from "@game/systems/cursorSystem"
import { DateSystem } from "@engine/systems/dateSystem"
import { IndustrySystem } from "@game/systems/industrySystem"
import { MapSystem } from "@game/systems/mapSystem"
import { MoveSystem } from "@game/systems/moveSystem"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem"
import { Star } from "@game/data/types"
import Camera from "@lib/camera"

export class Game {
    readonly engine: World = new World
    private gameLoopId?: number

    constructor(public renderingContext: CanvasRenderingContext2D, public solarSystems: Map<string, Star>) {
        const camera = new Camera(renderingContext, { initialPosition: [1500, 1500], distance: 3000, fieldOfView: Math.PI / 4.0, scaleX: 1.0, scaleY: 1.0, minDistance: 100, maxDistance: 12000 })

        this.engine
            .addSystem(IndustrySystem)
            .addSystem(DateSystem)
            .addSystem(ButtonPressSystem)
            .addSystem(ViewportSystem)
            .addEntity(this.engine.createEntity()
                .addComponent(new ViewportComponent(camera)))
            .addSystem(MoveSystem)
            .addSystem(SelectionSystem)
            .addSystem(CursorSystem)
            .addSystem(MapSystem)
            .addSystem(ClickableSystem)
            .addEntity(this.engine.createEntity().addComponent(new DateComponent(0)))
        // .subscribe("selectionChanged", ({ type }: { entity: Entity, type: string }) => {
        //     if(type === "colony") {
        //         document.body.style.cursor = 'default';
        //     }
        // })

        this.engine.getSystem(MapSystem)!.init(48)

        let previousTime = 0.

        const update = (time: number) => {
            if(!this.engine) {
                return
            }

            const dt = time - previousTime;

            previousTime = time

            this.engine.update(Math.min(500, dt))

            this.gameLoopId = requestAnimationFrame(update)
        }

        this.gameLoopId = requestAnimationFrame(time => {
            previousTime = time;

            this.gameLoopId = requestAnimationFrame(update)
        })
    }

    destruct(): void {
        this.engine.destruct()

        if(this.gameLoopId !== undefined) {
            cancelAnimationFrame(this.gameLoopId)
        }
    }
}