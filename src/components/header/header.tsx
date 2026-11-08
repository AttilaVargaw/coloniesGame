import { ColonialDate } from "@/lib/colonialCalendar"
import { useGameDate } from "@/hooks/useGameDate"
import { useGameEngine } from "@/hooks/useGameContext"
import { SetTimeScaleCommand } from "@/engine/lib/SetTimeScaleCommand"
import { DebugModal } from "@/components/header/DebugModal"
import { GovernmentModal } from "../governmentTab/government"
import { useEffect, useState } from "react"
import { Entity } from "@/engine/entities/entity"
import { cn } from "cn"
import { Button } from "../ui/button"

const SPEEDS = [0, 1, 10, 150, 500] as const

export function Header() {
    const time = useGameDate()
    const date = ColonialDate(time)
    const engine = useGameEngine()
    const [multiplier, setMultiplier] = useState(1)

    const setSpeed: React.MouseEventHandler<HTMLButtonElement> = ({ target }) => {
        //@ts-ignore
        const { id } = target

        setMultiplier(() => {
            engine?.addCommand(new SetTimeScaleCommand(Number.parseInt(id)))
            return multiplier
        })
    }

    const [colony, setColony] = useState<Entity>()

    useEffect(() => {
        if(engine) {
            setTimeout(() => {
                const colony = engine?.getEntityById("Caprica")!

                setColony(colony)
            }, 1000)
        }
    }, [engine])

    return (
        <div className="flex items-center justify-between bg-black p-4 text-white">
            <nav>
                <ul className="flex space-x-4">
                    <li>1000 ♉︎</li>
                    <li>
                        <DebugModal />
                    </li>
                    {colony && <li>
                        <GovernmentModal colony={colony!} />
                    </li>}
                </ul>
            </nav>
            <h1 className="text-2xl font-bold"></h1>
            <nav>
                <ul className="flex space-x-4 items-center">
                    {SPEEDS.map(speed => (
                        <li key={speed}>
                            <Button
                                id={`${speed}-button`}
                                onClick={setSpeed}
                                className={cn("px-2", "py-1", "rounded", "text-sm", multiplier === speed ? "bg-gray-900" : "bg-gray-800")}
                            >
                                {speed || "||"}{speed > 0 && "x"}
                            </Button>
                        </li>
                    ))}
                    <li>{date.year} {date.monthString} {date.day} {date.hour.toString().padStart(2, '0')}:{date.minute.toString().padStart(2, '0')}</li>
                </ul>
            </nav>
        </div>
    )
}
