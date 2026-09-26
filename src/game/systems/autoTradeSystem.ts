import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent } from "@/engine/lib/events";
import { PositionComponent } from "@/engine/components/position";
import { basePrices, Goods } from "../data/Goods";

const ALL_GOODS = Object.keys(basePrices) as (keyof Goods)[];
import { CreateTradeRouteCommand } from "@game/commands/createTradeRouteCommand";
import { Population } from "../data/Population";
import { TradeRouteComponent } from "@game/components/tradeRouteComponent";

const MIN_TRADE_AMOUNT = 10;
const MAX_AUTO_ROUTES_PER_SETTLEMENT = 5;
const SURPLUS_THRESHOLD_MULTIPLIER = 8;
const DEFICIT_THRESHOLD_MULTIPLIER = 3;
const MAX_ROUTE_SPEED = 2;

export class AutoTradeSystem extends SystemWithNodes<IndustryNode> {
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        super.removeFromEngine();
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(DayPassedEvent, this.onDayPassed);
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }

    private onDayPassed = () => {
        const settlements: Array<{
            entityId: string;
            position: { x: number; y: number };
            goods: Goods;
            population: Population;
            routeCount: number;
        }> = [];

        for (const { entity, industry } of this.nodes) {
            const pos = entity.getComponent(PositionComponent);
            if (!pos) continue;

            const routeCount = this.countActiveRoutes(entity.id);

            settlements.push({
                entityId: entity.id,
                position: { x: pos.x, y: pos.y },
                goods: { ...industry.goods },
                population: { ...industry.population },
                routeCount,
            });
        }

        this.evaluateTradeOpportunities(settlements);
    };

    private countActiveRoutes(entityId: string): number {
        if (!this.engine) return 0;
        let count = 0;
        for (const entity of this.engine.getAllEntities()) {
            const route = entity.getComponent(TradeRouteComponent);
            if (route && route.sourceEntityId === entityId) {
                count++;
            }
        }
        return count;
    }

    private evaluateTradeOpportunities(
        settlements: Array<{
            entityId: string;
            position: { x: number; y: number };
            goods: Goods;
            population: Population;
            routeCount: number;
        }>
    ) {
        if (settlements.length < 2) return;

        const totalPopulation = settlements.reduce(
            (sum, s) => sum + Object.values(s.population).reduce((p, c) => p + c.number, 0),
            0
        );

        for (const key of ALL_GOODS) {
            const scored = settlements.map(s => {
                const pop = Object.values(s.population).reduce((sum, c) => sum + c.number, 0);
                const baseline = Math.max(pop * SURPLUS_THRESHOLD_MULTIPLIER, totalPopulation * 0.5);
                const deficitLine = Math.max(pop * DEFICIT_THRESHOLD_MULTIPLIER, totalPopulation * 0.1);
                const amount = s.goods[key] ?? 0;

                let score = 0;
                if (amount > baseline) {
                    score = (amount - baseline) / baseline;
                } else if (amount < deficitLine) {
                    score = -((deficitLine - amount) / deficitLine);
                }

                return { ...s, goodKey: key, score, amount };
            });

            const exporters = scored.filter(s => s.score > 0 && s.amount >= MIN_TRADE_AMOUNT);
            const importers = scored.filter(s => s.score < 0);

            exporters.sort((a, b) => b.score - a.score);
            importers.sort((a, b) => a.score - b.score);

            for (const exporter of exporters) {
                if (exporter.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

                for (const importer of importers) {
                    if (importer.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) continue;

                    const distance = Math.hypot(
                        importer.position.x - exporter.position.x,
                        importer.position.y - exporter.position.y
                    );

                    const travelDays = Math.max(1, Math.ceil(distance / (MAX_ROUTE_SPEED * 0.5)));
                    const tradeValue = Math.min(
                        exporter.amount - MIN_TRADE_AMOUNT,
                        Math.max(0, -importer.score * (importer.goods[key as keyof Goods] ?? 0) + MIN_TRADE_AMOUNT)
                    );

                    if (tradeValue < MIN_TRADE_AMOUNT) continue;
                    if (distance > travelDays * 10) continue;

                    const amount = Math.min(tradeValue, exporter.goods[key as keyof Goods] ?? 0);

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

                    if (exporter.routeCount >= MAX_AUTO_ROUTES_PER_SETTLEMENT) break;
                }
            }
        }
    }
}
