import { CommandBase } from "@/engine/lib/CommandBase";
import { IndustrialSectors } from "../components/Factories";

export class UpgradeSectorCommand extends CommandBase {
    constructor(
        public entityId: string,
        public sectorName: keyof IndustrialSectors
    ) {
        super()
    }
}