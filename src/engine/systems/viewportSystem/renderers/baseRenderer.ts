import type { Engine } from "@/engine/core/engine";
import { SystemWithNodes } from "../../system";
import { ViewportSystem } from "../viewportSystem";
import { EntityAddedEvent } from "@/engine/lib/events";
import { RenderableNode } from "./renderableNode";
import { Entity } from "@/engine/entities/entity";
import { PositionComponent } from "@/engine/components/position";
import { EntityComponent } from "@/engine/entities/entityComponent";
import { ProjectedPoint } from "@/lib/camera";

export abstract class BaseRenderer<N extends RenderableNode> extends SystemWithNodes<N> {
    protected readonly components: (new (...args: any[]) => EntityComponent)[];
    protected readonly nodeFactory: (entity: Entity) => N;
    protected readonly viewportSystem: ViewportSystem;
    private projectedCache = new Map<N, { worldPos: [number, number, number]; projected: ProjectedPoint }>()
    private _renderLogged = false

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

    projectNodes(): void {
        const { camera } = this.viewportSystem.viewport
        if (!camera) {
            console.warn('[BaseRenderer]', this.constructor.name, 'no camera')
            return
        }

        this.projectedCache.clear()
        const entries: N[] = []

        for (const node of this.nodes) {
            const worldPos = this.getWorldPosition(node)
            const projected = camera.project(worldPos[0], worldPos[1], worldPos[2])
            if (!projected) {
                continue
            }

            const margin = this.getCullMargin(node)
            const scaledMargin = margin * projected.scale
            const bounds = camera.visibleBounds
            if (
                projected.x + scaledMargin < bounds.left ||
                projected.x - scaledMargin > bounds.right ||
                projected.y + scaledMargin < bounds.top ||
                projected.y - scaledMargin > bounds.bottom
            ) {
                continue
            }

            this.projectedCache.set(node, { worldPos, projected })
            entries.push(node)
        }

        if(entries.length > 0 && !this._renderLogged) {
            this._renderLogged = true
        }

        entries.sort((a, b) => {
            const aProj = this.projectedCache.get(a)!.projected
            const bProj = this.projectedCache.get(b)!.projected
            return bProj.depth - aProj.depth
        })
    }

    update(_dt: number): void {
        this.projectNodes()
    }

    getProjectedCacheEntries(): Array<{ node: N; projected: ProjectedPoint }> {
        const entries: Array<{ node: N; projected: ProjectedPoint }> = []
        for (const [node, { projected }] of this.projectedCache) {
            entries.push({ node, projected })
        }
        return entries
    }

    drawNode(node: N, dt: number): void {
        this.updateNode(node, dt)
    }

    getViewportSystem(): ViewportSystem {
        return this.viewportSystem
    }

    protected getCullMargin(_node: N): number {
        return 0
    }

    protected getProjected(node: N): { worldPos: [number, number, number]; projected: ProjectedPoint } {
        const entry = this.projectedCache.get(node)
        if (!entry) {
            throw new Error(`Node ${node.entity.id} not found in projection cache`)
        }
        return entry
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
