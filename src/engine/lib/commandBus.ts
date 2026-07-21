import { Queue } from "./commandQueue"
import { SelectEntityCommand } from "./SelectEntityCommand"
import { RedrawCommand } from "./RedrawCommand"
import { CommandBase } from "./CommandBase"

export class CommandBus {
    readonly commands = new Map<abstract new (...args: any) => CommandBase, Queue<CommandBase>>([
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

    getCommands<T extends new (...args: any) => CommandBase>(type: T) {
        return this.commands.get(type) as Queue<InstanceType<T>>
    }

    clearAll() {
        for(const commandQueue of this.commands.values()) {
            commandQueue.clear()
        }
    }
}
