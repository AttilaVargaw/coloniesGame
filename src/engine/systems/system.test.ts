// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-nocheck
import { describe, it, expect, vi } from "vitest"
import { EntityNode, EntityNodeConstructor } from "@engine/entities/entityNode"
import { SystemWithNodes } from "@engine/systems/system"
import { TestEntityNode, testEntityNodeCtor, makeWorld } from "@engine/test-utils"
import type { Engine } from "@/engine/core/engine"

class CounterSystem extends SystemWithNodes<TestEntityNode> {
    updateNode(_node: TestEntityNode, _dt?: number): void { }
}

describe("System", () => {
    it("attaches to engine via addToEngine and detaches via removeFromEngine", () => {
        const world = makeWorld() as unknown as Engine
        const system = new CounterSystem()

        system.addToEngine(world)

        expect(system.engine).toBe(world)

        system.removeFromEngine()

        expect(system.engine).toBeUndefined()
    })

    it("does not throw when removeFromEngine is called without an engine", () => {
        const system = new CounterSystem()

        expect(() => system.removeFromEngine()).not.toThrow()
    })

    it("unregisters its node type from the world when removed from engine", () => {
        const world = makeWorld() as unknown as Engine
        const system = new CounterSystem()

        world.registerNodeType(
            system.constructor as unknown as EntityNodeConstructor<EntityNode>,
            new Set(),
            () => new TestEntityNode()
        )

        expect(world.getNodeList(system.constructor as unknown as EntityNodeConstructor<EntityNode>)).toBeDefined()

        system.addToEngine(world)
        system.removeFromEngine()

        expect(() =>
            world.getNodeList(system.constructor as unknown as EntityNodeConstructor<EntityNode>)
        ).toThrow()
    })
})

describe("SystemWithNodes", () => {
    it("clears nodes when removed from engine", () => {
        const world = makeWorld() as unknown as Engine
        const nodes = world.getNodeList(testEntityNodeCtor)
        expect(nodes).toHaveLength(0)

        const ctor = CounterSystem as unknown as new () => CounterSystem
        const system = world.addSystem(ctor).getSystem(ctor)!

        system.addToEngine(world)
        system.nodes.push(nodes[0])
        expect(system.nodes).toHaveLength(1)

        system.removeFromEngine()

        expect(system.nodes).toHaveLength(0)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)
    })

    it("calls updateNode for each registered node", () => {
        const world = makeWorld() as unknown as Engine
        const node = world.getNodeList(testEntityNodeCtor)[0]

        const ctor = CounterSystem as unknown as new () => CounterSystem
        const system = world.addSystem(ctor).getSystem(ctor)!

        system.addToEngine(world)
        system.nodes.push(node)

        const spy = vi.spyOn(system, "updateNode")

        system.update(16)

        expect(spy).toHaveBeenCalledWith(node, 16)
    })

    it("skips nodes that do not pass the filter", () => {
        const world = makeWorld() as unknown as Engine
        const node = world.getNodeList(testEntityNodeCtor)[0]

        const ctor = CounterSystem as unknown as new () => CounterSystem
        const system = world.addSystem(ctor).getSystem(ctor)!

        system.addToEngine(world)
        system.nodes.push(node)
        system.filterNodes = () => false

        const spy = vi.spyOn(system, "updateNode")

        system.update(16)

        expect(spy).not.toHaveBeenCalled()
    })
})
