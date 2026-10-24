
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
    orbitalFactory: number;
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
}>

export const industrialSectors = new Map<string, Set<keyof IndustrialSectors>>([
    ["rawMaterials", new Set(["farm", "forestry", "oilRig", "mine", "orbitalFactory", "waterTreatment", "powerPlant", "environmentControl", "fishery"])],
    ["industrialMaterials", new Set(["construction", "chemical", "electronics", "lumberMill", "metalFactory", "medicineFactory", "paperFactory", "recycling", "machineryFactory"])],
    ["consumerGoods", new Set(["consumerFactory", "furnitureFactory", "foodFactory", "meat", "drinkIndustry", "clothing", "alternativeMedicine"])],
    ["services", new Set(["services", "government", "healthcare", "lawEnforcement", "tourism", "religion", "bank", "education", "entertainmentIndustry", "informationTechnology", "retail", "postalServices"])],
    ["military", new Set(["nuclearSector", "ammunitionFactory", "weaponFactory", "militaryVehicles", "defense"])],
    ["mobility", new Set(["spaceShips", "automotive", "railroadInfrastructure", "railroadVehicles", "aircraftInfrastructure", "ships", "automotiveInfrastructure", "aircraft", "spaceGoodsTransport", "spaceInfrastructure"])]
])

export type ReadonlyIndustrialSectors = Readonly<IndustrialSectors>;