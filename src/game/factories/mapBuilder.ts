import { PositionComponent } from "@engine/components/position";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { MapCreationData } from "../data/gameData";
import { Engine } from "@/engine/core/engine";
import { applyComponents } from "./helpers";
import { createBody } from "./createBody";
import { massByArchetype } from "./helpers";

export async function init(engine: Engine) {
    const viewportSystem = engine.getSystem(ViewportSystem)

    viewportSystem.sortOnEveryEntityAddition = false

    const root = engine.createEntity("root")

    applyComponents(root,
        new PositionComponent(0, 0, 0),
    )

    await createBody(MapCreationData, root, engine, massByArchetype["sol"])

    viewportSystem.sortOnEveryEntityAddition = true

    return engine
}
