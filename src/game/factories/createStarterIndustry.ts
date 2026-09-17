import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    mine: 0.000005,
    oilRig: 0.000004,
    forestry: 0.000013,
    farm: 0.000044,
    fishery: 0.00003,
    foodFactory: 0.0001,
    luxuryFood: 0.00006,
    waterTreatment: 0.000004,
    powerPlant: 0.000021,
    nuclearSector: 0.000005,
    metalFactory: 0.000063,
    lumberMill: 0.000032,
    machineryFactory: 0.000224,
    medicineFactory: 0.000044,
    consumerFactory: 0.000028,
    furnitureFactory: 0.000084,
    ammunitionFactory: 0.000002,
    weaponFactory: 0.000007,
    nuclearWeaponFactory: 0,
    ordnanceFactory: 0.000002,
    spaceport: 0,
    spaceShipyard: 0,
    orbitalFactory: 0,
    construction: 0.000002,
    services: 0.000031,
    tourism: 0.000042,
    education: 0.000002,
    healthcare: 0.000144,
    environmentControl: 0.000001,
    bank: 0.000005,
    religion: 0.00008,
    lawEnforcement: 0.000015,
    chemical: 0.000007,
} as const satisfies Record<keyof IndustrialSectors, number>;

const MIN_SECTOR_LEVEL = 2;

export function createStarterIndustry(population: number) {
    const sectors = {} as Record<keyof IndustrialSectors, number>;

    for (const key of Object.keys(PER_CAPITA_SECTOR_RATIOS) as (keyof IndustrialSectors)[]) {
        const scaled = population * PER_CAPITA_SECTOR_RATIOS[key];
        sectors[key] = Math.max(MIN_SECTOR_LEVEL, Math.round(scaled));
    }

    return sectors as IndustrialSectors;
}
