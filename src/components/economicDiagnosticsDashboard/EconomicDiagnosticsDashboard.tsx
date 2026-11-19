import { useState, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EconomicHealthMetrics } from "@/game/economics/diagnostics/economicHealthMetrics";
import { MarketStabilityAnalyzer } from "@/game/economics/diagnostics/marketStabilityAnalyzer";
import { IndustryHealthReport } from "@/game/economics/diagnostics/industryHealthAnalyzer";
import { HouseholdHealthReport } from "@/game/economics/diagnostics/householdHealthAnalyzer";
import { EconomicCascadeAnalyzer, CascadeLink } from "@/game/economics/diagnostics/economicCascadeAnalyzer";
import { useGameEngine } from "@/hooks/useGameContext";
import { IndustryTickCompletedEvent } from "@engine/lib/events/IndustryTickCompletedEvent";
import { useGameEvent } from "@/hooks/useGameEvent";

interface EconomicDiagnosticsDashboardProps {
    entityId: string;
}

const SEVERITY_COLORS = {
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const EVIDENCE_COLORS = {
    confirmed_dependency: "bg-green-500/20 text-green-400 border-green-500/30",
    observed_association: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    possible_consequence: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const STATUS_COLORS = {
    healthy: "bg-green-500/20 text-green-400",
    under_pressure: "bg-yellow-500/20 text-yellow-400",
    unprofitable: "bg-red-500/20 text-red-400",
    resource_constrained: "bg-orange-500/20 text-orange-400",
    inactive: "bg-gray-500/20 text-gray-400",
};

const HOUSEHOLD_STATUS_COLORS = {
    prosperous: "bg-green-500/20 text-green-400",
    stable: "bg-blue-500/20 text-blue-400",
    stressed: "bg-yellow-500/20 text-yellow-400",
    destitute: "bg-red-500/20 text-red-400",
};

function formatNumber(n: number): string {
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return n.toFixed(2);
}

function formatPct(n: number | null): string {
    if (n === null) return "N/A";
    return (n * 100).toFixed(1) + "%";
}

export function EconomicDiagnosticsDashboard({ entityId }: EconomicDiagnosticsDashboardProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [historyLength, setHistoryLength] = useState(50);
    const engine = useGameEngine();

    const diagnostics = useMemo(() => {
        if (!engine) return null;
        return engine.getEconomicDiagnostics();
    }, [engine]);

    const healthMetrics = diagnostics?.health ?? null;
    const marketAnalyzer = diagnostics?.market ?? null;
    const industryAnalyzer = diagnostics?.industry ?? null;
    const householdAnalyzer = diagnostics?.household ?? null;
    const cascadeAnalyzer = diagnostics?.cascade ?? null;

    const [latestReports, setLatestReports] = useState<{
        health: ReturnType<EconomicHealthMetrics["getLatestSnapshot"]> | null;
        market: ReturnType<MarketStabilityAnalyzer["analyze"]> | null;
        industry: IndustryHealthReport | null;
        household: HouseholdHealthReport | null;
        cascade: ReturnType<EconomicCascadeAnalyzer["analyze"]> | null;
    }>({
        health: null,
        market: null,
        industry: null,
        household: null,
        cascade: null,
    });

    const updateReports = useCallback(() => {
        if (!engine) return;
        const tick = (engine as any).currentTick ?? 0;
        
        if (healthMetrics) {
            setLatestReports(prev => ({
                ...prev,
                health: healthMetrics.getLatestSnapshot(entityId),
            }));
        }
        if (marketAnalyzer) {
            setLatestReports(prev => ({
                ...prev,
                market: marketAnalyzer.analyze(tick, entityId),
            }));
        }
        if (industryAnalyzer) {
            setLatestReports(prev => ({
                ...prev,
                industry: industryAnalyzer.analyze(tick, entityId),
            }));
        }
        if (householdAnalyzer) {
            setLatestReports(prev => ({
                ...prev,
                household: householdAnalyzer.analyze(tick, entityId),
            }));
        }
        if (cascadeAnalyzer) {
            setLatestReports(prev => ({
                ...prev,
                cascade: cascadeAnalyzer.analyze(tick, entityId),
            }));
        }
    }, [engine, entityId, healthMetrics, marketAnalyzer, industryAnalyzer, householdAnalyzer, cascadeAnalyzer]);

    useGameEvent(IndustryTickCompletedEvent, useCallback(() => {
        updateReports();
    }, [updateReports]));

    const overviewCards = useMemo(() => {
        const { health, market, industry, household, cascade } = latestReports;
        if (!health || !market || !industry || !household || !cascade) return [];

        return [
            {
                title: "Economic Health",
                value: market.summary.goodsWithShortage > 0 ? "Stressed" : "Stable",
                details: `${market.summary.goodsWithShortage} shortages, ${market.summary.goodsWithSurplus} surpluses`,
                severity: market.summary.goodsWithShortage > 5 ? "critical" : market.summary.goodsWithShortage > 0 ? "warning" : "info",
            },
            {
                title: "Industry Status",
                value: industry.summary.inactive > 0 ? `${industry.summary.inactive} Stopped` : "Operational",
                details: `${industry.summary.healthy} healthy, ${industry.summary.unprofitable} unprofitable, ${industry.summary.resourceConstrained} constrained`,
                severity: industry.summary.inactive > 3 ? "critical" : industry.summary.unprofitable > 3 ? "warning" : "info",
            },
            {
                title: "Households",
                value: household.summary.destitute > 0 ? "Critical" : household.summary.stressed > 0 ? "Stressed" : "Stable",
                details: `${household.summary.prosperous} prosperous, ${household.summary.stable} stable, ${household.summary.stressed} stressed, ${household.summary.destitute} destitute`,
                severity: household.summary.destitute > 0 ? "critical" : household.summary.stressed > 2 ? "warning" : "info",
            },
            {
                title: "Treasury",
                value: health.treasury.runway ? `${health.treasury.runway.toFixed(0)} ticks` : "Infinite",
                details: `Balance: ${formatNumber(health.treasury.balance)}, Outflow: ${formatNumber(health.treasury.subsidyOutflowRate + health.treasury.otherOutflowRate)}/tick`,
                severity: health.treasury.runway && health.treasury.runway < 20 ? "critical" : health.treasury.runway && health.treasury.runway < 50 ? "warning" : "info",
            },
            {
                title: "Active Cascades",
                value: cascade.summary.activeCascades.toString(),
                details: `${cascade.summary.resolvedCascades} resolved, ${cascade.summary.escalatingCascades} escalating`,
                severity: cascade.summary.escalatingCascades > 0 ? "critical" : cascade.summary.activeCascades > 2 ? "warning" : "info",
            },
        ];
    }, [latestReports]);

    const marketAlerts = useMemo(() => {
        return latestReports.market?.alerts ?? [];
    }, [latestReports.market]);

    const industryAssessments = useMemo(() => {
        return latestReports.industry?.assessments ?? [];
    }, [latestReports.industry]);

    const householdAssessments = useMemo(() => {
        return latestReports.household?.assessments ?? [];
    }, [latestReports.household]);

    const activeCascades = useMemo(() => {
        return latestReports.cascade?.cascades.filter(c => c.status === "active") ?? [];
    }, [latestReports.cascade]);

    const cascadeLinks = useMemo(() => {
        const links: (CascadeLink & { fromCascadeId: string })[] = [];
        for (const cascade of latestReports.cascade?.cascades ?? []) {
            for (const link of cascade.links) {
                links.push({ ...link, fromCascadeId: cascade.id });
            }
        }
        return links;
    }, [latestReports.cascade]);

    return (
        <Dialog modal={false} open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                    <span className="flex items-center gap-1">
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Diagnostics
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1c1c1c] text-white max-w-5xl max-h-[90vh]" style={{ width: "95vw" }}>
                <DialogHeader>
                    <DialogTitle>Economic Diagnostics Dashboard</DialogTitle>
                </DialogHeader>
                
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                            <TabsList className="grid w-full grid-cols-7">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="markets">Markets</TabsTrigger>
                                <TabsTrigger value="industries">Industries</TabsTrigger>
                                <TabsTrigger value="households">Households</TabsTrigger>
                                <TabsTrigger value="treasury">Treasury</TabsTrigger>
                                <TabsTrigger value="cascades">Cascades</TabsTrigger>
                                <TabsTrigger value="history">History</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="flex items-center gap-2 ml-4">
                            <label className="text-xs text-muted-foreground">History:</label>
                            <select 
                                value={historyLength} 
                                onChange={(e) => setHistoryLength(Number(e.target.value))}
                                className="bg-[#2a2a2a] border border-[#3a3a3a] text-xs px-2 py-1 rounded"
                            >
                                <option value={10}>10</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                            </select>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        {activeTab === "overview" && (
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                                    {overviewCards.map((card, i) => (
                                        <Card key={i} className={`border-${SEVERITY_COLORS[card.severity as keyof typeof SEVERITY_COLORS].split(" ")[2]}`}>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{card.value}</div>
                                                <div className="text-xs text-muted-foreground">{card.details}</div>
                                                <Badge 
                                                    variant="outline" 
                                                    className={SEVERITY_COLORS[card.severity as keyof typeof SEVERITY_COLORS]}
                                                >
                                                    {card.severity}
                                                </Badge>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === "markets" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">Market Stability Alerts</h3>
                                    <Badge variant="outline" className={marketAlerts.length > 0 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}>
                                        {marketAlerts.length} alerts
                                    </Badge>
                                </div>
                                {marketAlerts.length === 0 ? (
                                    <Alert className="bg-green-500/10 border-green-500/20">
                                        <AlertDescription>No market stability alerts detected.</AlertDescription>
                                    </Alert>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Good</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Severity</TableHead>
                                                <TableHead>Duration</TableHead>
                                                <TableHead>Description</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {marketAlerts.map((alert, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono">{alert.good}</TableCell>
                                                    <TableCell>{alert.type.replace(/_/g, " ")}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={SEVERITY_COLORS[alert.severity]}>
                                                            {alert.severity}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{alert.consecutiveTicks} ticks</TableCell>
                                                    <TableCell className="max-w-[300px] truncate">{alert.description}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        )}

                        {activeTab === "industries" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">Industry Health Assessments</h3>
                                    <div className="flex gap-2">
                                        {["healthy", "under_pressure", "unprofitable", "resource_constrained", "inactive"].map(status => (
                                            <Badge 
                                                key={status} 
                                                variant="outline" 
                                                className={STATUS_COLORS[status as keyof typeof STATUS_COLORS]}
                                            >
                                                {status}: {industryAssessments.filter(a => a.status === status).length}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                {industryAssessments.length === 0 ? (
                                    <Alert className="bg-gray-500/10 border-gray-500/20">
                                        <AlertDescription>No industry data available.</AlertDescription>
                                    </Alert>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Sector</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Pre-Subsidy Result</TableHead>
                                                <TableHead>Post-Subsidy Result</TableHead>
                                                <TableHead>Utilization</TableHead>
                                                <TableHead>Input Avail.</TableHead>
                                                <TableHead>Labor Avail.</TableHead>
                                                <TableHead>Stopped</TableHead>
                                                <TableHead>Details</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {industryAssessments.map((assessment, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono">{assessment.sectorId}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={STATUS_COLORS[assessment.status]}>
                                                            {assessment.status.replace(/_/g, " ")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className={assessment.operatingResultPreSubsidy < 0 ? "text-red-400" : "text-green-400"}>
                                                        {formatNumber(assessment.operatingResultPreSubsidy)}
                                                    </TableCell>
                                                    <TableCell className={assessment.operatingResultPostSubsidy < 0 ? "text-red-400" : "text-green-400"}>
                                                        {formatNumber(assessment.operatingResultPostSubsidy)}
                                                    </TableCell>
                                                    <TableCell>{formatPct(assessment.utilization)}</TableCell>
                                                    <TableCell>{formatPct(assessment.inputAvailabilityScore)}</TableCell>
                                                    <TableCell>{formatPct(assessment.laborAvailabilityScore)}</TableCell>
                                                    <TableCell>{assessment.consecutiveStoppedTicks > 0 ? assessment.consecutiveStoppedTicks : "-"}</TableCell>
                                                    <TableCell className="max-w-[300px] truncate">
                                                        {assessment.assessmentDetails.join("; ")}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        )}

                        {activeTab === "households" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">Household Health Assessments</h3>
                                    <div className="flex gap-2">
                                        {["prosperous", "stable", "stressed", "destitute"].map(status => (
                                            <Badge 
                                                key={status} 
                                                variant="outline" 
                                                className={HOUSEHOLD_STATUS_COLORS[status as keyof typeof HOUSEHOLD_STATUS_COLORS]}
                                            >
                                                {status}: {householdAssessments.filter(a => a.status === status).length}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                {householdAssessments.length === 0 ? (
                                    <Alert className="bg-gray-500/10 border-gray-500/20">
                                        <AlertDescription>No household data available.</AlertDescription>
                                    </Alert>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Wealth</TableHead>
                                                <TableHead>Fulfillment</TableHead>
                                                <TableHead>Affordability</TableHead>
                                                <TableHead>QoL</TableHead>
                                                <TableHead>Purchasing Power</TableHead>
                                                <TableHead>Details</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {householdAssessments.map((assessment, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono capitalize">{assessment.category}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={HOUSEHOLD_STATUS_COLORS[assessment.status]}>
                                                            {assessment.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{formatNumber(assessment.cashWealth)}</TableCell>
                                                    <TableCell>{formatPct(assessment.consumptionFulfillmentRatio)}</TableCell>
                                                    <TableCell>{formatPct(assessment.affordabilityRatio)}</TableCell>
                                                    <TableCell>{assessment.qol.toFixed(1)} / {assessment.expectedQol.toFixed(1)}</TableCell>
                                                    <TableCell>{formatPct(assessment.purchasingPower)}</TableCell>
                                                    <TableCell className="max-w-[300px] truncate">
                                                        {assessment.assessmentDetails.join("; ")}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        )}

                        {activeTab === "treasury" && (
                            <div className="space-y-4">
                                {latestReports.health && (
                                    <div className="grid gap-4 md:grid-cols-4">
                                        <Card>
                                            <CardHeader><CardTitle className="text-sm">Balance</CardTitle></CardHeader>
                                            <CardContent className="text-2xl font-bold">{formatNumber(latestReports.health.treasury.balance)}</CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader><CardTitle className="text-sm">Subsidy Outflow</CardTitle></CardHeader>
                                            <CardContent className="text-2xl font-bold text-red-400">{formatNumber(latestReports.health.treasury.subsidyOutflowRate)}/tick</CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader><CardTitle className="text-sm">Other Outflow</CardTitle></CardHeader>
                                            <CardContent className="text-2xl font-bold text-orange-400">{formatNumber(latestReports.health.treasury.otherOutflowRate)}/tick</CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader><CardTitle className="text-sm">Inflow</CardTitle></CardHeader>
                                            <CardContent className="text-2xl font-bold text-green-400">{formatNumber(latestReports.health.treasury.inflowRate)}/tick</CardContent>
                                        </Card>
                                    </div>
                                )}
                                <Card>
                                    <CardHeader><CardTitle>Financial Runway</CardTitle></CardHeader>
                                    <CardContent>
                                        {latestReports.health?.treasury.runway ? (
                                            <>
                                                <div className="text-3xl font-bold">
                                                    {latestReports.health.treasury.runway < 20 ? "⚠️ " : ""}
                                                    {latestReports.health.treasury.runway.toFixed(0)} ticks remaining
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-2">
                                                    At current outflow rate (subsidies: {formatNumber(latestReports.health.treasury.subsidyOutflowRate)}, other: {formatNumber(latestReports.health.treasury.otherOutflowRate)}/tick)
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-3xl font-bold text-green-400">Infinite (positive net flow)</div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === "cascades" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">Economic Cascades</h3>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="bg-red-500/20 text-red-400">
                                            Active: {activeCascades.length}
                                        </Badge>
                                        <Badge variant="outline" className="bg-green-500/20 text-green-400">
                                            Resolved: {latestReports.cascade?.summary.resolvedCascades ?? 0}
                                        </Badge>
                                        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
                                            Escalating: {latestReports.cascade?.summary.escalatingCascades ?? 0}
                                        </Badge>
                                    </div>
                                </div>

                                {activeCascades.length === 0 && latestReports.cascade?.cascades.length === 0 ? (
                                    <Alert className="bg-green-500/10 border-green-500/20">
                                        <AlertDescription>No economic cascades detected.</AlertDescription>
                                    </Alert>
                                ) : (
                                    <>
                                        {activeCascades.map((cascade, i) => (
                                            <Card key={i} className="border-red-500/30">
                                                <CardHeader>
                                                    <div className="flex items-center justify-between">
                                                        <CardTitle className="text-base">{cascade.narrative}</CardTitle>
                                                        <Badge variant="outline" className={cascade.status === "escalating" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}>
                                                            {cascade.status}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    <div className="text-sm text-muted-foreground">
                                                        Root cause: {cascade.rootCause.description} (tick {cascade.rootCause.firstDetectedTick})
                                                    </div>
                                                    <div className="text-sm">
                                                        <strong>Nodes:</strong> {cascade.nodes.map(n => `${n.type}${n.good ? `(${n.good})` : ""}${n.sector ? ` [${n.sector}]` : ""}`).join(" → ")}
                                                    </div>
                                                    <div className="text-sm">
                                                        <strong>Links:</strong> {cascade.links.map(l => `${l.fromProblem} → ${l.toProblem} [${l.evidenceLevel}]`).join("; ")}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {cascadeLinks.length > 0 && (
                                            <Card>
                                                <CardHeader><CardTitle>All Cascade Links (Evidence)</CardTitle></CardHeader>
                                                <CardContent>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>From</TableHead>
                                                                <TableHead>To</TableHead>
                                                                <TableHead>Evidence</TableHead>
                                                                <TableHead>Confidence</TableHead>
                                                                <TableHead>Description</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {cascadeLinks.map((link, i) => (
                                                                <TableRow key={i}>
                                                                    <TableCell className="font-mono">{link.fromProblem}</TableCell>
                                                                    <TableCell className="font-mono">{link.toProblem}</TableCell>
<TableCell>
                                                                            <Badge variant="outline" className={EVIDENCE_COLORS[link.evidenceLevel as keyof typeof EVIDENCE_COLORS]}>
                                                                                {link.evidenceLevel.replace(/_/g, " ")}
                                                                            </Badge>
                                                                        </TableCell>
                                                                    <TableCell>{(link.confidence * 100).toFixed(0)}%</TableCell>
                                                                    <TableCell className="max-w-[300px] truncate">{link.description}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === "history" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">Diagnostic History</h3>
                                    <div className="text-sm text-muted-foreground">
                                        Showing last {historyLength} ticks (adjustable above)
                                    </div>
                                </div>
                                <Alert className="bg-blue-500/10 border-blue-500/20">
                                    <AlertDescription>
                                        Historical time-series charts for market prices, industry health, household metrics, and cascade progression 
                                        will be rendered here using the history buffers from each diagnostic analyzer.
                                    </AlertDescription>
                                </Alert>
                                {latestReports.health && (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card>
                                            <CardHeader><CardTitle>Price Volatility (Last {historyLength} Ticks)</CardTitle></CardHeader>
                                            <CardContent>
                                                <pre className="text-xs bg-[#0a0a0a] p-3 rounded overflow-auto max-h-[300px]">
{JSON.stringify(
    Object.fromEntries(
        Object.entries(latestReports.health.prices.byGood)
            .filter(([, v]) => v.volatility !== null)
            .map(([k, v]) => [k, { volatility: v.volatility?.toFixed(4), current: v.currentPrice, change: v.priceChangePct.toFixed(4) }])
    ),
    null,
    2
)}
                                                </pre>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader><CardTitle>Treasury History (Last {historyLength} Ticks)</CardTitle></CardHeader>
                                            <CardContent>
                                                <pre className="text-xs bg-[#0a0a0a] p-3 rounded overflow-auto max-h-[300px]">
{JSON.stringify(
    latestReports.health.treasury,
    null,
    2
)}
                                                </pre>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}