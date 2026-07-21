import { Queue, QueueItem } from "./commandQueue"
import { SelectEntityCommand } from "./SelectEntityCommand"
import { RedrawCommand } from "./RedrawCommand"
import { CommandBase } from "./CommandBase"

export class CommandBus {
    // eslint-disable-next-line 
    readonly commands = new Map<Function, Queue<unknown>>([
        [RedrawCommand, new Queue()],
        [SelectEntityCommand, new Queue()],
    ] as const)

    // eslint-disable-next-line 
    registerCommandQueue(command: Function) {
        this.commands.set(command, new Queue())

        return this
    }

    // eslint-disable-next-line 
    removeCommandQueue(command: Function) {
        this.commands.delete(command)

        return this
    }

    addCommand(command: CommandBase) {
        this.commands.get(command.constructor)?.enqueue({ data: command.data })

        return this
    }

    // eslint-disable-next-line 
    getCommandQueue<T extends object>(type: Function) {
        return this.commands.get(type) as T
    }

    clearAll() {
        for(const commandQueue of this.commands.values()) {
            commandQueue.clear()
        }
    }
}

export type { QueueItem }
