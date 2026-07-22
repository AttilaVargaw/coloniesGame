import { World } from "../../../core/world";
import { SystemWithNodes } from "../../system";
import { sortByDepth } from "@/lib/sortByIndex";
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

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.nodes = engine.getNodeList(this.constructor as any)
        engine.subscribe(EntityAddedEvent, this.onEntityAdded)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unsubscribe(EntityAddedEvent, this.onEntityAdded)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.engine.unregisterNodeType(this.constructor as any)
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    protected registerNodes(engine: World): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        engine.registerNodeType(this.constructor as any, new Set(this.components), this.nodeFactory,)

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.engine.unregisterNodeType(this.constructor as any)

        return this
    }

    private onEntityAdded = () => {
        if(this.sortOnEveryEntityAddition) {
            this.nodes.sort(sortByDepth)
        }
    }
}
