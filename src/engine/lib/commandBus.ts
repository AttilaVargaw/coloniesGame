import { Queue } from "./commandQueue"
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

    getCommands<T extends (...args: any) => any>(type: T) {
        return this.commands.get(type) as unknown as Queue<ReturnType<T>>
    }

    clearAll() {
        for(const commandQueue of this.commands.values()) {
            commandQueue.clear()
        }
    }
}

// export type { QueueItem }
