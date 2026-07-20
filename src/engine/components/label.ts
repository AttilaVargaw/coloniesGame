import { EntityComponent } from "../entities/entityComponent";
export class LabelComponent extends EntityComponent {
    constructor(public text: string, public size: number) {
        super();
    }
}