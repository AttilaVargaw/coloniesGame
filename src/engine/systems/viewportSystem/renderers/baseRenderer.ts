import type { Engine } from "@/engine/core/engine";
import { SystemWithNodes } from "../../system";
import { ViewportSystem } from "../viewportSystem";
import { EntityAddedEvent } from "@/engine/lib/events";
import { RenderableNode } from "./renderableNode";
import { Entity } from "@/engine/entities/entity";
import { PositionComponent } from "@/engine/components/position";
import { EntityComponent } from "@/engine/entities/entityComponent";

export abstract class BaseRenderer<N extends RenderableNode> extends SystemWithNodes<N> {
    protected readonly components: (new (...args: any[]) => EntityComponent)[];
    protected readonly nodeFactory: (entity: Entity) => N;
    protected readonly viewportSystem: ViewportSystem;

    constructor(
        viewportSystem: ViewportSystem,
        components: (new (...args: any[]) => EntityComponent)[],
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

    update(dt: number): void {
        const { camera } = this.viewportSystem.viewport
        if (!camera) {
            return
        }

        const sorted = this.nodes.filter(node => !this.filterNodes || this.filterNodes(node))
        sorted.sort((a, b) => {
            const [ax, ay, az] = this.getWorldPosition(a)
            const [bx, by, bz] = this.getWorldPosition(b)
            const aProj = camera.project(ax, ay, az)
            const bProj = camera.project(bx, by, bz)
            const aDepth = aProj ? aProj.depth : 0
            const bDepth = bProj ? bProj.depth : 0
            return bDepth - aDepth
        })

        for(const node of sorted) {
            this.updateNode(node, dt)
        }
    }

    private getWorldPosition(node: N): [number, number, number] {
        const sceneNode = this.engine?.getSceneNode(node.entity)
        if (!sceneNode) {
            const pos = node.entity.getComponent(PositionComponent)
            return pos ? [pos.x, pos.y, pos.z] : [0, 0, 0]
        }
        return sceneNode.getWorldPosition()
    }
}
