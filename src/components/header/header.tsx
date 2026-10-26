import { ColonialDate } from "@/lib/colonialCalendar"
import { useGameDate } from "@/hooks/useGameDate"
import { useGameEngine } from "@/hooks/useGameContext"
import { SetTimeScaleCommand } from "@/engine/lib/SetTimeScaleCommand"
import { DebugModal } from "@/components/header/DebugModal"
import { GovernmentModal } from "../governmentTab/government"
import { useEffect, useRef, useState } from "react"
import { Entity } from "@/engine/entities/entity"
import { useSelectionChanged } from "@/hooks/useSelectionChanged"

const SPEEDS = [1, 5, 10, 100, 500] as const

export function Header() {
    const time = useGameDate()
    const date = ColonialDate(time)
    const engine = useGameEngine()

    const setSpeed = (multiplier: number) => {
        engine?.addCommand(new SetTimeScaleCommand(multiplier))
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
                    <li >
                        <button
                            onClick={() => {
                                setSpeed(0)
                            }}
                            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                        >
                            ||
                        </button>
                    </li>
                    {SPEEDS.map(speed => (
                        <li key={speed}>
                            <button
                                onClick={() => {
                                    setSpeed(speed)
                                }}
                                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                            >
                                {speed}x
                            </button>
                        </li>
                    ))}
                    <li>{date.year} {date.monthString} {date.day} {date.hour.toString().padStart(2, '0')}:{date.minute.toString().padStart(2, '0')}</li>
                </ul>
            </nav>
        </div>
    )
}
