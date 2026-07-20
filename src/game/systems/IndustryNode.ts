import { IndustryComponent } from "@game/components/industryComponent";
import { EntityNode } from "@engine/entities/entityNode";

export class IndustryNode extends EntityNode {
    constructor(public industry: IndustryComponent) {
        super();
    }
}