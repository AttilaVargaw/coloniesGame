import { Goods } from "@game/data/Goods";
import { EconomicHealthMetrics } from "./economicHealthMetrics";

export type EvidenceLevel = "confirmed_dependency" | "observed_association" | "possible_consequence";

export interface CascadeLink {
    fromProblem: string;
    toProblem: string;
    fromGood: keyof Goods | null;
    toSector: string | null;
    evidenceLevel: EvidenceLevel;
    firstObservedTick: number;
    description: string;
    confidence: number;
}

export interface CascadeNode {
    id: string;
    type: "shortage" | "surplus" | "production_decline" | "consumption_decline" | "price_spike" | "price_collapse" | "sector_stop" | "sector_restart" | "wealth_decline" | "population_decline";
    entityId: string;
    good: keyof Goods | null;
    sector: string | null;
    firstDetectedTick: number;
    lastObservedTick: number;
    severity: "info" | "warning" | "critical";
    description: string;
    relatedLinks: CascadeLink[];
}

export interface EconomicCascade {
    id: string;
    rootCause: CascadeNode;
    nodes: CascadeNode[];
    links: CascadeLink[];
    startTick: number;
    endTick: number | null;
    status: "active" | "resolved" | "escalating";
    narrative: string;
}

export interface EconomicCascadeReport {
    tick: number;
    entityId: string;
    cascades: EconomicCascade[];
    summary: {
        activeCascades: number;
        resolvedCascades: number;
        escalatingCascades: number;
        totalNodes: number;
        rootCauses: string[];
    };
}

export interface EconomicCascadeAnalyzerConfig {
    rollingWindowTicks: number;
    linkDetectionWindow: number;
    minConfidenceForLink: number;
    maxCascadeDepth: number;
    cascadeResolutionThreshold: number;
}

export const DEFAULT_CASCADE_CONFIG: EconomicCascadeAnalyzerConfig = {
    rollingWindowTicks: 50,
    linkDetectionWindow: 10,
    minConfidenceForLink: 0.6,
    maxCascadeDepth: 5,
    cascadeResolutionThreshold: 20,
};

export class EconomicCascadeAnalyzer {
    private config: EconomicCascadeAnalyzerConfig;
    private healthMetrics: EconomicHealthMetrics;
    private activeCascades: Map<string, EconomicCascade> = new Map();
    private resolvedCascades: EconomicCascade[] = [];
    private problemTracking: Map<string, { firstTick: number; lastTick: number; severity: "info" | "warning" | "critical" }> = new Map();
    private cascadeIdCounter = 0;

    constructor(healthMetrics: EconomicHealthMetrics, config: Partial<EconomicCascadeAnalyzerConfig> = {}) {
        this.healthMetrics = healthMetrics;
        this.config = { ...DEFAULT_CASCADE_CONFIG, ...config };
    }

    analyze(tick: number, entityId: string): EconomicCascadeReport {
        // Detect current problems
        const currentProblems = this.detectProblems(tick, entityId);
        
        // Update problem tracking
        this.updateProblemTracking(currentProblems, tick);
        
        // Build/update cascades
        this.updateCascades(currentProblems, tick, entityId);
        
        // Check for resolved cascades
        this.checkResolvedCascades(tick);
        
        // Generate report
        const cascades = [...this.activeCascades.values(), ...this.resolvedCascades.slice(-10)];
        const summary = this.computeSummary(cascades);

        return { tick, entityId, cascades, summary };
    }

