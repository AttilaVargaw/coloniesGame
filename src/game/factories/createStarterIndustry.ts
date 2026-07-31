import { IndustrialSectors } from "../components/Factories";


export function createStarterIndustry() {
    return {
        electricityFactory: 0,
        foodFactory: 0,
        metalFactory: 0,
        uraniumFactory: 0,
        agriculturalFactory: 0,
        consumerFactory: 0,
        ammunitionFactory: 0,
        machineryFactory: 0,
        medicineFactory: 0,
        buildingSector: 0,
        nuclearWeaponFactory: 0,
        furnitureFactory: 0,
        weaponFactory: 0,
        forestry: 0,
        oilFactory: 0,
        oilRig: 0,
        orbitalBuildingSector: 0,
        orbitalFactory: 0,
        spaceport: 0,
        spaceTransport: 0,
    } as IndustrialSectors;
}
