import { PositionComponent } from "../components/position";
import { World } from "../core/world";
import { Modifier } from "../modifiers/patronGod";
import { EntityComponent } from "./entityComponent";

export class Entity {
    private readonly _component = new Map<Function, EntityComponent>()
    private engine?: World

    private revalidatePosition() {
        const position = this.getComponent(PositionComponent)
        if(position) {
            position.dirty = true
        }
        return this
    }

    get components() {
        return this._component
    }

    constructor(public id: string) {

    }

    private readonly _children = new Set<Entity>()
    private _parent?: Entity | null = null
    private readonly _modifiers: Modifier[] = []

    get children() {
        return this._children
    }

    get modifiers() {
        return this._modifiers
    }

    get parent() {
        return this._parent
    }

    getParent() {
        return this.parent
    }

    attachToEngine(engine: World) {
        this.engine = engine

        for(const child of this.children) {
            child.attachToEngine(engine)
        }

        return this
    }

    detachFromEngine() {
        this.engine = undefined

        for(const child of this.children) {
            child.detachFromEngine()
        }

        return this
    }

    addChild(entity: Entity) {
        entity.setParent(this)
        entity.revalidatePosition()

        for(const child of entity.children) {
            child.revalidatePosition()
            if(entity.engine) {
                entity.engine.addEntity(child)
            }
        }

        return this
    }

    setParent(parent: Entity | null) {
        this._parent = parent;
        parent?.children.add(this)
        parent?.engine?.addEntity(this)
        this.engine = parent?.engine

        this.revalidatePosition()

        return this;
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

        this.engine?.reindexEntity(this)

        return this
    }

    removeComponent(component: new (...args: any) => EntityComponent) {
        this._component.delete(component);
        this.engine?.reindexEntity(this)
        this.engine?.dispatchEvent("componentRemoved", component)

        return this
    }

    getComponent<T extends new (...args: any) => EntityComponent>(component: T) {
        return this._component.get(component) as InstanceType<T> | undefined
    }

    removeChild(entity: Entity) {
        this.children.delete(entity)
        entity._parent = null
        this.revalidatePosition()

        for(const child of entity.children) {
            child.revalidatePosition()
        }

        return this
    }
}