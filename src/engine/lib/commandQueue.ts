
export type CommandHandler = (data: unknown) => void

export type QueueOptions<Data> = {
    capacity?: number
    onOverflow?: (dropped: Data) => void
}

// eslint-disable-next-line
export class Queue<Data = any> {
    private readonly queue: Data[] = []
    private readonly capacity: number
    private readonly onOverflow?: (dropped: Data) => void

    constructor(options: QueueOptions<Data> = {}) {
        this.capacity = options.capacity ?? Infinity
        this.onOverflow = options.onOverflow
    }

    enqueue(item?: Data): this {
        if(this.queue.length >= this.capacity) {
            const dropped = this.queue.shift()!
            this.onOverflow?.(dropped)
        }

        this.queue.push(item!)

        return this
    }

    enqueueMany(items: Data[]): this {
        for(const item of items) {
            this.enqueue(item)
        }

        return this
    }

    peek(): Data | undefined {
        return this.queue[0]
    }

    get length(): number {
        return this.queue.length
    }

    isEmpty(): boolean {
        return this.queue.length === 0
    }

    next(): Data | undefined {
        return this.queue.shift()
    }

    clear(): this {
        this.queue.length = 0

        return this
    }

    [Symbol.iterator](): Iterator<Data> {
        return this.queue[Symbol.iterator]()
    }
}