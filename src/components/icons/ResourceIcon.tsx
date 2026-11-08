import { Goods } from "@/game/data/Goods";
import { Atom, Clapperboard, Cuboid, Mail, Newspaper, School, Shirt, ShoppingCart, type LucideProps } from "lucide-react"
import {
    Wheat,
    Cookie,
    Plane,
    Boxes,
    Droplets,
    Zap,
    Stethoscope,
    Stone,
    Diamond,
    Cog,
    Pill,
    Package,
    FlaskConical,
    Rocket,
    Biohazard,
    Car,
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
import { ComponentType } from "react";

const ICON_MAP: Record<keyof Goods, ComponentType<LucideProps>> = {
    food: Cookie,
    entertainment: Clapperboard,
    education: School,
    tourism: Palmtree,
    consumerGoods: Boxes,
    water: Droplets,
    energy: Zap,
    services: Stethoscope,
    agriculturalGoods: Wheat,
    tylium: Diamond,
    metals: Cuboid,
    fissionMaterial: Atom,
    machinery: Cog,
    medicine: Pill,
    lumber: Package,
    oil: FlaskConical,
    spaceShips: Rocket,
    nuclearWeapons: Biohazard,
    vehicles: Car,
    environmentFactor: Leaf,
    faith: FaPray,
    lawEnforcement: Shield,
    healthcare: HeartPulse,
    chemicals: TestTubes,
    buildings: Building2,
    waste: Recycle,
    governance: Landmark,
    paper: Newspaper,
    logistics: Mail,
    defense: Shield,
    monetaryServices: CircleDollarSign,
    militaryEquipment: InfantryFightingVehicle,
    mobility: Plane
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
