import type { IndustrialSectors } from "../components/Factories";

const PER_CAPITA_SECTOR_RATIOS = {
    mine: 0.000001,
    oilRig: 0.0000028,
    forestry: 0.000006,
    farm: 0.0000088,
    fishery: 0.000006,
    foodFactory: 0.00006,
    meat: 0.00005,
    waterTreatment: 0.000005,
    powerPlant: 0.000004,
    nuclearSector: 0.00001,
    alternativeMedicine: 0.000008,
    metalFactory: 0.00000526,
    lumberMill: 0.0000064,
    machineryFactory: 0.000004,
    medicineFactory: 0.000008,
    consumerFactory: 0.00008,
    furnitureFactory: 0.00005,
    ammunitionFactory: 0.000001,
    weaponFactory: 0.000002,
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
    railroadVehicles: 0.000002,
    aircraft: 0.000002,
    clothing: 0.0001,
    ships: 0.000002,
    postalServices: 0.00005,
    paperFactory: 0.00001,
    entertainmentIndustry: 0.00005,
    informationTechnology: 0.00005,
    drinkIndustry: 0.00005,
    retail: 0.00005,
    aircraftInfrastructure: 0.00004,
    automotiveInfrastructure: 0.00004,
    railroadInfrastructure: 0.00004,
    shipInfrastructure: 0.00004,
    spaceInfrastructure: 0.00004,
    spaceShips: 0.00005,
    defense: 0.000015,
    militaryVehicles: 0.000002,
    spaceGoodsTransport: 0.000002,
    greenEnergy: 0.0000001
} satisfies Readonly<Record<keyof IndustrialSectors, number>>;

export function createStarterIndustry(population: number): Set<keyof IndustrialSectors> {
    const sectors: Set<keyof IndustrialSectors> = new Set();

    for(const key of Object.keys(PER_CAPITA_SECTOR_RATIOS) as (keyof IndustrialSectors)[]) {
        const scaled = population * PER_CAPITA_SECTOR_RATIOS[key];
        if(scaled > 0) {
            sectors.add(key);
        }
    }

    return sectors;
}
