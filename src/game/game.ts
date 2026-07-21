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

        const viewportEntity = this.engine.createEntity()
        viewportEntity.addComponent(new ViewportComponent(camera))
        this.engine.addEntity(viewportEntity)

        const dateEntity = this.engine.createEntity()
        dateEntity.addComponent(new DateComponent(0))
        this.engine.addEntity(dateEntity)

        this.engine
            .addSystem(MoveSystem)
            .addSystem(SelectionSystem)
            .addSystem(CursorSystem, ViewportSystem)
            .addSystem(MapSystem)
            .addSystem(ClickableSystem, ViewportSystem)
        // .subscribe("selectionChanged", ({ type }: { entity: Entity, type: string }) => {
        //     if(type === "colony") {
        //         document.body.style.cursor = 'default';
        //     }
        // })

        this.engine.getSystem(MapSystem)!.init(48)

        let previousTime = 0.

        const update = (time: number) => {
            this.gameLoopId = requestAnimationFrame(update)

            if(!this.engine) {
                return
            }

            const dt = time - previousTime;

            previousTime = time

            this.engine.update(Math.min(500, dt))
        }

        update(previousTime)
    }

    destruct(): void {
        this.engine.destruct()

        if(this.gameLoopId !== undefined) {
            cancelAnimationFrame(this.gameLoopId)
        }
    }
}