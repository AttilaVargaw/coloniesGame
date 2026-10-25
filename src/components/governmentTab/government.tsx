import { DialogContent, DialogTitle, Dialog, DialogHeader } from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { useState } from "react";
import { DialogInner } from "./dialogInner";
import { Entity } from "@/engine/entities/entity";
import { IndustryComponent } from "@/game/components/industryComponent";

export function ColoniesInforWindow({ colony }: { colony: Entity }) {
    const [isOpen, setOpen] = useState(false)
    const industry = colony.getComponent(IndustryComponent)

    return <Dialog modal={false} open={isOpen}>
        <DialogContent className="bg-[#1c1c1c] text-white min-w-4xl" onCloseButtonClick={() => {
            setOpen(false)
        }}>
            <DialogHeader>
                <DialogTitle>Government</DialogTitle>
            </DialogHeader>
            <div style={{
                height: "75vh",
            }}>
                <Tabs defaultValue="overview" >
                    <TabsList style={{
                        height: "2em",
                        width: "100%"
                    }} >
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="population">Population</TabsTrigger>
                        <TabsTrigger value="warehouse">Warehouse</TabsTrigger>
                        <TabsTrigger value="industry">Industry</TabsTrigger>
                        <TabsTrigger value="trade">Trade</TabsTrigger>
                        <TabsTrigger value="migration">Migration</TabsTrigger>
                    </TabsList>
                    <div style={{
                        height: "calc(75vh - 2em)",
                        overflowY: "auto",
                        padding: "1em",
                    }}>
                        {industry && <DialogInner industry={industry} />}
                    </div>
                </Tabs>
            </div>
        </DialogContent>
    </Dialog >
}