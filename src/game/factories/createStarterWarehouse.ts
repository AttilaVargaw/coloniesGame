import { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";


export function createStarterWarehouse(population: number) {
    return {
        water: population * 50,
        food: population * 50,
        agriculturalGoods: population * 1,
        ammunition: population * 1,
        consumerGoods: population * 50,
        electricity: population * 50,
        machinery: population * 10,
        medicine: population * 10,
        oil: population * 10,
        tylium: population * 10,
        uranium: population * 10,
        environmentFactor: population * 0.8,
        furniture: population * 50,
        happiness: population * 1,
        metals: population * 10,
        money: population * 10,
        nuclearWeapons: population * 0,
        services: population * 50,
        spaceTransport: population * 1,
        tourism: population * 0,
        weapons: population * 10,
        wood: population * 10,
    } satisfies Goods;
}

export function createStarterIndustry() {
    return {
        agriculturalFactory: 1,
        ammunitionFactory: 1,
        buildingSector: 1,
        consumerFactory: 1,
        electricityFactory: 1,
        foodFactory: 1,
        furnitureFactory: 1,
        machineryFactory: 1,
        medicineFactory: 1,
        metalFactory: 1,
        nuclearWeaponFactory: 1,
        oilFactory: 1,
        oilRig: 1,
        orbitalBuildingSector: 1,
        orbitalFactory: 1,
        spaceport: 1,
        spaceTransport: 1,
        uraniumFactory: 1,
        weaponFactory: 1,
        forestry: 1,
        environmentFactor: 1,
        services: 1,
        tourism: 1,
        waterFactory: 1
    } satisfies IndustrialSectors;
}

