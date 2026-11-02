import { laws, type Law } from "@/game/systems/laws";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Entity } from "@/engine/entities/entity";
import { EnactLawCommand, RepealLawCommand } from "@/game/commands/IndustryPolicyCommand";
import { useGameEngine } from "@/hooks/useGameContext";
import { Button } from "../ui/button";
import { useMemo } from "react";

function effectSummary(law: Law): string {
    return law.effects.map((e) => {
        if(e.type === "disable_sector") return `Disable ${e.sector ?? "sector"}`;
        if(e.type === "efficiency_penalty") return `${e.sector ?? "sector"} ×${e.value}`;
        return e.name;
    }).join(" • ");
}

export function LawsPanel({ colony, industry }: { colony: Entity; industry: IndustryComponent }) {
    const engine = useGameEngine();
    const activeLaws = industry.activeLaws;

    const enact = (lawId: string) => {
        if(!engine) return;
        engine.addCommand(new EnactLawCommand(colony.id, lawId));
    };

    const repeal = (lawId: string) => {
        if(!engine) return;
        engine.addCommand(new RepealLawCommand(colony.id, lawId));
    };

    const lawList = useMemo(() => [...laws.entries()], []);

    return (
        <div className="space-y-3 p-2 text-sm">
            <h2 className="text-lg font-bold mb-2">Laws &amp; Policies</h2>
            <p className="text-xs text-gray-400 mb-3">
                Enacting a law costs treasury funds and applies industry-wide effects.
            </p>
            {lawList.map(([lawId, law]) => {
                const isActive = activeLaws.has(lawId);
                return (
                    <div
                        key={lawId}
                        className={`border rounded-lg p-3 ${
                            isActive ? "border-green-500/50 bg-green-500/10" : "border-gray-600/50 bg-gray-800/50"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                                <div className="font-medium">{law.name}</div>
                                <div className="text-xs text-gray-400">{law.desc}</div>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                                <span className="text-gray-400">Cost: </span>
                                <span className="font-mono text-yellow-400">{law.cost}</span>
                            </div>
                        </div>
                        <div className="text-xs text-gray-300 mb-2">
                            {effectSummary(law)}
                        </div>
                        <Button
                            size="sm"
                            onClick={() => isActive ? repeal(lawId) : enact(lawId)}
                            variant={isActive ? "destructive" : "default"}
                            disabled={!isActive && engine ? false : true}
                        >
                            {isActive ? "Repeal" : "Enact"}
                        </Button>
                        {isActive && (
                            <span className="text-xs text-green-400 mt-1 block">Active</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
