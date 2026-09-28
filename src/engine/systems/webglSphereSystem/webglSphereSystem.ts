import { SystemWithNodes } from "../system"
import { ViewportSystem } from "../viewportSystem/viewportSystem"
import { WebGLSphereRenderer } from "./webglSphereRenderer"
import { WebGLTextureAtlas } from "./webglTextureAtlas"
import { TextureComponent } from "@/engine/components/textureComponent"
import { PositionComponent } from "@/engine/components/position"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { Entity } from "@/engine/entities/entity"
import { ColorComponent } from "@/engine/components/colorComponent"
import { RenderableNode } from "../viewportSystem/renderers/renderableNode"

export class WebGLSphereNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public radius: RadiusComponent,
        public texture: TextureComponent,
        public color: ColorComponent
    ) {
        super(color, entity)
    }
}

export class WebGLSphereSystem extends SystemWithNodes<WebGLSphereNode> {
    private renderer!: WebGLSphereRenderer
    private atlas!: WebGLTextureAtlas
    private glCanvas!: HTMLCanvasElement

    constructor(private viewportSystem: ViewportSystem) {
        super()
    }

    addToEngine(engine: any): this {
        super.addToEngine(engine)

        return this
    }

    removeFromEngine(): this {
        if(this.glCanvas.parentNode) {
            this.glCanvas.parentNode.removeChild(this.glCanvas)
        }
        super.removeFromEngine()
        return this
    }

    init() {
        if(typeof document === "undefined") {
            return
        }

        const mainCanvas = this.viewportSystem.viewport?.camera?.context?.canvas
        if(!mainCanvas) {
            return
        }

        this.glCanvas = document.createElement("canvas")
        this.glCanvas.style.position = "absolute"
        this.glCanvas.style.top = "0"
        this.glCanvas.style.left = "0"
        this.glCanvas.style.zIndex = "0"
        this.glCanvas.width = mainCanvas.width
        this.glCanvas.height = mainCanvas.height
        this.glCanvas.style.pointerEvents = "none"

        const container = mainCanvas.parentNode
        if(container) {
            container.insertBefore(this.glCanvas, mainCanvas)
        }

        // this.renderer = new WebGLSphereRenderer(this.glCanvas)
        this.atlas = new WebGLTextureAtlas(this.glCanvas.getContext("webgl")!)
    }

    protected updateNode(_node: WebGLSphereNode, _dT?: number): void {
        // per-node update handled in update()
    }

    protected registerNodes(engine: any): this {
        engine.registerNodeType(
            WebGLSphereNode,
            new Set([PositionComponent, RadiusComponent, TextureComponent, ColorComponent]),
            (entity: Entity) => {
                const pos = entity.getComponent(PositionComponent)!
                const radius = entity.getComponent(RadiusComponent)!
                const texture = entity.getComponent(TextureComponent)!
                const color = entity.getComponent(ColorComponent)!

                return new WebGLSphereNode(entity, pos, radius, texture, color)
            },
        )
        return this
    }

    update(_dt: number) {
        console.log("update", this.nodes)

        if(!this.engine || !this.renderer || !this.atlas || !this.glCanvas) {
            return
        }

        const ctx = this.viewportSystem.viewport?.camera?.context
        const camera = this.viewportSystem.viewport?.camera
        if(!ctx || !camera) {
            return
        }

        const mainCanvas = ctx.canvas
        if(this.glCanvas.width !== mainCanvas.width || this.glCanvas.height !== mainCanvas.height) {
            this.glCanvas.width = mainCanvas.width
            this.glCanvas.height = mainCanvas.height
            this.renderer.resize(mainCanvas.width, mainCanvas.height)
        }

        const starEntity = this.findStarEntity()
        if(!starEntity) {
            return
        }

        const starPos = this.getWorldPosition(starEntity)
        const lightDir: [number, number, number] = [starPos[0], starPos[1], starPos[2]]

        const gl = this.glCanvas.getContext("webgl")!
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        for(const node of this.nodes) {
            if(!node.texture?.texture) {
                continue
            }

            if(!this.atlas.getEntry(node.entity.id.toString())) {
                this.atlas.addTexture(node.entity.id.toString(), node.texture.texture)
            }

            const worldPos = this.getWorldPosition(node.entity)
            const projected = camera.project(worldPos[0], worldPos[1], worldPos[2])
            if(!projected) {
                continue
            }

            const screenRadius = node.radius.radius * projected.scale
            if(
                projected.x + screenRadius < 0 ||
                projected.x - screenRadius > camera.cssWidth ||
                projected.y + screenRadius < 0 ||
                projected.y - screenRadius > camera.cssHeight
            ) {
                continue
            }

            const atlasEntry = this.atlas.getEntry(node.entity.id.toString())
            if(!atlasEntry) {
                continue
            }

            const atlasTexture = this.atlas.getTexture(gl)

            this.renderer.render(
                //projected,
                worldPos,
                node.radius.radius,
                camera,
                atlasEntry,
                atlasTexture,
                lightDir,
            )
        }
    }

    private findStarEntity(): Entity | undefined {
        return this.engine?.getAllEntities().find(e => {
            const color = e.getComponent(ColorComponent)
            return color?.emitLight
        })
    }

    private getWorldPosition(entity: Entity): [number, number, number] {
        const sceneNode = this.engine?.getSceneNode(entity)
        if(sceneNode) {
            const pos = sceneNode.getWorldPosition()
            return [pos[0], pos[1], pos[2]]
        }
        const pos = entity.getComponent(PositionComponent)
        return pos ? [pos.x, pos.y, pos.z] : [0, 0, 0]
    }
}
