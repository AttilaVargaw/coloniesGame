import type { Command } from "../engine"

export type CommandHandler = (data: any) => void

export type CommandQueueOptions = {
    capacity?: number
    onOverflow?: (dropped: Command) => void
}

export class CommandQueue {
    private readonly queue: Command[] = []
    // private readonly handlers = new Map<Commands, Set<CommandHandler>>()
    private readonly capacity: number
    private readonly onOverflow?: (dropped: Command) => void

    constructor(options: CommandQueueOptions = {}) {
        this.capacity = options.capacity ?? Infinity
        this.onOverflow = options.onOverflow
    }

    enqueue(command: Command): this {
        if(this.queue.length >= this.capacity) {
            const dropped = this.queue.shift()!
            this.onOverflow?.(dropped)
        }

        this.queue.push(command)

        return this
    }

    enqueueMany(commands: Command[]): this {
        for(const command of commands) {
            this.enqueue(command)
        }

        return this
    }

    // registerHandler(command: Commands, handler: CommandHandler): this {
    //     if(!this.handlers.has(command)) {
    //         this.handlers.set(command, new Set([handler]))

    //         return this
    //     }

    //     this.handlers.get(command)!.add(handler)

    //     return this
    // }

    // unregisterHandler(command: Commands, handler: CommandHandler): this {
    //     this.handlers.get(command)?.delete(handler)

    //     return this
    // }

    peek(): Command | undefined {
        return this.queue[0]
    }

    get length(): number {
        return this.queue.length
    }

    isEmpty(): boolean {
        return this.queue.length === 0
    }

    next(): Command | undefined {
        return this.queue.shift()
    }

    // flush(): Command[] {
    //     const processed = this.queue.splice(0, this.queue.length)

    //     for(const command of processed) {
    //         for(const handler of this.handlers.get(command.name) ?? []) {
    //             handler(command.data)
    //         }
    //     }

    //     return processed
    // }

    // processNext(): Command | undefined {
    //     const command = this.queue.shift()

    //     if(!command) {
    //         return undefined
    //     }

    //     for(const handler of this.handlers.get(command.name) ?? []) {
    //         handler(command.data)
    //     }

    //     return command
    // }

    clear(): this {
        this.queue.length = 0

        return this
    }

    [Symbol.iterator](): Iterator<Command> {
        return this.queue[Symbol.iterator]()
    }
}