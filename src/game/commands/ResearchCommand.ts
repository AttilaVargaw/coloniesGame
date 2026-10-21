import { CommandBase } from "@/engine/lib/CommandBase";

export class ResearchCommand extends CommandBase {
    constructor(
        public entityId: string,
        public techId: string,
    ) {
        super()
    }
}

export class CancelResearchCommand extends CommandBase {
    constructor(
        public entityId: string,
    ) {
        super()
    }
}
