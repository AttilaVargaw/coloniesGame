
export type IndustrialSectors = Readonly<{
    mine: number;
    oilRig: number;
    forestry: number;
    farm: number;
    fishery: number;
    foodFactory: number;
    meat: number;
    waterTreatment: number;
    powerPlant: number;
    nuclearSector: number;
    metalFactory: number;
    lumberMill: number;
    machineryFactory: number;
    medicineFactory: number;
    consumerFactory: number;
    furnitureFactory: number;
    ammunitionFactory: number;
    weaponFactory: number;
    spaceShips: number;
    spaceInfrastructure: number;
    construction: number;
    services: number;
    tourism: number;
    education: number;
    healthcare: number;
    environmentControl: number;
    chemical: number;
    bank: number;
    religion: number;
    lawEnforcement: number;
    alternativeMedicine: number;
    recycling: number;
    government: number;
    automotive: number;
    electronics: number;
    railroadVehicles: number;
    aircraft: number;
    clothing: number;
    ships: number;
    postalServices: number;
    paperFactory: number;
    entertainmentIndustry: number;
    informationTechnology: number;
    drinkIndustry: number;
    retail: number;
    railroadInfrastructure: number;
    shipInfrastructure: number;
    aircraftInfrastructure: number;
    automotiveInfrastructure: number;
    defense: number
    militaryVehicles: number
    spaceGoodsTransport: number
    greenEnergy: number
}>

export type IndustrialMainSectors = Readonly<{
    energy: number;
    rawMaterials: number;
    manufacturing: number;
    consumerGoods: number;
    services: number;
    military: number;
    infrastructure: number;
}>;

export const industrialSubsectors = new Map<string, Set<keyof IndustrialSectors>>([
    ["energy", new Set(["powerPlant", "greenEnergy", "nuclearSector"])],
    ["rawMaterials", new Set(["mine", "waterTreatment", "oilRig"])],
    ["agriculture", new Set(["forestry", "farm", "fishery", "meat", "alternativeMedicine"])],
    ["environment", new Set(["environmentControl", "recycling"])],
    ["heavyIndustry", new Set(["metalFactory", "machineryFactory", "chemical", "construction"])],
    ["lightIndustry", new Set(["lumberMill", "paperFactory", "furnitureFactory", "clothing", "consumerFactory", "electronics", "foodFactory", "drinkIndustry", "medicineFactory"])],
    ["services", new Set(["services", "retail", "tourism", "bank", "entertainmentIndustry", "informationTechnology", "religion"])],
    ["publicServices", new Set(["government", "lawEnforcement", "education", "healthcare", "postalServices"])],
    ["military", new Set(["ammunitionFactory", "weaponFactory", "militaryVehicles", "defense"])],
    ["vehicleManufacturing", new Set(["automotive", "railroadVehicles", "aircraft", "ships", "spaceShips"])],
    ["mobility", new Set(["railroadInfrastructure", "automotiveInfrastructure", "spaceInfrastructure", "spaceGoodsTransport", "aircraftInfrastructure", "shipInfrastructure"])],
]);

export type ReadonlyIndustrialSectors = Readonly<IndustrialSectors>;