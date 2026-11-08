export type IndustrialSectors = Readonly<{
    mine: number;
    oilRig: number;
    forestry: number;
    farm: number;
    fishery: number;
    foodFactory: number;
    waterTreatment: number;
    powerPlant: number;
    nuclearSector: number;
    metalFactory: number;
    machineryFactory: number;
    medicineFactory: number;
    consumerFactory: number;
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
    recycling: number;
    government: number;
    automotive: number;
    electronics: number;
    logistics: number;
    paperFactory: number;
    entertainmentIndustry: number;
    defense: number
    militaryEquipment: number
    mobility: number
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
    ["energy", new Set(["powerPlant", "nuclearSector"])],
    ["rawMaterials", new Set(["metalFactory", "waterTreatment", "oilRig"])],
    ["agriculture", new Set(["forestry", "farm", "fishery"])],
    ["environment", new Set(["environmentControl", "recycling"])],
    ["heavyIndustry", new Set(["metalFactory", "machineryFactory", "chemical", "construction"])],
    ["lightIndustry", new Set(["paperFactory", "consumerFactory", "foodFactory", "medicineFactory"])],
    ["services", new Set(["services", "tourism", "bank", "entertainmentIndustry", "religion", "logistics"])],
    ["publicServices", new Set(["government", "lawEnforcement", "education", "healthcare"])],
    ["military", new Set(["militaryEquipment", "defense"])],
    ["vehicleManufacturing", new Set(["automotive", "spaceShips"])],
    ["mobility", new Set(["spaceInfrastructure", "mobility"])],
]);

export type ReadonlyIndustrialSectors = Readonly<IndustrialSectors>;