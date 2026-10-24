import { IndustrialSectors } from "@/game/components/Factories";
import {
    BarChart3,
    BrickWall,
    Car,
    CircleDollarSign,
    Clapperboard,
    Droplets,
    Factory,
    FlaskConical,
    Landmark,
    LucideProps,
    Mail,
    Newspaper,
    Plane,
    PlaneLanding,
    Recycle,
    Shield,
    Ship,
    ShipIcon,
    ShipWheel,
    Shirt,
    Sofa,
    Stone,
    TrainIcon,
    TrainTrack,
    Zap,
    Vegan,
    UserGroupIcon,
    GpuIcon,
    Ambulance,
    Fish,
    TreePine,
    Cookie,
    Atom,
    FactoryIcon,
    VeganIcon,
    BriefcaseMedical,
    Satellite,
    Cog,
    Tractor,
    Ham,
    BottleWine
} from "lucide-react";

import { InfantryFightingVehicle } from "./InfantryFightingVehicle";
import { FaOilCan } from "react-icons/fa6";
import { GiGreekTemple, GiRifle } from "react-icons/gi";

const ICON_MAP: Record<keyof IndustrialSectors, React.ComponentType<LucideProps>> = {
    aircraft: Plane,
    aircraftInfrastructure: PlaneLanding,
    automotive: Car,
    automotiveInfrastructure: Factory,
    chemical: FlaskConical,
    clothing: Shirt,
    defense: Shield,
    militaryVehicles: InfantryFightingVehicle,
    railroadVehicles: TrainIcon,
    railroadInfrastructure: TrainTrack,
    ships: ShipIcon,
    shipInfrastructure: Ship,
    tourism: Plane,
    postalServices: Mail,
    waterTreatment: Droplets,
    alternativeMedicine: Vegan,
    ammunitionFactory: GiRifle,
    bank: CircleDollarSign,
    furnitureFactory: Sofa,
    drinkIndustry: BottleWine,
    mine: Stone,
    paperFactory: Newspaper,
    construction: BrickWall,
    recycling: Recycle,
    consumerFactory: BarChart3,
    education: UserGroupIcon,
    electronics: GpuIcon,
    entertainmentIndustry: Clapperboard,
    government: Landmark,
    oilRig: FaOilCan,
    healthcare: Ambulance,
    spaceShips: ShipWheel,
    fishery: Fish,
    farm: Tractor,
    forestry: TreePine,
    services: UserGroupIcon,
    meat: Ham,
    retail: Shirt,
    foodFactory: Cookie,
    powerPlant: Zap,
    nuclearSector: Atom,
    metalFactory: FactoryIcon,
    lumberMill: TreePine,
    environmentControl: VeganIcon,
    informationTechnology: GpuIcon,
    lawEnforcement: Shield,
    machineryFactory: Cog,
    medicineFactory: BriefcaseMedical,
    religion: GiGreekTemple,
    weaponFactory: GiRifle,
    spaceInfrastructure: Satellite,
    orbitalFactory: Satellite,
    spaceGoodsTransport: Satellite
} as const

// console.log("sectorsN", Object.keys(ICON_MAP).length)

export function SectorIcon({ name, className }: { name: keyof IndustrialSectors; className?: string }) {
    const IconComponent = ICON_MAP[name]

    if(!IconComponent) {
        return name
    }
    return <IconComponent className={className} strokeWidth={1.5} size={16} />
}