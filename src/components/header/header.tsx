import { ColonialDate } from "@/lib/colonialCalendar"

export function Header({ time }: { time: number }) {
    const date = ColonialDate(time)

    return (
        <div className="flex items-center justify-between bg-black p-4 text-white">
            <nav>
                <ul className="flex space-x-4">
                    <li>1000 ♉︎</li>
                </ul>
            </nav>
            <h1 className="text-2xl font-bold"></h1>
            <nav>
                <ul className="flex space-x-4">
                    <li>{date.year} {date.monthString} {date.day}</li>
                </ul>
            </nav>
        </div>
    )
}