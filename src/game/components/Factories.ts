
export type IndustrialSectors = Readonly<{
    electricityFactory: number;
    foodFactory: number;
    metalFactory: number;
    uraniumFactory: number;
    agriculturalFactory: number;
    consumerFactory: number;
    ammunitionFactory: number;
    machineryFactory: number;
    medicineFactory: number;
    buildingSector: number;
    nuclearWeaponFactory: number;
    furnitureFactory: number;
    weaponFactory: number;
    forestry: number;
    oilFactory: number;
    oilRig: number;
    orbitalBuildingSector: number;
    orbitalFactory: number;
    spaceport: number;
    spaceTransport: number;
    tourism: number;
    services: number;
    environmentFactor: number;
    waterFactory: number;
}>;

export type ReadonlyIndustrialSectors = Readonly<IndustrialSectors>;