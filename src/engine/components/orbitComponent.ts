import { EntityComponent } from "../entities/entityComponent";
import { TWO_PI } from "@/game/constants";

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
        this.rebuildCache();
    }

    cachedPoints: { x: number; y: number }[] = []
    _semiMinorAxis: number = 0

    rebuildCache() {
        this.cachedPoints = []
        this._semiMinorAxis = Math.max(0, this.radius * Math.sqrt(1 - this.eccentricity ** 2))
        const segments = 32
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * TWO_PI
            const x = this.radius * Math.cos(angle)
            const y = this._semiMinorAxis * Math.sin(angle)
            this.cachedPoints.push({ x, y })
        }
    }

    get semiMinorAxis(): number {
        return this._semiMinorAxis
    }
}
