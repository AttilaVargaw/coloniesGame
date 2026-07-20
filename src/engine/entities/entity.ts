import type { Modifier } from "../modifier"
import { EntityComponent } from "./entityComponent"

export class Entity {
    private readonly _component = new Map<Function, EntityComponent>()
    private readonly _modifiers: Modifier[] = []
    private onComponentChanged?: (entity: Entity) => void

    get components() {
        return this._component
    }

    constructor(public id: string) {

    }

    get modifiers() {
        return this._modifiers
    }

    setComponentChangeHandler(handler: ((entity: Entity) => void) | undefined) {
        this.onComponentChanged = handler
    }

    addModifier(modifier: Modifier) {
        this.modifiers.push(modifier)
        modifier.onAdd(this)
    }

    removeModifier(modifier: Modifier) {
        modifier.onRemove(this)
        this.modifiers.splice(this.modifiers.indexOf(modifier), 1)

        return this
    }

    addComponent(component: EntityComponent) {
        this._component.set(component.constructor, component);
        component.entity = this

        this.onComponentChanged?.(this)

        return this
    }

    removeComponent(component: new (...args: any[]) => EntityComponent) {
        this._component.delete(component);

        this.onComponentChanged?.(this)

        return this
    }

    getComponent<T extends new (...args: any[]) => EntityComponent>(component: T) {
        return this._component.get(component) as InstanceType<T> | undefined
    }
}
