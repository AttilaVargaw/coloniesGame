import type { Engine } from "@/engine/core/engine";
import { SystemWithNodes } from "../../system";
import { ViewportSystem } from "../viewportSystem";
import { EntityAddedEvent } from "@/engine/lib/events";
import { RenderableNode } from "./renderableNode";
import { Entity } from "@/engine/entities/entity";

export abstract class BaseRenderer<N extends RenderableNode> extends SystemWithNodes<N> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    protected readonly components: Function[];
    protected readonly nodeFactory: (entity: Entity) => N;
    protected readonly viewportSystem: ViewportSystem;

    constructor(
        viewportSystem: ViewportSystem,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        components: Function[],
        nodeFactory: (entity: Entity) => N,
    ) {
        super()
        this.viewportSystem = viewportSystem
        this.components = components
        this.nodeFactory = nodeFactory
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(this.constructor as any)
        engine.subscribe(EntityAddedEvent, this.onEntityAdded)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unsubscribe(EntityAddedEvent, this.onEntityAdded)
         
        this.engine.unregisterNodeType(this.constructor as any)
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    protected registerNodes(engine: Engine): this {
        engine.registerNodeType(this.constructor as any, new Set(this.components), this.nodeFactory,)

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(this.constructor as any)

        return this
    }

    private onEntityAdded = () => {
        if(this.sortOnEveryEntityAddition) {
            this.nodes.sort((a, b) => a.zIndex - b.zIndex)
        }
    }
}
