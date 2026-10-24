import { LabelComponent } from "@engine/components/label";
import { Entity } from "@engine/entities/entity";
import { DialogContent, DialogTitle, Dialog, DialogHeader } from "../ui/dialog";
import { IndustryComponent } from "@game/components/industryComponent";
import { InfoComponent } from "@engine/components/infoComponent";
import { PatronGoodInfo } from "./patronGoodInfo";
import { useRef, useState, useCallback } from "react";
import { useGameEvent } from "@/hooks/useGameEvent";
import { DayPassedEvent, SelectionChangedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { useSelectionChanged } from "@/hooks/useSelectionChanged";
import { DialogInner } from "./DialogInner";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

export function ColoniesInforWindow() {
    const [industry, setIndustry] = useState<IndustryComponent | null>(null)
    const [currentColony, setCurrentColony] = useState<Entity>()
    const currentColonyRef = useRef(currentColony)
    currentColonyRef.current = currentColony
    useSelectionChanged(setCurrentColony);

    useGameEvent(DayPassedEvent, useCallback(() => {
        if(currentColonyRef.current?.getComponent(IndustryComponent)) {
            setIndustry({ ...currentColonyRef.current.getComponent(IndustryComponent)! })
        }
    }, []))

    useGameEvent(IndustryUpdatedEvent, useCallback((entity) => {
        if(currentColonyRef.current?.id === entity.id && entity.getComponent(IndustryComponent)) {
            setIndustry({ ...entity.getComponent(IndustryComponent)! })
        }
    }, []))

    useGameEvent(SelectionChangedEvent, ({ type, data }) => {
        if(type === "colony") {
            if(data) {
                setCurrentColony(data)
                setIndustry({ ...data.getComponent(IndustryComponent)! })
            }
        } else {
            setCurrentColony(undefined)
            setIndustry(null)
        }
    })

    const name = currentColony?.getComponent(LabelComponent)
    const info = currentColony?.getComponent(InfoComponent)

    return <Dialog modal={false} open={!!currentColony}>
        <DialogContent className="bg-[#1c1c1c] text-white min-w-4xl" onCloseButtonClick={() => {
            setCurrentColony(undefined)
            setIndustry(null)
        }}>
            <DialogHeader>
                <DialogTitle>{name?.text}</DialogTitle>
            </DialogHeader>
            <div style={{
                height: "75vh",
            }}>
                {info && <PatronGoodInfo info={info} />}
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