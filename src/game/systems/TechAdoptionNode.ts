import { TechAdoptionComponent } from "@game/components/TechAdoptionComponent";
import { EntityNode } from "@engine/entities/entityNode";
import { Entity } from "@/engine/entities/entity";

export class TechAdoptionNode extends EntityNode {
    constructor(public adoption: TechAdoptionComponent, entity: Entity) {
        super(entity);
    }
}
