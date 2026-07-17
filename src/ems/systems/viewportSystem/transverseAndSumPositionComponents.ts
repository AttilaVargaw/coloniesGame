import { PositionComponent } from "@/ems/components/position";

export function transverseAndSumPositionComponents({ x, y, entity }: Omit<PositionComponent, "z">): [number, number] {
    const parent = entity?.getParent()?.getComponent(PositionComponent);

    if(!parent) {
        return [x, y];
    }

    const [sumX, sumY] = transverseAndSumPositionComponents(parent);
    return [sumX + x, sumY + y];
}
