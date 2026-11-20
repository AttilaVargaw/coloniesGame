import { DialogContent, DialogTitle, Dialog, DialogHeader, DialogTrigger } from "../ui/dialog";
import { TabsTrigger } from "../ui/tabs";
import { useState } from "react";
import { Entity } from "@/engine/entities/entity";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Button } from "../ui/button";
import { GoLaw } from "react-icons/go";
import { useGameEvent } from "@/hooks/useGameEvent";
import { IndustryUpdatedEvent } from "@/engine/lib/events";
import { GameDialogTabs, TabPanel } from "../economicDiagnosticsDashboard/DialogTabs";
import { Religion } from "./religion";
import { Research } from "./research";
import { LawsPanel } from "./lawsPanel";
import { IndustryPolicyPanel } from "./industryPolicyPanel";

export function GovernmentModal({ colony }: { colony: Entity }) {
    const [isOpen, setOpen] = useState(false)
    const [industry, setIndustry] = useState<IndustryComponent | null>({ ...colony.getComponent(IndustryComponent)! })

    useGameEvent(IndustryUpdatedEvent, (entity) => {
        if(entity.id === colony.id) {
            setIndustry({ ...entity.getComponent(IndustryComponent)! })
        }
    })

    return <Dialog modal={false} open={isOpen}>
        <DialogTrigger asChild>
            <Button onClick={() => setOpen(true)} variant="ghost" size="sm" className="text-xs">
                <GoLaw />
                Government
            </Button>
        </DialogTrigger>
        <DialogContent style={{
        }} className="bg-[#1c1c1c] text-white min-w-7xl" onCloseButtonClick={() => {
            setOpen(false)
        }}>
            <DialogHeader>
                <DialogTitle>Government</DialogTitle>
            </DialogHeader>
            <div style={{
                height: "80vh",
            }}>
                <GameDialogTabs
                    triggers={[
                        <TabsTrigger key="religion" value="religion">Religion</TabsTrigger>,
                        <TabsTrigger key="research" value="research">Research</TabsTrigger>,
                        <TabsTrigger key="laws" value="laws">Laws</TabsTrigger>,
                        <TabsTrigger key="industryPolicy" value="industryPolicy">Industry Policy</TabsTrigger>,
                    ]}
                >
                    {industry && (
                        <>
                            <TabPanel value="religion">
                                <Religion industry={industry} />
                            </TabPanel>
                            <TabPanel value="research">
                                <Research colony={colony} />
                            </TabPanel>
                            <TabPanel value="laws">
                                <LawsPanel colony={colony} industry={industry} />
                            </TabPanel>
                            <TabPanel value="industryPolicy">
                                <IndustryPolicyPanel colony={colony} industry={industry} />
                            </TabPanel>
                        </>
                    )}
                </GameDialogTabs>
            </div>
        </DialogContent>
    </Dialog >
}