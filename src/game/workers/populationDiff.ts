import { Population, PopulationBreakdown } from "../data/Population";
import { populationGroupDiff } from "./populationGroupDiff";

export function populationDiff(old: Population | undefined, newPop: Population): Partial<Population> | null {
    if(!old) return newPop as Partial<Population>;
    const changed: Partial<Population> = {};
    let hasChanged = false;
    for(const key in newPop) {
        const oldGroup = old[key as keyof Population];
        const newGroup = newPop[key as keyof Population];
        const groupDiff = populationGroupDiff(oldGroup, newGroup);
        if(groupDiff) {
            changed[key as keyof Population] = groupDiff as PopulationBreakdown;
            hasChanged = true;
        }
    }
    return hasChanged ? changed : null;
}
