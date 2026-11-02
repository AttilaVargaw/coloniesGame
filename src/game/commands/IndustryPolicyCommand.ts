import { CommandBase } from "@/engine/lib/CommandBase";
import type { IndustrialSectors } from "../components/Factories";

export class EnactLawCommand extends CommandBase {
    constructor(
        public entityId: string,
        public lawId: string,
    ) {
        super()
    }
}

export class RepealLawCommand extends CommandBase {
    constructor(
        public entityId: string,
        public lawId: string,
    ) {
        super()
    }
}

export class SelectProductionMethodCommand extends CommandBase {
    constructor(
        public entityId: string,
        public sector: keyof IndustrialSectors,
        public methodId: string | null,
    ) {
        super()
    }
}

export class AllocateBudgetCommand extends CommandBase {
    constructor(
        public entityId: string,
        public sector: keyof IndustrialSectors,
        public amount: number,
    ) {
        super()
    }
}
