import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { PositionComponent } from "@/engine/components/position";
import { Goods, physicalGoods } from "../data/Goods";
import { Population } from "../data/Population";
import { TradeRouteNode } from "./TradeRouteNode";
import { MigrationRouteNode } from "./MigrationRouteNode";
import {
    SourceHasRouteCapacity,
    DestHasRouteCapacity,
    RouteDoesNotExist,
    ValidTradeDistance,
    MigrationDestFree,
} from "./autoTradeBehaviorTree/autoTradeConditions";
import {
    CreateTradeRouteAction,
    CreateMigrationRouteAction,
} from "./autoTradeBehaviorTree/autoTradeActions";
import { Sequence } from "./sectorBehaviorTree/bt";

const MIN_TRADE_AMOUNT = 1;
const MAX_AUTO_ROUTES_PER_SETTLEMENT = 10;
const MAX_ROUTE_SPEED = 20;
const MIGRATION_SURPLUS_FACTOR = 1.5;
const MIGRATION_DEFICIT_FACTOR = 0.75;
const WAGE_MIGRATION_THRESHOLD = 1.1;
const MAX_MIGRATION_RATIO = 0.2;

type Settlement = {
    entityId: string;
    position: { x: number; y: number };
    goods: Goods;
    goodsProduction: Partial<Goods>;
    goodsRequirements: Partial<Goods>;
    population: Population;
    wages: Record<keyof Population, number>;
    routeCount: number;
    hasIncomingMigration: boolean;
};

const exportableGoods = new Set<keyof Goods>([...physicalGoods, "tourism"]);

