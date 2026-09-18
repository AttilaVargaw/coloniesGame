import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    mine: 0.0000001,
    oilRig: 0.00000008,
    forestry: 0.00000026,
    farm: 0.00000088,
    fishery: 0.000006,
    foodFactory: 0.000002,
    luxuryFood: 0.0000012,
    waterTreatment: 0.0000008,
    powerPlant: 0.0000042,
    nuclearSector: 0.000001,
    greenEnergy: 0.000003,
    alternativeMedicine: 0.000008,
    metalFactory: 0.00000126,
    lumberMill: 0.0000064,
    machineryFactory: 0.00000248,
    medicineFactory: 0.000000088,
    consumerFactory: 0.000003,
    furnitureFactory: 0.00000168,
    ammunitionFactory: 0.000004,
    weaponFactory: 0.0000014,
    nuclearWeaponFactory: 0,
    ordnanceFactory: 0.0000004,
    spaceport: 0,
    spaceShipyard: 0,
    orbitalFactory: 0,
    construction: 0.000004,
    services: 0.0000062,
    tourism: 0.00000084,
    education: 0.000004,
    healthcare: 0.00000288,
    environmentControl: 0.000002,
    bank: 0.000001,
    religion: 0.00000016,
    lawEnforcement: 0.000003,
    chemical: 0.0000014,
    recycling: 0.000002,
    government: 0.00001,
    automotive: 0.00001,
    electronics: 0.00001,
} satisfies Readonly<Record<keyof IndustrialSectors, number>>;

const MIN_SECTOR_LEVEL = 0;

export function createStarterIndustry(population: number) {
    const sectors = {} as Record<keyof IndustrialSectors, number>;

    for(const key of Object.keys(PER_CAPITA_SECTOR_RATIOS) as (keyof IndustrialSectors)[]) {
        const scaled = population * PER_CAPITA_SECTOR_RATIOS[key];
        sectors[key] = Math.max(MIN_SECTOR_LEVEL, Math.round(scaled));
    }

    return sectors as IndustrialSectors;
}

export function createStarterSectorWealth(sectors: IndustrialSectors): Record<keyof IndustrialSectors, number> {
    const baseWealth = 100_00_000;
    const wealthPerLevel = 5000;
    return Object.fromEntries(
        Object.keys(sectors).map(key => [key, baseWealth + wealthPerLevel * sectors[key as keyof IndustrialSectors]])
    ) as Record<keyof IndustrialSectors, number>;
}
