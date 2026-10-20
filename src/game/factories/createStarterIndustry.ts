import { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    mine: 0.000005,
    oilRig: 0.0000028,
    forestry: 0.000026,
    farm: 0.0000088,
    fishery: 0.000006,
    foodFactory: 0.00006,
    luxuryFood: 0.00005,
    waterTreatment: 0.000005,
    powerPlant: 0.000004,
    nuclearSector: 0.00001,
    greenEnergy: 0.00003,
    alternativeMedicine: 0.000008,
    metalFactory: 0.00000526,
    lumberMill: 0.0000064,
    machineryFactory: 0.000004,
    medicineFactory: 0.000008,
    consumerFactory: 0.00008,
    furnitureFactory: 0.00005,
    ammunitionFactory: 0.000001,
    weaponFactory: 0.000002,
    nuclearWeaponFactory: 0,
    ordnanceFactory: 0.000004,
    orbitalFactory: 0,
    construction: 0.000006,
    services: 0.00006,
    tourism: 0.000084,
    education: 0.000009,
    healthcare: 0.00004,
    environmentControl: 0.000005,
    bank: 0.0001,
    religion: 0.00003,
    lawEnforcement: 0.00005,
    chemical: 0.000004,
    recycling: 0.000002,
    government: 0.00001,
    automotive: 0.0001,
    electronics: 0.00005,
    luxuryFurnitureFactory: 0.00005,
    railroadVehicles: 0.000002,
    aircraft: 0.000002,
    clothing: 0.0001,
    constructionMaterials: 0.000001,
    luxuryShips: 0.00001,
    ships: 0.000002,
    postalServices: 0.00005,
    paperFactory: 0.00001,
    entertainmentIndustry: 0.00005,
    informationTechnology: 0.00005,
    alcoholicDrinkIndustry: 0.0002,
    stimulantDrinkIndustry: 0.0002,
    retail: 0.00005,
    aircraftInfrastructure: 0.00004,
    automotiveInfrastructure: 0.00004,
    railroadInfrastructure: 0.00004,
    shipInfrastructure: 0.00004,
    luxurySpaceShips: 0.00004,
    spaceInfrastructure: 0.00004,
    spaceShips: 0.00005,
    nuclearEnergy: 0.0005,
    defense: 0.000015,
    militaryVehicles: 0.000002,
    spaceGoodsTransport: 0.000002,
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

export function createStarterSectorCapital(sectors: IndustrialSectors): Record<keyof IndustrialSectors, number> {
    return Object.fromEntries(
        Object.keys(sectors).map(key => [key, 0])
    ) as Record<keyof IndustrialSectors, number>;
}

export function createStarterSectorWealth(sectors: IndustrialSectors): Record<keyof IndustrialSectors, number> {
    const baseWealth = 100_00_000;
    const wealthPerLevel = 5000;

    return Object.fromEntries(
        Object.keys(sectors).map(key => [key, baseWealth + wealthPerLevel * sectors[key as keyof IndustrialSectors]])
    ) as Record<keyof IndustrialSectors, number>;
}
