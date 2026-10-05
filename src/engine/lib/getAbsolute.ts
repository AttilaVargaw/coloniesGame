import { vec3 } from "gl-matrix";
import { PositionComponent } from "../components/position";
import type { Engine } from "../core/engine";
import { Entity } from "../entities/entity";

export function getAbsolute(entity: Entity, engine: Engine): vec3 {
    const sceneNode = engine.getSceneNode(entity)
    return sceneNode?.getWorldPosition() ?? entity.getComponent(PositionComponent)?.getVector() ?? vec3.fromValues(0, 0, 0)
}
