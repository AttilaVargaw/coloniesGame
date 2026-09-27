import { DateComponent } from "@engine/components/dateComponent"
import { TimeScaleComponent } from "@engine/components/timeScaleComponent"
import { ViewportComponent } from "@engine/components/viewportComponent"
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
import Camera from "@lib/camera"
import { FIELD_OF_VIEW, CAMERA_INITIAL_DISTANCE, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE } from "./constants"
import { CommandBase } from "@/engine/lib/CommandBase"
import { BodyBlueprint } from "./data/BodyBlueprint"
import { ShapeRenderer } from "@/engine/systems/viewportSystem/renderers/shapeRenderer"
import { CircleRenderer } from "@/engine/systems/viewportSystem/renderers/circleRenderer"
import { LabelRenderer } from "@/engine/systems/viewportSystem/renderers/labelRenderer"
import { RectRenderer } from "@/engine/systems/viewportSystem/renderers/rectRenderer"
import { PointerInteractionSystem } from "@/engine/systems/pointerInteractionSystem"
import { OrbitSelectionSystem } from "./systems/orbitSelectionSystem"
import { CameraFollowSystem, CameraFollowComponent } from "./systems/cameraFollowSystem"
import { DebugSystem } from "./systems/debugSystem"
import { AsteroidSpinSystem } from "./systems/asteroidSpinSystem"
import { DayPassedEvent, } from "@/engine/lib/events"
import { ColorComponent } from "@/engine/components/colorComponent"
import { PositionComponent } from "@/engine/components/position"
import { disposeAsteroidTextures } from "./factories/createAsteroidBelt"
import { createEntity } from "@/engine/lib/entityRegistry"

export class Game {
    readonly engine: World
    private gameLoopId?: number

    private constructor(public renderingContext: CanvasRenderingContext2D, public map: BodyBlueprint) {
        this.engine = new World()

        const camera = new Camera(renderingContext, {
            initialPosition: [
                0, 0, 0
            ],
            distance: CAMERA_INITIAL_DISTANCE,
            fieldOfView: FIELD_OF_VIEW,
            scaleX: 1.0,
            scaleY: 1.0,
            minDistance: CAMERA_MIN_DISTANCE,
            maxDistance: CAMERA_MAX_DISTANCE,
            yaw: 0,
            pitch: 0,
        })

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

        const viewportEntity = createEntity()
            .addComponent(new ViewportComponent(camera))
        this.engine.addEntity(viewportEntity)

        const dateEntity = createEntity()
            .addComponent(new DateComponent(0))
        this.engine.addEntity(dateEntity)

        const timeScaleEntity = createEntity()
            .addComponent(new TimeScaleComponent(1))
        this.engine.addEntity(timeScaleEntity)

        this.engine
            .addSystem(MoveSystem)
            .addSystem(SelectionManager)
            .addSystem(TargetSystem)
            .addSystem(PointerInteractionSystem, ViewportSystem)
            .addSystem(MapSystem)
            .addSystem(OrbitSelectionSystem, ViewportSystem)
            .addSystem(ShapeRenderer, ViewportSystem)
            .addSystem(CircleRenderer, ViewportSystem)
            .addSystem(LabelRenderer, ViewportSystem)
            .addSystem(RectRenderer, ViewportSystem)
            .addSystem(CameraFollowSystem, ViewportSystem)
            .addSystem(DebugSystem)
            .addSystem(AsteroidSpinSystem)

        viewportEntity.addComponent(new CameraFollowComponent())

        this.engine.getSystem(ViewportSystem).setRendererClasses([
            ShapeRenderer, CircleRenderer, LabelRenderer, RectRenderer
        ])
        this.engine.getSystem(ViewportSystem).init()

        setTimeout(() => {
            this.engine.dispatchEvent(new DayPassedEvent(null))
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

    static async create(renderingContext: CanvasRenderingContext2D, map: BodyBlueprint) {
        const game = new Game(renderingContext, map)
        game.engine.getSystem(MapSystem).init().catch(console.error).then(() => {
            const { x, y, z, } = game.engine.getAllEntities().find(e => e.getComponent(ColorComponent)?.emitLight)!.getComponent(PositionComponent)!

            const camera = game.engine.getSystem(ViewportSystem).viewport.camera

            camera.moveTo(x, y, z)

            game.engine.getSystem(MapSystem).rebuildGraph()
        })

        return game
    }

    destruct(): void {
        this.engine.destruct()
        disposeAsteroidTextures()

        if(this.gameLoopId !== undefined) {
            cancelAnimationFrame(this.gameLoopId)
        }
    }

    onCommand<T extends new (...args: any) => CommandBase>(command: T) {
        return this.engine.getCommands(command)
    }
}
