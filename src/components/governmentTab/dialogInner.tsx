import { IndustryComponent } from "@/game/components/industryComponent";
import { ReactNode } from "react";
import { TabsContent } from "../ui/tabs";
import { Religion } from "./religion";
import { Research } from "./research";

export type DialogPage = "summary" | "population" | "warehouse" | "industry" | "trade" | "migration";

export function DialogInner({ industry }: { industry: IndustryComponent }): ReactNode {
    return <>
        <TabsContent style={{ overflowY: "auto", }} value="religion">
            <Religion industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="research">
            <Research industry={industry} />
        </TabsContent>
    </>
}
