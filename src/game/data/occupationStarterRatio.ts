import { Population } from "./Population";

export const occupationStarterRatio = {
    farmer: 0.8,
    scientist: 2,
    worker: 29.3,
    healtcarePersonal: 6,
    policeMen: 1,
    teacher: 3,
    serviceWorker: 16.4,
    clergy: 2.5,
    clerks: 15,
    engineer: 4,
    stayAtHome: 20
} as Readonly<Record<keyof Population, number>>

// console.log({ ratio: Object.values(occupationStarterRatio).reduce((a, b) => a + b, 0) })