import { Entity } from "@engine/entities/entity"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { MapSystem } from "@game/systems/mapSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { JumpDriveComponent } from "../components/vessel"
import { setShipPath } from "@game/systems/moveSystem"
import { Colony } from "../data/types"
import { Engine } from "@/engine/core/engine"
import { applyComponents, createLabel, bodyColor } from "./helpers"

export function createColony(engine: Engine, { name, population, patronGod, soi }: Colony, parent: Entity) {
    const colony = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0, 0),
        new RadiusComponent(10),
        new SoiComponent(soi ?? 100),
        new PathComponent()
    )

    if(population) {
        if(patronGod) {
            colony.addModifier(patronGod)
        }

        applyComponents(colony,
            new ColorComponent("green"),
            new HoverableComponent("pointer", { width: 40, height: 40 }),
            new ClickableComponent(true, { width: 40, height: 40 }, ({ event: { shiftKey } }) => {
                if(!engine) {
                    return
                }

                if(shiftKey) {
                    const selectionSystem = engine.getSystem(SelectionSystem)
                    const selection = selectionSystem?.currentSelection()
                    if(selection) {
                        const target = colony
                        selectionSystem?.onTargetChanged(target)
                        const mapSystem = engine.getSystem(MapSystem)
                        const selectionSceneNode = engine.getSceneNode(selection)!
                        const selectionsParent = selectionSceneNode.parentRef!.entity
                        const path = mapSystem?.findPath(selectionsParent, target)
                        if(path && path.length > 1) {
                            setShipPath(selection, path)
                        } else {
                            const drive = selection.getComponent(JumpDriveComponent)
                            if(drive) {
                                drive.target = target
                            }
                        }
                    }
                } else {
                    engine.dispatchEvent(new SelectionChangedEvent({ data: colony, type: "colony" }))
                }
            }),
            new IndustryComponent(population, 80, population, 1)
        )
    } else {
        colony.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
            .addComponent(bodyColor)
    }

    const label = createLabel(engine, name, 18, "white")

    engine.addEntity(colony, parent)
        .addEntity(label, colony)

    return colony
}
