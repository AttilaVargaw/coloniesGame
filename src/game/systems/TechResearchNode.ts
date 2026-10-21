import { TechResearchComponent } from "@game/components/TechResearchComponent";
import { EntityNode } from "@engine/entities/entityNode";
import { Entity } from "@/engine/entities/entity";

export class TechResearchNode extends EntityNode {
    constructor(public research: TechResearchComponent, entity: Entity) {
        super(entity);
    }
}
