import { Entity } from "../entities/entity"
import { SceneNode } from "../entities/sceneNode"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"

export class NodeManager {
    private readonly _nodes = new Map<typeof EntityNode, EntityNode[]>()
    private readonly nodeTypes: Map<typeof EntityNode, Set<Function>> = new Map()
    private readonly nodeConverters: Map<typeof EntityNode, (entity: Entity) => EntityNode> = new Map()

    nodes<Key extends EntityNodeConstructor>(key: Key) {
        return this._nodes.get(key) as Key[]
    }

    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void {
        this._nodes.delete(nodeName)
        this.nodeTypes.delete(nodeName)
        this.nodeConverters.delete(nodeName)
    }

    registerNodeType<T extends EntityNode>(
        nodeName: EntityNodeConstructor<T>,
        keys: Set<Function>,
        converter: (entity: Entity) => T) {
        if(this._nodes.has(nodeName)) {
            throw new Error(`Node ${nodeName} already exists`)
        }

        this._nodes.set(nodeName, [])
        this.nodeTypes.set(nodeName, keys)
        this.nodeConverters.set(nodeName, converter)

        return this
    }

    getNodeList<T extends Object>(node: EntityNodeConstructor<T>) {
        if(!this._nodes.has(node)) {
            throw new Error(`Node ${node} does not exist`)
        }

        return (this._nodes.get(node) ?? []) as T[]
    }

    addEntityToNodes(entity: Entity, sceneNode?: SceneNode) {
        const entityComponentConstructors: Set<Function> = new Set()

        for(const component of entity.components.values()) {
            entityComponentConstructors.add(component.constructor)
        }

        for(const nodeName of this.nodeTypes.keys()) {
            let skip = false
            for(const keyValues of this.nodeTypes.get(nodeName)!.values()) {
                if(!entityComponentConstructors.has((keyValues))) {
                    skip = true
                    break
                }
            }

            if(skip) {
                continue
            }

            const nodeConverter = this.nodeConverters.get(nodeName)!
            this._nodes.get(nodeName)!.push(nodeConverter(entity))
        }

        const currentNode = sceneNode ?? new SceneNode(entity)

        for(const child of currentNode.childrenRef) {
            this.addEntityToNodes(child.entity, child)
        }
    }

    removeEntityFromNodes(entity: Entity, sceneNode?: SceneNode) {
        const entityComponentConstructors: Set<Function> = new Set()

        for(const component of entity.components.values()) {
            entityComponentConstructors.add(component.constructor)
        }

        for(const nodeName of this.nodeTypes.keys()) {
            const keyValues = [...this.nodeTypes.get(nodeName)!.values()]

            if(keyValues.every((nodeConstructor) => entityComponentConstructors.has(nodeConstructor))) {
                const nodes = this._nodes.get(nodeName)

                if(!nodes) {
                    continue
                }

                for(let i = 0; i < nodes.length; i++) {
                    if(nodes[i].entity === entity) {
                        nodes.splice(i, 1)
                        break
                    }
                }
            }
        }

        const currentNode = sceneNode ?? new SceneNode(entity)

        for(const child of currentNode.childrenRef) {
            this.removeEntityFromNodes(child.entity, child)
        }
    }

    reindexEntity(entity: Entity, sceneNode?: SceneNode) {
        const removeSubtree = (current: Entity, currentNode: SceneNode) => {
            for(const nodes of this._nodes.values()) {
                for(let i = 0; i < nodes.length; i++) {
                    if(nodes[i].entity === current) {
                        nodes.splice(i, 1)
                        break
                    }
                }
            }

            for(const child of currentNode.childrenRef) {
                removeSubtree(child.entity, child)
            }
        }

        const currentNode = sceneNode ?? new SceneNode(entity)

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
