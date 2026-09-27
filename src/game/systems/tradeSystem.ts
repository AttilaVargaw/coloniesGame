import { TradeRouteNode } from "@game/systems/TradeRouteNode";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent } from "@/engine/lib/events";
import { TradeRouteComponent } from "@game/components/tradeRouteComponent";
import { IndustryComponent } from "@game/components/industryComponent";
import { PositionComponent } from "@/engine/components/position";
import { TradeRouteCreatedEvent, TradeRouteCompletedEvent, TradeRouteCancelledEvent } from "@game/events/tradeEvents";
import { CreateTradeRouteCommand } from "@game/commands/createTradeRouteCommand";
import { CancelTradeRouteCommand } from "@game/commands/cancelTradeRouteCommand";
import { Goods } from "@game/data/Goods";
import { v4 as uuid } from "uuid";
import { Queue } from "@/engine/lib/commandQueue";

const TRADE_SPEED = 0.5;

export class TradeSystem extends SystemWithNodes<TradeRouteNode> {
    private tradeRouteCreatedEvents: Queue<TradeRouteCreatedEvent> | null = null
    private tradeRouteCompletedEvents: Queue<TradeRouteCompletedEvent> | null = null
    private tradeRouteCancelledEvents: Queue<TradeRouteCancelledEvent> | null = null

    update(_dt: number): void {
        this.tradeRouteCancelledEvents?.clear()
        this.tradeRouteCompletedEvents?.clear()
        this.tradeRouteCreatedEvents?.clear()
    }

    protected updateNode(_node: TradeRouteNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine?.unregisterNodeType(TradeRouteNode);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        this.engine?.removeCommandQueue(CreateTradeRouteCommand);
        this.engine?.removeCommandQueue(CancelTradeRouteCommand);
        super.removeFromEngine();

        this.tradeRouteCreatedEvents = null;
        this.tradeRouteCompletedEvents = null;
        this.tradeRouteCancelledEvents = null;

        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(
            TradeRouteNode,
            new Set([TradeRouteComponent]),
            (entity) => new TradeRouteNode(entity.getComponent(TradeRouteComponent)!, entity)
        );
        engine.registerEventQueue(TradeRouteCreatedEvent);
        engine.registerEventQueue(TradeRouteCompletedEvent);
        engine.registerEventQueue(TradeRouteCancelledEvent);
        engine.subscribe(DayPassedEvent, this.onDayPassed);
        engine.registerCommandQueue(CreateTradeRouteCommand);
        engine.registerCommandQueue(CancelTradeRouteCommand);

        this.tradeRouteCreatedEvents = engine.getEvents(TradeRouteCreatedEvent);
        this.tradeRouteCompletedEvents = engine.getEvents(TradeRouteCompletedEvent);
        this.tradeRouteCancelledEvents = engine.getEvents(TradeRouteCancelledEvent);

        this.nodes = engine.getNodeList(TradeRouteNode);

        return this;
    }

    private onDayPassed = () => {
        const createCommands = this.engine?.getCommands(CreateTradeRouteCommand);
        if(createCommands) {
            for(const cmd of [...createCommands]) {
                this.handleCreateTradeRoute(cmd);
            }
        }

        const cancelCommands = this.engine?.getCommands(CancelTradeRouteCommand);
        if(cancelCommands) {
            for(const cmd of [...cancelCommands]) {
                this.handleCancelTradeRoute(cmd);
            }
        }

        const routesToRemove: TradeRouteNode[] = [];

        for(const node of this.nodes) {
            node.tradeRoute.travelDaysRemaining -= 1;

            if(node.tradeRoute.travelDaysRemaining <= 0) {
                this.completeTradeRoute(node);
                routesToRemove.push(node);
            }
        }

        for(const node of routesToRemove) {
            this.engine?.removeEntity(node.entity);
        }
    };

    private handleCreateTradeRoute(command: CreateTradeRouteCommand) {
        const { sourceEntityId, destinationEntityId, goods, speed } = command;
        const source = this.engine?.getAllEntities().find(e => e.id === sourceEntityId);
        const destination = this.engine?.getAllEntities().find(e => e.id === destinationEntityId);

        if(!source || !destination) return;

        const sourceIndustry = source.getComponent(IndustryComponent);
        if(!sourceIndustry) return;

        const sourcePos = source.getComponent(PositionComponent);
        const destPos = destination.getComponent(PositionComponent);
        if(!sourcePos || !destPos) return;

        const distance = Math.hypot(destPos.x - sourcePos.x, destPos.y - sourcePos.y);
        const travelDays = Math.max(1, Math.ceil(distance / (speed * TRADE_SPEED)));

        const goodsToTransfer: Partial<Goods> = {};
        for(const key in goods) {
            const amount = goods[key as keyof Goods] as number;
            if(amount > 0) {
                const available = sourceIndustry.goods[key as keyof Goods] ?? 0;
                const transferAmount = Math.min(amount, available);
                if(transferAmount > 0) {
                    goodsToTransfer[key as keyof Goods] = transferAmount;
                    sourceIndustry.goods[key as keyof Goods] = Math.max(0, available - transferAmount);
                }
            }
        }

        if(Object.keys(goodsToTransfer).length === 0) return;

        const routeEntity = this.engine?.createEntity(uuid());
        if(!routeEntity) return;

        routeEntity.addComponent(new TradeRouteComponent(
            sourceEntityId,
            destinationEntityId,
            goodsToTransfer,
            travelDays,
            travelDays,
            speed
        ));

        this.engine?.addEntity(routeEntity);
        this.engine?.dispatchEvent(new TradeRouteCreatedEvent({ routeEntityId: routeEntity.id }));
    }

    private handleCancelTradeRoute(command: CancelTradeRouteCommand) {
        const routeEntity = this.engine?.getAllEntities().find(e => e.id === command.routeEntityId);
        if(!routeEntity) return;

        const route = routeEntity.getComponent(TradeRouteComponent);
        if(!route) return;

        const source = this.engine?.getAllEntities().find(e => e.id === route.sourceEntityId);
        if(source) {
            const sourceIndustry = source.getComponent(IndustryComponent);
            if(sourceIndustry) {
                for(const key in route.goods) {
                    const amount = route.goods[key as keyof Goods] ?? 0;
                    sourceIndustry.goods[key as keyof Goods] = (sourceIndustry.goods[key as keyof Goods] ?? 0) + amount;
                }
            }
        }

        this.engine?.removeEntity(routeEntity);
        this.engine?.dispatchEvent(new TradeRouteCancelledEvent({ routeEntityId: command.routeEntityId }));
    }

    private completeTradeRoute(node: TradeRouteNode) {
        const { destinationEntityId, goods } = node.tradeRoute;
        const destination = this.engine?.getAllEntities().find(e => e.id === destinationEntityId);
        if(!destination) return;

        const destIndustry = destination.getComponent(IndustryComponent);
        if(!destIndustry) return;

        for(const key in goods) {
            const amount = goods[key as keyof Goods] ?? 0;
            destIndustry.goods[key as keyof Goods] = (destIndustry.goods[key as keyof Goods] ?? 0) + amount;
        }

        this.engine?.dispatchEvent(new TradeRouteCompletedEvent({ routeEntityId: node.entity.id }));
    }
}
