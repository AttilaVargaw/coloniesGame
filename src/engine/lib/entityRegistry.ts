import { Entity } from "../entities/entity"
import { SceneNode } from "../entities/sceneNode"
import { NodeManager } from "./nodeManager"
import { EventBus } from "./eventBus"
import { EntityRemovedEvent } from "./events"
import { v4 } from "uuid"

export function createEntity(id = v4()) {
    return new Entity(id)
}
export class EntityRegistry {
    private readonly entities: Map<string, Entity> = new Map()
    private readonly sceneNodes: Map<string, SceneNode> = new Map()

    constructor(
        private readonly nodes: NodeManager,
        private readonly events: EventBus
    ) {
    }

    addEntity(entity: Entity, parentEntity?: Entity | null) {
        if(this.entities.has(entity.id)) {
            return this
        }

        this.entities.set(entity.id, entity)

        for(const component of entity.components.values()) {
            component.entity = entity
        }

        entity.onComponentChanged = ((e) => {
            for(const component of e.components.values()) {
                component.entity = e
            }

            const sceneNode = this.getSceneNode(e)
            this.nodes.reindexEntity(e, sceneNode)
        })

        const sceneNode = this.getOrCreateSceneNode(entity)

        if(parentEntity) {
            sceneNode.parent = this.getOrCreateSceneNode(parentEntity)

            for(const child of sceneNode.childrenRef) {
                this.addEntity(child.entity)
            }
        }

        this.nodes.addEntityToNodes(entity, sceneNode)

        return this
    }

    removeEntity(entity: Entity) {
        if(!this.entities.has(entity.id)) {
            return this
        }

        const sceneNode = this.getSceneNode(entity)

        if(sceneNode) {
            sceneNode.parent?.removeChild(sceneNode)

            const descendants =
                sceneNode.collectDescendants()

            for(const descendant of descendants) {
                this.sceneNodes.delete(descendant.id)
                this.entities.delete(descendant.id)
                descendant.onComponentChanged = undefined
                this.nodes.removeEntityFromNodes(descendant)
            }

            this.sceneNodes.delete(entity.id)
        }

        this.entities.delete(entity.id)
        entity.onComponentChanged = undefined
        this.nodes.removeEntityFromNodes(entity)

        this.events.dispatchEvent(new EntityRemovedEvent(entity))

        return this
    }

    getSceneNode(entity: Entity): SceneNode | undefined {
        return this.sceneNodes.get(entity.id)
    }

    getOrCreateSceneNode(entity: Entity): SceneNode {
        let sceneNode = this.sceneNodes.get(entity.id)
        if(!sceneNode) {
            sceneNode = new SceneNode(entity.id, entity)
            this.sceneNodes.set(entity.id, sceneNode)
        }
        return sceneNode
    }

    getAllEntities(): Entity[] {
        return Array.from(this.entities.values())
    }

    getEntityById(id: string): Entity | undefined {
        return this.entities.get(id)
    }

    clear() {
        this.entities.clear()
        this.sceneNodes.clear()
    }
}
