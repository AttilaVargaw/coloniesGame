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
            defense: 1,
            consumerGoods: 1
        },
        10: {
            services: 1,
            food: 1,
            faith: 2,
            water: 1,
            healthcare: 3,
            logistics: 0.1,
            buildings: 0.01,
            energy: 0.1,
            entertainment: 0.5,
            monetaryServices: 0.1,
            consumerGoods: 2
        },
        20: {
            consumerGoods: 4,
            healthcare: 2,
            buildings: 0.05,
        },
        40: {
            faith: 1.5,
            services: 2,
            energy: 1,
            food: 1,
            healthcare: 1,
            vehicles: 0.5,
            buildings: 0.01,
            logistics: 1,
            entertainment: 1,
            tourism: 1,
            monetaryServices: 1,
            consumerGoods: 5
        },
        50: {
        },
        80: {
            faith: 1,
            tourism: 4,
            vehicles: 1,
            buildings: 0.015,
            logistics: 1.5,
            entertainment: 2,
            services: 5,
            monetaryServices: 2,
            consumerGoods: 10
        }
    } satisfies Record<number, Partial<Record<keyof Goods, number>>>

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
