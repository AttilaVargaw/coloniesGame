import type { Entity } from "./entity";

export class EntityNode {
    constructor(public entity: Entity) { }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EntityNodeConstructor<T extends EntityNode = EntityNode> = new (...args: any[]) => T