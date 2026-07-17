import { EntityComponent } from "../entities/entityComponent";
import { ColorComponent } from "./colorComponent";
export class LabelComponent extends EntityComponent {
    constructor(public text: string, public color: ColorComponent, public size: number) {
        super();
    }
}