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
import { populationPackets } from "./populationPackets";

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
    armyMen: PopulationBreakdown;
    navalReservist: PopulationBreakdown;
    worker: PopulationBreakdown;
    student: PopulationBreakdown;
    healtcarePersonal: PopulationBreakdown;
    policeMen: PopulationBreakdown;
    marines: PopulationBreakdown;
    teacher: PopulationBreakdown;
    serviceWorker: PopulationBreakdown;
    clergy: PopulationBreakdown;
    retired: PopulationBreakdown;
    clerks: PopulationBreakdown
    engineer: PopulationBreakdown
    stayAtHome: PopulationBreakdown
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
    stayAtHome: 180
} as ReadonlyRecord<keyof Population, number>

export function sumPopulation(population: Population) {
    return Object.values(population).reduce((acc, curr) => acc + curr.number, 0);
}

export function getLowestPopulationRatio(requirements: Partial<Record<keyof Population, number>>, available: Record<string, PopulationBreakdown>, level: number, workerRatio: number) {
    const workerRatios = {} as Record<string, number>

    for(const [key, requirement] of Object.entries(requirements)) {
        const t = available[key].number - requirement * level * workerRatio

        if(t > 0) {
            workerRatios[key] = 1
        } else {
            workerRatios[key] = Math.max(0, available[key].number / (requirement * level * workerRatio))
        }
    }

    const entries = Object.entries(workerRatios)
    if(entries.length === 0) return 1

    return Math.max(0, Math.min(...entries.map(([, v]) => v), 1))
}

// export function getQol(population: keyof Population, goodPrices: Goods) {
//     const salary = baseSalaries[population]
// }

export function getRequirementsForQol(qol: number, number: number): Record<keyof Goods, number> {
    let lastData: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;

    for(const { data, id } of populationPackets.cumulative) {
        if(Number(id) <= qol) {
            lastData = data as Record<keyof Goods, number>;
        } else {
            break;
        }
    }

    const requirements = {} as Record<keyof Goods, number>;
    for(const [key, value] of Object.entries(lastData)) {
        requirements[key as keyof Goods] = value * number;
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

    for(const { data, id } of populationPackets.cumulative) {
        const cumulativeCost = Object.entries(data).reduce((acc, [key, value]) => {
            return acc + (value as number) * goodsPrices[key as keyof Goods]
        }, 0)
        const budget = salary + wealth

        if(budget >= cumulativeCost) {
            qol = Number(id)
            lastAffordableCumulativeCost = cumulativeCost
            lastAffordableId = Number(id)
            lastAffordableData = data as Record<keyof Goods, number>
        } else {
            const margin = budget - lastAffordableCumulativeCost
            const gap = cumulativeCost - lastAffordableCumulativeCost

            if(gap > 0 && margin >= 0) {
                qol = lastAffordableId + (margin / gap) * (Number(id) - lastAffordableId)
            }
            break
        }
    }

    const requirements = {} as Record<keyof Goods, number>
    for(const [key, value] of Object.entries(lastAffordableData)) {
        requirements[key as keyof Goods] = value * number
    }

    return { requirements, qol }
}