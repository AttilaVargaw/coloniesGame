import { describe, it, expect } from "vitest"
import { ColonialDate, hourLength } from "./colonialCalendar"

const dayMs = 1000 * 60 * 60 * 24

describe("ColonialDate", () => {
    it("year 1 day 1 is at ms = 0", () => {
        const d = ColonialDate(0)
        expect(d.year).toBe(1)
        expect(d.month).toBe(1)
        expect(d.day).toBe(1)
        expect(d.monthString).toBe("Martius")
        expect(d.hour).toBe(0)
        expect(d.minute).toBe(0)
    })

    it("ms is preserved as-is", () => {
        const d = ColonialDate(123456789)
        expect(d.ms).toBe(123456789)
    })

    it("advances day by dayMs", () => {
        const d0 = ColonialDate(0)
        const d1 = ColonialDate(dayMs)
        expect(d1.day).toBe(d0.day + 1)
        expect(d1.month).toBe(d0.month)
        expect(d1.year).toBe(d0.year)
    })

    it("rolls over month at end of Martius (31 days)", () => {
        const endOfMartius = ColonialDate(dayMs * 30) // day 31 (0-indexed day 30)
        expect(endOfMartius.day).toBe(31)
        expect(endOfMartius.month).toBe(1)

        const firstOfAprilis = ColonialDate(dayMs * 31) // day 1 of month 2
        expect(firstOfAprilis.day).toBe(1)
        expect(firstOfAprilis.month).toBe(2)
        expect(firstOfAprilis.monthString).toBe("Aprilis")
    })

    it("rolls over year at end of December (365 days)", () => {
        // Total days: 31+30+31+30+31+30+30+31+30+30 = 304... let's compute
        const daysInYear = [31, 30, 31, 30, 31, 30, 30, 31, 30, 30].reduce((a, b) => a + b, 0)
        const lastDay = ColonialDate(dayMs * (daysInYear - 1))
        expect(lastDay.day).toBe(30)
        expect(lastDay.month).toBe(10)
        expect(lastDay.year).toBe(1)

        const firstDayNextYear = ColonialDate(dayMs * daysInYear)
        expect(firstDayNextYear.day).toBe(1)
        expect(firstDayNextYear.month).toBe(1)
        expect(firstDayNextYear.year).toBe(2)
        expect(firstDayNextYear.monthString).toBe("Martius")
    })

    it("computes hour correctly", () => {
        const d = ColonialDate(hourLength * 5 + 1000 * 60 * 30)
        expect(d.hour).toBe(5)
        expect(d.minute).toBe(30)
    })

    it("computes minute correctly", () => {
        const d = ColonialDate(1000 * 60 * 45)
        expect(d.hour).toBe(0)
        expect(d.minute).toBe(45)
    })

    it("all month names are correct", () => {
        const expected = [
            "Martius", "Aprilis", "Maius", "Iunius", "Quntilis",
            "Sextilis", "September", "October", "November", "December",
        ]
        const daysPerMonth = [31, 30, 31, 30, 31, 30, 30, 31, 30, 30]
        let ms = 0
        for(let i = 0; i < expected.length; i++) {
            const d = ColonialDate(ms)
            expect(d.monthString).toBe(expected[i])
            expect(d.month).toBe(i + 1)
            ms += dayMs * daysPerMonth[i]
        }
    })
})
