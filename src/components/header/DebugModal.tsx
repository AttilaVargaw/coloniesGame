import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { BugOff, Check } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useGameEngine } from "@/hooks/useGameContext";
import { DebugToggleCommand } from "@/game/commands/DebugToggleCommand";
import type { DebugFlag, BloomSettings } from "@engine/lib/debugManager";

const DEBUG_FLAGS: { flag: DebugFlag; label: string }[] = [
    { flag: "showJumpGraph", label: "Show Jump Graph" },
    { flag: "drawOrbits", label: "Draw Orbits" },
    { flag: "showCameraGizmo", label: "Show Camera Gizmo" },
    { flag: "showFpsCounter", label: "Show FPS Counter" },
    { flag: "showCameraTarget", label: "Show Camera Target" },
    { flag: "showBloom", label: "Show Bloom" },
    { flag: "showHDR", label: "Show HDR" },
    { flag: "showColorGrading", label: "Show Color Grading" },
    { flag: "showVignette", label: "Show Vignette" },
    { flag: "showContrastSaturation", label: "Show Contrast Saturation" },
    { flag: "showCullingOverlay", label: "Show Culling Overlay" },
    { flag: "showCheckerPattern", label: "Show Checker Pattern" },
    { flag: "showFrameTime", label: "Show Frame Time" },
    { flag: "showClickBoxes", label: "Show Click Boxes" },
] as const

const DEFAULT_BLOOM_SETTINGS: Readonly<BloomSettings> = {
    brightness: 3,
    contrast: 2,
    iterations: 3,
    alpha: 1,
    threshold: 0.4,
} as const

export function DebugModal() {
    const [open, setOpen] = useState(false)
    const [flags, setFlags] = useState<Record<DebugFlag, boolean>>({
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
    })
    const [bloomSettings, setBloomSettings] = useState<BloomSettings>(DEFAULT_BLOOM_SETTINGS)
    const engine = useGameEngine()

    const handleToggle = (flag: DebugFlag) => {
        setFlags(prev => {
            const next = { ...prev, [flag]: !prev[flag] }
            return next
        })
        engine?.addCommand(new DebugToggleCommand({ flag }))
    }

    const handleBloomSettingChange = (key: keyof BloomSettings, value: number) => {
        if(!engine) return

        setBloomSettings(prev => {
            const next = { ...prev, [key]: value }
            engine.getDebugManager().bloomSettings = next
            return next
        })
    }

    return (
        <Dialog modal={false} open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                    <BugOff />
                    Debug
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1c1c1c] text-popover-foreground">
                <DialogHeader>
                    <DialogTitle>Debug</DialogTitle>
                    <DialogDescription>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    {DEBUG_FLAGS.map(({ flag, label }) => (
                        <div key={flag} className="flex items-center justify-between">
                            <span className="text-sm">{label}</span>
                            <Toggle
                                pressed={flags[flag]}
                                onPressedChange={() => handleToggle(flag)}
                                size="sm"
                                variant="outline"
                            >
                                <span className="flex items-center justify-center">
                                    <Check className={`size-3.5 transition-opacity ${flags[flag] ? "opacity-100" : "opacity-0"}`} />
                                </span>
                            </Toggle>
                        </div>
                    ))}
                    {flags.showBloom && (
                        <div className="mt-4 flex flex-col gap-3 border-t border-muted pt-3">
                            <span className="text-sm font-medium">Bloom Settings</span>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Brightness</Label>
                                    <span className="text-xs text-muted-foreground">{bloomSettings.brightness.toFixed(1)}</span>
                                </div>
                                <Slider
                                    value={[bloomSettings.brightness]}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    onValueChange={([value]) => handleBloomSettingChange("brightness", value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Contrast</Label>
                                    <span className="text-xs text-muted-foreground">{bloomSettings.contrast.toFixed(1)}</span>
                                </div>
                                <Slider
                                    value={[bloomSettings.contrast]}
                                    min={1}
                                    max={5}
                                    step={0.1}
                                    onValueChange={([value]) => handleBloomSettingChange("contrast", value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Blur Passes</Label>
                                    <span className="text-xs text-muted-foreground">{bloomSettings.iterations}</span>
                                </div>
                                <Slider
                                    value={[bloomSettings.iterations]}
                                    min={1}
                                    max={5}
                                    step={1}
                                    onValueChange={([value]) => handleBloomSettingChange("iterations", value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Intensity</Label>
                                    <span className="text-xs text-muted-foreground">{bloomSettings.alpha.toFixed(1)}</span>
                                </div>
                                <Slider
                                    value={[bloomSettings.alpha]}
                                    min={0.1}
                                    max={1}
                                    step={0.1}
                                    onValueChange={([value]) => handleBloomSettingChange("alpha", value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Threshold</Label>
                                    <span className="text-xs text-muted-foreground">{bloomSettings.threshold.toFixed(1)}</span>
                                </div>
                                <Slider
                                    value={[bloomSettings.threshold]}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    onValueChange={([value]) => handleBloomSettingChange("threshold", value)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
