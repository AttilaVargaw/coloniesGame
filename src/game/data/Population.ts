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
    farmer: number;
    miner: number;
    scientist: number;
    armyMen: number;
    navalReservist: number;
    worker: number;
    student: number;
    healtcarePersonal: number;
    policeMen: number;
    marines: number;
    teacher: number;
    serviceWorker: number;
    clergy: number;
    //activeNavymen: number;
    retired: number;
    clerks: number;
};

export type ReadonlyPopulation = Readonly<Population>;