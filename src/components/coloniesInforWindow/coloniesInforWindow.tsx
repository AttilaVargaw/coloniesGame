import { LabelComponent } from "@engine/components/label";
import { Entity } from "@engine/entities/entity";

import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Dialog } from "../ui/dialog";
import { IndustryComponent } from "@game/components/industryComponent";
import { Slider } from "../ui/slider";
import { InfoComponent } from "@engine/components/infoComponent";
import { PatronGoodInfo } from "./patronGoodInfo";
import { useState } from "react";
import { useGameEvent } from "@/hooks/useGameEvent";
import { DayPassedEvent } from "@/engine/lib/events";
import { getPopulationBreakdown } from "@/game/data/getPopulationBreakdown";

export function ColoniesInforWindow({ entity, setIsOpen, onAllocationChange }: {
    entity?: Entity,
    setIsOpen: (isOpen: boolean) => void,
    onAllocationChange: (colony: Entity, type: "civilian" | "military", value: number) => void
}) {
    const [civilianValue, setCivilianValue] = useState(0.5)
    const [militaryValue, setMilitaryValue] = useState(0.3)
    const [industry, setIndustry] = useState<IndustryComponent | null>(null)

    useGameEvent(DayPassedEvent, () => {
        if(entity) {
            setIndustry({ ...entity!.getComponent(IndustryComponent)! })
        }
    })

    if(!entity) {
        return null
    }
    const name = entity.getComponent(LabelComponent)
    const info = entity.getComponent(InfoComponent)

    return industry && <Dialog modal open={!!industry} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm" >
            <DialogHeader>
                <DialogTitle>{name?.text}</DialogTitle>
                <DialogDescription>
                    {info && <PatronGoodInfo info={info} />}
                    <br />
                    Happiness: {(industry.happiness * 100).toLocaleString()}%
                    <br />
                    {(() => {
                        const popGrowth = (industry.happiness - 0.5) * industry.population / 15000
                        const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}/day`
                        return <>Growth: {fmt(popGrowth)}<br /></>
                    })()}
                </DialogDescription>

                <DialogDescription>
                    <div className="flex flex-col gap-3">
                        <div>
                            Civilian goods: {(civilianValue * 100).toFixed(0)}%
                            <Slider min={0} max={1} step={0.05}
                                value={[civilianValue]}
                                onValueChange={([v]) => {
                                    setCivilianValue(v)
                                    onAllocationChange(entity, "civilian", v)
                                }} />
                        </div>
                        <div>
                            Military: {(militaryValue * 100).toFixed(0)}%
                            <Slider min={0} max={1} step={0.05}
                                value={[militaryValue]}
                                onValueChange={([v]) => {
                                    setMilitaryValue(v)
                                    onAllocationChange(entity, "military", v)
                                }} />
                        </div>
                    </div>
                    <br />
                    {(() => {
                        const popGrowth = (industry.happiness - 0.5) * industry.population / 15000
                        const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}/day`

                        return (
                            <>
                                Full Population: {Math.floor(industry.population).toLocaleString()} <span className="text-neutral-400">({fmt(popGrowth)})</span><br />
                                Working Population: {Math.floor(industry.population * industry.workingPopulationRatio).toLocaleString()}

                                {Object.entries(getPopulationBreakdown(industry.population)).map(([key, value]) => {
                                    return <div key={key}>{key}: {Math.floor(value).toLocaleString()}</div>
                                })}
                            </>
                        )
                    })()}
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <DialogClose asChild>
                    {/* <Button variant="outline">Cancel</Button> */}
                </DialogClose>
                {/* <Button type="submit">Save changes</Button> */}
            </DialogFooter>
        </DialogContent>
    </Dialog>
}
