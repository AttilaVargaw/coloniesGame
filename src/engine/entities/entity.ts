import type { Modifier } from "../modifier"
import { EntityComponent } from "./entityComponent"

export class Entity {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    private readonly _component = new Map<Function, EntityComponent>()
    private readonly _modifiers: Modifier[] = []
    private _onComponentChanged?: (entity: Entity) => void

    get components() {
        return this._component
    }

    constructor(public id: string) {

    }

    get modifiers() {
        return this._modifiers
    }

    set onComponentChanged(handler: ((entity: Entity) => void) | undefined) {
        this._onComponentChanged = handler
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
        const existing = this._component.get(component.constructor)
        if(existing && existing !== component) {
            existing?.dispose?.()
        }
        this._component.set(component.constructor, component);
        component.entityId = this.id
        this._onComponentChanged?.(this)

        return this
    }

    removeComponent(component: new (...args: any[]) => EntityComponent) {
        this._component.delete(component);

        this._onComponentChanged?.(this)

        return this
    }

    getComponent<T extends new (...args: any[]) => EntityComponent>(component: T) {
        return this._component.get(component) as InstanceType<T> | undefined
    }
}
