import { EntityComponent } from "@engine/entities/entityComponent";
import type { Entity } from "@engine/entities/entity";

export class JumpDriveComponent extends EntityComponent {
    target?: Entity
    clickX?: number
    clickY?: number
}
export class SensorSuiteComponent extends EntityComponent {
    constructor(public range: number) {
        super()
    }
}
