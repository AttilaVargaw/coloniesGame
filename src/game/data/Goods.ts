export type Goods = {
    food: number;
    tylium: number;
    metals: number;
    uranium: number;
    agriculturalGoods: number;
    consumerGoods: number;
    ammunition: number;
    machinery: number;
    medicine: number;
    furniture: number;
    wood: number;
    weapons: number;
    oil: number;
    nuclearWeapons: number;
    spaceTransport: number;
    tourism: number;
    water: number
    electricity: number
    services: number
    environmentFactor: number
    money: number,
    happiness: number
}

export type ReadonlyGoods = Readonly<Goods>

export function getLowestRatio(requirements: Record<string, number>, available: Record<string, number>, level: number, workerRatio: number) {
    const workerRatios = {} as Record<string, number>

    for(const [key, requirement] of Object.entries(requirements) as ([string, number])[]) {
        const t = available[key] - requirement * level * workerRatio

        if(t > 0) {
            workerRatios[key] = 1
        } else {
            workerRatios[key] = available[key] / (requirement * level * workerRatio)
        }
    }

    return Math.min(...Object.values(workerRatios))
}
