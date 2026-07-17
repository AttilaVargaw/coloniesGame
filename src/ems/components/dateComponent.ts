import { EntityComponent } from "../entities/entityComponent";

export class DateComponent extends EntityComponent {

    constructor(public ms: number) {
        super()
    }
}