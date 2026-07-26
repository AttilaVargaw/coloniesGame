import type { Entity } from "./entity"
import { PositionComponent } from "../components/position"

export class SceneNode {
    readonly entityId: string
    private _entity?: Entity
    private parent: SceneNode | null = null
    private readonly children = new Set<SceneNode>()

    constructor(entityId: string, entity?: Entity) {
        this.entityId = entityId
        this._entity = entity
    }

    get entity(): Entity {
        if(!this._entity) {
            throw new Error(`SceneNode entity not resolved for id: ${this.entityId}`)
        }
        return this._entity
    }

    setEntity(entity: Entity) {
        this._entity = entity
    }

    get parentRef(): SceneNode | null {
        return this.parent
    }

    get childrenRef(): ReadonlySet<SceneNode> {
        return this.children
    }

    setParent(parent: SceneNode | null) {
        if(this.parent === parent) {
            return
        }

        this.parent?.children.delete(this)

        this.parent = parent
        parent?.children.add(this)
    }

    addChild(node: SceneNode) {
        node.setParent(this)
    }

    removeChild(node: SceneNode) {
        if(!this.children.has(node)) {
            return
        }

        node.setParent(null)
    }

    getWorldPosition(): [number, number] {
        const position = this.entity.getComponent(PositionComponent)

        if(!position) {
            return [0, 0]
        }

        if(!this.parent) {
            return [position.x, position.y]
        }

        const [parentX, parentY] = this.parent.getWorldPosition()
        return [parentX + position.x, parentY + position.y]
    }

    collectDescendants() {
        const ret: Entity[] = []

        for(const child of this.children) {
            ret.push(child.entity)
            ret.splice(0, 0, ...child.collectDescendants())
        }

        return ret
    }
}
