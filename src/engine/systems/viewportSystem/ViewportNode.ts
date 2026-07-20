import { EntityNode } from "@engine/entities/entityNode";
import { ViewportComponent } from "../../components/viewportComponent";

export class ViewportNode extends EntityNode {
    constructor(public viewPort: ViewportComponent) {
        super();
    }
}
