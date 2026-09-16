import { LabelComponent } from "@engine/components/label";
import { Entity } from "@engine/entities/entity";
import { DialogContent, DialogTitle, Dialog, DialogHeader, DialogFooter } from "../ui/dialog";
import { IndustryComponent } from "@game/components/industryComponent";
import { InfoComponent } from "@engine/components/infoComponent";
import { PatronGoodInfo } from "./patronGoodInfo";
import { ReactNode, useRef, useState, useCallback } from "react";
import { useGameEvent } from "@/hooks/useGameEvent";
import { DayPassedEvent, SelectionChangedEvent } from "@/engine/lib/events";
import { useSelectionChanged } from "@/hooks/useSelectionChanged";
import { ToggleGroup, ToggleGroupItem, } from "../ui/toggle-group";
import { WarehouseBreakdown } from "./WarehouseBreakdown";
import { PopulationBreakdown } from "./PopulationBreakdown";
import { IndustryBreakdown } from "./IndustryBreakdown";

export function ColoniesInforWindow() {
    const [industry, setIndustry] = useState<IndustryComponent | null>(null)
    const [currentColony, setCurrentColony] = useState<Entity>()
    const currentColonyRef = useRef(currentColony)
    currentColonyRef.current = currentColony
    useSelectionChanged(setCurrentColony);

    useGameEvent(DayPassedEvent, useCallback(() => {
        if(currentColonyRef.current) {
            setIndustry({ ...currentColonyRef.current!.getComponent(IndustryComponent)! })
        }
    }, []))

    useGameEvent(SelectionChangedEvent, ({ type, data }) => {
        if(type === "colony") {
            if(data) {
                setCurrentColony(data)
                setIndustry({ ...data!.getComponent(IndustryComponent)! })
            }
        }
    })

    const name = currentColony?.getComponent(LabelComponent)
    const info = currentColony?.getComponent(InfoComponent)

    const [page, setPage] = useState<string>("population")

    return <Dialog modal={false} open={!!currentColony} onOpenChange={() => setCurrentColony(undefined)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{name?.text}</DialogTitle>
            </DialogHeader>
            <div style={{
                height: "60vh",
            }}>
                {info && <PatronGoodInfo info={info} />}
                {
                    DialogInner(industry, page)
                }
            </div>
            <DialogFooter>
                <ToggleGroup style={{
                    height: "2em",
                    justifyContent: "space-between",
                    width: "100%"
                }} value={page} onValueChange={(value) => setPage((prev) => value || prev)} type="single">
                    <ToggleGroupItem value="population">Population</ToggleGroupItem>
                    <ToggleGroupItem value="warehouse">Warehouse</ToggleGroupItem>
                    <ToggleGroupItem value="industry">Industry</ToggleGroupItem>
                </ToggleGroup>
            </DialogFooter>
        </DialogContent>
    </Dialog >
}

function DialogInner(industry: IndustryComponent | null, page: string): ReactNode {
    if(!industry) return <></>;

    switch(page) {
        case "population":
            return <PopulationBreakdown industry={industry} />;
        case "warehouse":
            return <WarehouseBreakdown industry={industry} />;
        case "industry":
            return <IndustryBreakdown industry={industry} />;
    }
}

