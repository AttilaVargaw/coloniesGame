import { Engine } from "../engine"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"

export abstract class System {
    protected engine?: Engine
    protected subsystems = new Set<System>()
    protected parent?: System

    update(_dt: number): void { }

    updateSubsystems(dt: number): void {
        for(const subsystem of this.subsystems) {
            subsystem.update(dt)
        }
    }

    addSubsystem(subsystem: System) {
        this.subsystems.add(subsystem)
        subsystem.parent = this
        if (this.engine) {
            subsystem.addToEngine(this.engine)
        }

        return this
    }

    removeSubsystem(subsystem: System): System {
        subsystem.parent = undefined
        this.subsystems.delete(subsystem)
        if (this.engine) {
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
    protected nodes: N[] = []

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

    update(dt: number): void {
        for(const node of this.nodes) {
            this.updateNode(node, dt)
        }
    }
}