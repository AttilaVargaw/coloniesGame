import { EntityComponent } from "../entities/entityComponent";
import { v4 as uuid } from "uuid"

export class TextureComponent extends EntityComponent {
    constructor(
        public src?: string,
        public svg?: string,
        public texture?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
        public tint?: string,
        public rotation?: number,
        public minimumScreenSize?: number,
        public animationSpeed?: number,
        public nightTexture?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
        public id = uuid()
    ) {
        super();
    }
}
