import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    electricityFactory: 1.0,
    foodFactory: 0.15,
    metalFactory: 0.1,
    uraniumFactory: 0.05,
    agriculturalFactory: 0.2,
    consumerFactory: 0.1,
    ammunitionFactory: 0.05,
    machineryFactory: 0.05,
    medicineFactory: 0.05,
    buildingSector: 0.1,
    nuclearWeaponFactory: 0,
    furnitureFactory: 0.1,
    weaponFactory: 0.05,
    forestry: 0.1,
    oilFactory: 0.05,
    oilRig: 0,
    orbitalBuildingSector: 0,
    orbitalFactory: 0,
    spaceport: 0,
    spaceTransport: 0,
    waterFactory: 0.1,
    environmentFactor: 0.1,
    services: 0.1,
    tourism: 0,
} as const satisfies Record<keyof IndustrialSectors, number>;

export function createStarterIndustry(population: number) {
    const sectors = {} as Record<keyof IndustrialSectors, number>;

    for (const key of Object.keys(PER_CAPITA_SECTOR_RATIOS) as (keyof IndustrialSectors)[]) {
        sectors[key] = Math.max(1, Math.round(population * PER_CAPITA_SECTOR_RATIOS[key]));
    }

    return sectors as IndustrialSectors;
}
