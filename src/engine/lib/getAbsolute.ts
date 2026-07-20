import { PositionComponent } from "../components/position";
import { World } from "../core/world";
import { Entity } from "../entities/entity";

export function getAbsolute(entity: Entity, engine: World): [number, number] {
    const sceneNode = engine.getSceneNode(entity);
    const parentPosition = sceneNode?.parentRef?.entity;

    let absoluteX: number;
    let absoluteY: number;

    if(!parentPosition) {
        const position = entity.getComponent(PositionComponent)!;
        absoluteX = position.x;
        absoluteY = position.y;
    } else {
        const [parentX, parentY] = getAbsolute(sceneNode.parentRef.entity, engine);
        const position = entity.getComponent(PositionComponent)!;
        absoluteX = parentX + position.x;
        absoluteY = parentY + position.y;
    }

    return [absoluteX, absoluteY];
}