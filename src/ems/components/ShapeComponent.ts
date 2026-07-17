import { EntityComponent } from "@/ems/entities/entityComponent";


export class ShapeComponent extends EntityComponent {
    constructor(public sides: number, public radius: number) {
        super();
    }
}
