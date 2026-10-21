import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { IndustryUpdatedEvent } from "@/engine/lib/events";
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
        this.engine?.unsubscribe(IndustryUpdatedEvent, this.onIndustryUpdated);
        super.removeFromEngine();
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(IndustryUpdatedEvent, this.onIndustryUpdated);
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }

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

    private hasActiveRoute(sourceId: string, destId: string): boolean {
        if(!this.engine) return false;
        for(const entity of this.engine.getAllEntities()) {
            const route = entity.getComponent(TradeRouteComponent);
            if(!route) continue;
            if(route.sourceEntityId === sourceId && route.destinationEntityId === destId) return true;
        }
        return false;
    }

    private evaluateTradeOpportunities(
        settlements: Settlement[]
    ) {
        if(settlements.length < 2) return;

        const scored = settlements.map(s => {
            const goodsInfo: Record<keyof Goods, { net: number; stock: number; requirements: number }> = {} as any;
            for(const key of physicalGoods) {
                const production = s.goodsProduction[key] ?? 0;
                const requirements = s.goodsRequirements[key] ?? 0;
                goodsInfo[key] = {
                    net: production - requirements,
                    stock: s.goods[key] ?? 0,
                    requirements,
                };
            }
            return { ...s, goodsInfo };
        });

        // Batch all tradeable goods per (source, dest) pair into a single route
        const pairRoutes = new Map<string, { source: Settlement; importer: Settlement; goods: Partial<Goods> }>();

        for(const exporter of scored) {
            if(exporter.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

            for(const importer of scored) {
                if(importer === exporter) continue;
                if(importer.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

                const distance = Math.hypot(
                    importer.position.x - exporter.position.x,
                    importer.position.y - exporter.position.y
                );
                const travelDays = Math.max(1, Math.ceil(distance / (MAX_ROUTE_SPEED * 0.5)));
                if(distance > travelDays * 20) continue;
                if(this.hasActiveRoute(exporter.entityId, importer.entityId)) continue;

                const batch: Partial<Goods> = {};
                let hasAny = false;

        for(const key of physicalGoods) {
            const info = exporter.goodsInfo[key];
            const impInfo = importer.goodsInfo[key];

            if(info.net > MIN_TRADE_AMOUNT && info.stock >= MIN_TRADE_AMOUNT &&
               impInfo.net < -MIN_TRADE_AMOUNT) {

                        const amountNeeded = Math.max(1, Math.floor(-impInfo.net * 1.2));
                        const amount = Math.min(
                            Math.floor(info.net) - MIN_TRADE_AMOUNT,
                            Math.floor(info.stock) - MIN_TRADE_AMOUNT,
                            amountNeeded,
                            Math.max(MIN_TRADE_AMOUNT, Math.floor(info.stock * 0.25))
                        );

                        if(amount >= MIN_TRADE_AMOUNT) {
                            batch[key] = Math.floor(amount);
                            hasAny = true;
                        }
                    }
                }

                if(hasAny) {
                    const routeKey = `${exporter.entityId}->${importer.entityId}`;
                    pairRoutes.set(routeKey, { source: exporter, importer, goods: batch });
                }
            }
        }

        for(const { source, importer, goods } of pairRoutes.values()) {
            if(source.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) break;
            if(importer.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

            this.engine?.addCommand(
                new CreateTradeRouteCommand(
                    source.entityId,
                    importer.entityId,
                    goods,
                    MAX_ROUTE_SPEED
                )
            );

            source.routeCount++;
            importer.routeCount++;
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
