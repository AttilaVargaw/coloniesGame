import { Entity } from "../entities/entity";
import { JumpDriveComponent } from "../systems/moveSystem";

export function createJumpCommand(entity: Entity, target: Entity) {
    const jumpDrive = entity.getComponent(JumpDriveComponent)

    if(jumpDrive) {
        jumpDrive.target = target
    }

    return entity
}