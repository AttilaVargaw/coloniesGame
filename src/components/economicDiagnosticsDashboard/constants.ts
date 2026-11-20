export function formatNumber(n: number): string {
    if(Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if(Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if(Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return n.toFixed(2);
}

export function formatPct(n: number | null): string {
    if(n === null) return "N/A";
    return (n * 100).toFixed(1) + "%";
}

export const SEVERITY_COLORS = {
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const EVIDENCE_COLORS = {
    confirmed_dependency: "bg-green-500/20 text-green-400 border-green-500/30",
    observed_association: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    possible_consequence: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export const STATUS_COLORS = {
    healthy: "bg-green-500/20 text-green-400",
    under_pressure: "bg-yellow-500/20 text-yellow-400",
    unprofitable: "bg-red-500/20 text-red-400",
    resource_constrained: "bg-orange-500/20 text-orange-400",
    inactive: "bg-gray-500/20 text-gray-400",
};

export const HOUSEHOLD_STATUS_COLORS = {
    prosperous: "bg-green-500/20 text-green-400",
    stable: "bg-blue-500/20 text-blue-400",
    stressed: "bg-yellow-500/20 text-yellow-400",
    destitute: "bg-red-500/20 text-red-400",
};