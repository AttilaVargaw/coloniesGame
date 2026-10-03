import { Entity } from "../entities/entity";
import { CommandBase } from "./CommandBase";

export class SelectEntityCommand extends CommandBase {
    constructor(public data?: Entity) {
        super()
    }
}