import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { Engine } from "@/engine/core/engine"
import { applyComponents } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"

export function createStar(engine: Engine, { x, y, soi }: { x: number, y: number, soi: number }) {
    const star = applyComponents(engine.createEntity(),
        new PositionComponent(x, y),
        new RadiusComponent(20),
        new ColorComponent("yellow"),
        new HoverableComponent("not-allowed", { width: 100, height: 100 }),
        new SoiComponent(soi),
        new PathComponent(),
        new TargetableComponent()
    )
    engine.addEntity(star)

    const soiCircle = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soi),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )
    engine.addEntity(soiCircle, star)

    return star
}
