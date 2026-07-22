import { EntityComponent } from "../entities/entityComponent";

export class OrbitComponent extends EntityComponent {
    constructor(
        public centerEntityId: string,
        public radius: number,
        public angularSpeed: number,
        public angle: number = 0
    ) {
        super();
    }
}
