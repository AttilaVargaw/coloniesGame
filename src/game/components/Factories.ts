
export type IndustrialSectors = {
    readonly electricityFactory: number;
    readonly foodFactory: number;
    readonly metalFactory: number;
    readonly uraniumFactory: number;
    readonly agriculturalFactory: number;
    readonly consumerFactory: number;
    readonly ammunitionFactory: number;
    readonly machineryFactory: number;
    readonly medicineFactory: number;
    readonly buildingSector: number;
    readonly nuclearWeaponFactory: number;
    readonly furnitureFactory: number;
    readonly weaponFactory: number;
    readonly forestry: number;
    readonly oilFactory: number;
    readonly oilRig: number;
    readonly orbitalBuildingSector: number;
    readonly orbitalFactory: number;
    readonly spaceport: number;
    readonly spaceTransport: number;
    readonly tourism: number;
    readonly services: number;
    readonly environmentFactor: number;
    readonly waterFactory: number;
};

export type ReadonlyIndustrialSectors = Readonly<IndustrialSectors>;