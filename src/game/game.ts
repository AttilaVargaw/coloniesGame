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
import { LabelRenderer } from "@/engine/systems/viewportSystem/renderers/labelRenderer"
import { RectRenderer } from "@/engine/systems/viewportSystem/renderers/rectRenderer"
import { PointerInteractionSystem } from "@/engine/systems/pointerInteractionSystem"
import { OrbitSelectionSystem } from "./systems/orbitSelectionSystem"
import { CameraFollowSystem, CameraFollowComponent } from "./systems/cameraFollowSystem"
import { DebugSystem } from "./systems/debugSystem"
import { AsteroidSpinSystem } from "./systems/asteroidSpinSystem"
import { DayPassedEvent, } from "@/engine/lib/events"
import { disposeAsteroidTextures } from "./factories/createAsteroidBelt"
import { createEntity } from "@/engine/lib/entityRegistry"
import { WebGLSphereRenderer } from "@/engine/systems/webglSphereSystem/webglSphereRenderer"
import { WebGLRectRenderer } from "@/engine/systems/webglSphereSystem/webglRectRenderer"

export class Game {
    readonly engine: World
    private gameLoopId?: number

    private constructor(public renderingContext: CanvasRenderingContext2D, public map: BodyBlueprint) {
        this.engine = new World()

        const camera = new Camera(renderingContext, {
            initialPosition: [
                -5357.8, 4398.6, 600
            ],
            distance: CAMERA_INITIAL_DISTANCE,
            fieldOfView: FIELD_OF_VIEW,
            scaleX: 1.0,
            scaleY: 1.0,
            minDistance: CAMERA_MIN_DISTANCE,
            maxDistance: CAMERA_MAX_DISTANCE,
            yaw: 1.15,
            pitch: 0.8,
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
            .addSystem(LabelRenderer, ViewportSystem)
            .addSystem(RectRenderer, ViewportSystem)
            .addSystem(WebGLRectRenderer, ViewportSystem)
            .addSystem(WebGLSphereRenderer, ViewportSystem)
            .addSystem(CameraFollowSystem, ViewportSystem)
            .addSystem(DebugSystem)
            .addSystem(AsteroidSpinSystem)

        viewportEntity.addComponent(new CameraFollowComponent())

        this.engine.getSystem(ViewportSystem).setRendererClasses([
            ShapeRenderer, LabelRenderer, WebGLRectRenderer, WebGLSphereRenderer
        ])
        //this.engine.addSystem(WebGLSphereSystem, ViewportSystem)
        this.engine.getSystem(ViewportSystem).init()
        this.engine.getSystem(WebGLSphereRenderer).init()
        this.engine.getSystem(WebGLRectRenderer).init()


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
        if(!renderingContext) {
            console.error("No rendering context")

            return
        }
        const game = new Game(renderingContext, map)
        game.engine.getSystem(MapSystem).init().catch(console.error).then(() => {
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
