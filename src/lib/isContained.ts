import { PositionComponent, WorldPosition } from "@/ems/components/position"
import { SizeComponent } from "@/ems/components/sizeComponent"

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