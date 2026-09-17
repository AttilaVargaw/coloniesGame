import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    mine: 0.000001,
    oilRig: 0.0005,
    forestry: 0.000001,
    farm: 0.000002,
    foodFactory: 0.000005,
    waterTreatment: 0.005,
    powerPlant: 0.002,
    metalFactory: 0.0004,
    lumberMill: 0.000001,
    machineryFactory: 0.09,
    medicineFactory: 0.00005,
    consumerFactory: 0.0000005,
    furnitureFactory: 0.0000005,
    ammunitionFactory: 0.0000005,
    weaponFactory: 0.0000005,
    nuclearWeaponFactory: 0,
    ordnanceFactory: 0.0000005,
    spaceport: 0,
    spaceShipyard: 0,
    orbitalFactory: 0,
    construction: 0.000001,
    services: 0.0000005,
    tourism: 0,
    education: 0.0000005,
    healthcare: 0.0005,
    environmentControl: 0.000001,
    bank: 0.0000005,
    religion: 0.00005,
    lawEnforcement: 0.0000005,
    chemical: 0.0000005,
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
