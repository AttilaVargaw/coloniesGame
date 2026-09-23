import { CommandBase } from "@/engine/lib/CommandBase";
import type { DebugFlag } from "@/engine/lib/debugManager";

export class DebugToggleCommand extends CommandBase {
    constructor(public data: { flag: DebugFlag }) {
        super()
    }
}
