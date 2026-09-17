import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    electricityFactory: 0.0002,
    foodFactory: 0.000005,
    metalFactory: 0.000001,
    uraniumFactory: 0.0000005,
    agriculturalFactory: 0.000002,
    consumerFactory: 0.0000005,
    ammunitionFactory: 0.0000005,
    machineryFactory: 0.0000005,
    medicineFactory: 0.0000005,
    buildingSector: 0.000001,
    nuclearWeaponFactory: 0,
    furnitureFactory: 0.0000005,
    weaponFactory: 0.0000005,
    forestry: 0.000001,
    oilFactory: 0.0000005,
    oilRig: 0,
    orbitalBuildingSector: 0,
    orbitalFactory: 0,
    spaceport: 0,
    spaceTransport: 0,
    waterFactory: 0.000005,
    environmentFactor: 0.000001,
    services: 0.0000005,
    tourism: 0,
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
