export type BTStatus = "SUCCESS" | "FAILURE" | "RUNNING";

export interface BTNode<TBlackboard = Record<string, any>> {
    tick(blackboard: TBlackboard): BTStatus;
}

export class Sequence<TBlackboard = Record<string, any>> implements BTNode<TBlackboard> {
    constructor(public children: BTNode<TBlackboard>[]) {}

    tick(blackboard: TBlackboard): BTStatus {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status !== "SUCCESS") return status;
        }
        return "SUCCESS";
    }
}

export class Selector<TBlackboard = Record<string, any>> implements BTNode<TBlackboard> {
    constructor(public children: BTNode<TBlackboard>[]) {}

    tick(blackboard: TBlackboard): BTStatus {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status === "SUCCESS") return status;
        }
        return "FAILURE";
    }
}

export class Inverter<TBlackboard = Record<string, any>> implements BTNode<TBlackboard> {
    constructor(public child: BTNode<TBlackboard>) {}

    tick(blackboard: TBlackboard): BTStatus {
        const status = this.child.tick(blackboard);
        if (status === "SUCCESS") return "FAILURE";
        if (status === "FAILURE") return "SUCCESS";
        return status;
    }
}

export abstract class Condition<TBlackboard = Record<string, any>> implements BTNode<TBlackboard> {
    abstract check(blackboard: TBlackboard): boolean;

    tick(blackboard: TBlackboard): BTStatus {
        return this.check(blackboard) ? "SUCCESS" : "FAILURE";
    }
}

export abstract class Action<TBlackboard = Record<string, any>> implements BTNode<TBlackboard> {
    abstract execute(blackboard: TBlackboard): BTStatus;

    tick(blackboard: TBlackboard): BTStatus {
        return this.execute(blackboard);
    }
}

// ----- Generic conditions (work on any Record<string, any> blackboard) -----

export class KeyExists extends Condition<Record<string, any>> {
    constructor(public key: string) { super(); }
    check(bb: Record<string, any>): boolean {
        return bb[this.key] !== undefined;
    }
}

export class GreaterThan extends Condition<Record<string, any>> {
    constructor(public key: string, public threshold: number) { super(); }
    check(bb: Record<string, any>): boolean {
        return (bb[this.key] ?? 0) > this.threshold;
    }
}

export class LessThan extends Condition<Record<string, any>> {
    constructor(public key: string, public threshold: number) { super(); }
    check(bb: Record<string, any>): boolean {
        return (bb[this.key] ?? 0) < this.threshold;
    }
}

export class Equals extends Condition<Record<string, any>> {
    constructor(public key: string, public value: any) { super(); }
    check(bb: Record<string, any>): boolean {
        return bb[this.key] === this.value;
    }
}

export class NotEquals extends Condition<Record<string, any>> {
    constructor(public key: string, public value: any) { super(); }
    check(bb: Record<string, any>): boolean {
        return bb[this.key] !== this.value;
    }
}

export class And extends Condition<Record<string, any>> {
    constructor(public children: Condition<Record<string, any>>[]) { super(); }
    check(bb: Record<string, any>): boolean {
        return this.children.every(c => c.check(bb));
    }
}

export class Or extends Condition<Record<string, any>> {
    constructor(public children: Condition<Record<string, any>>[]) { super(); }
    check(bb: Record<string, any>): boolean {
        return this.children.some(c => c.check(bb));
    }
}

export class Not extends Condition<Record<string, any>> {
    constructor(public child: Condition<Record<string, any>>) { super(); }
    check(bb: Record<string, any>): boolean {
        return !this.child.check(bb);
    }
}
