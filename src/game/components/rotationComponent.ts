import { EntityComponent } from "@engine/entities/entityComponent"

export class RotationComponent extends EntityComponent {
    constructor(public angle: number = 0, public speed: number = 0) {
        super()
    }
}
