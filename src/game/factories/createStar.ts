import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { Engine } from "@/engine/core/engine"
import { applyComponents } from "./helpers"

export function createStar(engine: Engine, { x, y, soi }: { x: number, y: number, soi: number }) {
    const star = applyComponents(engine.createEntity(),
        new PositionComponent(x, y),
        new RadiusComponent(20),
        new ColorComponent("yellow"),
        new HoverableComponent("not-allowed", { width: 100, height: 100 }),
        new SoiComponent(soi),
        new PathComponent()
    )
    engine.addEntity(star)

    return star
}
