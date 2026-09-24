import { EntityComponent } from "../entities/entityComponent";

export class ColorComponent extends EntityComponent {
    constructor(public fill?: string, public stroke?: string, public shade = false, public emitLight: boolean = false) {
        super();
    }
}