import { EventBase } from "@/engine/lib/events";

export class MigrationRouteCreatedEvent extends EventBase<{ routeEntityId: string }> {
    constructor(data: { routeEntityId: string }) {
        super(data);
    }
}

export class MigrationRouteCompletedEvent extends EventBase<{ routeEntityId: string }> {
    constructor(data: { routeEntityId: string }) {
        super(data);
    }
}

export class MigrationRouteCancelledEvent extends EventBase<{ routeEntityId: string }> {
}
