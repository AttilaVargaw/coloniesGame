import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    mine: 0.0001,
    oilRig: 0.00008,
    forestry: 0.00026,
    farm: 0.000088,
    fishery: 0.00006,
    foodFactory: 0.00002,
    luxuryFood: 0.00012,
    waterTreatment: 0.00008,
    powerPlant: 0.000042,
    nuclearSector: 0.0001,
    greenEnergy: 0.0003,
    alternativeMedicine: 0.00008,
    metalFactory: 0.000126,
    lumberMill: 0.000064,
    machineryFactory: 0.0000248,
    medicineFactory: 0.000088,
    consumerFactory: 0.000056,
    furnitureFactory: 0.000168,
    ammunitionFactory: 0.00004,
    weaponFactory: 0.00014,
    nuclearWeaponFactory: 0,
    ordnanceFactory: 0.00004,
    spaceport: 0,
    spaceShipyard: 0,
    orbitalFactory: 0,
    construction: 0.00004,
    services: 0.000062,
    tourism: 0.000084,
    education: 0.00004,
    healthcare: 0.000288,
    environmentControl: 0.00002,
    bank: 0.0001,
    religion: 0.00016,
    lawEnforcement: 0.00003,
    chemical: 0.00014,
    recycling: 0.00002,
} as const satisfies Record<keyof IndustrialSectors, number>;

const MIN_SECTOR_LEVEL = 1;

export function createStarterIndustry(population: number) {
    const sectors = {} as Record<keyof IndustrialSectors, number>;

    for(const key of Object.keys(PER_CAPITA_SECTOR_RATIOS) as (keyof IndustrialSectors)[]) {
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
