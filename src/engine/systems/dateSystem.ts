import { v4 as uuid } from "uuid"
import { ColonialDate } from "@/lib/colonialCalendar";
import { DateComponent } from "../components/dateComponent";
import type { Engine } from "../core/engine";
import { System } from "./system"
import { DateNode } from "./DateNode";
import { TimeScaleNode } from "./timeScaleNode";
import { Entity } from "../entities/entity";
import { DayPassedEvent, MonthPassedEvent } from "../lib/events";
import { TIME_ACCELERATION } from "@/game/constants";

export class DateSystem extends System {
    private entity?: Entity
    private node?: DateNode
    private timeSinceLastDay = 0
    private timeSinceLasMonth = 0
    private lastMonth = 0
    private startTime = 0

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(DateNode)
        this.engine.removeEntity(this.entity!)

        this.node = undefined
        super.removeFromEngine()

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        engine.registerNodeType(DateNode, new Set([DateComponent]), (entity: Entity) => new DateNode(
            entity,
            entity.getComponent(DateComponent)!,
        ))
        this.entity = new Entity(uuid()).addComponent(new DateComponent(this.startTime))
        engine.addEntity(this.entity)
        this.node = engine.getNodeList(DateNode)[0]

        return this
    }

    update(dt: number) {
        if(!this.node || !this.engine) {
            return
        }

        const timeScaleNode = this.engine.getNodeList(TimeScaleNode)[0]
        const multiplier = timeScaleNode?.timeScale.multiplier ?? 1

        const node = this.node
        node.date.ms += dt * TIME_ACCELERATION * multiplier

        this.timeSinceLastDay += dt * TIME_ACCELERATION * multiplier
        this.timeSinceLasMonth += dt * TIME_ACCELERATION * multiplier

        if(this.timeSinceLastDay > 1000 * 60 * 60 * 24) {
            this.timeSinceLastDay = 0
            this.engine.dispatchEvent(new DayPassedEvent(null))
        }

        const date = ColonialDate(node.date.ms)

        if(this.lastMonth !== date.month) {
            this.lastMonth = date.month
            this.timeSinceLasMonth = 0
            this.engine.dispatchEvent(new MonthPassedEvent(null))
        }
    }
}
