import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { PositionComponent } from "@/engine/components/position";
import { Goods, physicalGoods } from "../data/Goods";
import { CreateTradeRouteCommand } from "@game/commands/createTradeRouteCommand";
import { Population } from "../data/Population";
import { TradeRouteComponent } from "@game/components/tradeRouteComponent";
import { CreateMigrationRouteCommand } from "@game/commands/createMigrationRouteCommand";

const MIN_TRADE_AMOUNT = 1;
const MAX_AUTO_ROUTES_PER_SETTLEMENT = 10;
const MAX_ROUTE_SPEED = 20;
const MIGRATION_SURPLUS_FACTOR = 1.5;
const MIGRATION_DEFICIT_FACTOR = 0.75;

type Settlement = {
    entityId: string;
    position: { x: number; y: number };
    goods: Goods;
    goodsProduction: Partial<Goods>;
    goodsRequirements: Partial<Goods>;
    population: Population;
    routeCount: number;
};

export class AutoTradeSystem extends SystemWithNodes<IndustryNode> {
    // eslint-disable-next-line class-methods-use-this,no-empty-function
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        this.engine?.unsubscribe(IndustryUpdatedEvent, this.onIndustryUpdated);
        super.removeFromEngine();
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(DayPassedEvent, this.onDayPassed);
        engine.subscribe(IndustryUpdatedEvent, this.onIndustryUpdated);
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }

    private onDayPassed = () => {
        this.evaluate();
    };

    private onIndustryUpdated = () => {
        this.evaluate();
    };

    private evaluate = () => {
        const settlements: Settlement[] = [];

        for(const { entity, industry } of this.nodes) {
            const pos = entity.getComponent(PositionComponent);
            if(!pos) continue;

            const routeCount = this.countActiveRoutes(entity.id);

            settlements.push({
                entityId: entity.id,
                position: { x: pos.x, y: pos.y },
                goods: industry.goods,
                goodsProduction: industry.goodsProduction,
                goodsRequirements: industry.goodsRequirements,
                population: industry.population,
                routeCount,
            });
        }

        this.evaluateTradeOpportunities(settlements);
        this.evaluateMigrationOpportunities(settlements);
    };

    private countActiveRoutes(entityId: string): number {
        if(!this.engine) return 0;
        let count = 0;
        for(const entity of this.engine.getAllEntities()) {
            const route = entity.getComponent(TradeRouteComponent);
            if(route && route.sourceEntityId === entityId) {
                count++;
            }
        }
        return count;
    }

    private hasActiveRoute(sourceId: string, destId: string, goodKey: keyof Goods): boolean {
        if(!this.engine) return false;
        for(const entity of this.engine.getAllEntities()) {
            const route = entity.getComponent(TradeRouteComponent);
            if(!route) continue;
            if(route.sourceEntityId !== sourceId || route.destinationEntityId !== destId) continue;
            if(goodKey in route.goods) return true;
        }
        return false;
    }

    private evaluateTradeOpportunities(
        settlements: Settlement[]
    ) {
        if(settlements.length < 2) return;

        for(const key of physicalGoods) {
            const scored = settlements.map(s => {
                const production = s.goodsProduction[key as keyof Goods] ?? 0;
                const requirements = s.goodsRequirements[key as keyof Goods] ?? 0;
                const net = production - requirements;
                const stock = s.goods[key] ?? 0;

                return { ...s, goodKey: key, net, stock, requirements };
            });

            const exporters = scored.filter(s => s.net > MIN_TRADE_AMOUNT && s.stock >= MIN_TRADE_AMOUNT);
            const importers = scored.filter(s => s.net < -MIN_TRADE_AMOUNT && s.stock < s.requirements * 0.5);

            exporters.sort((a, b) => b.net - a.net);
            importers.sort((a, b) => a.net - b.net);

            for(const exporter of exporters) {
                if(exporter.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

                for(const importer of importers) {
                    if(importer.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

                    const distance = Math.hypot(
                        importer.position.x - exporter.position.x,
                        importer.position.y - exporter.position.y
                    );

                    const travelDays = Math.max(1, Math.ceil(distance / (MAX_ROUTE_SPEED * 0.5)));
                    if(distance > travelDays * 20) continue;

                    const amountNeeded = Math.max(1, Math.floor(-importer.net * 1.2));
                    const amount = Math.min(
                        Math.floor(exporter.net) - MIN_TRADE_AMOUNT,
                        Math.floor(exporter.stock) - MIN_TRADE_AMOUNT,
                        amountNeeded,
                        Math.max(MIN_TRADE_AMOUNT, Math.floor(exporter.stock * 0.25))
                    );

                    if(amount < MIN_TRADE_AMOUNT) continue;

                    if(this.hasActiveRoute(exporter.entityId, importer.entityId, key as keyof Goods)) continue;

                    this.engine?.addCommand(
                        new CreateTradeRouteCommand(
                            exporter.entityId,
                            importer.entityId,
                            { [key]: Math.floor(amount) },
                            MAX_ROUTE_SPEED
                        )
                    );

                    exporter.routeCount++;
                    importer.routeCount++;

                    if(exporter.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) break;
                }
            }
        }
    }

    private evaluateMigrationOpportunities(
        settlements: Settlement[]
    ) {
        if(settlements.length < 2) return;

        const populations = settlements.map(s => ({
            entityId: s.entityId,
            position: s.position,
            totalPop: Object.values(s.population).reduce((sum, c) => sum + c.number, 0),
            routeCount: s.routeCount,
            freeWorkers: s.population.worker.number,
        }));

        const avgPop = populations.reduce((sum, p) => sum + p.totalPop, 0) / populations.length;

        const surplus = populations.filter(p => p.totalPop > avgPop * MIGRATION_SURPLUS_FACTOR && p.freeWorkers > 0);
        const deficit = populations.filter(p => p.totalPop < avgPop * MIGRATION_DEFICIT_FACTOR);

        surplus.sort((a, b) => b.totalPop - a.totalPop);
        deficit.sort((a, b) => a.totalPop - b.totalPop);

        for(const source of surplus) {
            if(source.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

            for(const dest of deficit) {
                if(dest.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

                const distance = Math.hypot(dest.position.x - source.position.x, dest.position.y - source.position.y);
                const travelDays = Math.max(1, Math.ceil(distance / (MAX_ROUTE_SPEED * 0.5)));
                const workerCount = Math.min(source.freeWorkers, Math.max(1, Math.floor(source.freeWorkers * 0.1)));

                if(workerCount <= 0) continue;
                if(distance > travelDays * 10) continue;

                this.engine?.addCommand(
                    new CreateMigrationRouteCommand(
                        source.entityId,
                        dest.entityId,
                        workerCount,
                        MAX_ROUTE_SPEED
                    )
                );

                source.routeCount++;
                dest.routeCount++;

                if(source.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) break;
            }
        }
    }
}
