import { EntityComponent } from "../entities/entityComponent";

export class TextureComponent extends EntityComponent {
    constructor(
        public src?: string,
        public svg?: string,
        public texture?: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
        public tint?: string,
    ) {
        super();
    }
}
