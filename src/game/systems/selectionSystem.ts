import { Entity } from "@engine/entities/entity"
import { SystemWithNodes } from "@engine/systems/system"
import { SelectionNode } from "@game/systems/SelectionNode"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { ShapeComponent } from "@engine/components/ShapeComponent"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { SelectionChangedEvent, TargetChangedEvent } from "@/engine/lib/events"
import { SensorSuiteComponent } from "@/game/components/vessel"
import { Engine } from "@/engine/core/engine"
import { SHIP_RADIUS, UNIVERSE_SCALE } from "../constants"
import { createMarker } from "../factories/createSpaceship"

function createSpaceshipSelector(engine: Engine, color: string) {
    const entity = createMarker(engine, { color, radius: SHIP_RADIUS * 2, offset: { x: 0, y: 0, z: -1 } })

    return entity
}

export class SelectionSystem extends SystemWithNodes<SelectionNode> {
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

    currentSelection() {
        return this.selectorSceneNode?.parentRef?.entity
    }

    currentTarget() {
        return this.targetSelectorSceneNode?.parentRef?.entity
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

    onSelectionChanged = ({ type, entity }: { type: "colony" | "ship" | "attractor", entity?: Entity }) => {
        if(!this.engine || !entity) return
        if(!entity.getComponent(SelectableComponent)) return

        this.unselect()

        if(this.selectorSceneNode?.parentRef?.entity === entity) {
            return this
        }

        switch(type) {
            case "colony":
            case "attractor":
                this.selector = createSpaceshipSelector(this.engine, "green")
                break
            case "ship":
                this.selector = createSpaceshipSelector(this.engine, "#0f04")
                this.showSensorRangeForSelection(entity)
                break
        }

        this.engine.addEntity(this.selector!, entity)

        return this
    }

    private onTargetChanged = ({ ship: _ship, target }: { ship: Entity, target?: Entity }) => {
        if(!this.engine) return

        this.unTarget()

        if(target) {
            if(target.getComponent(ShapeComponent)) {
                this.targetSelector = createSpaceshipSelector(this.engine, "red")
            } else {
                this.targetSelector = createSpaceshipSelector(this.engine, "#f004")
            }

            this.engine.addEntity(this.targetSelector!, target)
        }


        return this
    }

    update(_dt: number) {
    }

    private showSensorRangeForSelection(entity: Entity) {
        if(!this.engine || !entity) return

        this.unselectSensorRange()

        const suite = entity.getComponent(SensorSuiteComponent)
        if(!suite) return

        const circle = this.engine.createEntity()
            .addComponent(new PositionComponent(0, 0))
            .addComponent(new RadiusComponent(suite.range * UNIVERSE_SCALE))
            .addComponent(new ColorComponent("", "red"))

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