import { pensionerRatio, studentRatio, workingRatio } from "../constants";
import { Population } from "./Population";
import { occupationStarterRatio } from "./occupationStarterRatio";

export function getPopulationBreakdown(n: number) {
    const ret = {
        pensioner: n * pensionerRatio,
        student: n * studentRatio
    } as any;
    
    const workingPopulation = n * workingRatio;

    for(const key in occupationStarterRatio) {
        ret[key] = occupationStarterRatio[key as keyof Population] * workingPopulation * 0.01;
    }

    return ret as Population;
}
