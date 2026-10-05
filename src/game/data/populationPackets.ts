import { Goods } from "./Goods";

interface QolLevel {
    id: number
    cumulativeData: Record<keyof Goods, number>
}

export const QOL_LEVELS: readonly QolLevel[] = (() => {
    const raw = {
        0: {
            food: 0.5,
            water: 0.5,
            faith: 4,
            lawEnforcement: 1,
            healthcare: 4,
            governance: 0.5,
            clothing: 0.1,
            defense: 1
        },
        10: {
            services: 1,
            food: 1,
            faith: 2,
            water: 1,
            healthcare: 3,
            electronics: 0.3,
            post: 0.1,
            buildings: 0.01,
            clothing: 0.2,
            wood: 0.1,
            electricity: 0.1,
            alcoholDrinks: 0.1,
            entertainment: 0.5,
            monetaryServices: 0.1
        },
        20: {
            consumerGoods: 1,
            furniture: 1,
            healthcare: 2,
            buildings: 0.05,
            automotiveMobility: 0.2,
            railroadMobility: 0.2,
            shipMobility: 0.2,
            airMobility: 0.2,
        },
        40: {
            faith: 1.5,
            services: 2,
            electricity: 1,
            food: 1,
            luxuryFood: 0.2,
            furniture: 1.5,
            healthcare: 1,
            vehicles: 0.5,
            buildings: 0.01,
            electronics: 1.0,
            clothing: 0.5,
            wood: 0,
            post: 1,
            automotiveMobility: 0.5,
            railroadMobility: 0.5,
            shipMobility: 0.5,
            airMobility: 0.5,
            stimulantDrinks: 0.1,
            entertainment: 1,
            tourism: 1,
            itServices: 1,
            monetaryServices: 1
        },
        50: {
            alcoholDrinks: 0.5,
            stimulantDrinks: 0.5,
        },
        80: {
            faith: 1,
            tourism: 4,
            luxuryFood: 1,
            luxuryFurniture: 1,
            vehicles: 1,
            buildings: 0.015,
            electronics: 2.0,
            clothing: 1,
            post: 1.5,
            luxuryShips: 0.5,
            airMobility: 1,
            shipMobility: 1,
            railroadMobility: 1,
            automotiveMobility: 1,
            alcoholDrinks: 1,
            stimulantDrinks: 1,
            entertainment: 2,
            itServices: 2,
            services: 5,
            monetaryServices: 2
        }
    } as const

    const entries = Object.entries(raw)
        .map(([id, data]) => ({
            id: Number(id),
            data: data as Record<keyof Goods, number>
        }))
        .sort((a, b) => a.id - b.id)

    const cumulative = {} as Record<keyof Goods, number>
    return entries.map(entry => {
        for(const key in entry.data) {
            cumulative[key as keyof Goods] = (cumulative[key as keyof Goods] ?? 0) + entry.data[key as keyof Goods]
        }
        return {
            id: entry.id,
            cumulativeData: { ...cumulative }
        }
    })
})()
