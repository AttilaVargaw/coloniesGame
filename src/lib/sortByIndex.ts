import { PositionComponent } from "@/engine/components/position"

export function sortByZIndex({ position: { z: aZ } }: { position: PositionComponent }, { position: { z: bZ } }: { position: PositionComponent }) {
    return aZ - bZ
}