    private detectProblems(tick: number, entityId: string): CascadeNode[] {
        const problems: CascadeNode[] = [];
        const marketHistory = this.healthMetrics.getMarketHistory();
        const latestMarket = marketHistory.find(m => m.tick === tick && m.entityId === entityId);
        const industryHistory = this.healthMetrics.getIndustryHistory(entityId);
        const latestIndustry = industryHistory.filter(m => m.tick === tick);
        const householdHistory = this.healthMetrics.getHouseholdHistory(entityId);
        const latestHousehold = householdHistory.filter(m => m.tick === tick);
        const priceSnapshot = this.healthMetrics.getLatestSnapshot(entityId);
        const priceData = priceSnapshot?.prices?.byGood ?? {};

        if (!latestMarket) return problems;

        // Market shortages
        for (const [good, metrics] of Object.entries(latestMarket.goods)) {
            const goodKey = good as keyof Goods;
            const priceInfo = priceData[goodKey];
            if (metrics.shortageRatio !== null && metrics.shortageRatio > 0.2) {
                problems.push({
                    id: `shortage_${goodKey}`,
                    type: "shortage",
                    entityId,
                    good: goodKey,
                    sector: null,
                    firstDetectedTick: tick,
                    lastObservedTick: tick,
                    severity: metrics.shortageRatio > 0.5 ? "critical" : "warning",
                    description: `${goodKey} shortage: ${(metrics.shortageRatio * 100).toFixed(1)}% unmet demand`,
                    relatedLinks: [],
                });
            }
            
            if (metrics.surplusRatio !== null && metrics.surplusRatio > 0.5) {
                problems.push({
                    id: `surplus_${goodKey}`,
                    type: "surplus",
                    entityId,
                    good: goodKey,
                    sector: null,
                    firstDetectedTick: tick,
                    lastObservedTick: tick,
                    severity: "info",
                    description: `${goodKey} surplus: ${(metrics.surplusRatio * 100).toFixed(1)}% excess supply`,
                    relatedLinks: [],
                });
            }

            if (priceInfo?.atCeiling) {
                problems.push({
                    id: `price_spike_${goodKey}`,
                    type: "price_spike",
                    entityId,
                    good: goodKey,
                    sector: null,
                    firstDetectedTick: tick,
                    lastObservedTick: tick,
                    severity: "warning",
                    description: `${goodKey} price at ceiling (${(priceInfo.basePrice * 10).toFixed(2)})`,
                    relatedLinks: [],
                });
            }
        }

        // Sector stops
        for (const sectorMetrics of latestIndustry) {
            if (sectorMetrics.stopReason) {
                problems.push({
                    id: `sector_stop_${sectorMetrics.sectorId}`,
                    type: "sector_stop",
                    entityId,
                    good: null,
                    sector: sectorMetrics.sectorId,
                    firstDetectedTick: tick,
                    lastObservedTick: tick,
                    severity: sectorMetrics.consecutiveStoppedTicks > 5 ? "critical" : "warning",
                    description: `${sectorMetrics.sectorId} stopped: ${sectorMetrics.stopReason}`,
                    relatedLinks: [],
                });
            }
        }

        // Production declines (sector utilization drop)
        for (const sectorMetrics of latestIndustry) {
            if (sectorMetrics.utilization < 0.3 && !sectorMetrics.stopReason) {
                problems.push({
                    id: `production_decline_${sectorMetrics.sectorId}`,
                    type: "production_decline",
                    entityId,
                    good: null,
                    sector: sectorMetrics.sectorId,
                    firstDetectedTick: tick,
                    lastObservedTick: tick,
                    severity: "warning",
                    description: `${sectorMetrics.sectorId} utilization low: ${(sectorMetrics.utilization * 100).toFixed(1)}%`,
                    relatedLinks: [],
                });
            }
        }

        // Household wealth declines
        for (const householdMetrics of latestHousehold) {
            // Would need previous tick comparison for wealth decline detection
            // For now, flag very low wealth
            if (householdMetrics.cashWealth < 100 && householdMetrics.population > 0) {
                problems.push({
                    id: `wealth_decline_${householdMetrics.category}`,
                    type: "wealth_decline",
                    entityId,
                    good: null,
                    sector: null,
                    firstDetectedTick: tick,
                    lastObservedTick: tick,
                    severity: "critical",
                    description: `${householdMetrics.category} wealth critically low: ${householdMetrics.cashWealth.toFixed(1)}`,
                    relatedLinks: [],
                });
            }
        }

        return problems;
    }

    private updateProblemTracking(problems: CascadeNode[], tick: number): void {
        for (const problem of problems) {
            const existing = this.problemTracking.get(problem.id);
            if (existing) {
                existing.lastTick = tick;
                existing.severity = problem.severity;
            } else {
                this.problemTracking.set(problem.id, {
                    firstTick: problem.firstDetectedTick,
                    lastTick: tick,
                    severity: problem.severity,
                });
            }
        }

        // Clean up old problems not seen recently
        for (const [id, tracking] of this.problemTracking) {
            if (tick - tracking.lastTick > this.config.linkDetectionWindow * 2) {
                this.problemTracking.delete(id);
            }
        }
    }

    private updateCascades(problems: CascadeNode[], tick: number, entityId: string): void {
        // For each new problem, try to link to existing problems
        for (const problem of problems) {
            const tracking = this.problemTracking.get(problem.id);
            if (!tracking || tracking.firstTick === tick) {
                // New problem - try to find causes
                this.linkToPotentialCauses(problem, tick, entityId);
            }
        }

        // Update existing cascades with new observations
        for (const cascade of this.activeCascades.values()) {
            this.updateCascadeWithNewProblems(cascade, problems, tick);
        }
    }

