import { Entity } from "@engine/entities/entity"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { Colony } from "../data/types"
import { Engine } from "@/engine/core/engine"
import { applyComponents, createLabel, bodyColor, calculateSoi, soiFromRadius } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"

export function createColony(engine: Engine, { name, population, patronGod, soi, radius, archetype }: Colony, parent: Entity) {
    const colony = engine.createEntity()
    applyComponents(colony,
        new PositionComponent(0, 0, 0),
        new RadiusComponent(radius),
        new SoiComponent(soi ?? calculateSoi(radius, archetype)),
        new PathComponent()
    )

    if(population) {
        if(patronGod) {
            colony.addModifier(patronGod)
        }

        applyComponents(colony,
            new ColorComponent("green"),
            new SelectableComponent(20, "red"),
            new TargetableComponent(),
            new HoverableComponent("pointer", { width: 40, height: 40 }),
            new ClickableComponent(true, { width: 40, height: 40 }, ({ event: { shiftKey }, worldX, worldY }) => {
                if(!engine) {
                    return
                }

                if(shiftKey) {
                    const targetSystem = engine.getSystem(TargetSystem)
                    const selectionSystem = engine.getSystem(SelectionSystem)
                    const selection = selectionSystem?.currentSelection()
                    if(selection) {
                        targetSystem?.setTarget(selection, colony, worldX, worldY)
                    }
                } else {
                    engine.dispatchEvent(new SelectionChangedEvent({ data: colony, type: "colony" }))
                }
            }),
            new IndustryComponent(population, 80, population, 1)
        )
    } else {
        colony.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
            .addComponent(new TargetableComponent(true))
            .addComponent(bodyColor)
    }

    const label = createLabel(engine, name, 18, "white")

    const soiCircle = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiFromRadius(colony.getComponent(RadiusComponent)!, archetype).radius),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    engine.addEntity(colony, parent)
        .addEntity(label, colony)
        .addEntity(soiCircle, colony)

    return colony
}
