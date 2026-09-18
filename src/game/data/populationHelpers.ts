export function birthRate(x: number) {
    if(x <= 10) return 4.5;
    if(x <= 25) return 4.5 - (4.5 - 0.6) * (x - 10) / 15;
    return 0.6;
}

export function mortality(x: number) {
    if(x <= 5) return 5.3 - (5.3 - 4.5) * (x - 1) / 4;
    if(x <= 15) return 4.5 - (4.5 - 1.1) * (x - 5) / 10;
    if(x <= 25) return 1.1 - (1.1 - 0.45) * (x - 15) / 10;
    return 0.45;
}

export function populationGrowth(x: number) {
    if(x <= 10) return -0.05 + (0.0 - (-0.05)) * (x - 1) / 9;
    if(x <= 15) return 0.0 + (0.05 - 0.0) * (x - 10) / 5;
    if(x <= 25) return 0.05 + (0.0 - 0.05) * (x - 15) / 10;
    return 0.0;
}