import { EntityComponent } from "../entities/entityComponent";

export type TextureSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

export type TextureComponentOptions = {
    day?: TextureSource;
    night?: TextureSource;
    roughness?: TextureSource;
    cloud?: TextureSource;
    src?: string;
    svg?: string;
    tint?: string;
    rotation?: number;
    minimumScreenSize?: number;
    animationSpeed?: number;
    id?: string;
};

export class TextureComponent extends EntityComponent {
    day?: TextureSource;
    night?: TextureSource;
    roughness?: TextureSource;
    cloud?: TextureSource;
    src?: string;
    svg?: string;
    tint?: string;
    rotation?: number;
    minimumScreenSize?: number;
    animationSpeed?: number;
    id?: string;

    constructor(options: TextureComponentOptions = {}) {
        super();
        this.day = options.day;
        this.night = options.night;
        this.roughness = options.roughness;
        this.cloud = options.cloud;
        this.src = options.src;
        this.svg = options.svg;
        this.tint = options.tint;
        this.rotation = options.rotation;
        this.minimumScreenSize = options.minimumScreenSize;
        this.animationSpeed = options.animationSpeed;
        this.id = options.id;
    }
}
