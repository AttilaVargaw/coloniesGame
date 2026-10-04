import { DateComponent } from "@engine/components/dateComponent"
import { TimeScaleComponent } from "@engine/components/timeScaleComponent"
import { World } from "@engine/core/world"
import { ButtonPressSystem } from "@engine/systems/buttonPressSystem"
import { DateSystem } from "@engine/systems/dateSystem"
import { TimeScaleSystem } from "@engine/systems/timeScaleSystem"
import { IndustrySystem } from "@game/systems/industrySystem"
import { TradeSystem } from "@game/systems/tradeSystem"
import { AutoTradeSystem } from "@game/systems/autoTradeSystem"
import { MigrationSystem } from "@game/systems/migrationSystem"
import { MapSystem } from "@game/systems/mapSystem"
import { MoveSystem } from "@game/systems/moveSystem"
import { SelectionManager } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem"
import { OrbitSystem } from "@engine/systems/orbitSystem/orbitSystem"
import { CommandBase } from "@/engine/lib/CommandBase"
import { BodyBlueprint } from "./data/BodyBlueprint"
import { PointerInteractionSystem } from "@/engine/systems/pointerInteractionSystem"
import { OrbitSelectionSystem } from "./systems/orbitSelectionSystem"
import { CameraFollowSystem } from "./systems/cameraFollowSystem"
import { DebugSystem } from "./systems/debugSystem"
import { AsteroidSpinSystem } from "./systems/asteroidSpinSystem"
import { DayPassedEvent, } from "@/engine/lib/events"
import { createEntity } from "@/engine/lib/entityRegistry"

export class Game {
    readonly engine: World
    private gameLoopId?: number

    private constructor(public map: BodyBlueprint) {
        this.engine = new World()

        this.engine
            .addSystem(IndustrySystem)
            .addSystem(TradeSystem)
            .addSystem(AutoTradeSystem)
            .addSystem(MigrationSystem)
            .addSystem(DateSystem)
            .addSystem(TimeScaleSystem)
            .addSystem(OrbitSystem)
            .addSystem(ButtonPressSystem)
            .addSystem(ViewportSystem)

        const dateEntity = createEntity()
            .addComponent(new DateComponent(0))
        this.engine.addEntity(dateEntity)

        const timeScaleEntity = createEntity()
            .addComponent(new TimeScaleComponent(1))
        this.engine.addEntity(timeScaleEntity)

        const viewport = this.engine.getSystem(ViewportSystem)

        this.engine
            .addSystem(MoveSystem)
            .addSystem(SelectionManager)
            .addSystem(TargetSystem)
            .addSystem(PointerInteractionSystem, viewport)
            .addSystem(MapSystem)
            .addSystem(OrbitSelectionSystem, viewport)
            // .addSystem(ShapeRenderer, ViewportSystem)
            // .addSystem(LabelRenderer, ViewportSystem)
            // .addSystem(WebGLRectRenderer, ViewportSystem)
            // .addSystem(WebGLSphereRenderer, ViewportSystem)
            .addSystem(CameraFollowSystem, viewport)
            .addSystem(DebugSystem)
            .addSystem(AsteroidSpinSystem)

        //viewportEntity.addComponent(new CameraFollowComponent())

        // this.engine.getSystem(ViewportSystem).setRendererClasses(renderers)
        const cameraFollowSystem = this.engine.getSystem(CameraFollowSystem)
        this.engine.getSystem(ViewportSystem).init(cameraFollowSystem)

        setTimeout(() => {
            this.engine.dispatchEvent(new DayPassedEvent())
        }, 100);

        let previousTime = 0.0
        let firstUpdate = true
        let lastRenderTime = 0
        const frameDuration = 1000 / 60

        const update = (time: number) => {
            this.gameLoopId = requestAnimationFrame(update)

            if(!this.engine) {
                return
            }

            if(time - lastRenderTime < frameDuration) {
                return
            }

            lastRenderTime = time

            const dt = time - previousTime;

            previousTime = time

            this.engine.update(Math.min(500, dt))

            if(firstUpdate) {
                firstUpdate = false
                this.engine.getSystem(MapSystem).rebuildGraph()
            }
        }

        update(previousTime)
    }

    static async create(map: BodyBlueprint) {
        const game = new Game(map)
        game.engine.getSystem(MapSystem).init().catch(console.error).then(() => {
            game.engine.getSystem(MapSystem).rebuildGraph()
        })

        return game
    }

    destruct(): void {
        this.engine.destruct()

        if(this.gameLoopId !== undefined) {
            cancelAnimationFrame(this.gameLoopId)
        }
    }

    onCommand<T extends new (...args: any) => CommandBase>(command: T) {
        return this.engine.getCommands(command)
    }
}
