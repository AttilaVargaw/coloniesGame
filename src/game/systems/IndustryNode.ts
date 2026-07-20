import { IndustryComponent } from "@game/components/industryComponent";
import { EntityNode } from "@engine/entities/entityNode";
import { Entity } from "@/engine/entities/entity";

export class IndustryNode extends EntityNode {
    constructor(public industry: IndustryComponent, entity: Entity) {
        super(entity);
    }
}