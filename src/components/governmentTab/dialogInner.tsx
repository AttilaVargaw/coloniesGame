import { IndustryComponent } from "@/game/components/industryComponent";
import { Entity } from "@/engine/entities/entity";
import { ReactNode } from "react";
import { TabsContent } from "../ui/tabs";
import { Religion } from "./religion";
import { Research } from "./research";
import { LawsPanel } from "./lawsPanel";
import { IndustryPolicyPanel } from "./industryPolicyPanel";

export function DialogInner({ industry, colony }: { industry: IndustryComponent; colony: Entity }): ReactNode {
    return <>
        <TabsContent style={{ overflowY: "auto", }} value="religion">
            <Religion industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="research">
            <Research colony={colony} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="laws">
            <LawsPanel colony={colony} industry={industry} />
        </TabsContent>
        <TabsContent style={{ overflowY: "auto", }} value="industryPolicy">
            <IndustryPolicyPanel colony={colony} industry={industry} />
        </TabsContent>
    </>
}
