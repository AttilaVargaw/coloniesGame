import { PositionComponent } from "@/ems/components/position";
import { transverseAndSumPositionComponents } from "../transverseAndSumPositionComponents";

export interface VisibleBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export function isVisible(
    position: PositionComponent,
    bounds: VisibleBounds,
    margin = 0
): boolean {
    const [x, y] = transverseAndSumPositionComponents(position);
    return (
        x + margin >= bounds.left &&
        x - margin <= bounds.right &&
        y + margin >= bounds.top &&
        y - margin <= bounds.bottom
    );
}
