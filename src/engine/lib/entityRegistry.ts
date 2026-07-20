import { Entity } from "../entities/entity"
import { NodeManager } from "./nodeManager"
import { EventBus } from "./eventBus"
import { CommandBus } from "./commandBus"
import type { World } from "../core/world"

export class EntityRegistry {
    private readonly entities: Map<string, Entity> = new Map()
    private world?: World

    constructor(
        private readonly nodes: NodeManager,
        private readonly events: EventBus,
        private readonly commands: CommandBus) {
    }

    setWorld(world: World) {
        this.world = world

        return this
    }

    createEntity(id: string, addItToEngine = true) {
        const entity = new Entity(id)
        this.events.dispatchEvent("entityAdded", entity)

        if(addItToEngine) {
            this.addEntity(entity)
        }

        return entity
    }

    addEntity(entity: Entity) {
        if(this.entities.has(entity.id)) {
            return this
        }

        this.entities.set(entity.id, entity)
        entity.attachToEngine(this.world!)

        this.nodes.addEntityToNodes(entity)

        return this
    }

    removeEntity(entity: Entity) {
        entity.parent?.removeChild(entity)

        this.entities.delete(entity.id)

        this.nodes.removeEntityFromNodes(entity)

        entity.detachFromEngine()

        for(const child of entity.children) {
            this.removeEntity(child)
        }

        this.events.dispatchEvent("entityRemoved", entity)
        this.commands.addCommand("redraw", {})

        return this
    }

    clear() {
        this.entities.clear()
    }
}
