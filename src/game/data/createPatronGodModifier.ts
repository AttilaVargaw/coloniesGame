import { InfoComponent } from "@/engine/components/infoComponent";
import type { Entity } from "@/engine/entities/entity";


export function createPatronGodModifier({ name, description, onAdd, onRemove, modifiers }: { modifiers?: Record<string, string>; description: string; name: string; onAdd: (entity: Entity) => Entity; onRemove: (entity: Entity) => Entity; }) {
    const nameComponent = new InfoComponent({ patronGod: name, description, ...modifiers });

    return {
        onAdd: (entity: Entity) => onAdd(entity).addComponent(nameComponent),
        onRemove: (entity: Entity) => onRemove(entity.removeComponent(InfoComponent)),
    };
}
