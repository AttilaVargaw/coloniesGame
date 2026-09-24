import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { TextureComponent } from "../../../components/textureComponent";
import { ViewportSystem } from "../viewportSystem";
import { RectNode } from "./rectNode";
import { BaseRenderer } from "./baseRenderer";

export class RectRenderer extends BaseRenderer<RectNode> {
    private textureCache = new Map<string, HTMLImageElement | HTMLCanvasElement | ImageBitmap>();

    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, SizeComponent],
            (e) => new RectNode(e, e.getComponent(PositionComponent)!,
                e.getComponent(SizeComponent)!,
                e.getComponent(ColorComponent)!,
                e.getComponent(TextureComponent),
                e.getComponent(TextureComponent)?.rotation ?? 0
            ),
        )
    }

    protected getCullMargin(node: RectNode): number {
        return Math.max(node.size.width, node.size.height) / 2
    }

    private resolveTexture(texture: TextureComponent | undefined): HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined {
        if(!texture) {
            return undefined;
        }

        if(texture.texture) {
            return texture.texture;
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

    protected updateNode(rect: RectNode, _dt?: number): void {
        const { projected } = this.getProjected(rect)
        const ctx = this.viewportSystem.viewport.camera.context;

        const screenWidth = rect.size.width * projected.scale
        const screenHeight = rect.size.height * projected.scale
        const x = projected.x - screenWidth / 2
        const y = projected.y - screenHeight / 2

        const texture = this.resolveTexture(rect.texture)

        if(texture) {
            ctx.save()

            ctx.translate(projected.x, projected.y)
            ctx.rotate(rect.rotation)
            ctx.drawImage(texture, -screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight)

            if(rect.texture?.tint) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = rect.texture.tint;
                ctx.fillRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
                ctx.globalAlpha = 1.0;
            }

            ctx.restore()
        } else {
            ctx.save()

            rect.setColor(ctx);

            ctx.fillRect(
                x,
                y,
                screenWidth,
                screenHeight
            )

            ctx.restore()
        }
    }
}
