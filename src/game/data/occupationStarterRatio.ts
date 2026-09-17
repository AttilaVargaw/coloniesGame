import { Population } from "./Population";

export const occupationStarterRatio = {
    farmer: 1,
    miner: 2,
    scientist: 6,
    armyMen: 0.5,
    navalReservist: 0.5,
    worker: 28.5,
    healtcarePersonal: 8,
    policeMen: 1,
    marines: 0.5,
    teacher: 8.5,
    serviceWorker: 21,
    clergy: 3.5,
    clerks: 19,
} as const as Record<keyof Population, number>;
