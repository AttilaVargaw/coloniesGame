import { EntityComponent } from "../entities/entityComponent";

export class SoiComponent extends EntityComponent {
    constructor(
        public radius: number
    ) {
        super();
    }
}
