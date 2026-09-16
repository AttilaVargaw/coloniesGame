import { EntityComponent } from "../entities/entityComponent";

export class OrbitComponent extends EntityComponent {
    constructor(
        public centerEntityId: string,
        public radius: number,
        public angularSpeed: number,
        public meanAnomaly: number = 0,
        public eccentricity: number = 0,
        public inclination: number = 0
    ) {
        super();
    }

    get semiMinorAxis(): number {
        return Math.max(0, this.radius * Math.sqrt(1 - this.eccentricity ** 2))
    }
}
