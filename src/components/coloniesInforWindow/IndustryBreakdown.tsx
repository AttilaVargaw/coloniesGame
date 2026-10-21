import { IndustryComponent } from "@/game/components/industryComponent";
import { Entity } from "@/engine/entities/entity";
import { useGameEngine } from "@/hooks/useGameContext";
import { UpgradeSectorCommand } from "@/game/commands/UpgradeSectorCommand";
import { useCallback, useState } from "react";
import type { IndustrialSectors } from "@/game/components/Factories";
import type { Goods } from "@/game/data/Goods";
import type { Population } from "@/game/data/Population";
import { POPULATION_NAMES } from "@/components/icons/PopulationIcon";
import { SectorRow } from "./sectorRow";

export function isPopulationReq(name: keyof Population | keyof Goods): name is keyof Population {
    return name in POPULATION_NAMES;
}

export function IndustryBreakdown({ industry, entity }: { industry: IndustryComponent; entity: Entity; }) {
    const engine = useGameEngine();
    const [autoUpgrade, setAutoUpgrade] = useState<Partial<Record<keyof IndustrialSectors, boolean>>>(industry.autoUpgradeSectors)

    const handleUpgrade = useCallback((sectorName: keyof IndustrialSectors) => {
        if(!engine) return;
        engine.addCommand(new UpgradeSectorCommand(entity.id, sectorName));
    }, [engine, entity]);

    const toggleAutoUpgrade = useCallback((sectorName: keyof IndustrialSectors) => {
        setAutoUpgrade(prev => {
            const next = { ...prev, [sectorName]: !prev[sectorName] }
            industry.autoUpgradeSectors = next
            return next
        })
    }, [industry])

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-muted">
                        <th className="text-left p-2 font-medium">Sector</th>
                        <th className="text-center p-2 font-medium">Level</th>
                        <th className="text-center p-2 font-medium">Utilization</th>
                        <th className="text-center p-2 font-medium">Efficiency</th>
                        <th className="text-center p-2 font-medium">Profit</th>
                        <th className="text-center p-2 font-medium">Wealth</th>
                        <th className="text-center p-2 font-medium">Bottleneck</th>
                        <th className="text-left p-2 font-medium">Requirements</th>
                        {/* <th className="text-center p-2 font-medium">Upgrade</th>
                        <th className="text-center p-2 font-medium">Auto</th> */}
                    </tr>
                </thead>
                <tbody>
                    {Object.entries((industry.sectors as IndustrialSectors)).map(([key, value]) => (
                        <SectorRow
                            key={key}
                            rowKey={key}
                            sectorKey={key as keyof IndustrialSectors}
                            value={value}
                            industry={industry}
                            onUpgrade={handleUpgrade}
                            autoUpgrade={autoUpgrade}
                            onToggleAutoUpgrade={toggleAutoUpgrade}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
