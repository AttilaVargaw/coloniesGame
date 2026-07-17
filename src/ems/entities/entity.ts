import { Modifier } from "../modifiers/patronGod";
import { EntityComponent } from "./entityComponent";

export class Entity {
    private readonly _component = new Map<Function, Object>()

    get components() {
        return this._component
    }

    constructor(public id?: string) {

    }

    readonly children = new Set<Entity>()
    _parent?: Entity | null = null
    readonly modifiers: Modifier[] = []

    getParent() {
        return this._parent
    }

    setParent(parent: Entity | null) {
        this._parent = parent
        return this
    }

    addModifier(modifier: Modifier) {
        this.modifiers.push(modifier)
        modifier.onAdd(this)
    }

    removeModifier(modifier: Modifier) {
        this.modifiers.splice(this.modifiers.indexOf(modifier), 1)
        return this
    }

    addComponent(component: EntityComponent) {
        this._component.set(component.constructor, component);
        component.entity = this
        //signal that a new component was added

        return this
    }

    removeComponent(component: new (...args: any) => EntityComponent) {
        //fix later
        this._component.delete(component);

        return this
    }

    getComponent<T extends new (...args: any) => Object>(component: T) {
        return this._component.get(component) as InstanceType<T> | undefined
    }

    //Notify the engine
    addChild(entity: Entity) {
        this.children.add(entity)
        entity._parent = this

        return this
    }

    removeChild(entity: Entity) {
        this.children.delete(entity)
        entity._parent = null

        return this
    }
}