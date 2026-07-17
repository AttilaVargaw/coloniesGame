import { LabelComponent } from "@/ems/components/label";
import { Entity } from "@/ems/entities/entity";

import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Dialog } from "../ui/dialog";
import { IndustryComponent } from "@/ems/components/industryComponent";
import { Slider } from "../ui/slider";
import { InfoComponent } from "@/ems/components/infoComponent";
import { PatronGoodInfo } from "./patronGoodInfo";

export function ColoniesInforWindow({ entity, setIsOpen }: { entity?: Entity, setIsOpen: (isOpen: boolean) => void }) {
    if(!entity) return null

    const name = entity.getComponent(LabelComponent)
    const { consumerGoodsRatio, happiness, population, production } = entity.getComponent(IndustryComponent)!
    const info = entity.getComponent(InfoComponent)

    return <Dialog modal open={!!entity} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm" >
            <DialogHeader>
                <DialogTitle>{name?.text}</DialogTitle>
                <DialogDescription>
                    {info && <PatronGoodInfo info={info} />}
                    <br />
                    Happiness: {(happiness * 100).toLocaleString()}
                    <br />
                    Population: {Math.floor(population).toLocaleString()}
                    <br />
                </DialogDescription>
                <DialogDescription>
                    Tylium:
                    <br />
                    Raw materials:
                    <br />
                </DialogDescription>

                <DialogDescription>
                    Full production: {production.toLocaleString()}
                    <br />
                </DialogDescription>

                <DialogDescription>
                    Growth:
                    <br />
                    Consumer goods ratio: {consumerGoodsRatio * 100}%
                    <br />
                    <Slider onValueChange={([value]) => {
                        entity.getComponent(IndustryComponent)!.consumerGoodsRatio = value
                    }}
                        defaultValue={[consumerGoodsRatio]}
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