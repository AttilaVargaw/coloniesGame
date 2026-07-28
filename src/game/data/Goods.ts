import { Population, ReadonlyPopulation } from "./Population";

export type Goods = {
    readonly food: number;
    readonly tylium: number;
    readonly metals: number;
    readonly uranium: number;
    readonly agriculturalGoods: number;
    readonly consumerGoods: number;
    readonly ammunition: number;
    readonly machinery: number;
    readonly medicine: number;
    readonly furniture: number;
    readonly wood: number;
    readonly weapons: number;
    readonly oil: number;
    readonly nuclearWeapons: number;
    readonly spaceTransport: number;
    readonly tourism: number;
    readonly water: number
}

export type Factories = {
    readonly electricityFactory: number
    readonly foodFactory: number
    readonly metalFactory: number
    readonly uraniumFactory: number
    readonly agriculturalFactory: number
    readonly consumerFactory: number
    readonly ammunitionFactory: number
    readonly machineryFactory: number
    readonly medicineFactory: number
    readonly buildingSector: number
    readonly nuclearWeaponFactory: number
    readonly furnitureFactory: number
    readonly weaponFactory: number
    readonly forestry: number
    readonly oilFactory: number
    readonly oilRig: number
    readonly orbitalBuildingSector: number
    readonly orbitalFactory: number
    readonly spaceport: number
    readonly spaceTransport: number
    readonly tourism: number
    readonly services: number
    readonly environmentFactor: number
    readonly waterFactory: number
}

type FactoryConfig = {
    readonly workers: Map<keyof Population, number>
    readonly reducer: RescourceReducer
}

const generateRescource = ({ name, workerRequirement, goods }: { name: keyof Goods, workerRequirement: Map<keyof ReadonlyPopulation, number>, goods: Goods, goodsRequirements: Map<keyof Goods, number> }) => {
    const reducer = ({ population, factoryLevel, workerRatio }: { population: Population, factoryLevel: number, workerRatio: number }) => {
        const remainingWorkers = population

        const workerRequirementSum = workerRequirement.entries().reduce((acc, [key, value]) => {
            acc[key] = value * factoryLevel * workerRatio

            if(remainingWorkers[key] - value < 0) {
                acc[key] = remainingWorkers[key]
                remainingWorkers[key] = 0
            } else {
                remainingWorkers[key] -= acc[key]
            }

            return acc
        }, new Map<keyof Population, number>());

        const lowestRatio = Math.min(...Object.values(workerRequirementSum).map((value, index) => value / Object.values(population)[index]))
        const lowestRequirementRatio = Object.entries(workerRequirementSum).reduce((acc, [key, value]) => { })

        return {
            remainingWorkers,
            goods: {
                ...goods,
                [name]: lowestRatio * factoryLevel
            }
        }
    }

    return {
        reducer,
        workerRequirement
    }
}

type RescourceReducer = (state: Goods, action: Factories, workers: Population) => Goods;

