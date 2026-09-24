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
import { useGameEngine } from "@/hooks/useGameContext";
import { DebugToggleCommand } from "@/game/commands/DebugToggleCommand";
import type { DebugFlag } from "@engine/lib/debugManager";

const DEBUG_FLAGS: { flag: DebugFlag; label: string }[] = [
    { flag: "showJumpGraph", label: "Show Jump Graph" },
    { flag: "drawOrbits", label: "Draw Orbits" },
    { flag: "showCameraGizmo", label: "Show Camera Gizmo" },
    { flag: "showFpsCounter", label: "Show FPS Counter" },
]

export function DebugModal() {
    const [open, setOpen] = useState(false)
    const [flags, setFlags] = useState<Record<DebugFlag, boolean>>({
        showJumpGraph: false,
        drawOrbits: true,
        showCameraGizmo: true,
        showFpsCounter: true
    })
    const engine = useGameEngine()

    const handleToggle = (flag: DebugFlag) => {
        setFlags(prev => {
            const next = { ...prev, [flag]: !prev[flag] }
            return next
        })
        engine?.addCommand(new DebugToggleCommand({ flag }))
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
                </div>
            </DialogContent>
        </Dialog>
    )
}
