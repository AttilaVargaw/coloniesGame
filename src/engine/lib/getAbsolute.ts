import type { vec3 } from "gl-matrix";
import { PositionComponent } from "../components/position";
import type { Engine } from "../core/engine";
import { Entity } from "../entities/entity";

export function getAbsolute(entity: Entity, engine: Engine): vec3 {
    const sceneNode = engine.getSceneNode(entity)
    if(!sceneNode) {
        const pos = entity.getComponent(PositionComponent)
        return pos ? [pos.x, pos.y, pos.z] : [0, 0, 0]
    }
    return sceneNode.getWorldPosition()
}
