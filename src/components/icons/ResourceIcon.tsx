import { Goods } from "@/game/data/Goods";
import { Atom, Beer, Clapperboard, Coffee, Cuboid, Mail, MonitorSmartphone, Newspaper, School, ShipIcon, ShipWheel, Shirt, ShoppingCart, TrainIcon, type LucideProps } from "lucide-react"
import {
    Wheat,
    Cookie,
    Grape,
    Plane,
    Boxes,
    Droplets,
    Zap,
    Bed,
    Sofa,
    Stethoscope,
    Stone,
    Diamond,
    Cog,
    Pill,
    TreePine,
    Package,
    FlaskConical,
    Rocket,
    Bomb,
    Sword,
    Biohazard,
    Car,
    Cpu,
    Leaf,
    CircleDollarSign,
    Shield,
    HeartPulse,
    TestTubes,
    Building2,
    Recycle,
    Landmark,
    Palmtree,
} from "lucide-react"
import { InfantryFightingVehicle } from "./InfantryFightingVehicle";

import { FaPray } from "react-icons/fa";

const ICON_MAP: Record<keyof Goods, React.ComponentType<LucideProps>> = {
    food: Cookie,
    alcoholDrinks: Beer,
    stimulantDrinks: Coffee,
    entertainment: Clapperboard,
    itServices: MonitorSmartphone,
    education: School,
    retail: ShoppingCart,
    luxuryFood: Grape,
    tourism: Palmtree,
    consumerGoods: Boxes,
    water: Droplets,
    electricity: Zap,
    furniture: Bed,
    luxuryFurniture: Sofa,
    services: Stethoscope,
    agriculturalGoods: Wheat,
    // dividents: TrendingUp,
    tylium: Diamond,
    metals: Cuboid,
    uranium: Atom,
    machinery: Cog,
    medicine: Pill,
    wood: TreePine,
    lumber: Package,
    oil: FlaskConical,
    spaceTransport: Rocket,
    ammunition: Bomb,
    weapons: Sword,
    nuclearWeapons: Biohazard,
    ordnance: Bomb,
    vehicles: Car,
    electronics: Cpu,
    environmentFactor: Leaf,
    faith: FaPray,
    lawEnforcement: Shield,
    healthcare: HeartPulse,
    chemicals: TestTubes,
    buildings: Building2,
    waste: Recycle,
    governance: Landmark,
    aircraft: Plane,
    clothing: Shirt,
    luxuryShips: ShipWheel,
    paper: Newspaper,
    post: Mail,
    railroadVehicles: TrainIcon,
    ships: ShipIcon,
    airMobility: Plane,
    automotiveMobility: Car,
    railroadMobility: TrainIcon,
    shipMobility: ShipIcon,
    defense: Shield,
    ore: Stone,
    monetaryServices: CircleDollarSign,
    militaryVehicles: InfantryFightingVehicle,
}

export function ResourceIcon({ name, className }: { name: keyof Goods; className?: string }) {
    const IconComponent = ICON_MAP[name]

    if(!IconComponent) {
        return name
    }
    return <IconComponent className={className} strokeWidth={1.5} size={16} />
}

export const RESOURCE_NAMES: Record<string, string> = Object.fromEntries(
    Object.keys(ICON_MAP).map(key => [key, key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')])
) as Record<string, string>
