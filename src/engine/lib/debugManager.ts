export interface BloomSettings {
    brightness: number
    contrast: number
    iterations: number
    alpha: number
    threshold: number
    thresholdStars: number
}

export type DebugFlag = keyof typeof DEBUG_FLAGS

export const DEFAULT_BLOOM_SETTINGS: Readonly<BloomSettings> = {
    brightness: 3.5,
    contrast: 2.2,
    iterations: 4,
    alpha: 1,
    threshold: 0.22,
    thresholdStars: 0.06,
} as const

export const DEBUG_FLAGS = {
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
    showHDR: true,
    showAtmosphere: true,
}

export class DebugManager {
    private readonly _flags: Record<DebugFlag, boolean> = { ...DEBUG_FLAGS }

    private _bloomSettings = DEFAULT_BLOOM_SETTINGS

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
