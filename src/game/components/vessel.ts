import { EntityComponent } from "@engine/entities/entityComponent";
import type { Entity } from "@/engine/entities/entity";

export class JumpDriveComponent extends EntityComponent {
    target?: Entity
    clickX?: number
    clickY?: number
    isOrbitSelecting?: boolean
}

export class SensorSuiteComponent extends EntityComponent {
    constructor(public range: number) {
        super()
    }
}

export class FuelComponent extends EntityComponent {
    constructor(public tylium: number = 0, public consumptionRate: number = 1) {
        super()
    }
}
