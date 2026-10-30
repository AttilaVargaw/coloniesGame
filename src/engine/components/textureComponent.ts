import { EntityComponent } from "../entities/entityComponent";

export type TextureSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

export type TextureComponentOptions = {
    day?: TextureSource;
    night?: TextureSource;
    roughness?: TextureSource;
    cloud?: TextureSource;
    normal?: TextureSource;
    src?: string;
    svg?: string;
    tint?: string;
    rotation?: number;
    minimumScreenSize?: number;
    animationSpeed?: number;
    id?: string;
    meshIndex?: number;
}

export class TextureComponent extends EntityComponent {
    day?: TextureSource;
    night?: TextureSource;
    roughness?: TextureSource;
    cloud?: TextureSource;
    normal?: TextureSource;
    src?: string;
    svg?: string;
    tint?: string;
    rotation?: number;
    minimumScreenSize?: number;
    animationSpeed?: number;
    id?: string;
    meshIndex?: number;

    constructor(options: TextureComponentOptions = {}) {
        super();
        this.day = options.day;
        this.night = options.night;
        this.roughness = options.roughness;
        this.cloud = options.cloud;
        this.normal = options.normal;
        this.src = options.src;
        this.svg = options.svg;
        this.tint = options.tint;
        this.rotation = options.rotation;
        this.minimumScreenSize = options.minimumScreenSize;
        this.animationSpeed = options.animationSpeed;
        this.id = options.id;
        this.meshIndex = options.meshIndex;
    }

    dispose(): void {
        for(const key of ["day", "night", "roughness", "cloud", "normal"] as const) {
            const source = this[key];
            if(source instanceof ImageBitmap) {
                source.close();
            }
            this[key] = undefined;
        }
    }
}
