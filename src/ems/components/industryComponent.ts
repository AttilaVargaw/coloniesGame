
import { EntityComponent } from "../entities/entityComponent";

export class IndustryComponent extends EntityComponent {
    constructor(public population: number, public happiness: number, public production: number, public consumerGoodsRatio: number) {
        super()
    }
}