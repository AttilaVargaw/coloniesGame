import { pensionerRatio, studentRatio, workingRatio } from "../constants";
import { baseSalaries, Population } from "./Population";
import { occupationStarterRatio } from "./occupationStarterRatio";

export function createStarterPopulation(n: number) {
    const ret = {
        retired: { number: n * pensionerRatio },
        student: { number: n * studentRatio }
    } as Population;

    const workingPopulation = n * workingRatio;

    for(const key in occupationStarterRatio) {
        ret[key as keyof Population] = {
            number: occupationStarterRatio[key as keyof Population] * workingPopulation * 0.01,
            wealth: 1,
            wealthLevel: 1,
            birthRate: 1,
            mortality: 0,
            populationChange: 0,
            qol: 50,
            salary: baseSalaries[key as keyof Population]
        };
    }

    return ret as Population;
}
