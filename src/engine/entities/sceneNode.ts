import { Entity } from "./entity"
import { PositionComponent } from "../components/position"

export class SceneNode {
    readonly entityId: string
    private _entity?: Entity
    private _parent: SceneNode | null = null
    private readonly _children = new Set<SceneNode>()

    get children() {
        return this._children
    }

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

    set entity(entity: Entity) {
        this._entity = entity
    }

    get parent(): SceneNode | null {
        return this._parent
    }

    get childrenRef(): ReadonlySet<SceneNode> {
        return this.children
    }

    set parent(parent: SceneNode | null) {
        if(this._parent === parent) {
            return
        }

        this._parent?.children.delete(this)

        this._parent = parent
        parent?.children.add(this)
    }

    addChild(node: SceneNode) {
        node.parent = this
    }

    removeChild(node: SceneNode) {
        if(!this.children.has(node)) {
            return
        }

        node.parent = null
    }

    getWorldPosition(): [number, number, number] {
        const position = this.entity.getComponent(PositionComponent)

        if(!position) {
            return [0, 0, 0]
        }

        if(!this._parent) {
            return [position.x, position.y, position.z]
        }

        const [parentX, parentY, parentZ] = this._parent.getWorldPosition()
        return [parentX + position.x, parentY + position.y, parentZ + position.z]
    }

    // Thx ai, why entity[]?
    collectDescendants(): Entity[] {
        if(this.children.size) {
            return this._children.values().flatMap(c => [c._entity!, ...c.collectDescendants()]).toArray()
        } else {
            return [] as Entity[]
        }
    }
}
