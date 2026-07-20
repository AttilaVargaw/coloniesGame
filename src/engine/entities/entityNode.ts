import type { Entity } from "./entity";

export class EntityNode {
    constructor(public entity?: Entity) { }
}

export type EntityNodeConstructor<T extends EntityNode = EntityNode> = new (...args: any[]) => T