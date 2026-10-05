import type { Entity } from "../entities/entity";
import { EntityComponent } from "../entities/entityComponent";
import { vec3 } from "gl-matrix";

export interface WorldPosition {
    x: number;
    y: number;
    z: number;
}

export class PositionComponent extends EntityComponent implements WorldPosition {
    private vector: vec3;

    constructor(x: number, y: number, z: number = 0, entity?: Entity) {
        super(entity)
        this.vector = vec3.fromValues(x, y, z)
    }

    get x(): number {
        return this.vector[0]
    }

    set x(value: number) {
        this.vector[0] = value
    }

    get y(): number {
        return this.vector[1]
    }

    set y(value: number) {
        this.vector[1] = value
    }

    get z(): number {
        return this.vector[2]
    }

    set z(value: number) {
        this.vector[2] = value
    }

    getVector(): vec3 {
        return this.vector
    }

    setVector(vector: vec3): void {
        this.vector = vector
    }
}
