import { Entity } from "../entities/entity"
import { SceneNode } from "../entities/sceneNode"
import { NodeManager } from "./nodeManager"
import { EventBus } from "./eventBus"
import { CommandBus } from "./commandBus"
import type { World } from "../core/world"

export class EntityRegistry {
    private readonly entities: Map<string, Entity> = new Map()
    private readonly sceneNodes: Map<string, SceneNode> = new Map()

    constructor(
        private readonly nodes: NodeManager,
        private readonly events: EventBus,
        private readonly commands: CommandBus) {
    }

    setWorld(_world: World) {
        return this
    }

    createEntity(id: string) {
        return new Entity(id)
    }

    addEntity(entity: Entity, parentEntity?: Entity | null) {
        if(this.entities.has(entity.id)) {
            return this
        }

        this.entities.set(entity.id, entity)

        entity.setComponentChangeHandler((e) => {
            const sceneNode = this.getSceneNode(e)
            this.nodes.reindexEntity(e, sceneNode)
        })

        const sceneNode = this.getOrCreateSceneNode(entity)

        if(parentEntity) {
            const parentSceneNode = this.getOrCreateSceneNode(parentEntity)
            sceneNode.setParent(parentSceneNode)

            for (const child of sceneNode.childrenRef) {
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
            sceneNode.parentRef?.removeChild(sceneNode)

            const descendants: Entity[] = []
            sceneNode.collectDescendants(descendants)

            for(const descendant of descendants) {
                this.sceneNodes.delete(descendant.id)
                this.entities.delete(descendant.id)
                descendant.setComponentChangeHandler(undefined)
                this.nodes.removeEntityFromNodes(descendant)
            }

            this.sceneNodes.delete(entity.id)
        }

        this.entities.delete(entity.id)
        entity.setComponentChangeHandler(undefined)
        this.nodes.removeEntityFromNodes(entity)

        this.events.dispatchEvent("entityRemoved", entity)
        this.commands.addCommand("redraw", {})

        return this
    }

    getSceneNode(entity: Entity): SceneNode | undefined {
        return this.sceneNodes.get(entity.id)
    }

    getOrCreateSceneNode(entity: Entity): SceneNode {
        let sceneNode = this.sceneNodes.get(entity.id)
        if(!sceneNode) {
            sceneNode = new SceneNode(entity)
            this.sceneNodes.set(entity.id, sceneNode)
        }
        return sceneNode
    }

    clear() {
        this.entities.clear()
        this.sceneNodes.clear()
    }
}
