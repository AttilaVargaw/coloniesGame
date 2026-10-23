import { Entity } from "@/engine/entities/entity";
import { IndustryComponent } from "@/game/components/industryComponent";
import { ReactNode } from "react";
import { IndustryBreakdown } from "./IndustryBreakdown";
import { PopulationBreakdown } from "./PopulationBreakdown";
import { WarehouseBreakdown } from "./WarehouseBreakdown";
import { ColonySummary } from "./colonySummary";
import { TradeBreakdown } from "./tradeBreakdown";
import { MigrationBreakdown } from "./migrationBreakdown";
import { TabsContent } from "../ui/tabs";

export type DialogPage = "summary" | "population" | "warehouse" | "industry" | "trade" | "services" | "migration";

export function DialogInner({ industry }: { industry: IndustryComponent }): ReactNode {
    return <>
        <TabsContent style={{ overflowY: "auto", }} value="summary">
            <ColonySummary industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="population">
            <PopulationBreakdown industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="warehouse">
            <WarehouseBreakdown showPhysical industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="industry">
            <IndustryBreakdown industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="trade">
            <TradeBreakdown industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="services">
            <WarehouseBreakdown industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="migration">
            <MigrationBreakdown industry={industry} />
        </TabsContent>
    </>
}
