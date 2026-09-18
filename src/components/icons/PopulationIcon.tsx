import { cn } from "@/lib/utils"
import { Beaker, BookOpen, BrickWallShield, Church, HardHat, HeartPulse, Pencil, Pickaxe, Siren, Tractor } from "lucide-react";

const ICONS: Record<string, (props: { className?: string }) => React.ReactNode> = {
    farmer: ({ className }) => (
        <Tractor className={cn("size-4", className)} />
    ),
    miner: ({ className }) => (
        <Pickaxe className={cn("size-4", className)} />
    ),
    scientist: ({ className }) => (
        <Beaker className={cn("size-4", className)} />
    ),
    armyMen: ({ className }) => (
        <BrickWallShield className={cn("size-4", className)} />
    ),
    navalReservist: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4", className)}>
            <path d="M2 21l10-9 10 9M4 17h16" />
            <circle cx="12" cy="7" r="3" />
        </svg>
    ),
    worker: ({ className }) => (
        <HardHat className={cn("size-4", className)} />
    ),
    student: ({ className }) => (
        <BookOpen className={cn("size-4", className)} />
    ),
    healtcarePersonal: ({ className }) => (
        <HeartPulse className={cn("size-4", className)} />
    ),
    policeMen: ({ className }) => (
        <Siren className={cn("size-4", className)} />
    ),
    marines: ({ className }) => (
        <BrickWallShield className={cn("size-4", className)} />
    ),
    teacher: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4", className)}>
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>
    ),
    serviceWorker: ({ className }) => (
        <Church className={cn("size-4", className)} />
    ),
    clergy: ({ className }) => (
        <Church className={cn("size-4", className)} />
    ),
    retired: ({ className }) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4", className)}>
            <path d="M4 18h16M8 18v-6a4 4 0 014-4h0a4 4 0 014 4v6" />
            <path d="M12 8V6M9 6h6" />
        </svg>
    ),
    clerks: ({ className }) => <Pencil className={cn("size-4", className)} />
}

export function PopulationIcon({ name, className }: { name: string; className?: string }) {
    const Icon = ICONS[name]
    if(!Icon) return null
    return <Icon className={className} />
}

export const POPULATION_NAMES: Record<string, string> = Object.fromEntries(
    Object.keys(ICONS).map(key => [key, key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')])
) as Record<string, string>
