import { PositionComponent } from "@engine/components/position";
import { MapCreationData } from "../data/gameData";
import { Engine } from "@/engine/core/engine";
import { applyComponents } from "./helpers";
import { createBody } from "./createBody";
import { massByArchetype } from "./helpers";
import { createEntity } from "@/engine/lib/entityRegistry";

export async function init(engine: Engine) {
    const root = createEntity("root")

    applyComponents(root,
        new PositionComponent(0, 0, 0),
    )

    await createBody(MapCreationData, root, engine, massByArchetype["sol"])

    return engine
}
