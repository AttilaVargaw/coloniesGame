import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import type { Engine } from "../core/engine"

export abstract class System {
    protected engine?: Engine
    protected subsystems = new Set<System>()
    protected parent?: System

    update(_dt: number): void {

    }

    updateSubsystems(dt: number): void {
        for(const subsystem of this.subsystems) {
            subsystem.update(dt)
        }
    }

    addSubsystem(subsystem: System) {
        this.subsystems.add(subsystem)
        subsystem.parent = this
        if(this.engine) {
            subsystem.addToEngine(this.engine)
        }

        return this
    }

    removeSubsystem(subsystem: System): System {
        subsystem.parent = undefined
        this.subsystems.delete(subsystem)
        if(this.engine) {
            subsystem.removeFromEngine()
        }

        return this
    }

    protected registerNodes(engine: Engine) {
        for(const subsystem of this.subsystems) {
            subsystem.registerNodes(engine)
        }

        return this
    }

    protected unregisterNodeTypes() {
        if(!this.engine) {
            return
        }

        this.engine.unregisterNodeType(this.constructor as EntityNodeConstructor<EntityNode>)

        for(const subsystem of this.subsystems) {
            subsystem.unregisterNodeTypes()
        }

        return this
    }

    addToEngine(engine: Engine): this {
        this.engine = engine
        this.registerNodes(engine)

        for(const subsystem of this.subsystems) {
            subsystem.parent = this
            subsystem.addToEngine(engine)
        }

        return this
    }

    removeFromEngine(): this {
        this.unregisterNodeTypes()
        for(const subsystem of this.subsystems) {
            subsystem.removeFromEngine()
        }

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

        for(const subsystem of this.subsystems) {
            if(subsystem instanceof SystemWithNodes) {
                subsystem.sortOnEveryEntityAddition = value
            }
        }
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
