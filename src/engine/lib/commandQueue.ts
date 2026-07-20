
export type CommandHandler = (data: unknown) => void

export type QueueOptions<Data> = {
    capacity?: number
    onOverflow?: (dropped: QueueItem<Data>) => void
}

export abstract class QueueItem<Data> {
    constructor(public data: Data) { }
}

export class Queue<Data, Item extends QueueItem<Data> = QueueItem<Data>> {
    private readonly queue: Item[] = []
    private readonly capacity: number
    private readonly onOverflow?: (dropped: Item) => void

    constructor(options: QueueOptions<Data> = {}) {
        this.capacity = options.capacity ?? Infinity
        this.onOverflow = options.onOverflow
    }

    enqueue(command: Item): this {
        if(this.queue.length >= this.capacity) {
            const dropped = this.queue.shift()!
            this.onOverflow?.(dropped)
        }

        this.queue.push(command)

        return this
    }

    enqueueMany(commands: Item[]): this {
        for(const command of commands) {
            this.enqueue(command)
        }

        return this
    }

    peek(): Item | undefined {
        return this.queue[0]
    }

    get length(): number {
        return this.queue.length
    }

    isEmpty(): boolean {
        return this.queue.length === 0
    }

    next(): Item | undefined {
        return this.queue.shift()
    }

    clear(): this {
        this.queue.length = 0

        return this
    }

    [Symbol.iterator](): Iterator<Item> {
        return this.queue[Symbol.iterator]()
    }
}