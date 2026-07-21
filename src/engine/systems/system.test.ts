import { describe, it, expect, vi } from "vitest"
import { EntityNode, EntityNodeConstructor } from "@engine/entities/entityNode"
import { System, SystemWithNodes } from "@engine/systems/system"
import { TestEntityNode, testEntityNodeCtor, makeWorld } from "@engine/test-utils"

class CounterSystem extends SystemWithNodes<TestEntityNode> {
    updateNode(_node: TestEntityNode, _dt?: number): void { }
}

describe("System", () => {
    it("adds and removes subsystems", () => {
        //@ts-ignore
        const parent = new System()
        //@ts-ignore
        const child = new System()

        parent.addSubsystem(child)

        expect(parent.subsystems.has(child)).toBe(true)
        expect(child.parent).toBe(parent)

        parent.removeSubsystem(child)

        expect(parent.subsystems.has(child)).toBe(false)
        expect(child.parent).toBeUndefined()
    })

    it("does not add the same subsystem twice", () => {
        //@ts-ignore
        const parent = new System()
        //@ts-ignore
        const child = new System()

        parent.addSubsystem(child)
        parent.addSubsystem(child)

        expect(parent.subsystems.size).toBe(1)
    })

    it("propagates update to subsystems", () => {
        //@ts-ignore
        const parent = new System()
        //@ts-ignore
        const child = new System()

        parent.addSubsystem(child)
        const childSpy = vi.spyOn(child, "update")

        parent.updateSubsystems(16)

        expect(childSpy).toHaveBeenCalledWith(16)
    })

    it("attaches to engine via addToEngine and detaches via removeFromEngine", () => {
        const world = makeWorld()
        //@ts-ignore
        const system = new System()

        system.addToEngine(world)

        expect(system.engine).toBe(world)

        system.removeFromEngine()

        expect(system.engine).toBeUndefined()
    })

    it("does not throw when removeFromEngine is called without an engine", () => {
        //@ts-ignore
        const system = new System()

        expect(() => system.removeFromEngine()).not.toThrow()
    })

    it("unregisters its node type from the world when removed from engine", () => {
        const world = makeWorld()
        //@ts-ignore
        const system = new System()

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
        const world = makeWorld()

        class ParentSystem extends System { }
        class ChildSystem extends System { }

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
        const world = makeWorld()
        const nodes = world.getNodeList(testEntityNodeCtor)
        expect(nodes).toHaveLength(0)

        const ctor = CounterSystem as unknown as new () => System
        const system = world.addSystem(ctor).getSystem(ctor)!

        system.addToEngine(world)
        //@ts-ignore
        system.nodes.push(nodes[0])
        //@ts-ignore
        expect(system.nodes).toHaveLength(1)

        system.removeFromEngine()

        //@ts-ignore
        expect(system.nodes).toHaveLength(0)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)
    })

    it("calls updateNode for each registered node", () => {
        const world = makeWorld()
        const node = world.getNodeList(testEntityNodeCtor)[0]

        const ctor = CounterSystem as unknown as new () => System
        const system = world.addSystem(ctor).getSystem(ctor)!

        system.addToEngine(world)
        //@ts-ignore
        system.nodes.push(node)

        //@ts-ignore
        const spy = vi.spyOn(system, "updateNode")

        system.update(16)

        expect(spy).toHaveBeenCalledWith(node, 16)
    })

    it("skips nodes that do not pass the filter", () => {
        const world = makeWorld()
        const node = world.getNodeList(testEntityNodeCtor)[0]

        const ctor = CounterSystem as unknown as new () => System
        const system = world.addSystem(ctor).getSystem(ctor)!

        system.addToEngine(world)
        //@ts-ignore
        system.nodes.push(node)
        //@ts-ignore
        system.filterNodes = () => false

        //@ts-ignore
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
        const world = makeWorld()

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

        //@ts-ignore
        expect(parent.engine).toBe(world)
        //@ts-ignore
        expect(child.engine).toBe(world)

        parent.removeFromEngine()
        //@ts-ignore
        expect(parent.engine).toBeUndefined()
        //@ts-ignore
        expect(child.engine).toBeUndefined()
    })
})