export class AutoTradeSystem extends SystemWithNodes<IndustryNode> {
    private dirty = false;
    private flushScheduled = false;

    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unsubscribe(IndustryUpdatedEvent, this.onIndustryUpdated);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        super.removeFromEngine();
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(IndustryUpdatedEvent, this.onIndustryUpdated);
        engine.subscribe(DayPassedEvent, this.onDayPassed);
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }

    private onIndustryUpdated = () => {
        this.dirty = true;
        this.scheduleFlush();
    };

    private onDayPassed = () => {
        this.dirty = true;
        this.scheduleFlush();
    };

    private scheduleFlush = () => {
        if(this.flushScheduled) return;
        this.flushScheduled = true;
        queueMicrotask(() => {
            this.flushScheduled = false;
            if(this.dirty) {
                this.dirty = false;
                this.evaluate();
            }
        });
    };

    private evaluate = () => {
        const routeCounts = new Map<string, number>();
        const activeRoutes = new Set<string>();
        const incomingMigrationDestinations = new Set<string>();
        if(this.engine) {
            for(const { tradeRoute } of this.engine.getNodeList(TradeRouteNode)) {
                routeCounts.set(tradeRoute.sourceEntityId, (routeCounts.get(tradeRoute.sourceEntityId) ?? 0) + 1);
                activeRoutes.add(`${tradeRoute.sourceEntityId}->${tradeRoute.destinationEntityId}`);
            }
            for(const { migrationRoute } of this.engine.getNodeList(MigrationRouteNode)) {
                incomingMigrationDestinations.add(migrationRoute.destinationEntityId);
            }
        }

        const settlements: Settlement[] = [];

        for(const { entity, industry } of this.nodes) {
            const pos = entity.getComponent(PositionComponent);
            if(!pos) continue;

            settlements.push({
                entityId: entity.id,
                position: { x: pos.x, y: pos.y },
                goods: industry.goods,
                goodsProduction: industry.goodsProduction,
                goodsRequirements: industry.goodsRequirements,
                population: industry.population,
                wages: industry.wages,
                routeCount: routeCounts.get(entity.id) ?? 0,
                hasIncomingMigration: incomingMigrationDestinations.has(entity.id),
            });
        }

        this.evaluateTradeOpportunities(settlements, activeRoutes);
        this.evaluateMigrationOpportunities(settlements);
    };

    private evaluateTradeOpportunities(
        settlements: Settlement[],
        activeRoutes: Set<string>,
    ) {
        if(settlements.length < 2) return;

        const scored = settlements.map(s => {
            const goodsInfo: Record<keyof Goods, { net: number; stock: number; requirements: number }> = {} as any;
            for(const key of exportableGoods) {
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

        const pairRoutes = new Map<string, {
            source: typeof scored[0];
            importer: typeof scored[0];
            goods: Partial<Goods>;
        }>();

        for(const exporter of scored) {
            for(const importer of scored) {
                if(importer === exporter) continue;

                const distance = Math.hypot(
                    importer.position.x - exporter.position.x,
                    importer.position.y - exporter.position.y
                );
                const travelDays = Math.max(1, Math.ceil(distance / (MAX_ROUTE_SPEED * 0.5)));
                if(distance > travelDays * 20) continue;

                const batch: Partial<Goods> = {};
                let hasAny = false;

                for(const key of exportableGoods) {
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

            // Behavior tree decision: should we create this trade route?
            const bb = {
                settlements,
                activeRoutes,
                incomingMigrationDestinations: new Set(),
                engine: this.engine,
                pairRoutes: new Map(),
                decisions: [],
            };

            const tree = new Sequence([
                new SourceHasRouteCapacity(source.entityId),
                new DestHasRouteCapacity(importer.entityId),
                new RouteDoesNotExist(source.entityId, importer.entityId),
                new ValidTradeDistance(source.entityId, importer.entityId),
                new CreateTradeRouteAction(source.entityId, importer.entityId, goods as Record<string, number>),
            ]);

            const status = tree.tick(bb);
            if(status === "SUCCESS") {
                source.routeCount++;
                importer.routeCount++;
                activeRoutes.add(`${source.entityId}->${importer.entityId}`);
            }
        }
    }

    private evaluateMigrationOpportunities(
        settlements: Settlement[],
    ) {
        if(settlements.length < 2) return;

        const populations = settlements.map(s => ({
            entityId: s.entityId,
            position: s.position,
            totalPop: Object.values(s.population).reduce((sum, c) => sum + c.number, 0),
            routeCount: s.routeCount,
            freeWorkers: s.population.worker.number,
            workerWage: s.wages.worker,
            hasIncomingMigration: s.hasIncomingMigration,
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
                if(dest.hasIncomingMigration) continue;

                // Wage-driven: only migrate if destination pays better
                if(dest.workerWage <= source.workerWage * WAGE_MIGRATION_THRESHOLD) continue;

                const distance = Math.hypot(dest.position.x - source.position.x, dest.position.y - source.position.y);
                const travelDays = Math.max(1, Math.ceil(distance / (MAX_ROUTE_SPEED * 0.5)));

                const wageRatio = dest.workerWage / source.workerWage;
                const wageFactor = Math.min(wageRatio - 1, MAX_MIGRATION_RATIO);
                const workerCount = Math.min(
                    source.freeWorkers,
                    Math.max(1, Math.floor(source.freeWorkers * wageFactor))
                );

                if(workerCount <= 0) continue;
                if(distance > travelDays * 10) continue;

                // Behavior tree decision: should we create this migration route?
                const bb = {
                    settlements: [],
                    activeRoutes: new Set(),
                    incomingMigrationDestinations: new Set(),
                    engine: this.engine,
                    pairRoutes: new Map(),
                    decisions: [],
                };

                const tree = new Sequence([
                    new SourceHasRouteCapacity(source.entityId),
                    new DestHasRouteCapacity(dest.entityId),
                    new MigrationDestFree(dest.entityId),
                    new CreateMigrationRouteAction(source.entityId, dest.entityId, workerCount),
                ]);

                const status = tree.tick(bb);
                if(status === "SUCCESS") {
                    source.routeCount++;
                    dest.routeCount++;
                }

                if(source.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) break;
            }
        }
    }
}
