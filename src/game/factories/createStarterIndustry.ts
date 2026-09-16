import { IndustrialSectors } from "../components/Factories";


export function createStarterIndustry() {
    return {
        electricityFactory: 0,
        foodFactory: 100_000,
        metalFactory: 0,
        uraniumFactory: 0,
        agriculturalFactory: 100,
        consumerFactory: 100,
        ammunitionFactory: 0,
        machineryFactory: 0,
        medicineFactory: 0,
        buildingSector: 0,
        nuclearWeaponFactory: 0,
        furnitureFactory: 1000,
        weaponFactory: 0,
        forestry: 1_000,
        oilFactory: 0,
        oilRig: 0,
        orbitalBuildingSector: 0,
        orbitalFactory: 0,
        spaceport: 0,
        spaceTransport: 0,
        waterFactory: 1_000,
        environmentFactor: 100,
        services: 100,
        tourism: 0
    } as IndustrialSectors;
}
