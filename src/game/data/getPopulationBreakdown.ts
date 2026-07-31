import { pensionerRatio, studentRatio, workingRatio } from "../constants";
import { Population } from "./Population";
import { occupationStarterRatio } from "./occupationStarterRatio";

export function createStarterPopulation(n: number) {
    const ret = {
        retired: n * pensionerRatio,
        student: n * studentRatio
    } as Population;

    const workingPopulation = n * workingRatio;

    for(const key in occupationStarterRatio) {
        ret[key as keyof Population] = occupationStarterRatio[key as keyof Population] * workingPopulation * 0.01;
    }

    return ret as Population;
}
