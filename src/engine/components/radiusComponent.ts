import { EntityComponent } from "../entities/entityComponent";
export class RadiusComponent extends EntityComponent {
    constructor(public radius: number) {
        super()
    }
}