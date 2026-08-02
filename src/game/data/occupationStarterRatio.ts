import { Population } from "./Population";

export const occupationStarterRatio = {
    farmer: 1,
    miner: 2,
    scientist: 6,
    armyMen: 0.5,
    navalReservist: 0.5,
    worker: 30,
    healtcarePersonal: 8,
    policeMen: 1,
    marines: 0.5,
    teacher: 8.5,
    serviceWorker: 21,
    clergy: 1,
    clerks: 20,
} as const as Population;
