import { RouteSystem } from "./RouteSystem";
import { TradeRouteNode } from "./TradeRouteNode";
import { TradeRouteComponent } from "@game/components/tradeRouteComponent";
import { IndustryComponent } from "@game/components/industryComponent";
import { TradeRouteCreatedEvent, TradeRouteCompletedEvent, TradeRouteCancelledEvent } from "@game/events/tradeEvents";
import { CreateTradeRouteCommand } from "@game/commands/createTradeRouteCommand";
import { CancelTradeRouteCommand } from "@game/commands/cancelTradeRouteCommand";
import { Goods } from "@game/data/Goods";
import { Entity } from "@/engine/entities/entity";
import { CommandBase } from "@/engine/lib/CommandBase";
import { Condition, Sequence } from "./sectorBehaviorTree/bt";

class SourceHasIndustry extends Condition {
    constructor(private source: Entity) { super(); }
    check(): boolean {
        return !!this.source.getComponent(IndustryComponent);
    }
}

export class TradeSystem extends RouteSystem<TradeRouteNode> {
    protected readonly nodeConstructor = TradeRouteNode;
    protected readonly componentConstructor = TradeRouteComponent;

    protected readonly createdEventClass = TradeRouteCreatedEvent;
    protected readonly completedEventClass = TradeRouteCompletedEvent;
    protected readonly cancelledEventClass = TradeRouteCancelledEvent;

    protected readonly createCommandClass = CreateTradeRouteCommand;
    protected readonly cancelCommandClass = CancelTradeRouteCommand;

    protected getRouteComponent(node: TradeRouteNode): TradeRouteComponent {
        return node.tradeRoute;
    }

    protected createRouteComponent(
        sourceEntityId: string,
        destinationEntityId: string,
        payload: unknown,
        travelDays: number,
        speed: number,
    ): TradeRouteComponent {
        const goods = payload as Partial<Goods>;
        return new TradeRouteComponent(sourceEntityId, destinationEntityId, goods, travelDays, travelDays, speed);
    }

    protected validateCreate(source: Entity): boolean {
        const bb = {} as any;
        const tree = new Sequence([
            new SourceHasIndustry(source),
        ]);
        return tree.tick(bb) === "SUCCESS";
    }

    protected prepareSource(source: Entity, command: CommandBase): Partial<Goods> | null {
        const { goods } = command as { goods: Partial<Goods>; speed?: number };
        const sourceIndustry = source.getComponent(IndustryComponent);
        if(!sourceIndustry) return null;

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

        if(Object.keys(goodsToTransfer).length === 0) return null;
        return goodsToTransfer;
    }

    protected refundSource(source: Entity, route: TradeRouteComponent): void {
        const sourceIndustry = source.getComponent(IndustryComponent);
        if(!sourceIndustry) return;

        for(const key in route.goods) {
            const amount = route.goods[key as keyof Goods] ?? 0;
            sourceIndustry.goods[key as keyof Goods] = (sourceIndustry.goods[key as keyof Goods] ?? 0) + amount;
        }
    }

    protected deliverDestination(destination: Entity, route: TradeRouteComponent): void {
        const destIndustry = destination.getComponent(IndustryComponent);
        if(!destIndustry) return;

        for(const key in route.goods) {
            const amount = route.goods[key as keyof Goods] ?? 0;
            destIndustry.goods[key as keyof Goods] = (destIndustry.goods[key as keyof Goods] ?? 0) + amount;
        }
    }
}
