import { Engine } from "@/engine/core/engine";
import { Entity } from "@/engine/entities/entity";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { ViewportSystem } from "../viewportSystem";

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
    const [x, y, z] = getAbsolute(entity, engine);
    const camera = engine.getSystem(ViewportSystem)?.viewport?.camera
    if (!camera) {
        return true
    }

    const projected = camera.project(x, y, z)
    if (!projected) {
        return false
    }

    const scaledMargin = margin * projected.scale
    return (
        projected.x + scaledMargin >= bounds.left &&
        projected.x - scaledMargin <= bounds.right &&
        projected.y + scaledMargin >= bounds.top &&
        projected.y - scaledMargin <= bounds.bottom
    );
}
