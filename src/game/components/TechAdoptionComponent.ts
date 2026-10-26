import { EntityComponent } from "@engine/entities/entityComponent";

export type TechAdoptionState = {
    techId: string;
    inventedAt: number; // day number when tech was researched
    model: "logistic" | "linear" | "instant";
    adoptionSpeed: number; // days to full adoption
    currentAdoption: number; // 0..1
    sectorAdoption?: Map<string, number>; // per-sector adoption if needed
};

export class TechAdoptionComponent extends EntityComponent {
    public adoptionStates: Map<string, TechAdoptionState> = new Map();
}
