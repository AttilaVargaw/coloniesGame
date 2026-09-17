import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryNode } from "@game/systems/IndustryNode";
import { SystemWithNodes } from "@engine/systems/system";
import { DayPassedEvent } from "@/engine/lib/events";
import { Engine } from "@/engine/core/engine";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { IndustryTickInput, IndustryTickResult } from "../workers/industryTick.worker";

const workerUrl = new URL("../workers/industryTick.worker.ts", import.meta.url);

function createIndustryWorker(onMessage: MessageEventTarget<Worker>["onmessage"]) {
    const worker = new Worker(workerUrl, { type: "module" })

    worker.onmessage = onMessage
    worker.onerror = (event) => {
        console.error("Industry worker error:", event.message);
    };

    return worker;
}

export class IndustrySystem extends SystemWithNodes<IndustryNode> {
    protected updateNode(_node: IndustryNode, _dT?: number): void {
    }

    private worker: Worker | null = null;

    private ensureWorker() {
        if(!this.worker) {
            this.worker = createIndustryWorker(this.handleWorkerMessage);
        }
    }

    private handleWorkerMessage = (event: MessageEvent<{ type: string; results: IndustryTickResult[] }>) => {
        if(event.data.type !== "result") {
            return
        }

        const resultsMap = new Map(event.data.results.map((r) => [r.entityId, r]));

        for(const { entity, industry } of this.nodes) {
            const result = resultsMap.get(entity.id);
            if(!result) continue;

            industry.goodsRequirements = result.goodsRequirements;
            industry.goodsProduction = result.goodsProduction;
            industry.workingWorkers = result.workingWorkers;
            industry.freeWorkers = result.freeWorkers;

            for(const [key, update] of Object.entries(result.populationUpdates) as [keyof Population, IndustryTickResult["populationUpdates"][keyof Population]][]) {
                const pop = industry.population[key];
                if(!pop) continue;

                pop.qol = update.qol;
                pop.populationChange = update.populationChange;
                pop.wealth = update.wealth;

                for(const it in update.requirements) {
                    industry.goodsRequirements[it as keyof Goods] =
                        update.requirements[it] * pop.number + (industry.goodsRequirements[it as keyof Goods] ?? 0);
                }
            }

            industry.goodsChange = result.goodsChange;
            for(const it in industry.goods) {
                industry.goods[it as keyof Goods] += industry.goodsChange[it as keyof Goods];
            }
        }
    };

    private onDayPassed = () => {
        this.ensureWorker();

        const industries: IndustryTickInput[] = [];
        for(const { entity, industry } of this.nodes) {
            industries.push({
                entityId: entity.id,
                sectors: industry.sectors,
                goods: { ...industry.goods },
                population: structuredClone(industry.population),
            });
        }

        this.worker!.postMessage({ type: "tick", industries });
    };

    removeFromEngine(): this {
        if(this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.engine?.unregisterNodeType(IndustryNode);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        super.removeFromEngine();
        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(IndustryNode,
            new Set([IndustryComponent]),
            (entity) => new IndustryNode(
                entity.getComponent(IndustryComponent)!,
                entity
            )
        ).subscribe(DayPassedEvent, this.onDayPassed);
        this.nodes = engine.getNodeList(IndustryNode);
        return this;
    }
}
