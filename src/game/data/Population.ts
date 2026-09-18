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
import { CumulativeLinkedList } from "@/lib/linkedList";

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
    miner: PopulationBreakdown;
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
};

export const baseSalaries = {
    farmer: 200,
    miner: 200,
    scientist: 1000,
    armyMen: 200,
    navalReservist: 200,
    worker: 200,
    student: 150,
    healtcarePersonal: 500,
    policeMen: 200,
    marines: 200,
    teacher: 200,
    serviceWorker: 200,
    clergy: 200,
    retired: 100,
    clerks: 500,
    investor: 0
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

function affordability(salary: number, goodsPrices: Goods, requirements: Record<keyof Goods, number>) {
    const ret = salary - Object.entries(requirements).reduce((acc, [key, value]) => acc + value * goodsPrices[key as keyof Goods], 0)

    return ret
}

export function getGoodRequirementsAndQoL(salary: number, goodsPrices: Goods, { number, wealth }: PopulationBreakdown) {
    let qol = 0

    const packets = new CumulativeLinkedList<Goods>({
        0: {
            basicFood: 0.5,
            water: 0.5,
            faith: 4,
            lawEnforcement: 1,
            healthcare: 4
        },
        10: {
            basicFood: 1,
            faith: 2,
            water: 1,
            healthcare: 3
        },
        20: {
            consumerGoods: 1,
            furniture: 1,
            healthcare: 2,
            buildings: 0.05
        },
        40: {
            faith: 1.5,
            services: 1,
            electricity: 1,
            food: 1,
            luxuryFood: 0.2,
            basicFood: 0.5,
            furniture: 1.5,
            healthcare: 1,
            Buildings: 0.01
        },
        50: {},
        80: {
            faith: 1,
            tourism: 1,
            luxuryFood: 1,
            luxuryFurniture: 1,
            buildings: 0.015
        }
    })

    const requirements = (Object.entries(packets.head.next!.data) as [keyof Goods, number][]).reduce((prev, [key, value]) => {
        prev[key] = value * number
        return prev
    }, {} as Record<keyof Goods, number>)

    for(const { data, id } of packets.cumulative) {
        if(affordability(salary + wealth, goodsPrices, data) >= 0) {
            qol = Number(id)

            for(const [key, value] of Object.entries(data)) {
                requirements[key as keyof Goods] = value * number
            }
        } else {
            break
        }
    }

    return { requirements, qol }
}