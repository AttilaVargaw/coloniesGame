import { PositionComponent } from "../components/position";
import type { Engine } from "../core/engine";
import { Entity } from "../entities/entity";

export function getAbsolute(entity: Entity, engine: Engine): [number, number] {
    const sceneNode = engine.getSceneNode(entity);
    const parentPosition = sceneNode?.parentRef?.entity;

    const position = entity.getComponent(PositionComponent)!;
    let absoluteX = position.x;
    let absoluteY = position.y;

    if(parentPosition) {
        const [parentX, parentY] = getAbsolute(sceneNode.parentRef.entity, engine);
        absoluteX = parentX + position.x;
        absoluteY = parentY + position.y;
    }

    return [absoluteX, absoluteY];
}
