import { EventBase } from "@/engine/lib/events";

export class MigrationRouteCreatedEvent extends EventBase<{ routeEntityId: string }> {
}

export class MigrationRouteCompletedEvent extends EventBase<{ routeEntityId: string }> {
}

export class MigrationRouteCancelledEvent extends EventBase<{ routeEntityId: string }> {
}
