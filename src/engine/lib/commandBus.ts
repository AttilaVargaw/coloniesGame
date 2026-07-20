import { Queue, QueueItem } from "./commandQueue"
import type { Commands } from "../core/world"

export class CommandBus {
    readonly commands: Map<Commands, Queue<unknown>> = new Map([
        ["redraw", new Queue()],
        ["selectEntity", new Queue()],
    ])

    registerCommandQueue(command: Commands) {
        this.commands.set(command, new Queue())

        return this
    }

    removeCommandQueue(command: Commands) {
        this.commands.delete(command)

        return this
    }

    addCommand(command: Commands, data: unknown) {
        this.commands.get(command)?.enqueue({ data })

        return this
    }

    getCommandQueue(type: Commands) {
        return this.commands.get(type)
    }

    clearAll() {
        for(const commandQueue of this.commands.values()) {
            commandQueue.clear()
        }
    }
}

export type { QueueItem }
