import { PositionComponent } from "../../components/position";
import { Entity } from "../../entities/entity";
import { EntityNode } from "../../entities/entityNode";

export class PositionNode extends EntityNode {
    constructor(public position: PositionComponent, public children?: PositionNode[], entity?: Entity) {
        super(entity)
    }
}
