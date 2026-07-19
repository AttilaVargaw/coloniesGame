import { Engine } from "../engine"
import { Entity } from "../entities/entity"
import { SystemWithNodes } from "./system"
import { SelectionNode } from "./SelectionNode"
import { SelectableComponent } from "../components/SelectableComponent"
import { ColorComponent } from "../components/colorComponent"
import { PositionComponent } from "../components/position"
import { ShapeComponent } from "../components/ShapeComponent"
import { RadiusComponent } from "../components/radiusComponent"

export class SelectionSystem extends SystemWithNodes<SelectionNode> {
    protected updateNode(_node: SelectionNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        this.engine?.unsubscribe("selectionChanged", this.onSelectionChanged)
        //this.engine.unsubscribe("targetChanged", this.onTargetChanged)

        this.unselect()
        this.unTarget()
        this.engine?.unregisterNodeType(SelectionNode)
        super.removeFromEngine()

        return this
    }

    selector?: Entity
    targetSelector?: Entity

    createSpaceshipSelector(color: string) {
        if(!this.engine) return

        return this.engine.createEntity().addComponent(new ColorComponent(color, ""))
            .addComponent(new RadiusComponent(20))
            .addComponent(new PositionComponent(0, 0, -1))
    }

    createSectorSelector(color: string) {
        if(!this.engine) return

        return this.engine.createEntity().addComponent(new ColorComponent("", color))
            .addComponent(new ShapeComponent(6, 40))
            .addComponent(new PositionComponent(0, 0, 1))
    }

    unselect() {
        if(!this.engine) return

        this.selector?.parent && this.engine.removeEntity(this.selector)
        this.selector = undefined
        //this.selected = undefined
    }

    unTarget() {
        if(!this.engine) return

        this.targetSelector?.parent && this.engine.removeEntity(this.targetSelector)
        this.targetSelector = undefined
        //this.selected = undefined
    }

    onSelectionChanged = ({ type, entity }: { type: "colony" | "ship" | "sector", entity?: Entity }) => {
        if(!this.engine) return

        this.unselect()

        if(this.selector?.parent === entity || !entity) {
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

        entity.addChild(this.selector!)
        this.engine.addEntity(this.selector!)
        this.engine.addCommand({ name: "redraw", data: {} })

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

        entity.addChild(this.targetSelector!)
        this.engine.addEntity(this.targetSelector!)
        this.engine.addCommand({ name: "redraw", data: {} })

        return this
    }

    update(_dt: number) {
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.engine = engine
            .registerNodeType(SelectionNode, new Set([SelectableComponent]), (entity) => {
                return {
                    entity,
                    selection: entity.getComponent(SelectableComponent)!,
                    color: entity.getComponent(ColorComponent)!
                }
            })
            .subscribe("selectionChanged", this.onSelectionChanged)
        //.subscribe("targetChanged", this.onTargetChanged)

        this.nodes = engine.getNodeList(SelectionNode)

        return this
    }
}