/*
    Occupation category (ISCO-08)	Typical share of employed population
    Managers	3–8%
    Professionals	15–25%
    Technicians & Associate Professionals	10–18%
    Clerical Support Workers	7–12%
    Service & Sales Workers	12–20%
    Skilled Agricultural, Forestry & Fishery Workers	1–30% (depends heavily on country)
    Craft & Related Trades Workers	8–15%
    Plant & Machine Operators & Assemblers	6–12%
    Elementary Occupations	8–20%
    Armed Forces Occupations	<1%
*/

import { ReadonlyRecord } from "@/lib/readonlyRecord";
import { Goods } from "./Goods";
import { QOL_LEVELS } from "./populationPackets";
import { getLowestRatio } from "../utils/getLowestRatio";

const WEALTH_DRAWDOWN_RATE = 0.01; // 1% of wealth available per day

export type PopulationBreakdown = {
    number: number
    wealth: number
    wealthLevel: number
    qol: number
    expectedQol: number
    populationChange: number
    mortality: number
    salary: number
    birthRate: number
}

export type Population = {
    farmer: PopulationBreakdown;
    scientist: PopulationBreakdown;
    worker: PopulationBreakdown;
    student: PopulationBreakdown;
    healtcarePersonal: PopulationBreakdown;
    policeMen: PopulationBreakdown;
    teacher: PopulationBreakdown;
    serviceWorker: PopulationBreakdown;
    clergy: PopulationBreakdown;
    retired: PopulationBreakdown;
    clerks: PopulationBreakdown
    engineer: PopulationBreakdown
    stayAtHome: PopulationBreakdown
    serviceMan: PopulationBreakdown
};

export const baseSalaries = {
    farmer: 200,
    scientist: 1000,
    armyMen: 200,
    navalReservist: 200,
    worker: 200,
    student: 180,
    healtcarePersonal: 500,
    policeMen: 200,
    marines: 200,
    teacher: 200,
    serviceWorker: 200,
    clergy: 200,
    retired: 180,
    clerks: 500,
    engineer: 500,
    stayAtHome: 180,
    serviceMan: 200
} as ReadonlyRecord<keyof Population, number>

export function sumPopulation(population: Population) {
    return Object.values(population).reduce((acc, curr) => acc + curr.number, 0);
}

export function getLowestPopulationRatio(requirements: Partial<Record<keyof Population, number>>, available: Record<string, PopulationBreakdown>, level: number, workerRatio: number) {
    return getLowestRatio(
        requirements as Record<string, number>,
        (key) => available[key]?.number ?? 0,
        level,
        workerRatio
    )
}

// export function getQol(population: keyof Population, goodPrices: Goods) {
//     const salary = baseSalaries[population]
// }

export function getRequirementsForQol(qol: number, number: number): Record<keyof Goods, number> {
    const clampedQol = Math.max(0, Math.min(80, qol));

    // Find floor and ceiling QOL levels
    let floorLevel = QOL_LEVELS[0];
    let ceilLevel = QOL_LEVELS[QOL_LEVELS.length - 1];

    for (let i = 0; i < QOL_LEVELS.length; i++) {
        if (QOL_LEVELS[i].id <= clampedQol) {
            floorLevel = QOL_LEVELS[i];
        } else {
            ceilLevel = QOL_LEVELS[i];
            break;
        }
    }

    // Exact level match or no ceiling above floor
    if (clampedQol <= floorLevel.id || ceilLevel.id <= floorLevel.id) {
        const requirements = {} as Record<keyof Goods, number>;
        for (const key in floorLevel.cumulativeData) {
            requirements[key as keyof Goods] = floorLevel.cumulativeData[key as keyof Goods] * number;
        }
        return requirements;
    }

    // Interpolate between floor and ceiling cumulative data
    const fraction = (clampedQol - floorLevel.id) / (ceilLevel.id - floorLevel.id);
    const allGoods = new Set([
        ...Object.keys(floorLevel.cumulativeData),
        ...Object.keys(ceilLevel.cumulativeData)
    ]) as Set<keyof Goods>;

    const requirements = {} as Record<keyof Goods, number>;
    for (const good of allGoods) {
        const floorVal = floorLevel.cumulativeData[good] ?? 0;
        const ceilVal = ceilLevel.cumulativeData[good] ?? 0;
        requirements[good] = ((1 - fraction) * floorVal + fraction * ceilVal) * number;
    }

    return requirements;
}

export function getGoodRequirementsAndQoL(salary: number, goodsPrices: Goods, { number, wealth }: PopulationBreakdown) {
    if(!Number.isFinite(number) || !Number.isFinite(wealth)) {
        return { requirements: {} as Record<keyof Goods, number>, qol: 0 }
    }

    let qol = 0
    let lastAffordableCumulativeCost = 0
    let lastAffordableId = 0
    let lastAffordableData: Partial<Record<keyof Goods, number>> = {}
    const budget = salary + wealth * WEALTH_DRAWDOWN_RATE;

    for (const level of QOL_LEVELS) {
        const cumulativeCost = Object.entries(level.cumulativeData).reduce(
            (acc, [key, value]) => {
                const price = goodsPrices[key as keyof Goods] ?? 0;
                return acc + (value as number) * Math.max(price, 0);
            },
            0
        )

        if (budget >= cumulativeCost) {
            qol = level.id
            lastAffordableCumulativeCost = cumulativeCost
            lastAffordableId = level.id
            lastAffordableData = level.cumulativeData
        } else {
            const margin = budget - lastAffordableCumulativeCost
            const gap = cumulativeCost - lastAffordableCumulativeCost

            if (gap > 0 && margin >= 0) {
                qol = lastAffordableId + (margin / gap) * (level.id - lastAffordableId)
            }
            break
        }
    }

    const requirements = {} as Record<keyof Goods, number>
    for (const key in lastAffordableData) {
        requirements[key as keyof Goods] = (lastAffordableData[key as keyof Goods] ?? 0) * number
    }

    return { requirements, qol }
}