import { Entity } from "./entity"
import { PositionComponent } from "../components/position"

export class SceneNode {
    readonly entity: Entity
    private parent: SceneNode | null = null
    private readonly children = new Set<SceneNode>()

    constructor(entity: Entity) {
        this.entity = entity;
        (entity as { __sceneNode?: SceneNode }).__sceneNode = this
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

        this.invalidatePositions()
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

    invalidatePositions(): void {
        const position = this.entity.getComponent(PositionComponent)
        if(position) {
            position.dirty = true
        }

        for(const child of this.children) {
            child.invalidatePositions()
        }
    }

    collectDescendants(out: Entity[]): void {
        for(const child of this.children) {
            out.push(child.entity)
            child.collectDescendants(out)
        }
    }
}
