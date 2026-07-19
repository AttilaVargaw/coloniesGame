import { PositionNode } from "@/ems/systems/viewportSystem/positionNode";

export function shortByDepth(a: PositionNode, b: PositionNode) {
    return a.position.z - b.position.z
}
