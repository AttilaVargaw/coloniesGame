import { EntityComponent } from "../entities/entityComponent";

export class InfoComponent extends EntityComponent {
        constructor(public info: Record<string, string>) {
            super()
        }
}