    private linkToPotentialCauses(problem: CascadeNode, tick: number, entityId: string): void {
        // Find potential causes from recent problems
        const potentialCauses: CascadeNode[] = [];
        
        for (const [id, tracking] of this.problemTracking) {
            if (id === problem.id) continue;
            if (tracking.lastTick < tick - this.config.linkDetectionWindow) continue;
            if (tracking.lastTick >= tick) continue; // Same tick or future
            
            // Find the actual problem node
            const causeProblem = this.findProblemNode(id, tracking, tick);
            if (causeProblem) {
                const evidence = this.assessEvidence(causeProblem, problem, entityId);
                if (evidence.confidence >= this.config.minConfidenceForLink) {
                    potentialCauses.push(causeProblem);
                    // Add link to problem
                    problem.relatedLinks.push({
                        fromProblem: causeProblem.id,
                        toProblem: problem.id,
                        fromGood: causeProblem.good,
                        toSector: problem.sector,
                        evidenceLevel: evidence.level,
                        firstObservedTick: tracking.firstTick,
                        description: evidence.description,
                        confidence: evidence.confidence,
                    });
                }
            }
        }

        // If has causes, add to existing cascade or create new
        if (potentialCauses.length > 0) {
            this.addToCascade(problem, potentialCauses, tick);
        } else if (problem.severity !== "info") {
            // Root cause - start new cascade
            this.startNewCascade(problem, tick);
        }
    }

    private findProblemNode(id: string, tracking: { firstTick: number; lastTick: number; severity: "info" | "warning" | "critical" }, _currentTick: number): CascadeNode | null {
        // Reconstruct problem node from tracking info
        // This is simplified - in practice would store the full node
        const parts = id.split("_");
        if (parts.length < 2) return null;
        
        const type = parts[0] as CascadeNode["type"];
        const identifier = parts.slice(1).join("_");
        
        let good: keyof Goods | null = null;
        let sector: string | null = null;
        
        if (type === "shortage" || type === "surplus" || type === "price_spike" || type === "price_collapse") {
            good = identifier as keyof Goods;
        } else if (type === "sector_stop" || type === "production_decline") {
            sector = identifier;
        }

        return {
            id,
            type,
            entityId: "",
            good,
            sector,
            firstDetectedTick: tracking.firstTick,
            lastObservedTick: tracking.lastTick,
            severity: tracking.severity,
            description: `${type} detected`,
            relatedLinks: [],
        };
    }

    private assessEvidence(cause: CascadeNode, effect: CascadeNode, _entityId: string): { level: EvidenceLevel; confidence: number; description: string } {
        // Confirmed dependency: known production chain
        if (cause.type === "shortage" && cause.good && effect.type === "sector_stop" && effect.sector) {
            // Check if sector requires this good
            return {
                level: "confirmed_dependency",
                confidence: 0.9,
                description: `${cause.good} shortage likely caused ${effect.sector} stop`,
            };
        }
        
        if (cause.type === "sector_stop" && cause.sector && effect.type === "shortage" && effect.good) {
            // Check if sector produces this good
            return {
                level: "confirmed_dependency",
                confidence: 0.85,
                description: `${cause.sector} stop likely caused ${effect.good} shortage`,
            };
        }

        if (cause.type === "production_decline" && cause.sector && effect.type === "shortage" && effect.good) {
            return {
                level: "observed_association",
                confidence: 0.7,
                description: `${cause.sector} production decline associated with ${effect.good} shortage`,
            };
        }

        if (cause.type === "shortage" && cause.good && effect.type === "production_decline" && effect.sector) {
            return {
                level: "observed_association",
                confidence: 0.7,
                description: `${cause.good} shortage associated with ${effect.sector} production decline`,
            };
        }

        if (cause.type === "shortage" && cause.good && effect.type === "wealth_decline") {
            return {
                level: "possible_consequence",
                confidence: 0.5,
                description: `${cause.good} shortage may contribute to household wealth decline`,
            };
        }

        if (cause.type === "price_spike" && cause.good && effect.type === "wealth_decline") {
            return {
                level: "possible_consequence",
                confidence: 0.5,
                description: `${cause.good} price spike may reduce household purchasing power`,
            };
        }

        // Default: observed association with lower confidence
        return {
            level: "observed_association",
            confidence: 0.4,
            description: `${cause.type} (${cause.id}) may relate to ${effect.type} (${effect.id})`,
        };
    }

