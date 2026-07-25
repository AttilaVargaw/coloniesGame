import { EntityComponent } from "../entities/entityComponent";
import { Entity } from "../entities/entity";
import { MouseEvent } from "react"
export class ClickableComponent extends EntityComponent {
    constructor(
        public clickable: boolean,
        public size: { width: number, height: number },
        public onClick?: (event: { target: Entity, event: MouseEvent, worldX: number, worldY: number }) => void,
        public zIndex = 0) {
        super()
    }
}