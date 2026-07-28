/*
    Occupation category (ISCO-08)	Typical share of employed population
    Managers	3–8%
    Professionals	15–25%
    Technicians & Associate Professionals	10–18%
    Clerical Support Workers	7–12%
    Service & Sales Workers	12–20%
    Skilled Agricultural, Forestry & Fishery Workers	1–30% (depends heavily on country)
    Craft & Related Trades Workers	8–15%
    Plant & Machine Operators & Assemblers	6–12%
    Elementary Occupations	8–20%
    Armed Forces Occupations	<1%
*/

export type Population = {
    readonly farmer: number;
    readonly miner: number;
    readonly scientist: number;
    readonly armyMen: number;
    readonly navalReservist: number;
    readonly worker: number;
    readonly student: number;
    readonly unemployed: number;
    readonly healtcarePersonal: number;
    readonly policeMen: number;
    readonly marines: number;
    readonly teacher: number;
    readonly serviceWorker: number;
    readonly clergy: number;
    readonly activeNavymen: number;
};
