import { Engine } from "../engine";
import { Entity } from "../entities/entity";
import { EntityComponent } from "../entities/entityComponent";
import { EntityNode } from "../entities/entityNode";
import { SystemWithNodes } from "./system";

class EntityCommandComponent extends EntityComponent {
    commands: ((entity: Entity) => Entity)[] = []
}

class EntityCommandNode extends EntityNode {
    constructor(entity: Entity, public commands: EntityCommandComponent) {
        super(entity)
    }
}

export class EntityCommandSystem extends SystemWithNodes<EntityCommandNode> {
    update(_dt: number): void {
        for(const entity of this.nodes) {
            while(entity.commands.commands.length !== 0) {
                const command = entity.commands.commands.shift()
                command?.(entity.entity!)
            }
        }
    }

    addToEngine(engine: Engine) {
        super.addToEngine(engine)
        engine
            .registerNodeType(EntityCommandNode,
                new Set([EntityCommandComponent]),
                (entity) => {
                    return {
                        commands: entity.getComponent(EntityCommandComponent)!,
                        entity
                    }
                });
        this.nodes = engine.getNodeList(EntityCommandNode)
    }

    removeFromEngine(): void {
        this.engine?.unregisterNodeType(EntityCommandNode)
        super.removeFromEngine()
    }
}