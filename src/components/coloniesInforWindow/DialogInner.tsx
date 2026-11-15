import { IndustryComponent } from "@/game/components/industryComponent";
import { ReactNode } from "react";
import { IndustryBreakdown } from "./IndustryBreakdown";
import { PopulationBreakdown } from "./PopulationBreakdown";
import { WarehouseBreakdown } from "./WarehouseBreakdown";
import { ColonySummary } from "./colonySummary";
import { TradeBreakdown } from "./tradeBreakdown";
import { MigrationBreakdown } from "./migrationBreakdown";
import { TabsContent } from "../ui/tabs";

type DialogPage = "summary" | "population" | "warehouse" | "industry" | "trade" | "migration";

function DialogPage({ value, children }: { value: DialogPage; children: ReactNode }) {
    return (
        <TabsContent style={{ overflowY: "auto" }} value={value}>
            {children}
        </TabsContent>
    )
}

export function DialogInner({ industry }: { industry: IndustryComponent }): ReactNode {
    return <>
        <DialogPage value="summary">
            <ColonySummary industry={industry} />
        </DialogPage>
        <DialogPage value="population">
            <PopulationBreakdown industry={industry} />
        </DialogPage>
        <DialogPage value="warehouse">
            <WarehouseBreakdown showPhysical industry={industry} />
        </DialogPage>
        <DialogPage value="industry">
            <IndustryBreakdown industry={industry} />
        </DialogPage>
        <DialogPage value="trade">
            <TradeBreakdown industry={industry} />
        </DialogPage>
        <DialogPage value="migration">
            <MigrationBreakdown industry={industry} />
        </DialogPage>
    </>
}
