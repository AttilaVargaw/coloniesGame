
const dayMs = 1000 * 60 * 60 * 24
const rDayMs = 1 / dayMs

let months: ReadonlyMap<number, { name: string; days: number; ms: number }>
let monthsArr: { name: string; days: number; ms: number }[]
let yearLength: number

(function () {
    let ms = 0
    const monthsList: { name: string; days: number; ms: number }[] = []
    monthsList.push({ name: "Martius", days: 31, ms })
    ms += dayMs * 31
    monthsList.push({ name: "Aprilis", days: 30, ms })
    ms += dayMs * 30
    monthsList.push({ name: "Maius", days: 31, ms })
    ms += dayMs * 31
    monthsList.push({ name: "Iunius", days: 30, ms })
    ms += dayMs * 30
    monthsList.push({ name: "Quntilis", days: 31, ms })
    ms += dayMs * 31
    monthsList.push({ name: "Sextilis", days: 30, ms })
    ms += dayMs * 30
    monthsList.push({ name: "September", days: 30, ms })
    ms += dayMs * 30
    monthsList.push({ name: "October", days: 31, ms })
    ms += dayMs * 31
    monthsList.push({ name: "November", days: 30, ms })
    ms += dayMs * 30
    monthsList.push({ name: "December", days: 30, ms })

    months = new Map(monthsList.map((m, i) => [i, m])) as ReadonlyMap<number, { name: string; days: number; ms: number }>
    monthsArr = [...months.values()]
    yearLength = monthsArr.reduce((a, b) => a + b.days, 0) * dayMs
})()

function getYear(ms: number) {
    return ms / yearLength
}

export const hourLength = 1000 * 60 * 60

function getMonthIndex(ms: number) {
    const correctedMs = ms % yearLength

    const result = monthsArr.findIndex((month) => month.ms > correctedMs)

    return result < 0 ? 9 : result - 1
}

function getMonthDay(ms: number) {
    const correctedMs = ms % yearLength

    return (correctedMs - months.get(getMonthIndex(correctedMs))!.ms) * rDayMs
}

export interface ColonialDate {
    readonly ms: number
    readonly day: number
    readonly month: number
    readonly year: number
    readonly monthString: string
    readonly hour: number
    readonly minute: number
}

export function ColonialDate(ms: number): ColonialDate {
    const date = ms

    return {
        get ms() { return date },
        get day() { return Math.floor(getMonthDay(date) + 1) },
        get month() { return getMonthIndex(date) + 1 },
        get year() { return Math.floor(getYear(date)) + 1 },
        get monthString() { return months.get(getMonthIndex(date))!.name },
        get hour() { return Math.floor((date % dayMs) / (1000 * 60 * 60)) },
        get minute() { return Math.floor((date % (1000 * 60 * 60)) / (1000 * 60)) },
    }
}
