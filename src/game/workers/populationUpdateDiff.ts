import { Population } from "../data/Population";
import { IndustryTickResult } from "./IndustryTickResult";
import { shallowObjectsEqual } from "./shallowObjectsEqual";

export function populationUpdateDiff(old: IndustryTickResult["populationUpdates"][keyof Population], newUpdate: IndustryTickResult["populationUpdates"][keyof Population]): boolean {
    if(old.qol !== newUpdate.qol) return true;
    if(old.expectedQol !== newUpdate.expectedQol) return true;
    if(old.populationChange !== newUpdate.populationChange) return true;
    if(old.wealth !== newUpdate.wealth) return true;
    if(old.number !== newUpdate.number) return true;
    if(!shallowObjectsEqual(old.requirements, newUpdate.requirements)) return true;
    return false;
}
