import { EntityComponent } from "../entities/entityComponent";
import { Entity } from "../entities/entity";
export class ClickableComponent extends EntityComponent {
    constructor(public clickable: boolean, public size: { width: number, height: number }, public onClick?: (event: { target: Entity, event: MouseEvent }) => void) {
        super()
    }
}