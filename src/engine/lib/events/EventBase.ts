export abstract class EventBase<T = any> {
    public readonly data: T;
    public readonly timestamp: number;

    constructor(data: T) {
        this.data = data;
        this.timestamp = Date.now();
    }
}