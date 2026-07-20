import { EntityComponent } from "@engine/entities/entityComponent";


export class ShapeComponent extends EntityComponent {
    constructor(public sides: number, public radius: number) {
        super();
    }
}
