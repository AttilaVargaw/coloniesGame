import { EntityComponent } from "../entities/entityComponent";
import { WorldPosition } from "./position";
export class LabelComponent extends EntityComponent {
    constructor(public text: string, public size: number, public offset: WorldPosition, public color: string) {
        super();
    }
}