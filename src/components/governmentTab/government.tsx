import { DialogContent, DialogTitle, Dialog, DialogHeader, DialogTrigger } from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { useState } from "react";
import { DialogInner } from "./dialogInner";
import { Entity } from "@/engine/entities/entity";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Button } from "../ui/button";
import { GoLaw } from "react-icons/go";
import { Research } from "./research";

export function GovernmentModal({ colony }: { colony: Entity }) {
    const [isOpen, setOpen] = useState(false)
    const industry = colony.getComponent(IndustryComponent)

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
                <Tabs defaultValue="overview" >
                    <TabsList style={{
                        height: "2em",
                        width: "100%"
                    }} >
                        <TabsTrigger value="religion">Religion</TabsTrigger>
                        <TabsTrigger value="research">Research</TabsTrigger>
                    </TabsList>
                    <div style={{
                        height: "calc(75vh - 2em)",
                        overflowY: "auto",
                        padding: "1em",
                    }}>
                        {industry && <DialogInner industry={industry} colony={colony} />}
                    </div>
                </Tabs>
            </div>
        </DialogContent>
    </Dialog >
}