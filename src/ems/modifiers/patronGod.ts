import { InfoComponent } from "../components/infoComponent";
import { Entity } from "../entities/entity";

export class Modifier {
    constructor(public onAdd: (entity: Entity) => Entity, public onRemove: (entity: Entity) => Entity) {

    }
}

export function createPatronGodModifier({ name, description, onAdd, onRemove, modifiers }: { modifiers?: Record<string, string>, description: string, name: string, onAdd: (entity: Entity) => Entity, onRemove: (entity: Entity) => Entity }) {
    const nameComponent = new InfoComponent({ patronGod: name, description, ...modifiers })

    return new Modifier(
        entity => {
            return onAdd(entity).addComponent(nameComponent)
        },
        entity => {
            return onRemove(entity.removeComponent(InfoComponent))
        })
}
