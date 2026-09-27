import { EntityComponent } from "../entities/entityComponent";
import { Entity } from "../entities/entity";
import { MouseEvent } from "react"

export type ClickEventHandler = (event: { target: Entity, event: MouseEvent, worldX: number, worldY: number }) => void

export type ContextMenuItems = {
    label: string,
    id: string,
    onClick: ClickEventHandler
}

export class ClickableComponent extends EntityComponent {
    constructor(
        public clickable: boolean,
        public size: { width: number, height: number },
        public onClick?: ClickEventHandler,
        public contextMenuItems?: ContextMenuItems[],
        public zIndex = 0) {
        super()
    }
}