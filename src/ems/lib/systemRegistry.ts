import type { System } from "../systems/system"
import type { World } from "../core/world"

export class SystemRegistry {
    private readonly systems: Map<new () => System, System> = new Map()
    private readonly subSystems: Map<new () => System, System> = new Map()

    getSystem<T extends System>(system: new () => T) {
        return this.systems.get(system) as T
    }

    addSystem(system: new () => System, world: World) {
        const newSystem = new system()
        newSystem.addToEngine(world)
        this.systems.set(system, newSystem)

        return this
    }

    removeSystem(system: new () => System) {
        const systemInstance = this.systems.get(system)
        if(systemInstance) {
            systemInstance.removeFromEngine()
        }
        this.systems.delete(system)

        return this
    }

    addSubsystem(subsystem: new () => System, world: World) {
        const newSubsystem = new subsystem()
        this.subSystems.set(subsystem, newSubsystem)
        newSubsystem.addToEngine(world)

        return this
    }

    removeSubSystem(subsystem: new () => System) {
        const system = this.subSystems.get(subsystem)
        if(system) {
            system.removeFromEngine()
        }
        this.subSystems.delete(subsystem)

        return this
    }

    update(dt: number) {
        for(const system of this.systems.values()) {
            system.update(dt)
        }
    }

    clear() {
        this.systems.clear()
        this.subSystems.clear()
    }
}
