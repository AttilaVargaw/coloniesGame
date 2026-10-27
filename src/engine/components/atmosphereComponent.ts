import { EntityComponent } from "../entities/entityComponent";

export type AtmosphereComponentOptions = {
    thickness?: number;
    skyColor?: string;
    rayleigh?: number;
    scaleHeight?: number;
    enabled?: boolean;
}

export class AtmosphereComponent extends EntityComponent {
    thickness: number;
    skyColor: string;
    rayleigh: number;
    scaleHeight: number;
    enabled: boolean;

    constructor(options: AtmosphereComponentOptions = {}) {
        super();
        this.thickness = options.thickness ?? 0;
        this.skyColor = options.skyColor ?? "#4a90e2";
        this.rayleigh = options.rayleigh ?? 1.0;
        this.scaleHeight = options.scaleHeight ?? 0.0;
        this.enabled = options.enabled ?? true;
    }
}
