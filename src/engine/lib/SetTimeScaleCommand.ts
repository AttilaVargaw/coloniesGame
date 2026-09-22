import { CommandBase } from "@/engine/lib/CommandBase";

export class SetTimeScaleCommand extends CommandBase {
    constructor(public multiplier: number) {
        super();
    }
}
