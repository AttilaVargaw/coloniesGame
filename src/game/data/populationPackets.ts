import { CumulativeLinkedList } from "@/lib/linkedList";
import { Goods } from "./Goods";

export const populationPackets = new CumulativeLinkedList<Goods>({
    0: {
        food: 0.5,
        water: 0.5,
        faith: 4,
        lawEnforcement: 1,
        healthcare: 4,
        governance: 0.5,
        clothing: 0.1
    },
    10: {
        food: 1,
        faith: 2,
        water: 1,
        healthcare: 3,
        electronics: 0.3,
        post: 0.1,
        buildings: 0.01,
        clothing: 0.2,
        wood: 0.1,
    },
    20: {
        consumerGoods: 1,
        furniture: 1,
        healthcare: 2,
        buildings: 0.05,
        vehicles: 0.2
    },
    40: {
        faith: 1.5,
        services: 1,
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
        post: 0.5
    },
    50: {},
    80: {
        faith: 1,
        tourism: 1,
        luxuryFood: 1,
        luxuryFurniture: 1,
        vehicles: 1,
        buildings: 0.015,
        electronics: 2.0,
        clothing: 1,
        post: 1
    }
} as const);
