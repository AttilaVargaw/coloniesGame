import { useState, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useGameEngine } from "@/hooks/useGameContext";
import { IndustryTickCompletedEvent } from "@engine/lib/events/IndustryTickCompletedEvent";
import { useGameEvent } from "@/hooks/useGameEvent";
import { EconomicHealthMetrics } from "@/game/economics/diagnostics/economicHealthMetrics";
import { MarketStabilityAnalyzer } from "@/game/economics/diagnostics/marketStabilityAnalyzer";
import { IndustryHealthReport } from "@/game/economics/diagnostics/industryHealthAnalyzer";
import { HouseholdHealthReport } from "@/game/economics/diagnostics/householdHealthAnalyzer";

import { GameDialogTabs, TabPanel } from "./DialogTabs";
import { OverviewPanel } from "./OverviewPanel";
import { MarketPanel } from "./MarketPanel";
import { IndustryPanel } from "./IndustryPanel";
import { HouseholdPanel } from "./HouseholdPanel";
import { TreasuryPanel } from "./TreasuryPanel";

interface EconomicDiagnosticsDashboardProps {
    entityId: string;
}

export function EconomicDiagnosticsDashboard({ entityId }: EconomicDiagnosticsDashboardProps) {
    const [open, setOpen] = useState(false);
    const engine = useGameEngine();

    const diagnostics = useMemo(() => {
        if(!engine) return null;
        return engine.getEconomicDiagnostics();
    }, [engine]);

    const healthMetrics = diagnostics?.health ?? null;
    const marketAnalyzer = diagnostics?.market ?? null;
    const industryAnalyzer = diagnostics?.industry ?? null;
    const householdAnalyzer = diagnostics?.household ?? null;

    const [latestReports, setLatestReports] = useState<{
        health: ReturnType<EconomicHealthMetrics["getLatestSnapshot"]> | null;
        market: ReturnType<MarketStabilityAnalyzer["analyze"]> | null;
        industry: IndustryHealthReport | null;
        household: HouseholdHealthReport | null;
    }>({
        health: null,
        market: null,
        industry: null,
        household: null,
    });

    const updateReports = useCallback((tick: number) => {
        if(!engine) return;

        if(healthMetrics) {
            const snapshot = healthMetrics.getLatestSnapshot(entityId);
            setLatestReports(prev => ({
                ...prev,
                health: snapshot,
            }));
        }
        if(marketAnalyzer) {
            const analysis = marketAnalyzer.analyze(tick, entityId);
            setLatestReports(prev => ({
                ...prev,
                market: analysis,
            }));
        }
        if(industryAnalyzer) {
            const analysis = industryAnalyzer.analyze(tick, entityId);
            setLatestReports(prev => ({
                ...prev,
                industry: analysis,
            }));
        }
        if(householdAnalyzer) {
            const analysis = householdAnalyzer.analyze(tick, entityId);
            setLatestReports(prev => ({
                ...prev,
                household: analysis,
            }));
        }
    }, [engine, entityId, healthMetrics, marketAnalyzer, industryAnalyzer, householdAnalyzer]);

    const updateReportsRef = useRef(updateReports);
    updateReportsRef.current = updateReports;

useGameEvent(IndustryTickCompletedEvent, useCallback((data) => {
        // Only update for our entity
        if (data.entity.id !== entityId) return;
        updateReports(data.tick);
    }, [entityId]));

    return (
        <Dialog modal={false} open={open}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    className="px-2 py-1 rounded-sm text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    onClick={() => setOpen(true)}
                >
                    <span className="flex items-center gap-1">
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Diagnostics
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent onCloseButtonClick={() => setOpen(false)} className="bg-[#1c1c1c] text-white max-w-5xl min-w-7xl">
                <DialogHeader>
                    <DialogTitle>Economic Diagnostics Dashboard</DialogTitle>
                </DialogHeader>

                <div style={{ height: "75vh" }}>
                    <GameDialogTabs
                        triggers={[
                            <TabsTrigger key="overview" value="overview">Overview</TabsTrigger>,
                            <TabsTrigger key="markets" value="markets">Markets</TabsTrigger>,
                            <TabsTrigger key="industries" value="industries">Industries</TabsTrigger>,
                            <TabsTrigger key="households" value="households">Households</TabsTrigger>,
                            <TabsTrigger key="treasury" value="treasury">Treasury</TabsTrigger>,
                        ]}
                    >
                        <TabPanel value="overview">
                            <OverviewPanel
                                health={latestReports.health}
                                market={latestReports.market}
                                industry={latestReports.industry}
                                household={latestReports.household}
                            />
                        </TabPanel>

                        <TabPanel value="markets">
                            <MarketPanel market={latestReports.market} />
                        </TabPanel>

                        <TabPanel value="industries">
                            <IndustryPanel industry={latestReports.industry} />
                        </TabPanel>

                        <TabPanel value="households">
                            <HouseholdPanel household={latestReports.household} />
                        </TabPanel>

                        <TabPanel value="treasury">
                            <TreasuryPanel health={latestReports.health} />
                        </TabPanel>
                    </GameDialogTabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}