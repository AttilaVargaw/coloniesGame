import { ColonialDate } from "@/lib/colonialCalendar"
import { useGameDate } from "@/hooks/useGameDate"
import { useGameEngine } from "@/hooks/useGameContext"
import { SetTimeScaleCommand } from "@/engine/lib/SetTimeScaleCommand"
import { DebugModal } from "@/components/header/DebugModal"
import { GovernmentModal } from "../governmentTab/government"
import { MouseEventHandler, useEffect, useState } from "react"
import { Entity } from "@/engine/entities/entity"
import { cn } from "cn"
import { Button } from "../ui/button"
import { GiTaurus } from "react-icons/gi"

const SPEEDS = [0, 1, 10, 150, 500] as const

export function Header() {
    const time = useGameDate()
    const date = ColonialDate(time)
    const engine = useGameEngine()
    const [multiplier, setMultiplier] = useState(1)

    const setSpeed: MouseEventHandler<HTMLButtonElement> = ({ target }) => {
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
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-4 text-white/80 backdrop-blur-xs border-b border-white/10">
            <nav>
                <ul className="flex space-x-4 text-xs text-white/50 uppercase tracking-widest">
                    <li>
                        <Button className="text-xs">
                            1000 <GiTaurus />
                        </Button>
                    </li>
                    <li>
                        <DebugModal />
                    </li>
                    {colony && <li>
                        <GovernmentModal colony={colony!} />
                    </li>}
                </ul>
            </nav>
            <h1 className="text-xs font-bold tracking-widest text-white uppercase letter-spacing-widest opacity-70"></h1>
            <nav>
                <ul className="flex space-x-4 items-center text-xs">
                    {SPEEDS.map(speed => (
                        <li key={speed}>
                            <Button
                                id={`${speed}-button`}
                                onClick={setSpeed}
                                className={cn("px-2 py-0.5 rounded-sm text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors", multiplier === speed ? "bg-white/20 text-white" : "text-white/40")}
                            >
                                {speed || "||"}{speed > 0 && "x"}
                            </Button>
                        </li>
                    ))}
                    <li className="text-white">{date.year} {date.monthString} {date.day} {date.hour.toString().padStart(2, '0')}:{date.minute.toString().padStart(2, '0')}</li>
                </ul>
            </nav>
        </div>
    )
}
