import { IndustrialSectors } from "@/game/components/Factories";
import {
    BarChart3,
    BrickWall,
    Car,
    CircleDollarSign,
    Clapperboard,
    Droplets,
    FlaskConical,
    Landmark,
    LucideProps,
    Mail,
    Newspaper,
    Plane,
    Recycle,
    Shield,
    ShipWheel,
    Zap,
    UserGroupIcon,
    Ambulance,
    Fish,
    TreePine,
    Cookie,
    FactoryIcon,
    VeganIcon,
    BriefcaseMedical,
    Satellite,
    Cog,
    Tractor,
} from "lucide-react";

import { InfantryFightingVehicle } from "./InfantryFightingVehicle";
import { FaOilCan } from "react-icons/fa6";
import { GiGreekTemple, GiRifle } from "react-icons/gi";
import { ComponentType } from "react";
import { renderMappedIcon } from "./iconRender";

const ICON_MAP = {
    automotive: Car,
    chemical: FlaskConical,
    defense: Shield,
    tourism: Plane,
    logistics: Mail,
    waterTreatment: Droplets,
    weaponFactory: GiRifle,
    bank: CircleDollarSign,
    paperFactory: Newspaper,
    construction: BrickWall,
    recycling: Recycle,
    consumerFactory: BarChart3,
    education: UserGroupIcon,
    entertainmentIndustry: Clapperboard,
    government: Landmark,
    oilRig: FaOilCan,
    healthcare: Ambulance,
    spaceShips: ShipWheel,
    fishery: Fish,
    farm: Tractor,
    forestry: TreePine,
    services: UserGroupIcon,
    foodFactory: Cookie,
    powerPlant: Zap,
    metalFactory: FactoryIcon,
    environmentControl: VeganIcon,
    lawEnforcement: Shield,
    machineryFactory: Cog,
    medicineFactory: BriefcaseMedical,
    religion: GiGreekTemple,
    spaceInfrastructure: Satellite,
    militaryEquipment: InfantryFightingVehicle,
    mobility: Car,
} satisfies Record<keyof IndustrialSectors, ComponentType<LucideProps>>

console.log("sectorsN", Object.keys(ICON_MAP).length)

export function SectorIcon({ name, className }: { name: keyof IndustrialSectors; className?: string }) {
    return renderMappedIcon(ICON_MAP, name, className)
}