import { EntityComponent } from "../entities/entityComponent";

export class SelectableComponent extends EntityComponent {
    constructor(public radius: number, public color: string) {
        super()
    }
}
