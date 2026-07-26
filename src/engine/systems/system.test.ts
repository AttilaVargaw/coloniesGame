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
    it("adds and removes subsystems", () => {
        const parent = new CounterSystem()
        const child = new CounterSystem()

        parent.addSubsystem(child)

        expect(parent.subsystems.has(child)).toBe(true)
        expect(child.parent).toBe(parent)

        parent.removeSubsystem(child)

        expect(parent.subsystems.has(child)).toBe(false)
    })

    it("does not add the same subsystem twice", () => {
        const parent = new CounterSystem()
        const child = new CounterSystem()

        parent.addSubsystem(child)
        parent.addSubsystem(child)

        expect(parent.subsystems.size).toBe(1)
    })

    it("propagates update to subsystems", () => {
        const parent = new CounterSystem()
        const child = new CounterSystem()

        parent.addSubsystem(child)
        const childSpy = vi.spyOn(child, "update")

        parent.updateSubsystems(16)

        expect(childSpy).toHaveBeenCalledWith(16)
    })

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

    it("unregisters node types recursively for subsystems", () => {
        const world = makeWorld() as unknown as Engine

        class ParentSystem extends CounterSystem { }
        class ChildSystem extends CounterSystem { }

        const parent = new ParentSystem()
        const child = new ChildSystem()

        parent.addSubsystem(child)

        parent.addToEngine(world)

        world.registerNodeType(
            ParentSystem as unknown as EntityNodeConstructor<EntityNode>,
            new Set(),
            () => new TestEntityNode()
        )

        child.addToEngine(world)

        world.registerNodeType(
            ChildSystem as unknown as EntityNodeConstructor<EntityNode>,
            new Set(),
            () => new TestEntityNode()
        )

        parent.removeFromEngine()

        expect(() =>
            world.getNodeList(ParentSystem as unknown as EntityNodeConstructor<EntityNode>)
        ).toThrow()
        expect(() =>
            world.getNodeList(ChildSystem as unknown as EntityNodeConstructor<EntityNode>)
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

    it("propagates sortOnEveryEntityAddition to subsystems", () => {
        class ParentSystem extends SystemWithNodes<TestEntityNode> {
            updateNode(_node: TestEntityNode, _dt?: number): void { }
        }

        class ChildSystem extends SystemWithNodes<TestEntityNode> {
            updateNode(_node: TestEntityNode, _dt?: number): void { }
        }

        const parent = new ParentSystem()
        const child = new ChildSystem()

        parent.addSubsystem(child)

        expect(child.sortOnEveryEntityAddition).toBe(false)

        parent.sortOnEveryEntityAddition = true

        expect(child.sortOnEveryEntityAddition).toBe(true)
    })

    it("propagates addToEngine and removeFromEngine to subsystems", () => {
        const world = makeWorld() as unknown as Engine

        class ParentSystem extends SystemWithNodes<TestEntityNode> {
            updateNode(_node: TestEntityNode, _dt?: number): void { }
        }

        class ChildSystem extends SystemWithNodes<TestEntityNode> {
            updateNode(_node: TestEntityNode, _dt?: number): void { }
        }

        const parent = new ParentSystem()
        const child = new ChildSystem()

        parent.addSubsystem(child)

        parent.addToEngine(world)

        expect(parent.engine).toBe(world)
        expect(child.engine).toBe(world)

        parent.removeFromEngine()
        expect(parent.engine).toBeUndefined()
        expect(child.engine).toBeUndefined()
    })
})
