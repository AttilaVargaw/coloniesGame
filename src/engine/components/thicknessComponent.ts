import { EntityComponent } from "../entities/entityComponent";

export class ThicknessComponent extends EntityComponent {
    constructor(public thickness: number) {
        super()
    }
}
