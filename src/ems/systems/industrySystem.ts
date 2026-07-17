import { IndustryComponent } from "../components/industryComponent";
import { Engine } from "../engine";
import { IndustryNode } from "./IndustryNode";
import { SystemWithNodes } from "./system";

const magicNumberToGetEarthsDailyPopuplationGrow = 15_000

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    removeFromEngine(): void {
        this.engine?.unregisterNodeType(IndustryNode)
        this.engine?.unsubscribe("dayPassed", this.onDayPassed)

        super.removeFromEngine()
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

    addToEngine(engine: Engine) {
        super.addToEngine(engine)

        engine.registerNodeType(IndustryNode,
            new Set([IndustryComponent]),
            (entity) => ({
                industry: entity.getComponent(IndustryComponent)!,
                entity
            })
        ).subscribe("dayPassed", this.onDayPassed)

        this.nodes = engine.getNodeList(IndustryNode);

        return () => { }
    }

    update(_dt: number) {

    }
}