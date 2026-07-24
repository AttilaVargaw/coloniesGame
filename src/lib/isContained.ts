import type { Engine } from "@/engine/core/engine"
import { Entity } from "@/engine/entities/entity"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { PositionComponent, WorldPosition } from "@engine/components/position"
import { SizeComponent } from "@engine/components/sizeComponent"

export function isContained(position: WorldPosition, { size: { height, width } }: { position: PositionComponent, size: SizeComponent }, entity: Entity, engine: Engine) {
    const [correctedPositionX, correctedPositionY] = getAbsolute(entity, engine)
    const halfX = width / 2
    const halfY = height / 2

    const { x, y } = position

    return (
        correctedPositionX - halfX < x
        && correctedPositionX + halfX > x
        && correctedPositionY - halfY < y
        && correctedPositionY + halfY > y
    )
}
