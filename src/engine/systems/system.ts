import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import type { Engine } from "../core/engine"

export abstract class System {
    protected engine?: Engine

    update(_dt: number): void {

    }

    protected registerNodes(_engine: Engine) {
        return this
    }

    protected unregisterNodeTypes() {
        if(!this.engine) {
            return
        }

        this.engine.unregisterNodeType(this.constructor as EntityNodeConstructor<EntityNode>)

        return this
    }

    addToEngine(engine: Engine): this {
        this.engine = engine
        this.registerNodes(engine)

        return this
    }

    removeFromEngine(): this {
        this.unregisterNodeTypes()
        this.engine = undefined

        return this
    }
}

export abstract class SystemWithNodes<N extends EntityNode> extends System {
    protected _sortOnEveryEntityAddition = false
    protected nodes: N[] = []

    get sortOnEveryEntityAddition(): boolean {
        return this._sortOnEveryEntityAddition
    }

    set sortOnEveryEntityAddition(value: boolean) {
        this._sortOnEveryEntityAddition = value
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        return this
    }

    removeFromEngine(): this {
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    protected abstract updateNode(_node: N, _dT?: number): void

    protected filterNodes?: (node: N) => boolean

    update(dt: number): void {
        for(const node of this.nodes) {
            if(this.filterNodes && !this.filterNodes(node)) {
                continue
            }
            this.updateNode(node, dt)
        }
    }
}
