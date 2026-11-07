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
    Stone,
    Zap,
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
} from "lucide-react";

import { InfantryFightingVehicle } from "./InfantryFightingVehicle";
import { FaOilCan } from "react-icons/fa6";
import { GiGreekTemple, GiRifle } from "react-icons/gi";

const ICON_MAP = {
    automotive: Car,
    chemical: FlaskConical,
    defense: Shield,
    tourism: Plane,
    logistics: Mail,
    waterTreatment: Droplets,
    weaponFactory: GiRifle,
    bank: CircleDollarSign,
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
    foodFactory: Cookie,
    powerPlant: Zap,
    nuclearSector: Atom,
    metalFactory: FactoryIcon,
    environmentControl: VeganIcon,
    lawEnforcement: Shield,
    machineryFactory: Cog,
    medicineFactory: BriefcaseMedical,
    religion: GiGreekTemple,
    spaceInfrastructure: Satellite,
    spaceGoodsTransport: Satellite,
    militaryEquipment: InfantryFightingVehicle
} satisfies Record<keyof IndustrialSectors, React.ComponentType<LucideProps>>

console.log("sectorsN", Object.keys(ICON_MAP).length)

export function SectorIcon({ name, className }: { name: keyof IndustrialSectors; className?: string }) {
    const IconComponent = ICON_MAP[name]

    if(!IconComponent) {
        return name
    }
    return <IconComponent className={className} strokeWidth={1.5} size={16} />
}