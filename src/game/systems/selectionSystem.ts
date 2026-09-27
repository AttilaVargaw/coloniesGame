import { Entity } from "@engine/entities/entity"
import { SystemWithNodes } from "@engine/systems/system"
import { SelectionNode } from "@game/systems/SelectionNode"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ShapeComponent } from "@engine/components/ShapeComponent"
import { SelectionChangedEvent, TargetChangedEvent } from "@/engine/lib/events"
import { SensorSuiteComponent } from "@/game/components/vessel"
import { Engine } from "@/engine/core/engine"
import { UNIVERSE_SCALE } from "../constants"
import { createSpaceshipSelector } from "./createSpaceshipSelector"
import { createCircle } from "./createCircle"

export class SelectionManager extends SystemWithNodes<SelectionNode> {
    protected updateNode(_node: SelectionNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unsubscribe(SelectionChangedEvent, this.onSelectionChanged as (data: unknown) => void)
        this.engine?.unsubscribe(TargetChangedEvent, this.onTargetChanged as (data: unknown) => void)
        this.unselect()
        this.unTarget()
        this.engine?.unregisterNodeType(SelectionNode)
        super.removeFromEngine()

        return this
    }

    private selector?: Entity
    private targetSelector?: Entity
    private sensorRangeCircle?: Entity

    private get selectorSceneNode() {
        return this.selector ? this.engine?.getSceneNode(this.selector) : undefined
    }

    private get targetSelectorSceneNode() {
        return this.targetSelector ? this.engine?.getSceneNode(this.targetSelector) : undefined
    }

    get currentSelection() {
        return this.selectorSceneNode?.parent?.entity
    }

    get currentTarget() {
        return this.targetSelectorSceneNode?.parent?.entity
    }

    unselect() {
        if(!this.engine || !this.selector) return

        this.engine.removeEntity(this.selector)
        this.selector = undefined

        this.unselectSensorRange()
    }

    unTarget() {
        if(!this.engine || !this.targetSelector) return

        this.engine.removeEntity(this.targetSelector)
        this.targetSelector = undefined
    }

    onSelectionChanged = ({ type, data }: { type: "colony" | "ship" | "attractor", data?: Entity }) => {
        if(!this.engine || !data || !data.getComponent(SelectableComponent) || this.selectorSceneNode?.parent?.entity === data) {
            return globalThis
        }

        this.unselect()

        switch(type) {
            case "attractor":
                break
            case "colony":
                break
            case "ship":
                this.selector = createSpaceshipSelector("#0f04")
                this.showSensorRangeForSelection(data)
                break
            default:
                throw new Error(`Unknown selection type: ${type}`)
        }

        if(this.selector) {
            this.engine.addEntity(this.selector, data)
        }

        return this
    }

    private onTargetChanged = ({ ship: _ship, target }: { ship: Entity, target?: Entity }) => {
        if(!this.engine) return

        this.unTarget()

        if(target) {
            if(target.getComponent(ShapeComponent)) {
                this.targetSelector = createSpaceshipSelector("red")
            } else {
                this.targetSelector = createSpaceshipSelector("#f004")
            }

            this.engine.addEntity(this.targetSelector!, target)
        }

        return this
    }

    private showSensorRangeForSelection(entity: Entity) {
        if(!this.engine || !entity) return

        this.unselectSensorRange()

        const suite = entity.getComponent(SensorSuiteComponent)
        if(!suite) return

        const circle = createCircle("red", suite.range * UNIVERSE_SCALE)

        this.sensorRangeCircle = circle
        this.engine.addEntity(this.sensorRangeCircle!, entity)
    }

    private unselectSensorRange() {
        if(!this.engine || !this.sensorRangeCircle) return

        this.engine.removeEntity(this.sensorRangeCircle)
        this.sensorRangeCircle = undefined
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.engine = engine
            .registerNodeType(SelectionNode, new Set([SelectableComponent]), (entity) => {
                return new SelectionNode(
                    entity,
                    entity.getComponent(SelectableComponent)!,
                )
            })
            .subscribe(SelectionChangedEvent, this.onSelectionChanged as (data: unknown) => void)
            .subscribe(TargetChangedEvent, this.onTargetChanged as (data: unknown) => void)

        this.nodes = engine.getNodeList(SelectionNode)

        return this
    }
}