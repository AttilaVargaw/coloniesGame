import { Engine } from "@/engine/core/engine";
import { Entity } from "@/engine/entities/entity";
import { getAbsolute } from "@/engine/lib/getAbsolute";

export interface VisibleBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export function isVisible(
    bounds: VisibleBounds,
    margin = 0,
    entity: Entity,
    engine: Engine
): boolean {
    const [x, y] = getAbsolute(entity, engine);
    return (
        x + margin >= bounds.left &&
        x - margin <= bounds.right &&
        y + margin >= bounds.top &&
        y - margin <= bounds.bottom
    );
}
