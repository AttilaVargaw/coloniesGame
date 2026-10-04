import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { TextureComponent } from "../../../components/textureComponent";
import { ViewportSystem } from "../viewportSystem";
import { RectNode } from "./rectNode";
import { BaseRenderer } from "./baseRenderer";
import { ProjectedPoint } from "@/lib/camera";
import { AsteroidBeltComponent } from "@/engine/components/asteroidBeltComponent";
import { Vector3 } from "@/lib/Vector3";

export class RectRenderer extends BaseRenderer<RectNode> {
    beginFrame(): void {
    }
    endFrame(): void {
    }
    drawNodes(_ctx: CanvasRenderingContext2D): void {
    }
    private textureCache = new Map<string, HTMLImageElement | HTMLCanvasElement | ImageBitmap>();

    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, SizeComponent],
            (e) => {
                const color = e.getComponent(ColorComponent) ?? new ColorComponent()
                return new RectNode(e, e.getComponent(PositionComponent)!,
                    e.getComponent(SizeComponent)!,
                    color,
                    e.getComponent(TextureComponent),
                    e.getComponent(TextureComponent)?.rotation ?? 0,
                    color.emitLight,
                )
            },
        )
    }

    protected getCullMargin(node: RectNode): number {
        return Math.max(node.size.width, node.size.height) / 2
    }

    protected shouldSkipProjection(node: RectNode, cameraDistance: number, _cameraScale: number): boolean {
        const belt = node.entity.getComponent(AsteroidBeltComponent)
        if(belt?.cullingDistanceThreshold !== undefined && cameraDistance > belt.cullingDistanceThreshold) {
            return true
        }
        return false
    }

    protected shouldCullNode(node: RectNode, projected: ProjectedPoint, _worldPos: Vector3): boolean {
        if(node.texture?.minimumScreenSize !== undefined && node.size) {
            const worldSize = Math.max(node.size.width, node.size.height)
            if(worldSize > 0 && projected.scale < node.texture.minimumScreenSize / worldSize) {
                return true
            }
        }
        return false
    }

    private resolveTexture(texture: TextureComponent | undefined): HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | undefined {
        if(!texture) {
            return undefined;
        }

        if(texture.day) {
            return texture.day;
        }

        let sourceKey: string | undefined;
        let sourceUri: string | undefined;

        if(texture.svg) {
            sourceKey = `svg:${texture.svg}`;
            sourceUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texture.svg)}`;
        } else if(texture.src) {
            sourceKey = `src:${texture.src}`;
            sourceUri = texture.src;
        }

        if(!sourceKey || !sourceUri) {
            return undefined;
        }

        const cached = this.textureCache.get(sourceKey);
        if(cached) {
            return cached;
        }

        const image = new Image();
        image.src = sourceUri;

        if(image.complete) {
            this.textureCache.set(sourceKey, image);
            return image;
        }

        image.onload = () => {
            this.textureCache.set(sourceKey, image);
        };

        return undefined;
    }

    removeFromEngine(): this {
        this.textureCache.clear();
        return super.removeFromEngine();
    }

    drawNode(ctx: CanvasRenderingContext2D): void {
        for(const rect of this.nodes) {

            const { projected } = this.getProjected(rect)
            const context = ctx ?? this.viewportSystem.camera.context;

            const screenWidth = rect.size.width * projected.scale
            const screenHeight = rect.size.height * projected.scale
            const x = projected.x - screenWidth / 2
            const y = projected.y - screenHeight / 2

            const texture = this.resolveTexture(rect.texture)

            if(texture) {
                context.save()

                context.translate(projected.x, projected.y)
                context.rotate(rect.texture?.rotation ?? 0)
                context.drawImage(texture, -screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight)

                if(rect.texture?.tint) {
                    context.globalCompositeOperation = 'source-atop';
                    context.globalAlpha = 0.35;
                    context.fillStyle = rect.texture.tint;
                    context.fillRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
                    context.globalAlpha = 1.0;
                }

                context.restore()
            } else {
                context.save()

                rect.setColor(context);

                context.fillRect(
                    x,
                    y,
                    screenWidth,
                    screenHeight
                )

                context.restore()
            }
        }
    }
}
