import { EntityComponent } from "../entities/entityComponent";

export class MassComponent extends EntityComponent {
    constructor(public mass: number) {
        super();
    }
}
