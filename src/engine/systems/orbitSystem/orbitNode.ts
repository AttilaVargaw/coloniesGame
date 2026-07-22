import { PositionComponent } from "../../components/position";
import { Entity } from "../../entities/entity";
import { EntityNode } from "../../entities/entityNode";
import { OrbitComponent } from "../../components/orbitComponent";

export class OrbitNode extends EntityNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public orbit: OrbitComponent
    ) {
        super(entity);
    }
}
