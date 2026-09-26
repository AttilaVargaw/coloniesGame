export type DebugFlag = 'showJumpGraph' | "drawOrbits" | "showCameraGizmo" | "showFpsCounter" | "showCameraTarget" | "showBloom" | "showColorGrading" | "showVignette"

export class DebugManager {
    private readonly flags: Record<DebugFlag, boolean> = {
        showJumpGraph: false,
        drawOrbits: true,
        showCameraGizmo: true,
        showFpsCounter: true,
        showCameraTarget: false,
        showBloom: false,
        showColorGrading: false,
        showVignette: false,
    }

    get(flag: DebugFlag): boolean {
        return this.flags[flag]
    }

    set(flag: DebugFlag, value: boolean): void {
        this.flags[flag] = value
    }

    toggle(flag: DebugFlag): void {
        this.flags[flag] = !this.flags[flag]
    }

    all(): Record<DebugFlag, boolean> {
        return { ...this.flags }
    }
}
