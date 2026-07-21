import { CommandBase } from "./CommandBase";


export class RedrawCommand extends CommandBase<undefined> {
    constructor(data = undefined) {
        super(data)
    }
 }
