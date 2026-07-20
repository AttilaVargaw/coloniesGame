import { EntityNode } from "@engine/entities/entityNode";
import { ViewportComponent } from "../../components/viewportComponent";
import { Entity } from "@/engine/entities/entity";

export class ViewportNode extends EntityNode {
    constructor(public viewPort: ViewportComponent, entity: Entity) {
        super(entity);
    }
}
