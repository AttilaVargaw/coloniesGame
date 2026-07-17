import { Engine } from "@/ems/engine";
import { System } from "../system";

const nodeNeighbours = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1]
] as const

export function getNeighbourNodes(node: [number, number]) {
    return nodeNeighbours.map(([x, y]) => [node[0] + x, node[1] + y])

}

export class OrbitSystem implements System {
    removeFromEngine(): void {
        throw new Error("Method not implemented.");
    }

    update(_dt: number): void {
        throw new Error("Method not implemented.");
    }
    addToEngine(_engine: Engine): () => void {
        throw new Error("Method not implemented.");
    }
}