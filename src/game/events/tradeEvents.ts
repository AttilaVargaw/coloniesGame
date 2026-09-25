import { EventBase } from "@/engine/lib/events";

export class TradeRouteCreatedEvent extends EventBase<{ routeEntityId: string }> { }
export class TradeRouteCompletedEvent extends EventBase<{ routeEntityId: string }> { }
export class TradeRouteCancelledEvent extends EventBase<{ routeEntityId: string }> { }
