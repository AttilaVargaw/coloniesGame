

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
import { SelectionManager } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem"
import { OrbitSystem } from "@engine/systems/orbitSystem/orbitSystem"
import Camera from "@lib/camera"
import { FIELD_OF_VIEW, CAMERA_INITIAL_DISTANCE, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, UNIVERSE_SCALE } from "./constants"
import { CommandBase } from "@/engine/lib/CommandBase"
import { BodyBlueprint } from "./data/BodyBlueprint"
import { ShapeRenderer } from "@/engine/systems/viewportSystem/renderers/shapeRenderer"
import { CircleRenderer } from "@/engine/systems/viewportSystem/renderers/circleRenderer"
import { LabelRenderer } from "@/engine/systems/viewportSystem/renderers/labelRenderer"
import { RectRenderer } from "@/engine/systems/viewportSystem/renderers/rectRenderer"
import { OrbitSelectionSystem } from "./systems/orbitSelectionSystem"

export class Game {
    readonly engine: World = new World
    private gameLoopId?: number

    constructor(public renderingContext: CanvasRenderingContext2D, public map: BodyBlueprint) {
        const firstStar = { x: 0, y: 0, z: 0 }

        const camera = new Camera(renderingContext, {
            initialPosition: [firstStar.x * UNIVERSE_SCALE, firstStar.y * UNIVERSE_SCALE, firstStar.z * UNIVERSE_SCALE],
            distance: CAMERA_INITIAL_DISTANCE,
            fieldOfView: FIELD_OF_VIEW,
            scaleX: 1.0,
            scaleY: 1.0,
            minDistance: CAMERA_MIN_DISTANCE,
            maxDistance: CAMERA_MAX_DISTANCE,
            azimuth: 0,
            elevation: Math.PI / 4,
        })

        this.engine
            .addSystem(IndustrySystem)
            .addSystem(DateSystem)
            .addSystem(OrbitSystem)
            .addSystem(ButtonPressSystem)
            .addSystem(ViewportSystem)

        const viewportEntity = this.engine.createEntity()
            .addComponent(new ViewportComponent(camera))
        this.engine.addEntity(viewportEntity)

        const dateEntity = this.engine.createEntity()
            .addComponent(new DateComponent(0))
        this.engine.addEntity(dateEntity)

        this.engine
            .addSystem(MoveSystem)
            .addSystem(SelectionManager)
            .addSystem(TargetSystem)
            .addSystem(CursorSystem, ViewportSystem)
            .addSystem(MapSystem)
            .addSystem(ClickableSystem, ViewportSystem)
            .addSystem(ShapeRenderer, ViewportSystem)
            .addSystem(CircleRenderer, ViewportSystem)
            .addSystem(LabelRenderer, ViewportSystem)
            .addSystem(RectRenderer, ViewportSystem)
            .addSystem(OrbitSelectionSystem, ViewportSystem)

        this.engine.getSystem(MapSystem).init()
        this.engine.getSystem(ViewportSystem).init()

        let previousTime = 0.0

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

    onCommand<T extends new (...args: any) => CommandBase>(command: T) {
        return this.engine.getCommands(command)
    }
}