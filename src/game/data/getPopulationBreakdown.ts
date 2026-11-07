import { pensionerRatio, studentRatio, workingRatio } from "../constants";
import { baseSalaries, Population } from "./Population";
import { occupationStarterRatio } from "./occupationStarterRatio";

export function createStarterPopulation(n: number, occupationStarterRatioOverride?: Partial<Record<keyof Population, number>>) {
    const ret = {
        retired: { number: n * pensionerRatio, salary: 0, mortality: 0, populationChange: 0, qol: 0, expectedQol: 0, wealth: 1, wealthLevel: 1, birthRate: 0 },
        student: { number: n * studentRatio, birthRate: 0, mortality: 0, populationChange: 0, qol: 1, expectedQol: 1, salary: 0, wealth: 1, wealthLevel: 1 }
    } as Population;

    const workingPopulation = n * workingRatio;
    const ratios = { ...occupationStarterRatio, ...occupationStarterRatioOverride } as Record<keyof Population, number>;

    for(const key in ratios) {
        ret[key as keyof Population] = {
            number: ratios[key as keyof Population] * workingPopulation * 0.01,
            wealth: 1,
            wealthLevel: 1,
            birthRate: 1,
            mortality: 0,
            populationChange: 0,
            qol: 5,
            expectedQol: 50,
            salary: baseSalaries[key as keyof Population]
        };
    }

    return ret as Population;
}
