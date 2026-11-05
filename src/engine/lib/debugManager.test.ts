import { describe, it, expect, vi } from "vitest"
import { DebugManager } from "./debugManager"
import { DebugToggleCommand } from "@/game/commands/DebugToggleCommand"
import { DebugSystem } from "@/game/systems/debugSystem"
import { Queue } from "@/engine/lib/commandQueue"
import type { Engine } from "@/engine/core/engine"

describe("DebugManager", () => {
    it("has default flag values", () => {
        const dm = new DebugManager()
        expect(dm.debugflags.drawOrbits).toBe(true)
        expect(dm.debugflags.showCameraGizmo).toBe(true)
        expect(dm.debugflags.showFpsCounter).toBe(true)
        expect(dm.debugflags.showBloom).toBe(true)
        expect(dm.debugflags.showClickBoxes).toBe(false)
    })

    it("set and toggle flags", () => {
        const dm = new DebugManager()
        dm.set("showJumpGraph", true)
        expect(dm.debugflags.showJumpGraph).toBe(true)
        dm.toggle("showJumpGraph")
        expect(dm.debugflags.showJumpGraph).toBe(false)
    })

    it("toggling twice returns to original value", () => {
        const dm = new DebugManager()
        dm.toggle("showBloom")
        expect(dm.debugflags.showBloom).toBe(false)
        dm.toggle("showBloom")
        expect(dm.debugflags.showBloom).toBe(true)
    })

    it("all returns a copy of flags", () => {
        const dm = new DebugManager()
        const all = dm.all()
        expect(all.showJumpGraph).toBe(false)
        all.showJumpGraph = true
        expect(dm.debugflags.showJumpGraph).toBe(false)
    })

    it("bloom settings default", () => {
        const dm = new DebugManager()
        expect(dm.bloomSettings.brightness).toBe(3)
        expect(dm.bloomSettings.iterations).toBe(3)
    })

    it("bloom settings merge partially", () => {
        const dm = new DebugManager()
        dm.bloomSettings = { brightness: 10 }
        expect(dm.bloomSettings.brightness).toBe(10)
        expect(dm.bloomSettings.iterations).toBe(3)
    })
})

describe("DebugSystem", () => {
    const makeEngine = (): { engine: Engine; debugManager: DebugManager } => {
        const debugManager = new DebugManager()
        const commands = new Map<new (...args: any[]) => any, Queue<any>>()

        const engine = {
            getDebugManager: () => debugManager,
            getCommands: <T>(ctor: new (...args: any[]) => T): Queue<T> => {
                let q = commands.get(ctor)
                if(!q) {
                    q = new Queue<T>()
                    commands.set(ctor as any, q as any)
                }
                return q as unknown as Queue<T>
            },
            registerCommandQueue: () => undefined,
            removeCommandQueue: () => undefined,
            addCommand: (command: any) => {
                const ctor = command.constructor as new (...args: any[]) => any
                let q = commands.get(ctor)
                if(!q) {
                    q = new Queue()
                    commands.set(ctor, q)
                }
                q.enqueue(command)
            },
        } as unknown as Engine

        return { engine, debugManager }
    }

    it("toggles debug flags from queued commands", () => {
        const { engine, debugManager } = makeEngine()
        const system = new DebugSystem()
        system.addToEngine(engine)

        debugManager.set("showBloom", true)
        engine.addCommand(new DebugToggleCommand({ flag: "showBloom" }))
        system.update(0)

        expect(debugManager.debugflags.showBloom).toBe(false)
    })

    it("processes multiple commands and clears queue", () => {
        const { engine } = makeEngine()
        const system = new DebugSystem()
        system.addToEngine(engine)

        engine.addCommand(new DebugToggleCommand({ flag: "showBloom" }))
        engine.addCommand(new DebugToggleCommand({ flag: "showFpsCounter" }))
        system.update(0)

        const q = engine.getCommands(DebugToggleCommand)
        expect(q.isEmpty()).toBe(true)
    })

    it("does nothing when no commands queued", () => {
        const { engine } = makeEngine()
        const system = new DebugSystem()
        system.addToEngine(engine)

        expect(() => system.update(0)).not.toThrow()
    })

    it("registers and unregisters command queue", () => {
        const { engine } = makeEngine()
        const system = new DebugSystem()
        const registerSpy = vi.spyOn(engine, "registerCommandQueue")
        const removeSpy = vi.spyOn(engine, "removeCommandQueue")

        system.addToEngine(engine)
        expect(registerSpy).toHaveBeenCalledWith(DebugToggleCommand)

        system.removeFromEngine()
        expect(removeSpy).toHaveBeenCalledWith(DebugToggleCommand)
    })
})
