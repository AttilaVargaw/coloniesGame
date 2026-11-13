import { DialogContent, DialogTitle, Dialog, DialogHeader, DialogTrigger } from "../ui/dialog";
import { TabsTrigger } from "../ui/tabs";
import { useState } from "react";
import { DialogInner } from "./dialogInner";
import { Entity } from "@/engine/entities/entity";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Button } from "../ui/button";
import { GoLaw } from "react-icons/go";
import { useGameEvent } from "@/hooks/useGameEvent";
import { IndustryUpdatedEvent } from "@/engine/lib/events";
import { GameDialogTabs } from "../coloniesInforWindow/DialogTabs";

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
                    {industry && <DialogInner industry={industry} colony={colony} />}
                </GameDialogTabs>
            </div>
        </DialogContent>
    </Dialog >
}