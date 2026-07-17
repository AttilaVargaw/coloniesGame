import { EntityNode } from "@/ems/entities/entityNode";
import { ViewportComponent } from "../../components/viewportComponent";

export class ViewportNode extends EntityNode {
    constructor(public viewPort: ViewportComponent) {
        super();
    }
}
