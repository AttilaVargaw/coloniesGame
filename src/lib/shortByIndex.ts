import { PositionNode } from "@/ems/systems/viewportSystem/positionNode";

export function shortByIndex(a: PositionNode, b: PositionNode) {
    return a.position.z - b.position.z
}
