import { EntityNode } from "@engine/entities/entityNode";
import { Entity } from "@/engine/entities/entity";
import { MigrationRouteComponent } from "@game/components/migrationRouteComponent";

export class MigrationRouteNode extends EntityNode {
    constructor(public migrationRoute: MigrationRouteComponent, entity: Entity) {
        super(entity);
    }
}
