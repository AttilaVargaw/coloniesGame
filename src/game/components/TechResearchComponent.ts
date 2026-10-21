import { EntityComponent } from "@engine/entities/entityComponent";

export class TechResearchComponent extends EntityComponent {
    public researched: Set<string> = new Set();
    public currentTech?: string;
    public progress: number = 0; // 0..1
    public researchPointsPerDay: number = 0;
}
