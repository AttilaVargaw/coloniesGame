import type { SectorResult } from "../systems/generateIndustrialSector";
import { sectorResultChanged } from "./sectorResultChanged";

export function buildSectorResultsPatch(
    old: Record<string, SectorResult> | undefined,
    newResults: Record<string, SectorResult>
): { changed: Record<string, SectorResult>; removed: string[] } | null {
    const changed: Record<string, SectorResult> = {};
    const removed: string[] = [];
    let hasChanged = false;

    for(const key in newResults) {
        const oldSector = old?.[key];
        const newSector = newResults[key];
        if(!oldSector || sectorResultChanged(oldSector, newSector)) {
            changed[key] = newSector;
            hasChanged = true;
        }
    }

    if(old) {
        for(const key in old) {
            if(!(key in newResults)) {
                removed.push(key);
                hasChanged = true;
            }
        }
    }

    return hasChanged ? { changed, removed } : null;
}
