import { ColonialDate } from "@/lib/colonialCalendar"
import { useGameDate } from "@/hooks/useGameDate"
import { useGameEngine } from "@/hooks/useGameContext"
import { SetTimeScaleCommand } from "@/engine/lib/SetTimeScaleCommand"

const SPEEDS = [1, 5, 10, 100, 500] as const

export function Header() {
    const time = useGameDate()
    const date = ColonialDate(time)
    const engine = useGameEngine()

    const setSpeed = (multiplier: number) => {
        engine?.addCommand(new SetTimeScaleCommand(multiplier))
    }

    return (
        <div className="flex items-center justify-between bg-black p-4 text-white">
            <nav>
                <ul className="flex space-x-4">
                    <li>1000 ♉︎</li>
                </ul>
            </nav>
            <h1 className="text-2xl font-bold"></h1>
            <nav>
                <ul className="flex space-x-4 items-center">
                    {SPEEDS.map(speed => (
                        <li key={speed}>
                            <button
                                onClick={() => setSpeed(speed)}
                                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                            >
                                {speed}x
                            </button>
                        </li>
                    ))}
                    <li>{date.year} {date.monthString} {date.day}</li>
                </ul>
            </nav>
        </div>
    )
}
