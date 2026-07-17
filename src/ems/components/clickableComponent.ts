import { EntityComponent } from "../entities/entityComponent";
import { Engine } from "../engine";
import { Entity } from "../entities/entity";
export class ClickableComponent extends EntityComponent {
    constructor(public clickable: boolean, public size: { width: number, height: number }, public onClick?: (event: { target: Entity, engine: Engine, data: { event: MouseEvent } }) => void) {
        super()
    }
}