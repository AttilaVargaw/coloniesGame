import { EntityComponent } from "@engine/entities/entityComponent";

export type BuildOrder = {
    id: number
    name: string
    imageUrl: string
    totalDays: number
    remainingDays: number
    oreCost: number
    tyliumCost: number
    creditCost: number
    orePaid: number
    tyliumPaid: number
    creditsPaid: number
}

export class IndustryComponent extends EntityComponent {
    constructor(
        public population: number,
        public happiness: number,
        public laborForce: number,
        public ore: number = 0,
        public tylium: number = 0,
        public credits: number = 0,
        public refineryCapacity: number = 10,
        public taxRate: number = 0.15,
        public civilianAllocation: number = 0.5,
        public militaryAllocation: number = 0.3,
        public buildOrders: BuildOrder[] = [],
        public maintenanceCosts: number = 0,
        public workingPopulationRatio: number = 0.6
    ) {
        super()
    }
}
