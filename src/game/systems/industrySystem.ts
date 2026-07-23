import { IndustryComponent } from "@game/components/industryComponent";
import { World } from "@engine/core/world";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent } from "@/engine/lib/events";
import { CommandBase } from "@/engine/lib/CommandBase";
import { Entity } from "@/engine/entities/entity";
import { Queue } from "@/engine/lib/commandQueue";

const magicNumberToGetEarthsDailyPopuplationGrow = 15_000

export class SetConsumerGoodsRatioCommand extends CommandBase {
    constructor(public readonly ratio: number, public readonly entity: Entity) {
        super()
    }
}

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    private setConsumerGoodsRatioQueue?: Queue<SetConsumerGoodsRatioCommand>

    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }
    removeFromEngine(): this {
        this.engine?.unregisterNodeType(IndustryNode)
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed)
        this.engine?.removeCommandQueue(SetConsumerGoodsRatioCommand)
        this.setConsumerGoodsRatioQueue?.clear()

        super.removeFromEngine()

        return this
    }

    private onDayPassed = () => {
        for(const node of this.nodes) {
            const { industry: { consumerGoodsRatio, happiness, population, production } } = node
            const productionUsedForGrowth = production - consumerGoodsRatio * production

            const fertility = (happiness - 0.5) / magicNumberToGetEarthsDailyPopuplationGrow
            const industrialGrowthRate = (happiness - 0.5) / magicNumberToGetEarthsDailyPopuplationGrow

            const happinessChange = ((consumerGoodsRatio * production / population) - 0.5) / 1000

            node.industry.population += fertility * population
            node.industry.production += (productionUsedForGrowth * industrialGrowthRate)
            node.industry.happiness = Math.min(1, Math.max(0, happiness + happinessChange))
        }
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine)

        engine.registerNodeType(IndustryNode,
            new Set([IndustryComponent]),
            (entity) => new IndustryNode(
                entity.getComponent(IndustryComponent)!,
                entity
            )
        ).subscribe(DayPassedEvent, this.onDayPassed)

        this.nodes = engine.getNodeList(IndustryNode);
        engine.registerCommandQueue(SetConsumerGoodsRatioCommand)
        this.setConsumerGoodsRatioQueue = engine.getCommands(SetConsumerGoodsRatioCommand)

        return this
    }

    update(_dt: number) {
        if(this.setConsumerGoodsRatioQueue?.length) {
            const node = this.nodes.find(node => node.entity.id === this.setConsumerGoodsRatioQueue?.peek()?.entity.id)!
            node.industry.consumerGoodsRatio = this.setConsumerGoodsRatioQueue.next()!.ratio
        }
    }
}