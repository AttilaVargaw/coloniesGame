let index = 0
let ms = 0

export const dayMs = 1000 * 60 * 60 * 24
export const rDayMs = 1 / dayMs

export const months = new Map([
    [index++, { name: "Martius", days: 31, ms }],
    [index++, { name: "Aprilis", days: 30, ms: ms += dayMs * 30 }],
    [index++, { name: "Maius", days: 31, ms: ms += dayMs * 31 }],
    [index++, { name: "Iunius", days: 30, ms: ms += dayMs * 30 }],
    [index++, { name: "Quntilis", days: 31, ms: ms += dayMs * 31 }],
    [index++, { name: "Sextilis", days: 30, ms: ms += dayMs * 30 }],
    [index++, { name: "September", days: 30, ms: ms += dayMs * 30 }],
    [index++, { name: "October", days: 31, ms: ms += dayMs * 31 }],
    [index++, { name: "November", days: 30, ms: ms += dayMs * 30 }],
    [index++, { name: "December", days: 30, ms: ms += dayMs * 30 }],
] as const)

const monthsArr = [...months.values()]

export const yearLength = monthsArr.reduce((a, b) => a + b.days, 0) * dayMs

function getYear(ms: number) {
    return ms / yearLength
}

function getMonthIndex(ms: number) {
    const correctedMs = ms % yearLength

    const result = monthsArr.findIndex((month) => month.ms > correctedMs)

    return result < 0 ? 9 : result - 1
}

function getMonthDay(ms: number) {
    const correctedMs = ms % yearLength

    return (correctedMs - months.get(getMonthIndex(correctedMs))!.ms) * rDayMs
}

export function ColonialDate(ms: number) {
    let date = ms

    return {
        ms: date,
        get day() { return Math.floor(getMonthDay(date) + 1) },
        get month() { return getMonthIndex(date) + 1 },
        get year() { return Math.floor(getYear(date)) + 1 },
        get monthString() { return months.get(getMonthIndex(date))!.name }
    }
}
