import { Engine } from "@/engine/core/engine"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { JumpDriveComponent, SensorSuiteComponent } from "../components/vessel"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { applyComponents, createLabel } from "./helpers"

export function createSpaceship(engine: Engine, { name }: { name: string }) {
    const ship = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new JumpDriveComponent(),
        new SensorSuiteComponent(3),
        new ColorComponent("red"),
        new RadiusComponent(6),
        new HoverableComponent("pointer", { width: 40, height: 40 }),
    )

    engine.addEntity(ship)

    const clickArea = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0, -1),
        new ClickableComponent(true, { width: 40, height: 40 }, ({ target, event: { shiftKey } }) => {
            const selectionSystem = engine.getSystem(SelectionSystem)
            const targetSceneNode = engine.getSceneNode(target)!

            if(shiftKey) {
                selectionSystem?.onTargetChanged(targetSceneNode.parentRef!.entity)
            } else {
                selectionSystem?.onSelectionChanged({ entity: targetSceneNode.parentRef!.entity, type: "ship" })
            }
        })
    )
    engine.addEntity(clickArea, ship)

    const label = createLabel(engine, name, 18, "red")
    engine.addEntity(label, ship)

    return ship
}
