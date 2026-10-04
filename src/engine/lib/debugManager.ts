export interface BloomSettings {
    brightness: number
    contrast: number
    iterations: number
    alpha: number
    threshold: number
}

export type DebugFlag = 'showJumpGraph' | "drawOrbits" | "showCameraGizmo" | "showFpsCounter" | "showCameraTarget" | "showBloom" | "showColorGrading" | "showVignette" | "showContrastSaturation" | "showCullingOverlay" | "showCheckerPattern" | "showFrameTime" | "showClickBoxes"

export class DebugManager {
    private readonly _flags: Record<DebugFlag, boolean> = {
        showJumpGraph: false,
        drawOrbits: true,
        showCameraGizmo: true,
        showFpsCounter: true,
        showCameraTarget: false,
        showBloom: true,
        showColorGrading: false,
        showVignette: false,
        showContrastSaturation: false,
        showCullingOverlay: false,
        showCheckerPattern: false,
        showFrameTime: false,
        showClickBoxes: false,
    }

    private _bloomSettings: BloomSettings = {
        brightness: 0.3,
        contrast: 2,
        iterations: 3,
        alpha: 0.25,
        threshold: 0.4,
    }

    get debugflags() {
        return this._flags
    }

    set(flag: DebugFlag, value: boolean): void {
        this._flags[flag] = value
    }

    toggle(flag: DebugFlag): void {
        this._flags[flag] = !this._flags[flag]
    }

    get bloomSettings(): BloomSettings {
        return this._bloomSettings
    }

    set bloomSettings(settings: Partial<BloomSettings>) {
        this._bloomSettings = { ...this.bloomSettings, ...settings }
    }

    all(): Record<DebugFlag, boolean> {
        return { ...this._flags }
    }
}
