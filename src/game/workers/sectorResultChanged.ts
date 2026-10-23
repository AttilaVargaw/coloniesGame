import type { SectorResult } from "../systems/generateIndustrialSector";
import { shallowObjectsEqual } from "./shallowObjectsEqual";

export function sectorResultChanged(old: SectorResult, newSector: SectorResult): boolean {
    if(old.productionRatio !== newSector.productionRatio) return true;
    if(old.inputLevel !== newSector.inputLevel) return true;
    if(old.outputLevel !== newSector.outputLevel) return true;
    if(!shallowObjectsEqual(old.consumedGoods, newSector.consumedGoods)) return true;
    if(!shallowObjectsEqual(old.producedGoods, newSector.producedGoods)) return true;
    if(!shallowObjectsEqual(old.workersEmployed, newSector.workersEmployed)) return true;
    return false;
}
