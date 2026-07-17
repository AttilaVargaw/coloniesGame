import { Engine } from "../engine"
import { EntityNode } from "../entities/entityNode"

export class System {
    protected engine?: Engine

    update(_dt: number): void { }
    addToEngine(engine: Engine): void {
        this.engine = engine
    }
    removeFromEngine(): void {
        this.engine = undefined
    }
}

export class SystemWithNodes<N extends EntityNode> extends System {
    protected nodes: N[] = []

    addToEngine(engine: Engine): void {
        super.addToEngine(engine)
    }

    removeFromEngine(): void {
        this.nodes.length = 0
        super.removeFromEngine()
    }
}