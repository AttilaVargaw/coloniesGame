import type { System } from "../systems/system"
import type { World } from "../core/world"

export class SystemRegistry {
    private readonly systems: Map<new (...args: unknown[]) => System, System> = new Map()

    getSystem<T extends System>(system: new (...args: unknown[]) => T) {
        return this.systems.get(system) as T
    }

    hasSystem(system: new (...args: unknown[]) => System) {
        return this.systems.has(system)
    }

    addSystem(system: new (...args: unknown[]) => System, world: World, ...args: unknown[]) {
        const newSystem = new system(...args)
        newSystem.addToEngine(world)
        this.systems.set(system, newSystem)

        return this
    }

    removeSystem(system: new (...args: unknown[]) => System) {
        const systemInstance = this.systems.get(system)
        if(systemInstance) {
            systemInstance.removeFromEngine()
        }
        this.systems.delete(system)

        return this
    }

    update(dt: number) {
        for(const system of this.systems.values()) {
            system.update(dt)
        }
    }

    clear() {
        for(const system of this.systems.values()) {
            system.removeFromEngine()
        }

        this.systems.clear()
    }
}
