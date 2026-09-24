import { SystemWithNodes } from "@game/systems/system";
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem";
import { PositionComponent } from "@engine/components/position";
import { PositionNode } from "@engine/systems/viewportSystem/positionNode";
import { EntityComponent } from "@engine/entities/entityComponent";
import { Entity } from "@/engine/entities/entity";

export class HoverableComponent extends EntityComponent {
    constructor(
        public cursor: "default" | "pointer" | "none" | "not-allowed" = "pointer",
        public size: { width: number, height: number },
        entity?: Entity,
    ) {
        super(entity)
    }
}

export class HoverableNode extends PositionNode {
    constructor(public position: PositionComponent, public hoverable: HoverableComponent, entity: Entity) {
        super(position, entity);
    }
}
