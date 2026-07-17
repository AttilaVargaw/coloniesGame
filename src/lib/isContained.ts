import { PositionComponent } from "@/ems/components/position"
import { SizeComponent } from "@/ems/components/sizeComponent"
import { transverseAndSumPositionComponents } from "@/ems/systems/viewportSystem/transverseAndSumPositionComponents"

export function isContained(node: Omit<PositionComponent, "z">, { position, size: { height, width } }: { position: Omit<PositionComponent, "z">, size: SizeComponent }) {
    const [correctedPositionX, correctedPositionY] = transverseAndSumPositionComponents(position)
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