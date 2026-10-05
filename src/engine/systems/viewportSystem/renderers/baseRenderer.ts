import type { Engine } from "@/engine/core/engine";
import { ViewportSystem } from "../viewportSystem";
import { RenderableNode } from "./renderableNode";
import { Entity } from "@/engine/entities/entity";
import { EntityComponent } from "@/engine/entities/entityComponent";
import { ProjectedPoint } from "@/lib/camera";
import { vec3 } from "gl-matrix";
import { getAbsolute } from "@/engine/lib/getAbsolute";

export abstract class BaseRenderer<N extends RenderableNode> {
    protected nodes: N[] = []
    protected engine: Engine | null = null
    protected readonly components: (new (...args: any[]) => EntityComponent)[];
    protected readonly nodeFactory: (entity: Entity) => N;
    protected readonly viewportSystem: ViewportSystem;
    private projectedCache = new Map<N, { worldPos: vec3; projected: ProjectedPoint }>()
    private projectedCacheEntries: Array<{ node: N; projected: ProjectedPoint }> = []
    protected debugCulledCount = 0
    protected debugProjectedCount = 0
    init?(): void

    get projectedCount() {
        return this.debugProjectedCount
    }

    get culledCount() {
        return this.debugCulledCount
    }

    constructor(
        viewportSystem: ViewportSystem,
        components: (new (...args: any[]) => EntityComponent)[],
        nodeFactory: (entity: Entity) => N,
    ) {
        this.viewportSystem = viewportSystem
        this.components = components
        this.nodeFactory = nodeFactory
    }

    addToEngine(engine: Engine): this {
        this.engine = engine
        this.registerNodes(engine)
        this.nodes = engine.getNodeList(this.constructor as any)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(this.constructor as any)
        this.nodes = []

        return this
    }

    protected registerNodes(engine: Engine): this {
        engine.registerNodeType(this.constructor as any, new Set(this.components), this.nodeFactory,)

        return this
    }

    projectNodes(): void {
        const { camera } = this.viewportSystem
        if(!camera || !this.engine) {
            return
        }

        this.projectedCache.clear()
        this.projectedCacheEntries.length = 0
        this.debugCulledCount = 0
        this.debugProjectedCount = 0

        const f = camera.cssHeight / (2 * Math.tan(camera.fieldOfView / 2))
        const cameraScale = f / camera.distance
        const cameraDistance = camera.distance

        for(const node of this.nodes) {
            if(this.shouldSkipProjection(node, cameraDistance, cameraScale)) {
                this.debugCulledCount++
                continue
            }

            const worldPos = getAbsolute(node.entity, this.engine)
            const projected = camera.project(worldPos)
            if(!projected) {
                this.debugCulledCount++
                continue
            }

            const margin = this.getCullMargin(node)
            const scaledMargin = margin * projected.scale
            const bounds = camera.visibleBounds
            if(
                projected.x + scaledMargin <= bounds.left ||
                projected.x - scaledMargin >= bounds.right ||
                projected.y + scaledMargin <= bounds.top ||
                projected.y - scaledMargin >= bounds.bottom
            ) {
                this.debugCulledCount++
                continue
            }

            if(this.shouldCullNode(node, projected, worldPos)) {
                this.debugCulledCount++
                continue
            }

            this.projectedCache.set(node, { worldPos, projected })
            this.projectedCacheEntries.push({ node, projected })
            this.debugProjectedCount++
        }

        this.projectedCacheEntries.sort((a, b) => b.projected.depth - a.projected.depth)
    }

    abstract beginFrame(): void
    abstract endFrame(): void

    getProjectedCacheEntries(): Array<{ node: N; projected: ProjectedPoint }> {
        return this.projectedCacheEntries
    }

    abstract drawNodes(ctx: CanvasRenderingContext2D): void

    getViewportSystem(): ViewportSystem {
        return this.viewportSystem
    }

    protected getCullMargin(_node: N): number {
        return 0
    }
    protected shouldCullNode(_node: N, _projected: ProjectedPoint, _worldPos: vec3): boolean {
        return false
    }
    protected shouldSkipProjection(_node: N, _cameraDistance: number, _cameraScale: number): boolean {
        return false
    }

    protected getProjected(node: N): { worldPos: vec3; projected: ProjectedPoint } {
        const entry = this.projectedCache.get(node)
        if(!entry) {
            throw new Error(`Node ${node.entity.id} not found in projection cache`)
        }
        return entry
    }

}
