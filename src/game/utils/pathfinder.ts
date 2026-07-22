import { PathComponent } from "@game/components/pathComponent";
import type { Entity } from "@engine/entities/entity";
import { PositionComponent } from "@engine/components/position";

export function aStar(
    start: Entity,
    end: Entity
): Entity[] {
    const startPath = start.getComponent(PathComponent);
    const endPath = end.getComponent(PathComponent);

    if (!startPath || !endPath) {
        return [];
    }

    if (start === end) {
        return [start];
    }

    const endPos = end.getComponent(PositionComponent);
    const h = (a: Entity): number => {
        const pos = a.getComponent(PositionComponent);
        if (!pos || !endPos) return Infinity;
        return Math.hypot(pos.x - endPos.x, pos.y - endPos.y) / 100;
    };

    const openSet = new Set<Entity>([start]);
    const cameFrom = new Map<Entity, Entity>();
    const gScore = new Map<Entity, number>([[start, 0]]);
    const fScore = new Map<Entity, number>([[start, h(start)]]);

    while (openSet.size > 0) {
        const current = [...openSet].reduce((best, e) => {
            const f = fScore.get(e) ?? Infinity;
            const bestF = fScore.get(best) ?? Infinity;
            return f < bestF ? e : best;
        });

        if (current === end) {
            const path: Entity[] = [end];
            let node: Entity | undefined = end;
            while ((node = cameFrom.get(node!))) {
                path.unshift(node);
            }
            return path;
        }

        openSet.delete(current);
        const currentPath = current.getComponent(PathComponent);
        if (!currentPath) continue;
        const currentG = gScore.get(current) ?? Infinity;

        for (const neighbourPath of currentPath.connections) {
            const neighbour = neighbourPath.entity;
            if (!neighbour) continue;

            const tentativeG = currentG + 1;
            const neighbourG = gScore.get(neighbour) ?? Infinity;

            if (tentativeG < neighbourG) {
                cameFrom.set(neighbour, current);
                gScore.set(neighbour, tentativeG);
                fScore.set(neighbour, tentativeG + h(neighbour));
                openSet.add(neighbour);
            }
        }
    }

    return [];
}
