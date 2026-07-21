
export abstract class CommandBase<T = unknown> {
    constructor(public data: T) { }
}
