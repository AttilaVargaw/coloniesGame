import { Population } from "@/game/data/Population";
import { cn } from "cn";
import { Beaker, BookOpen, Church, HardHat, HeartPulse, House, Pencil, Tractor, CoffeeIcon } from "lucide-react";
import { FaPersonWalkingWithCane, FaPersonMilitaryRifle } from "react-icons/fa6"
import { MdOutlineEngineering, MdOutlineLocalPolice } from "react-icons/md";

function createIcon(Icon: (props: { className?: string }) => React.ReactNode) {
    return ({ className }: { className?: string }) => <Icon className={cn("size-4", className)} />
}

const ICONS: Record<keyof Population, (props: { className?: string }) => React.ReactNode> = {
    farmer: createIcon(({ className }) => <Tractor className={cn("size-4", className)} />),
    scientist: createIcon(({ className }) => <Beaker className={cn("size-4", className)} />),
    worker: createIcon(({ className }) => <HardHat className={cn("size-4", className)} />),
    student: createIcon(({ className }) => <BookOpen className={cn("size-4", className)} />),
    healtcarePersonal: createIcon(({ className }) => <HeartPulse className={cn("size-4", className)} />),
    policeMen: createIcon(({ className }) => <MdOutlineLocalPolice className={cn("size-4", className)} />),
    teacher: createIcon(({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4", className)}>
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>
    )),
    serviceWorker: createIcon(({ className }) => <CoffeeIcon className={cn("size-4", className)} />),
    clergy: createIcon(({ className }) => <Church className={cn("size-4", className)} />),
    retired: FaPersonWalkingWithCane,
    clerks: createIcon(({ className }) => <Pencil className={cn("size-4", className)} />),
    stayAtHome: createIcon(({ className }) => <House className={cn("size-4", className)} />),
    engineer: createIcon(({ className }) => <MdOutlineEngineering className={cn("size-4", className)} />),
    serviceMan: createIcon(({ className }) => <FaPersonMilitaryRifle className={cn("size-4", className)} />),
}

export function PopulationIcon({ name, className }: { name: keyof Population; className?: string }) {
    const Icon = ICONS[name]
    if(!Icon) {
        return null
    }
    return <Icon className={className} />
}

export const POPULATION_NAMES: Record<string, string> = Object.fromEntries(
    Object.keys(ICONS).map(key => [key, key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')])
) as Record<string, string>
