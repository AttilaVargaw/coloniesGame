import { Entity } from "../entities/entity"
import { SceneNode } from "../entities/sceneNode"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import type { EntityComponent } from "../entities/entityComponent"

export class NodeManager {
    private readonly _nodes = new Map<typeof EntityNode, EntityNode[]>()
    private readonly nodeTypes: Map<typeof EntityNode, Set<new (...args: any[]) => EntityComponent>> = new Map()
    private readonly nodeConverters: Map<typeof EntityNode, (entity: Entity) => EntityNode> = new Map()

    nodes<Key extends EntityNodeConstructor>(key: Key) {
        return this._nodes.get(key)
    }

    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void {
        this._nodes.delete(nodeName)
        this.nodeTypes.delete(nodeName)
        this.nodeConverters.delete(nodeName)
    }

    registerNodeType<T extends EntityNode>(
        nodeName: EntityNodeConstructor<T>,
        keys: Set<new (...args: any[]) => EntityComponent>,
        converter: (entity: Entity) => T) {
        if (this._nodes.has(nodeName)) {
            throw new Error(`Node ${nodeName} already exists`)
        }

        this._nodes.set(nodeName, [])
        this.nodeTypes.set(nodeName, keys)
        this.nodeConverters.set(nodeName, converter)

        return this
    }

    getNodeList<T extends EntityNode>(node: EntityNodeConstructor<T>): T[] {
        if (!this._nodes.has(node)) {
            throw new Error(`Node ${node} does not exist`)
        }

        return (this._nodes.get(node) ?? []) as T[]
    }

    private static getEntityComponentConstructors(entity: Entity): Set<new (...args: any[]) => EntityComponent> {
        const constructors: Set<new (...args: any[]) => EntityComponent> = new Set()

        for (const component of entity.components.values()) {
            constructors.add(component.constructor as new (...args: any[]) => EntityComponent)
        }

        return constructors
    }

    addEntityToNodes(entity: Entity, sceneNode?: SceneNode) {
        const entityComponentConstructors = NodeManager.getEntityComponentConstructors(entity)

        for (const nodeName of this.nodeTypes.keys()) {
            const requiredKeys = this.nodeTypes.get(nodeName)!
            let skip = false
            for (const keyConstructor of requiredKeys) {
                if (!entityComponentConstructors.has(keyConstructor)) {
                    skip = true
                    break
                }
            }

            if (skip) {
                continue
            }

            const nodeConverter = this.nodeConverters.get(nodeName)!
            this._nodes.get(nodeName)!.push(nodeConverter(entity))
        }

        const currentNode = sceneNode ?? new SceneNode(entity.id)

        for (const child of currentNode.childrenRef) {
            this.addEntityToNodes(child.entity, child)
        }
    }

    removeEntityFromNodes(entity: Entity, sceneNode?: SceneNode) {
        const entityComponentConstructors = NodeManager.getEntityComponentConstructors(entity)

        for (const nodeName of this.nodeTypes.keys()) {
            const requiredKeys = this.nodeTypes.get(nodeName)!
            const keyArray = Array.from(requiredKeys)

            if (keyArray.every((nodeConstructor) => entityComponentConstructors.has(nodeConstructor))) {
                const nodes = this._nodes.get(nodeName)

                if (!nodes) {
                    continue
                }

                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].entity === entity) {
                        nodes.splice(i, 1)
                        break
                    }
                }
            }
        }

        const currentNode = sceneNode ?? new SceneNode(entity.id)

        for (const child of currentNode.childrenRef) {
            this.removeEntityFromNodes(child.entity, child)
        }
    }

    reindexEntity(entity: Entity, sceneNode?: SceneNode) {
        const removeSubtree = (current: Entity, currentNode: SceneNode) => {
            for (const nodes of this._nodes.values()) {
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].entity === current) {
                        nodes.splice(i, 1)
                        break
                    }
                }
            }

            for (const child of currentNode.childrenRef) {
                removeSubtree(child.entity, child)
            }
        }

        const currentNode = sceneNode ?? new SceneNode(entity.id)

        removeSubtree(entity, currentNode)

        this.addEntityToNodes(entity, currentNode)

        return this
    }

    clear() {
        this._nodes.clear()
        this.nodeTypes.clear()
        this.nodeConverters.clear()
    }
}
