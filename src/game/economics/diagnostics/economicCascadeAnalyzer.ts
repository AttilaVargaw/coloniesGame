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
    private sectorInputRequirements: Map<string, Set<keyof Goods>> = new Map();
    private cycleCheckCache: Map<string, boolean> = new Map();
    private adjacencyCache: Map<string, Map<string, Set<string>>> = new Map();
    private cascadeIdCounter = 0;

    constructor(healthMetrics: EconomicHealthMetrics, config: Partial<EconomicCascadeAnalyzerConfig> = {}) {
        this.healthMetrics = healthMetrics;
        this.config = { ...DEFAULT_CASCADE_CONFIG, ...config };
    }

    analyze(tick: number, entityId: string): EconomicCascadeReport {
        // Clear cycle check cache periodically (every 20 ticks)
        if (tick % 20 === 0) {
            this.cycleCheckCache.clear();
            this.adjacencyCache.clear();
            // Clear sector input requirements - they'll be rebuilt from current industry data
            this.sectorInputRequirements.clear();
        }
        
        // Build adjacency cache for this entity once per analyze call
        this.buildAdjacencyCache(entityId);
        
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

        // Build sector input requirements from ALL sectors (not just stopped ones)
        for (const sectorMetrics of latestIndustry) {
            const requiredInputs = Object.entries(sectorMetrics.inputAvailability)
                .filter(([, avail]) => avail !== undefined)
                .map(([good]) => good as keyof Goods);
            if (requiredInputs.length > 0) {
                this.sectorInputRequirements.set(sectorMetrics.sectorId, new Set(requiredInputs));
            }
        }

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

                // Create sector-specific shortage problems with sector in ID to avoid conflicts
                const requiredInputs = Object.entries(sectorMetrics.inputAvailability)
                    .filter(([, avail]) => avail !== undefined)
                    .map(([good]) => good as keyof Goods);
                for (const goodKey of requiredInputs) {
                    const avail = sectorMetrics.inputAvailability[goodKey];
                    if (avail !== undefined && avail < 0.3) { // threshold for "unavailable"
                        problems.push({
                            id: `shortage_${goodKey}_for_${sectorMetrics.sectorId}`,
                            type: "shortage",
                            entityId,
                            good: goodKey,
                            sector: sectorMetrics.sectorId,
                            firstDetectedTick: tick,
                            lastObservedTick: tick,
                            severity: avail === 0 ? "critical" : "warning",
                            description: `${goodKey} unavailable for ${sectorMetrics.sectorId}: ${(avail * 100).toFixed(0)}% available`,
                            relatedLinks: [],
                        });
                    }
                }
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
            // Allow same-tick for cause→effect pairs that logically happen in sequence within a tick
            const sameTickAllowed = this.canLinkSameTick(problem, id);
            if (!sameTickAllowed && tracking.lastTick >= tick) continue; // Same tick or future
            
            // Find the actual problem node
            const causeProblem = this.findProblemNode(id, tracking, tick);
            if (causeProblem) {
                const evidence = this.assessEvidence(causeProblem, problem, entityId);
                if (evidence.confidence >= this.config.minConfidenceForLink) {
                    // Check if this link would create a cycle
                    if (this.wouldCreateCycle(causeProblem.id, problem.id, entityId)) {
                        continue; // Skip this cause to avoid cycles
                    }
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
            // Root cause - try to group with similar root causes
            this.startOrMergeCascade(problem, tick);
        }
    }

    private canLinkSameTick(effect: CascadeNode, causeId: string): boolean {
        // Allow same-tick linking for specific cause→effect pairs where cause logically precedes effect
        const causeType = causeId.split("_")[0];
        const effectType = effect.type;
        
        // Shortage → Sector stop (input shortage causes sector to stop)
        if (causeType === "shortage" && effectType === "sector_stop") return true;
        // Price spike → Sector stop (high input prices make production unviable)
        if (causeType === "price_spike" && effectType === "sector_stop") return true;
        // Sector stop → Shortage (stopped sector stops producing its outputs)
        if (causeType === "sector_stop" && effectType === "shortage") return true;
        
        return false;
    }

    private wouldCreateCycle(causeId: string, effectId: string, entityId: string): boolean {
        const cacheKey = `${causeId}->${effectId}:${entityId}`;
        const cached = this.cycleCheckCache.get(cacheKey);
        if (cached !== undefined) return cached;
        
        // Get cached adjacency for this entity
        const adjacency = this.adjacencyCache.get(entityId);
        if (!adjacency) {
            this.cycleCheckCache.set(cacheKey, false);
            return false;
        }
        
        // DFS from effect to see if we can reach cause (with depth limit)
        const visited = new Set<string>();
        const stack: Array<{ node: string; depth: number }> = [{ node: effectId, depth: 0 }];
        const MAX_DEPTH = 10; // Prevent runaway searches
        
        while (stack.length > 0) {
            const { node: current, depth } = stack.pop()!;
            if (current === causeId) {
                this.cycleCheckCache.set(cacheKey, true);
                return true;
            }
            if (visited.has(current)) continue;
            if (depth >= MAX_DEPTH) continue;
            visited.add(current);
            
            const neighbors = adjacency.get(current);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        stack.push({ node: neighbor, depth: depth + 1 });
                    }
                }
            }
        }
        
        this.cycleCheckCache.set(cacheKey, false);
        return false;
    }

    private buildAdjacencyCache(entityId: string): void {
        const adjacency = new Map<string, Set<string>>();
        
        for (const cascade of this.activeCascades.values()) {
            if (cascade.rootCause.entityId !== entityId) continue;
            for (const link of cascade.links) {
                if (!adjacency.has(link.fromProblem)) {
                    adjacency.set(link.fromProblem, new Set());
                }
                adjacency.get(link.fromProblem)!.add(link.toProblem);
            }
        }
        
        this.adjacencyCache.set(entityId, adjacency);
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
            // Check if sector actually requires this good as input
            const requiredInputs = this.sectorInputRequirements.get(effect.sector);
            if (requiredInputs && requiredInputs.has(cause.good)) {
                return {
                    level: "confirmed_dependency",
                    confidence: 0.9,
                    description: `${cause.good} shortage likely caused ${effect.sector} stop`,
                };
            }
            // Sector doesn't require this good - observed association only
            return {
                level: "observed_association",
                confidence: 0.4,
                description: `${cause.good} shortage coincident with ${effect.sector} stop (not a direct input)`,
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
            // Add problem if not already present
            if (!targetCascade.nodes.some(n => n.id === problem.id)) {
                targetCascade.nodes.push(problem);
            }
            // Add links avoiding duplicates
            for (const link of problem.relatedLinks) {
                if (!targetCascade.links.some(l => l.fromProblem === link.fromProblem && l.toProblem === link.toProblem)) {
                    targetCascade.links.push(link);
                }
            }
            targetCascade.endTick = tick;
            targetCascade.narrative = this.generateNarrative(targetCascade);
        } else {
            // Merge causes' cascades or create new
            this.startNewCascade(problem, tick, causes);
        }
    }

    private startNewCascade(rootCause: CascadeNode, tick: number, causes: CascadeNode[] = []): void {
        this.cascadeIdCounter++;
        // Deduplicate causes
        const uniqueCauses = causes.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
        const uniqueNodes = [rootCause, ...uniqueCauses].filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);
        
        const cascade: EconomicCascade = {
            id: `cascade_${this.cascadeIdCounter}`,
            rootCause,
            nodes: uniqueNodes,
            links: rootCause.relatedLinks,
            startTick: rootCause.firstDetectedTick,
            endTick: tick,
            status: "active",
            narrative: `Cascade ${this.cascadeIdCounter}: ${rootCause.description} detected at tick ${tick}`,
        };
        
        this.activeCascades.set(cascade.id, cascade);
    }

    private startOrMergeCascade(rootCause: CascadeNode, tick: number): void {
        // Try to find an existing cascade with a related root cause
        const relatedKey = this.getCascadeGroupKey(rootCause);
        
        for (const cascade of this.activeCascades.values()) {
            if (cascade.status !== "active") continue;
            const existingKey = this.getCascadeGroupKey(cascade.rootCause);
            
            // Same group key = merge into existing cascade
            if (existingKey === relatedKey) {
                // Check if this exact problem is already in the cascade
                if (!cascade.nodes.some(n => n.id === rootCause.id)) {
                    cascade.nodes.push(rootCause);
                    cascade.endTick = tick;
                    cascade.narrative = this.generateNarrative(cascade);
                }
                return;
            }
        }
        
        // No existing cascade for this group - create new
        this.startNewCascade(rootCause, tick);
    }

    private getCascadeGroupKey(problem: CascadeNode): string {
        // Group by sector or by good category
        if (problem.sector) return `sector_${problem.sector}`;
        if (problem.good) {
            // Group goods by category (raw, manufactured, food, etc.)
            const goodCategories: Record<string, string> = {
                food: "food",
                water: "food",
                energy: "energy",
                fuel: "energy",
                ore: "raw",
                metal: "manufactured",
                electronics: "manufactured",
                chemicals: "manufactured",
                machinery: "manufactured",
                textiles: "manufactured",
                medicine: "services",
                luxury: "luxury",
            };
            const category = goodCategories[problem.good] || "other";
            return `good_${category}_${problem.type}`;
        }
        return `unknown_${problem.type}`;
    }

    private updateCascadeWithNewProblems(cascade: EconomicCascade, problems: CascadeNode[], tick: number): void {
        // Check if any new problems link to cascade nodes
        for (const problem of problems) {
            let addedToCascade = false;
            const newLinks: typeof cascade.links = [];
            
            for (const node of cascade.nodes) {
                const evidence = this.assessEvidence(node, problem, cascade.rootCause.entityId);
                if (evidence.confidence >= this.config.minConfidenceForLink) {
                    // Add link
                    newLinks.push({
                        fromProblem: node.id,
                        toProblem: problem.id,
                        fromGood: node.good,
                        toSector: problem.sector,
                        evidenceLevel: evidence.level,
                        firstObservedTick: tick,
                        description: evidence.description,
                        confidence: evidence.confidence,
                    });
                }
            }
            
            if (newLinks.length > 0) {
                // Add to cascade if not already present
                if (!cascade.nodes.some(n => n.id === problem.id)) {
                    cascade.nodes.push(problem);
                }
                // Add new links (avoiding duplicates)
                for (const newLink of newLinks) {
                    if (!cascade.links.some(l => l.fromProblem === newLink.fromProblem && l.toProblem === newLink.toProblem)) {
                        cascade.links.push(newLink);
                    }
                }
                cascade.endTick = tick;
                cascade.narrative = this.generateNarrative(cascade);
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