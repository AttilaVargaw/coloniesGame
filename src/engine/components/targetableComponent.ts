import { EntityComponent } from "../entities/entityComponent";

export class TargetableComponent extends EntityComponent {
    constructor(public canBeTargeted: boolean = true) {
        super()
    }
}
