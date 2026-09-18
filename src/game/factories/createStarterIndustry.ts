import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    mine: 0.0001,
    oilRig: 0.00008,
    forestry: 0.00026,
    farm: 0.00088,
    fishery: 0.0006,
    foodFactory: 0.002,
    luxuryFood: 0.0012,
    waterTreatment: 0.00008,
    powerPlant: 0.00042,
    nuclearSector: 0.0001,
    greenEnergy: 0.0003,
    alternativeMedicine: 0.00008,
    metalFactory: 0.00126,
    lumberMill: 0.00064,
    machineryFactory: 0.000248,
    medicineFactory: 0.000088,
    consumerFactory: 0.00056,
    furnitureFactory: 0.00168,
    ammunitionFactory: 0.00004,
    weaponFactory: 0.00014,
    nuclearWeaponFactory: 0,
    ordnanceFactory: 0.00004,
    spaceport: 0,
    spaceShipyard: 0,
    orbitalFactory: 0,
    construction: 0.0004,
    services: 0.00062,
    tourism: 0.00084,
    education: 0.00004,
    healthcare: 0.00288,
    environmentControl: 0.00002,
    bank: 0.0001,
    religion: 0.0016,
    lawEnforcement: 0.0003,
    chemical: 0.00014,
    recycling: 0.00002,
} as const satisfies Record<keyof IndustrialSectors, number>;

const MIN_SECTOR_LEVEL = 1;

export function createStarterIndustry(population: number) {
    const sectors = {} as Record<keyof IndustrialSectors, number>;

    for (const key of Object.keys(PER_CAPITA_SECTOR_RATIOS) as (keyof IndustrialSectors)[]) {
        const scaled = population * PER_CAPITA_SECTOR_RATIOS[key];
        sectors[key] = Math.max(MIN_SECTOR_LEVEL, Math.round(scaled));
    }

    return sectors as IndustrialSectors;
}

export function createStarterSectorWealth(): Record<keyof IndustrialSectors, number> {
    return Object.fromEntries(
        Object.keys(PER_CAPITA_SECTOR_RATIOS).map(key => [key, 100_00_000])
    ) as Record<keyof IndustrialSectors, number>;
}
