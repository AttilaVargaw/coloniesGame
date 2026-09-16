import { PositionComponent } from "../components/position";
import type { Engine } from "../core/engine";
import { Entity } from "../entities/entity";

export function getAbsolute(entity: Entity, engine: Engine): [number, number, number] {
    const sceneNode = engine.getSceneNode(entity);
    const parentPosition = sceneNode?.parent?.entity;

    const position = entity.getComponent(PositionComponent)!;
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
