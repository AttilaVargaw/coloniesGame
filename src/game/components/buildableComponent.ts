import { EntityComponent } from "@engine/entities/entityComponent";
import { SettlementType } from "./industryComponent";


export class BuildableComponent extends EntityComponent {
    constructor(
        public allowedSettlementTypes: SettlementType[] = [],
    ) {
        super();
    }
}
