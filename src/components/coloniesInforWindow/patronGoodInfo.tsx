import { InfoComponent } from "@/ems/components/infoComponent";
import { Badge } from "../ui/badge";
import { TooltipTrigger, TooltipContent, Tooltip } from "../ui/tooltip";

export function PatronGoodInfo({ info: { info } }: { info: InfoComponent }) {
    const { patronGod, description, ...rest } = info

    return (
        <span className="flex ">
            <span className="flex-1">
                Protected by:
            </span>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge>{patronGod}</Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <div>
                        <div style={{ paddingBottom: "2em" }}>{description}</div>
                        {Object.keys(rest).map((key) => <div key={key}>{key}: {info[key]}</div>)}
                    </div>
                </TooltipContent>
            </Tooltip>
        </span>
    )
}