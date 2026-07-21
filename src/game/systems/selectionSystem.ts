import { World } from "@engine/core/world"
import { Entity } from "@engine/entities/entity"
import { SystemWithNodes } from "@engine/systems/system"
import { SelectionNode } from "@game/systems/SelectionNode"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { ShapeComponent } from "@engine/components/ShapeComponent"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { RedrawCommand } from "@/engine/lib/RedrawCommand"
import { SelectionChangedEvent } from "@/engine/lib/events"

export class SelectionSystem extends SystemWithNodes<SelectionNode> {
    protected updateNode(_node: SelectionNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unsubscribe(SelectionChangedEvent, this.onSelectionChanged as (data: unknown) => void)
        this.unselect()
        this.unTarget()
        this.engine?.unregisterNodeType(SelectionNode)
        super.removeFromEngine()

        return this
    }

    private selector?: Entity
    private targetSelector?: Entity

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

    createSpaceshipSelector(color: string) {
        if(!this.engine) return

        const entity = this.engine.createEntity()
        entity.addComponent(new ColorComponent(color, ""))
            .addComponent(new RadiusComponent(20))
            .addComponent(new PositionComponent(0, 0, -1, entity))

        return entity
    }

    createSectorSelector(color: string) {
        if(!this.engine) return

        const entity = this.engine.createEntity()
        entity.addComponent(new ColorComponent("", color))
            .addComponent(new ShapeComponent(6, 40))
            .addComponent(new PositionComponent(0, 0, 1, entity))

        return entity
    }

    unselect() {
        if(!this.engine || !this.selector) return

        this.engine.removeEntity(this.selector)
        this.selector = undefined
    }

    unTarget() {
        if(!this.engine || !this.targetSelector) return

        this.engine.removeEntity(this.targetSelector)
        this.targetSelector = undefined
    }

    onSelectionChanged = ({ type, entity }: { type: "colony" | "ship" | "sector", entity?: Entity }) => {
        if(!this.engine) return

        this.unselect()

        if(this.selectorSceneNode?.parentRef?.entity === entity || !entity) {
            return this
        }

        switch(type) {
            case "colony":
                this.selector = this.createSectorSelector("green")
                break
            case "ship":
                this.selector = this.createSpaceshipSelector("#0f04")
                break
            case "sector":
                this.selector = this.createSectorSelector("green")
                break
        }

        this.engine.addEntity(this.selector!, entity)
        this.engine.addCommand(new RedrawCommand())

        return this
    }

    onTargetChanged = (entity: Entity) => {
        if(!this.engine) return

        this.unTarget()

        if(entity.getComponent(ShapeComponent)) {
            this.targetSelector = this.createSectorSelector("red")
        } else {
            this.targetSelector = this.createSpaceshipSelector("#f004")
        }

        this.engine.addEntity(this.targetSelector!, entity)
        this.engine.addCommand(new RedrawCommand())

        return this
    }

    update(_dt: number) {
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        this.engine = engine
            .registerNodeType(SelectionNode, new Set([SelectableComponent]), (entity) => {
                return new SelectionNode(
                    entity,
                    entity.getComponent(SelectableComponent)!,
                )
            })

        this.nodes = engine.getNodeList(SelectionNode)

        return this
    }
}
