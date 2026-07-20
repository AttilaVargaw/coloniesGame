import { EntityComponent } from "../entities/entityComponent";

export class SizeComponent extends EntityComponent {
    constructor(public width: number, public height: number) {
        super()
    }
}