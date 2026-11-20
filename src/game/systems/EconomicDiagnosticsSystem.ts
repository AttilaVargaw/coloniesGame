import { System } from "@engine/systems/system";
import { Engine } from "@engine/core/engine";
import { IndustryTickCompletedEvent, IndustryTickCompletedData } from "@/engine/lib/events/IndustryTickCompletedEvent";
import { MarketMetricsSnapshot, GoodMarketMetrics, IndustrySectorMetrics, HouseholdCategoryMetrics, TreasuryMetrics, ProductionDependencyExposure } from "@game/economics/diagnostics/economicHealthMetrics";
import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import { basePrices } from "@game/data/Goods";

function safeDivide(numerator: number, denominator: number): number | null {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    if (denominator === 0) return null;
    return numerator / denominator;
}

function safeRatio(numerator: number, denominator: number): number | null {
    const result = safeDivide(numerator, denominator);
    if (result === null) return null;
    return Math.max(0, result);
}

function getGoodValue(obj: Partial<Goods> | Record<string, number>, good: keyof Goods): number {
    return (obj[good] ?? 0) as number;
}

export class EconomicDiagnosticsSystem extends System {
    private diagnostics: ReturnType<Engine["getEconomicDiagnostics"]> | null = null;

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        this.diagnostics = engine.getEconomicDiagnostics();
        engine.subscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        return this;
    }

    removeFromEngine(): this {
        if (this.engine) {
            this.engine.unsubscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        }
        return super.removeFromEngine();
    }

    private handleTickCompleted = (data: IndustryTickCompletedData) => {
        if (!this.diagnostics) return;
        
        const { health, market: marketAnalyzer, industry: industryAnalyzer, household: householdAnalyzer, cascade: cascadeAnalyzer } = this.diagnostics;
        const entityId = data.entity.id;
        const tick = data.tick;
        const metrics = data.metrics;

        // Record market metrics
        const marketSnapshot = this.createMarketSnapshot(tick, entityId, metrics);
        health.recordMarketMetrics(marketSnapshot);

        // Record price snapshot
        const prices = this.extractPrices(metrics);
        health.recordPriceSnapshot(entityId, prices, basePrices);

        // Record industry metrics
        const industryMetrics = this.createIndustryMetrics(tick, metrics);
        health.recordIndustryMetrics(entityId, industryMetrics);

        // Record household metrics
        const householdMetrics = this.createHouseholdMetrics(tick, metrics, prices);
        health.recordHouseholdMetrics(entityId, householdMetrics);

        // Record treasury metrics
        const treasuryMetrics = this.createTreasuryMetrics(tick, entityId, metrics);
        health.recordTreasuryMetrics(treasuryMetrics);

        // Record dependency exposure
        const dependencyExposure = this.createDependencyExposure(tick, entityId, metrics);
        health.recordDependencyExposure(dependencyExposure);

        // Trigger analyzers to analyze
        if (marketAnalyzer) marketAnalyzer.analyze(tick, entityId);
        if (industryAnalyzer) industryAnalyzer.analyze(tick, entityId);
        if (householdAnalyzer) householdAnalyzer.analyze(tick, entityId);
        if (cascadeAnalyzer) cascadeAnalyzer.analyze(tick, entityId);
    };

    private createMarketSnapshot(tick: number, entityId: string, metrics: IndustryTickCompletedData["metrics"]): MarketMetricsSnapshot {
        const goods: Partial<Record<keyof Goods, GoodMarketMetrics>> = {};

        // Extract market data from accounting
        const householdSales = metrics.accounting.householdSalesByGood ?? {};
        const capitalPurchases = metrics.accounting.capitalPurchasesByGood ?? {};
        const sectorProductionSales = metrics.accounting.sectorProductionSalesByGood ?? {};
        const sectorInputsConsumed = metrics.accounting.sectorInputsConsumedByGood ?? {};
        const sectorProduction = metrics.accounting.sectorProductionByGood ?? {};

        // Calculate opening inventory from goods production and sales
        const allGoods = new Set([
            ...Object.keys(metrics.goodsProduction),
            ...Object.keys(householdSales),
            ...Object.keys(capitalPurchases),
            ...Object.keys(sectorProductionSales),
            ...Object.keys(sectorInputsConsumed),
            ...Object.keys(sectorProduction),
        ]);

        for (const goodKey of allGoods) {
            const good = goodKey as keyof Goods;
            
            const productionAvailable = getGoodValue(metrics.goodsProduction, good);
            const householdDemand = getGoodValue(householdSales, good);
            const capitalDemand = getGoodValue(capitalPurchases, good);
            const sectorDemand = getGoodValue(sectorInputsConsumed, good);
            
            const desiredDemand = householdDemand + capitalDemand + sectorDemand;
            const fulfilledDemand = getGoodValue(householdSales, good) + getGoodValue(capitalPurchases, good) + getGoodValue(sectorInputsConsumed, good);
            const unmetDemand = Math.max(0, desiredDemand - fulfilledDemand);
            const availableSupply = productionAvailable + getGoodValue(sectorProduction, good);
            
            const supplyDemandRatio = desiredDemand > 0 ? availableSupply / desiredDemand : 1;
            const shortageRatio = desiredDemand > 0 ? unmetDemand / desiredDemand : null;
            const surplusRatio = desiredDemand > 0 && availableSupply > desiredDemand ? (availableSupply - desiredDemand) / desiredDemand : null;
            
            const openingPrice = basePrices[good] ?? 1;
            const closingPrice = openingPrice;

            goods[good] = {
                good,
                openingPrice,
                closingPrice,
                openingInventory: 0,
                productionAvailable,
                availableSupply,
                desiredDemand,
                fulfilledDemand,
                unmetDemand,
                supplyDemandRatio,
                shortageRatio,
                surplusRatio,
                imbalance: supplyDemandRatio - 1,
                tradedQuantity: fulfilledDemand,
            };
        }

        return {
            tick,
            entityId,
            goods,
        };
    }

    private extractPrices(_metrics: IndustryTickCompletedData["metrics"]): Partial<Record<keyof Goods, number>> {
        // Prices would come from MarketPriceSystem, but we can use base prices as fallback
        // The actual prices will be recorded when MarketPriceSystem processes the tick
        return {};
    }

    private createIndustryMetrics(tick: number, metrics: IndustryTickCompletedData["metrics"]): IndustrySectorMetrics[] {
        const result: IndustrySectorMetrics[] = [];

        for (const [sectorId, sectorResult] of Object.entries(metrics.sectorResults)) {
            // Revenue per sector not directly available in metrics, use 0 for now
            // Could be computed from sector production output * prices if prices were available
            const revenue = 0;
            
            const inputCosts = metrics.sectorInputCosts[sectorId] ?? 0;
            const laborCosts = metrics.sectorLaborCosts[sectorId] ?? 0;
            const subsidies = metrics.accounting.treasurySubsidiesPaid[sectorId] ?? 0;
            const utilization = metrics.sectorUtilization[sectorId] ?? 0;
            
            const productionOutput = (metrics.accounting.sectorProductionByGood as Record<string, Partial<Goods>> | undefined)?.[sectorId] ?? {};
            const inputAvailability = this.calculateInputAvailability(sectorId, metrics);
            const laborAvailability = this.calculateLaborAvailability(sectorId, metrics);
            
            // Determine stop reason from sector result
            const stopReason = sectorResult.productionRatio === 0 ? "No production (inputs unavailable or no demand)" : null;
            const consecutiveStoppedTicks = sectorResult.productionRatio === 0 ? 1 : 0; // Simplified - would need history tracking

            result.push({
                sectorId,
                tick,
                revenue,
                inputCosts,
                laborCosts,
                subsidies,
                operatingResultPreSubsidy: revenue - inputCosts - laborCosts,
                operatingResultPostSubsidy: revenue - inputCosts - laborCosts + subsidies,
                profitMarginPreSubsidy: revenue > 0 ? safeDivide(revenue - inputCosts - laborCosts, revenue) : null,
                profitMarginPostSubsidy: revenue > 0 ? safeDivide(revenue - inputCosts - laborCosts + subsidies, revenue) : null,
                utilization,
                productionOutput,
                inputAvailability,
                laborAvailability,
                stopReason,
                consecutiveStoppedTicks,
            });
        }

        return result;
    }

    private calculateInputAvailability(sectorId: string, metrics: IndustryTickCompletedData["metrics"]): Partial<Record<keyof Goods, number>> {
        const result: Partial<Record<keyof Goods, number>> = {};
        const sectorInputs = metrics.accounting.sectorInputsPurchasedBySector[sectorId] ?? {};
        const sectorConsumed = metrics.accounting.sectorInputsConsumedBySector[sectorId] ?? {};
        
        for (const [good, purchased] of Object.entries(sectorInputs as Record<string, number>)) {
            const consumed = (sectorConsumed as Record<string, number>)[good] ?? 0;
            const purchasedNum = purchased as number;
            if (purchasedNum > 0) {
                result[good as keyof Goods] = safeRatio(consumed, purchasedNum) ?? 1;
            }
        }
        return result;
    }

    private calculateLaborAvailability(_sectorId: string, _metrics: IndustryTickCompletedData["metrics"]): Partial<Record<keyof Population, number>> {
        // This would need more detailed data from the worker
        // For now, return empty - can be enhanced later
        return {};
    }

    private createHouseholdMetrics(tick: number, metrics: IndustryTickCompletedData["metrics"], prices: Partial<Record<keyof Goods, number>>): HouseholdCategoryMetrics[] {
        const result: HouseholdCategoryMetrics[] = [];
        
        const populationUpdates = metrics.populationUpdates ?? {};
        
        for (const [categoryKey, popUpdate] of Object.entries(populationUpdates)) {
            const category = categoryKey as keyof Population;
            
            const wages = metrics.accounting.wagesByPop[category] ?? 0;
            const spending = metrics.accounting.spendingByPop[category] ?? 0;
            const cashWealth = popUpdate.wealth;
            
            // Desired consumption from household demand (approximated)
            const desiredConsumption: Partial<Record<keyof Goods, number>> = {};
            const fulfilledConsumption: Partial<Record<keyof Goods, number>> = {};
            
            for (const [good, sold] of Object.entries(metrics.accounting.householdSalesByGood as Record<string, number> ?? {})) {
                fulfilledConsumption[good as keyof Goods] = sold as number;
                desiredConsumption[good as keyof Goods] = sold as number;
            }

            const getPrice = (good: keyof Goods) => prices[good] ?? basePrices[good] ?? 1;
            
            const totalDesiredValue = Object.entries(desiredConsumption).reduce((sum, [good, qty]) => {
                return sum + qty * getPrice(good as keyof Goods);
            }, 0);
            
            const totalFulfilledValue = Object.entries(fulfilledConsumption).reduce((sum, [good, qty]) => {
                return sum + qty * getPrice(good as keyof Goods);
            }, 0);

            const consumptionFulfillmentRatio = totalDesiredValue > 0 ? totalFulfilledValue / totalDesiredValue : null;
            
            const affordableConsumption: Partial<Record<keyof Goods, number>> = {};
            const budget = cashWealth + wages;
            for (const [good, desired] of Object.entries(desiredConsumption)) {
                const price = getPrice(good as keyof Goods);
                affordableConsumption[good as keyof Goods] = budget > 0 ? Math.min(desired, budget / Math.max(price, 1)) : 0;
            }
            
            const purchasingPower = totalDesiredValue > 0 ? budget / totalDesiredValue : null;

            result.push({
                category,
                tick,
                population: popUpdate.number,
                cashWealth,
                wageIncome: wages,
                actualSpending: spending,
                desiredConsumption,
                affordableConsumption,
                fulfilledConsumption,
                consumptionFulfillmentRatio,
                qol: popUpdate.qol,
                expectedQol: popUpdate.expectedQol,
                purchasingPower,
            });
        }

        return result;
    }

    private createTreasuryMetrics(tick: number, entityId: string, metrics: IndustryTickCompletedData["metrics"]): TreasuryMetrics {
        const subsidyOutflowRate = Object.values(metrics.accounting.treasurySubsidiesPaid ?? {}).reduce((sum, v) => sum + v, 0);
        
        // Use actual computed treasury data from worker
        const inflowRate = metrics.treasuryRevenue ?? 0;
        const otherOutflowRate = (metrics.treasuryExpenditure ?? 0) - (metrics.accounting.treasurySubsidiesPaid ? Object.values(metrics.accounting.treasurySubsidiesPaid).reduce((sum, v) => sum + v, 0) : 0);
        
        const balance = metrics.colonyTreasury ?? 0;

        return {
            tick,
            entityId,
            balance,
            subsidyOutflowRate,
            otherOutflowRate: Math.max(0, otherOutflowRate),
            inflowRate,
            runway: (subsidyOutflowRate + otherOutflowRate) > 0 && balance > 0 
                ? balance / (subsidyOutflowRate + otherOutflowRate) 
                : null,
        };
    }

    private createDependencyExposure(tick: number, entityId: string, metrics: IndustryTickCompletedData["metrics"]): ProductionDependencyExposure {
        const sectorDependencies: Record<string, { totalExposure: number; byInput: Partial<Record<keyof Goods, number>> }> = {};

        for (const sectorId of Object.keys(metrics.sectorResults)) {
            let totalExposure = 0;
            const byInput: Partial<Record<keyof Goods, number>> = {};
            
            const sectorInputsConsumed = metrics.accounting.sectorInputsConsumedBySector[sectorId] ?? {};
            const sectorInputsPurchased = metrics.accounting.sectorInputsPurchasedBySector[sectorId] ?? {};
            
            for (const [good, consumed] of Object.entries(sectorInputsConsumed as Record<string, number>)) {
                const purchased = (sectorInputsPurchased as Record<string, number>)[good] ?? 0;
                const purchasedNum = purchased as number;
                const shortageRatio = purchasedNum > 0 ? safeRatio(purchasedNum - (consumed as number), purchasedNum) : null;
                const exposure = shortageRatio !== null ? (consumed as number) * shortageRatio : 0;
                byInput[good as keyof Goods] = exposure;
                totalExposure += exposure;
            }
            
            sectorDependencies[sectorId] = { totalExposure, byInput };
        }

        return {
            tick,
            entityId,
            bySector: sectorDependencies,
        };
    }
}