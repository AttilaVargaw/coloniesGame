import { LabelComponent } from "@engine/components/label";
import { Entity } from "@engine/entities/entity";

import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Dialog } from "../ui/dialog";
import { IndustryComponent } from "@game/components/industryComponent";
import { Slider } from "../ui/slider";
import { InfoComponent } from "@engine/components/infoComponent";
import { PatronGoodInfo } from "./patronGoodInfo";
import { useState } from "react";

export function useRerender() {
    const [, rerender] = useState(false)

    return () => setTimeout(() => {
        rerender((prev) => !prev)
    }, 5);
}

export function ColoniesInforWindow({ entity, setIsOpen, onConsumerGoodsRatioChange }: {
    entity?: Entity,
    setIsOpen: (isOpen: boolean) => void,
    onConsumerGoodsRatioChange: (colony: Entity, newValue: number) => void
}) {
    const rerender = useRerender()

    if(!entity) {
        return null
    }

    const industry = entity.getComponent(IndustryComponent)!
    const name = entity.getComponent(LabelComponent)
    const info = entity.getComponent(InfoComponent)

    return <Dialog modal open={!!industry} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm" >
            <DialogHeader>
                <DialogTitle>{name?.text}</DialogTitle>
                <DialogDescription>
                    {info && <PatronGoodInfo info={info} />}
                    <br />
                    Happiness: {(industry.happiness * 100).toLocaleString()}
                    <br />
                    Population: {Math.floor(industry.population).toLocaleString()}
                    <br />
                </DialogDescription>
                <DialogDescription>
                    Tylium:
                    <br />
                    Raw materials:
                    <br />
                </DialogDescription>

                <DialogDescription>
                    Full production: {industry.production.toLocaleString()}
                    <br />
                </DialogDescription>

                <DialogDescription>
                    Growth:
                    <br />
                    Consumer goods ratio: {industry.consumerGoodsRatio * 100}%
                    <br />
                    <Slider onValueChange={([value]) => {
                        rerender()
                        onConsumerGoodsRatioChange(entity, value)
                    }}
                        defaultValue={[industry.consumerGoodsRatio]}
                        step={0.1}
                        min={0}
                        max={1} />
                    <br />
                    Military spending:
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