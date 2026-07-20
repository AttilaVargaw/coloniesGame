import { PositionComponent, WorldPosition } from "@engine/components/position"
import { SizeComponent } from "@engine/components/sizeComponent"

export function isContained(node: WorldPosition, { position, size: { height, width } }: { position: PositionComponent, size: SizeComponent }) {
    const [correctedPositionX, correctedPositionY] = position.getAbsolute()
    const halfX = width / 2
    const halfY = height / 2

    const { x, y } = node

    return (
        correctedPositionX - halfX < x
        && correctedPositionX + halfX > x
        && correctedPositionY - halfY < y
        && correctedPositionY + halfY > y
    )
}