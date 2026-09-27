import { Entity } from "./entities/entity"
import { EntityComponent } from "./entities/entityComponent"
import { EntityNode, EntityNodeConstructor } from "./entities/entityNode"
import { World } from "./core/world"
import { createEntity } from "./lib/entityRegistry"

export class TestEntityComponent extends EntityComponent {
    constructor(public tag: string = "tag", entity?: Entity) {
        super(entity)
    }
}

export class TestEntityNode extends EntityNode {
    constructor(entity?: Entity) {
        super(entity!)
    }
}

export const testEntityNodeCtor = TestEntityNode as unknown as EntityNodeConstructor<TestEntityNode>

export function makeWorld() {
    const world = new World()
    world.registerNodeType(
        testEntityNodeCtor,
        new Set([TestEntityComponent]),
        (entity) => new TestEntityNode(entity)
    )
    return world
}

export function entityWithTag(world: World) {
    const entity = createEntity()
    entity.addComponent(new TestEntityComponent())
    world.addEntity(entity)
    return entity
}
