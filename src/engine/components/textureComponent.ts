import { EntityComponent } from "../entities/entityComponent";

export class TextureComponent extends EntityComponent {
    constructor(
        public src?: string,
        public svg?: string,
        public texture?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
        public tint?: string,
        public rotation?: number,
        public minimumScreenSize?: number,
        public animationSpeed?: number,
    ) {
        super();
    }
}
