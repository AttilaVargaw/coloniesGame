import { Entity } from "../entities/entity";
import { CommandBase } from "./CommandBase";


export class SelectEntityCommand extends CommandBase<Entity | undefined> {
    constructor(data?: Entity) {
        super(data)
    }
}
