import { IndustryComponent } from "../components/industryComponent";
import { EntityNode } from "../entities/entityNode";


export class IndustryNode extends EntityNode {
    constructor(public industry: IndustryComponent) {
        super();
    }
}
