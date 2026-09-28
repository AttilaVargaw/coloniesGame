import { LabelComponent } from "@engine/components/label";
import { Entity } from "@engine/entities/entity";
import { DialogContent, DialogTitle, Dialog, DialogHeader, DialogFooter } from "../ui/dialog";
import { IndustryComponent } from "@game/components/industryComponent";
import { InfoComponent } from "@engine/components/infoComponent";
import { PatronGoodInfo } from "./patronGoodInfo";
import { useRef, useState, useCallback } from "react";
import { useGameEvent } from "@/hooks/useGameEvent";
import { DayPassedEvent, SelectionChangedEvent, IndustryUpdatedEvent } from "@/engine/lib/events";
import { useSelectionChanged } from "@/hooks/useSelectionChanged";
import { ToggleGroup, ToggleGroupItem, } from "../ui/toggle-group";
import { DialogInner, DialogPage } from "./DialogInner";

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

    const [page, setPage] = useState<DialogPage>("population")

    return <Dialog modal={false} open={!!currentColony} onOpenChange={() => setCurrentColony(undefined)}>
        <DialogContent className="bg-[#1c1c1c] text-popover-foreground min-w-4xl">
            <DialogHeader>
                <DialogTitle>{name?.text}</DialogTitle>
            </DialogHeader>
            <div style={{
                height: "75vh",
                overflowY: "auto",
            }}>
                {info && <PatronGoodInfo info={info} />}
                <DialogInner industry={industry} page={page} entity={currentColony} />
            </div>
            <DialogFooter>
                <ToggleGroup style={{
                    height: "2em",
                    justifyContent: "space-between",
                    width: "100%"
                }} value={page} onValueChange={(value: DialogPage) => setPage((prev) => value || prev)} type="single">
                    <ToggleGroupItem value="summary">Summary</ToggleGroupItem>
                    <ToggleGroupItem value="population">Population</ToggleGroupItem>
                    <ToggleGroupItem value="warehouse">Warehouse</ToggleGroupItem>
                    <ToggleGroupItem value="industry">Industry</ToggleGroupItem>
                </ToggleGroup>
            </DialogFooter>
        </DialogContent>
    </Dialog >
}