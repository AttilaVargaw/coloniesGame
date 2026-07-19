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
    protected updateNode(_node: EntityCommandNode, _dT?: number): void {
    }
    update(_dt: number): void {
        for(const entity of this.nodes) {
            while(entity.commands.commands.length !== 0) {
                const command = entity.commands.commands.shift()
                command?.(entity.entity!)
            }
        }
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        engine
            .registerNodeType(EntityCommandNode,
                new Set([EntityCommandComponent]),
                (entity) => {
                    return new EntityCommandNode(
                        entity,
                        entity.getComponent(EntityCommandComponent)!
                    )
                });
        this.nodes = engine.getNodeList(EntityCommandNode)

        return this
    }

    removeFromEngine(): this {
        this.engine?.unregisterNodeType(EntityCommandNode)
        super.removeFromEngine()

        return this
    }
}