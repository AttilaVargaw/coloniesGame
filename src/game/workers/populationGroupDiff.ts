import { PopulationBreakdown } from "../data/Population";

export function populationGroupDiff(old: PopulationBreakdown | undefined, newGroup: PopulationBreakdown): Partial<PopulationBreakdown> | null {
    if(!old) return newGroup as Partial<PopulationBreakdown>;
    const changed: Partial<PopulationBreakdown> = {};
    let hasChanged = false;
    for(const key in newGroup) {
        if(old[key as keyof PopulationBreakdown] !== newGroup[key as keyof PopulationBreakdown]) {
            changed[key as keyof PopulationBreakdown] = newGroup[key as keyof PopulationBreakdown];
            hasChanged = true;
        }
    }
    return hasChanged ? changed : null;
}
