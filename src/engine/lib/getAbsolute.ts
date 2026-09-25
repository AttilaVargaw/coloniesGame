import { Vector3 } from "@/lib/Vector3";
import { PositionComponent } from "../components/position";
import type { Engine } from "../core/engine";
import { Entity } from "../entities/entity";

export function getAbsolute(entity: Entity, engine: Engine): Vector3 {
    const sceneNode = engine.getSceneNode(entity);
    const parentPosition = sceneNode?.parent?.entity;

    const position = entity.getComponent(PositionComponent);
    if(!position) {
        return [0, 0, 0]
    }

    let absoluteX = position.x;
    let absoluteY = position.y;
    let absoluteZ = position.z;

    if(parentPosition && sceneNode.parent) {
        const [parentX, parentY, parentZ] = getAbsolute(sceneNode.parent.entity, engine);
        absoluteX = parentX + position.x;
        absoluteY = parentY + position.y;
        absoluteZ = parentZ + position.z;
    }

    return [absoluteX, absoluteY, absoluteZ];
}
