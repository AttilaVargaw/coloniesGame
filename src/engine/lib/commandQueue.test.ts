import { describe, it, expect, vi } from "vitest"
import { Queue, QueueItem } from "./commandQueue"

class QueueItemImplementation<T> extends QueueItem<T> {
    constructor(data: T) {
        super(data)
    }
}

describe("Queue", () => {
    it("starts empty with no options", () => {
        const queue = new Queue<any>()

        expect(queue.length).toBe(0)
        expect(queue.isEmpty()).toBe(true)
    })

    it("enqueues an item and increments length", () => {
        const queue = new Queue<number>()

        const result = queue.enqueue(new QueueItemImplementation(1))

        expect(queue.length).toBe(1)
        expect(queue.isEmpty()).toBe(false)
        expect(result).toBe(queue)
    })

    it("enqueues multiple items via enqueueMany", () => {
        const queue = new Queue<number>()

        queue.enqueueMany([new QueueItemImplementation(1), new QueueItemImplementation(2), new QueueItemImplementation(3)])

        expect(queue.length).toBe(3)
    })

    it("peeks at the first item without removing it", () => {
        const queue = new Queue<number>()
        queue.enqueue(new QueueItemImplementation(10))
        queue.enqueue(new QueueItemImplementation(20))

        const first = queue.peek()

        expect(first?.data).toBe(10)
        expect(queue.length).toBe(2)
    })

    it("returns undefined from peek when empty", () => {
        const queue = new Queue<number>()

        expect(queue.peek()).toBeUndefined()
    })

    it("next returns and removes the first item", () => {
        const queue = new Queue<string>()
        queue.enqueue(new QueueItemImplementation("a"))
        queue.enqueue(new QueueItemImplementation("b"))

        const item = queue.next()

        expect(item?.data).toBe("a")
        expect(queue.length).toBe(1)
    })

    it("next returns undefined when empty", () => {
        const queue = new Queue<number>()

        expect(queue.next()).toBeUndefined()
    })

    it("clears all items", () => {
        const queue = new Queue<number>()
        queue.enqueue(new QueueItemImplementation(1))
        queue.enqueue(new QueueItemImplementation(2))

        const result = queue.clear()

        expect(queue.length).toBe(0)
        expect(queue.isEmpty()).toBe(true)
        expect(result).toBe(queue)
    })

    it("is iterable", () => {
        const queue = new Queue<string>()
        queue.enqueue(new QueueItemImplementation("x"))
        queue.enqueue(new QueueItemImplementation("y"))

        const items = [...queue]

        expect(items.map(item => item.data)).toEqual(["x", "y"])
    })

    it("respects capacity and calls onOverflow when exceeded", () => {
        const onOverflow = vi.fn()
        const queue = new Queue<number>({ capacity: 2, onOverflow })

        queue.enqueue(new QueueItemImplementation(1))
        queue.enqueue(new QueueItemImplementation(2))
        queue.enqueue(new QueueItemImplementation(3))

        expect(queue.length).toBe(2)
        expect(queue.peek()?.data).toBe(2)
        expect(onOverflow).toHaveBeenCalledTimes(1)
        expect(onOverflow).toHaveBeenCalledWith(expect.objectContaining({ data: 1 }))
    })

    it("uses Infinity as default capacity", () => {
        const queue = new Queue<number>()

        for(let i = 0; i < 1000; i++) {
            queue.enqueue(new QueueItemImplementation(i))
        }

        expect(queue.length).toBe(1000)
    })

    it("accepts custom QueueItem subclasses", () => {
        class CustomItem extends QueueItem<string> {
            extra = true
        }

        const queue = new Queue<string, CustomItem>()
        queue.enqueue(new CustomItem("hello"))

        const item = queue.next()

        expect(item?.data).toBe("hello")
        expect(item?.extra).toBe(true)
    })
})
