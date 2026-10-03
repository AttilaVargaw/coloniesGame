export interface Platform {
    createCanvas(): HTMLCanvasElement;
    readonly window: Window;
    readonly document: Document;
}

let _platform: Platform | undefined;

export function setPlatform(platform: Platform): void {
    _platform = platform;
}

export function getPlatform(): Platform {
    if (!_platform) {
        if (typeof document === "undefined" || typeof window === "undefined") {
            throw new Error("Platform not initialized: document/window unavailable");
        }
        _platform = {
            createCanvas(): HTMLCanvasElement {
                return document.createElement("canvas");
            },
            get window(): Window {
                return window;
            },
            get document(): Document {
                return document;
            },
        };
    }
    return _platform;
}
