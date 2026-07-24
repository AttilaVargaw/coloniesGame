import { Queue } from "./commandQueue"
import { SelectEntityCommand } from "./SelectEntityCommand"
import { CommandBase } from "./CommandBase"

export class CommandBus {
    // eslint-disable-next-line
    readonly commands = new Map<new (...args: any) => CommandBase, Queue<unknown>>([
        [SelectEntityCommand, new Queue()],
    ] as const)

    // eslint-disable-next-line 
    registerCommandQueue(command: Function) {
        // eslint-disable-next-line
        this.commands.set(command as new (...args: any) => CommandBase, new Queue())

        return this
    }

    // eslint-disable-next-line 
    removeCommandQueue(command: Function) {
        // eslint-disable-next-line
        this.commands.delete(command as new (...args: any) => CommandBase)

        return this
    }

    addCommand(command: CommandBase) {
        // eslint-disable-next-line
        this.commands.get(command.constructor as new (...args: any) => CommandBase)?.enqueue(command)

        return this
    }

    // eslint-disable-next-line
    getCommands<T extends new (...args: any) => CommandBase>(type: T) {
        return this.commands.get(type) as unknown as Queue<InstanceType<T>>
    }

    clearAll() {
        for(const commandQueue of this.commands.values()) {
            commandQueue.clear()
        }
    }
}
