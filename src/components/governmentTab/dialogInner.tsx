import { IndustryComponent } from "@/game/components/industryComponent";
import { ReactNode } from "react";
import { TabsContent } from "../ui/tabs";
import { Religion } from "./religion";

export type DialogPage = "summary" | "population" | "warehouse" | "industry" | "trade" | "migration";

export function DialogInner({ industry }: { industry: IndustryComponent }): ReactNode {
    return <>
        <TabsContent style={{ overflowY: "auto", }} value="summary">
            <Religion industry={industry} />
        </TabsContent>
    </>
}