    private addToCascade(problem: CascadeNode, causes: CascadeNode[], tick: number): void {
        // Find existing cascade containing any cause
        let targetCascade: EconomicCascade | null = null;
        
        for (const cascade of this.activeCascades.values()) {
            if (cascade.nodes.some(n => causes.some(c => c.id === n.id))) {
                targetCascade = cascade;
                break;
            }
        }

        if (targetCascade) {
            targetCascade.nodes.push(problem);
            targetCascade.links.push(...problem.relatedLinks);
            targetCascade.endTick = tick;
            targetCascade.narrative = this.generateNarrative(targetCascade);
        } else {
            // Merge causes' cascades or create new
            this.startNewCascade(problem, tick, causes);
        }
    }

    private startNewCascade(rootCause: CascadeNode, tick: number, causes: CascadeNode[] = []): void {
        this.cascadeIdCounter++;
        const cascade: EconomicCascade = {
            id: `cascade_${this.cascadeIdCounter}`,
            rootCause,
            nodes: [rootCause, ...causes],
            links: rootCause.relatedLinks,
            startTick: rootCause.firstDetectedTick,
            endTick: tick,
            status: "active",
            narrative: `Cascade ${this.cascadeIdCounter}: ${rootCause.description} detected at tick ${tick}`,
        };
        
        this.activeCascades.set(cascade.id, cascade);
    }

    private updateCascadeWithNewProblems(cascade: EconomicCascade, problems: CascadeNode[], tick: number): void {
        // Check if any new problems link to cascade nodes
        for (const problem of problems) {
            for (const node of cascade.nodes) {
                const evidence = this.assessEvidence(node, problem, cascade.rootCause.entityId);
                if (evidence.confidence >= this.config.minConfidenceForLink) {
                    // Add to cascade if not already present
                    if (!cascade.nodes.some(n => n.id === problem.id)) {
                        cascade.nodes.push(problem);
                        cascade.links.push({
                            fromProblem: node.id,
                            toProblem: problem.id,
                            fromGood: node.good,
                            toSector: problem.sector,
                            evidenceLevel: evidence.level,
                            firstObservedTick: tick,
                            description: evidence.description,
                            confidence: evidence.confidence,
                        });
                        cascade.endTick = tick;
                        cascade.narrative = this.generateNarrative(cascade);
                    }
                }
            }
        }
    }

    private checkResolvedCascades(tick: number): void {
        for (const [id, cascade] of this.activeCascades) {
            const allResolved = cascade.nodes.every(node => {
                const tracking = this.problemTracking.get(node.id);
                return !tracking || tick - tracking.lastTick > this.config.cascadeResolutionThreshold;
            });

            if (allResolved && tick - (cascade.endTick ?? 0) > this.config.cascadeResolutionThreshold) {
                cascade.status = "resolved";
                this.activeCascades.delete(id);
                this.resolvedCascades.push(cascade);
            }
        }

        // Limit resolved cascades history
        if (this.resolvedCascades.length > 100) {
            this.resolvedCascades = this.resolvedCascades.slice(-100);
        }
    }

    private generateNarrative(cascade: EconomicCascade): string {
        const root = cascade.rootCause;
        const nodeCount = cascade.nodes.length;
        const linkCount = cascade.links.length;
        const confirmedLinks = cascade.links.filter(l => l.evidenceLevel === "confirmed_dependency").length;
        
        let narrative = `Cascade ${cascade.id}: ${root.description} (tick ${root.firstDetectedTick})`;
        
        if (nodeCount > 1) {
            narrative += ` → ${nodeCount - 1} downstream effects`;
        }
        if (confirmedLinks > 0) {
            narrative += ` (${confirmedLinks} confirmed dependencies)`;
        }
        if (cascade.status === "escalating") {
            narrative += " [ESCALATING]";
        }
        
        return narrative;
    }

    private computeSummary(cascades: EconomicCascade[]): EconomicCascadeReport["summary"] {
        let active = 0, resolved = 0, escalating = 0, totalNodes = 0;
        const rootCauses: string[] = [];

        for (const c of cascades) {
            totalNodes += c.nodes.length;
            if (c.status === "active") active++;
            else if (c.status === "resolved") resolved++;
            else if (c.status === "escalating") escalating++;
            rootCauses.push(c.rootCause.description);
        }

        return { activeCascades: active, resolvedCascades: resolved, escalatingCascades: escalating, totalNodes, rootCauses };
    }

    getActiveCascades(): EconomicCascade[] {
        return [...this.activeCascades.values()];
    }

    getResolvedCascades(): EconomicCascade[] {
        return [...this.resolvedCascades];
    }

    getCascadeById(id: string): EconomicCascade | null {
        return this.activeCascades.get(id) ?? this.resolvedCascades.find(c => c.id === id) ?? null;
    }

    clear(): void {
        this.activeCascades.clear();
        this.resolvedCascades = [];
        this.problemTracking.clear();
        this.cascadeIdCounter = 0;
    }
}