import { Goods } from "@/game/data/Goods";
import { Beer, BrickWall, Clapperboard, Mail, Martini, MonitorSmartphone, Newspaper, School, ShipIcon, ShipWheel, Shirt, ShoppingCart, TrainIcon, type LucideProps } from "lucide-react"
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
    TrendingUp,
    Diamond,
    BarChart3,
    Siren,
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
    Church,
    Shield,
    HeartPulse,
    TestTubes,
    Building2,
    Recycle,
    Landmark,

} from "lucide-react"

const ICON_MAP: Record<keyof Goods, React.ComponentType<LucideProps>> = {
    food: Cookie,
    alcoholDrinks: Beer,
    stimulantDrinks: Martini,
    entertainment: Clapperboard,
    itServices: MonitorSmartphone,
    education: School,
    retail: ShoppingCart,
    luxuryFood: Grape,
    tourism: Plane,
    consumerGoods: Boxes,
    water: Droplets,
    electricity: Zap,
    furniture: Bed,
    luxuryFurniture: Sofa,
    services: Stethoscope,
    agriculturalGoods: Wheat,
    dividents: TrendingUp,
    tylium: Diamond,
    metals: BarChart3,
    uranium: Siren,
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
    money: CircleDollarSign,
    faith: Church,
    lawEnforcement: Shield,
    healthcare: HeartPulse,
    chemicals: TestTubes,
    buildings: Building2,
    waste: Recycle,
    governance: Landmark,
    aircraft: Plane,
    clothing: Shirt,
    constructionMaterials: BrickWall,
    luxuryShips: ShipWheel,
    paper: Newspaper,
    post: Mail,
    railroadVehicles: TrainIcon,
    ships: ShipIcon
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
