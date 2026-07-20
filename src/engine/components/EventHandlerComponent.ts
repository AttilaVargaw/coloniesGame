import { EntityComponent } from "../entities/entityComponent";


export class EventHandlerComponent extends EntityComponent {
    constructor(public button: string, public fn: (data?: unknown) => void) {
        super();
    }
}
