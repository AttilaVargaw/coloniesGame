import { IndustryComponent } from "@/game/components/industryComponent";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { religionLaws } from "@/game/data/laws/religion";
import { useState } from "react";

export function Religion(_: { industry: IndustryComponent }) {
    const [currentReligion, setCurrentReligion] = useState("")

    return <div className="space-y-4 ">
        <h2 className="text-xl font-bold flex">State religion</h2>
        <Select name="State religion" onValueChange={setCurrentReligion}>
            <SelectTrigger className="w-full max-w-48">
                <SelectValue />
            </SelectTrigger>
            <SelectContent className="flex">
                <SelectGroup>
                    <SelectLabel>State religion</SelectLabel>
                    {[...religionLaws].map(([key,]) => (
                        <SelectItem key={key} value={key}>
                            {key}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
        <div>
            {religionLaws.get(currentReligion)?.desc}
        </div>
    </div>
}