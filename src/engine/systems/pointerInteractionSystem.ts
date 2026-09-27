import { System } from "./system";
import { ClickableNode } from "./viewportSystem/ClickableNode";
import { HoverableNode, HoverableComponent } from "@game/systems/cursorSystem";
import type { Engine } from "@/engine/core/engine";
import { ClickableComponent } from "../components/clickableComponent";
import { ViewportSystem } from "./viewportSystem/viewportSystem";
import { PositionComponent } from "../components/position";
import { getAbsolute } from "../lib/getAbsolute";
import { ClickEventData, MousemoveEvent, ContextMenuEvent, ContextMenuOpenEvent } from "../lib/events";
import { SelectionManager } from "@game/systems/selectionSystem";
import { TargetSystem } from "@game/systems/targetSystem";
import { MouseEvent as ReactMouseEvent } from "react"

export class PointerInteractionSystem extends System {
    private clickableNodes: ClickableNode[] = []
    private hoverableNodes: HoverableNode[] = []

    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        engine.registerNodeType(ClickableNode, new Set([ClickableComponent]), (entity) =>
            new ClickableNode(
                entity.getComponent(ClickableComponent)!,
                entity
            )
        )
        engine.registerNodeType(HoverableNode, new Set([HoverableComponent]), (entity) =>
            new HoverableNode(
                entity.getComponent(PositionComponent)!,
                entity.getComponent(HoverableComponent)!,
                entity
            )
        )

        this.clickableNodes = engine.getNodeList(ClickableNode)
        this.hoverableNodes = engine.getNodeList(HoverableNode)
        this.clickableNodes.sort((a, b) => a.clickable.zIndex - b.clickable.zIndex)

        engine.subscribe(ContextMenuEvent, this.onContextMenu)

        return this
    }

    removeFromEngine(): this {
        this.clickableNodes = []
        this.hoverableNodes = []
        this.engine?.unsubscribe(ContextMenuEvent, this.onContextMenu)
        super.removeFromEngine()
        return this
    }

    private onContextMenu = ({ x, y }: { x: number, y: number }) => {
        if(!this.engine) return

        const { camera } = this.viewportSystem.viewport

        for(const node of this.clickableNodes) {
            const { clickable: { size: { width, height }, contextMenuItems, entity } } = node
            if(!contextMenuItems || contextMenuItems.length === 0) continue

            const [entityX, entityY, entityZ] = getAbsolute(node.entity, this.engine!)
            const projected = camera.project(entityX, entityY, entityZ)
            if(!projected) {
                continue
            }

            const halfX = (width / 2) * projected.scale
            const halfY = (height / 2) * projected.scale

            if(
                projected.x - halfX < x
                && projected.x + halfX > x
                && projected.y - halfY < y
                && projected.y + halfY > y) {
                this.engine.dispatchEvent(new ContextMenuOpenEvent({ entity: entity!, screenX: x, screenY: y }))
                return
            }
        }
    }

    private doHover(data: { x: number, y: number } & ReactMouseEvent): void {
        if(!this.engine) return

        if(this.viewportSystem.isDragging) {
            return
        }

        const { camera } = this.viewportSystem.viewport
        let hovered = false

        for(const hoverableNode of this.hoverableNodes) {
            const [wx, wy, wz] = getAbsolute(hoverableNode.entity, this.engine!)
            const { hoverable: { size, cursor } } = hoverableNode
            const projected = camera.project(wx, wy, wz)
            if(!projected) {
                continue
            }

            const halfX = (size.width / 2) * projected.scale
            const halfY = (size.height / 2) * projected.scale

            if(
                projected.x - halfX < data.x
                && projected.x + halfX > data.x
                && projected.y - halfY < data.y
                && projected.y + halfY > data.y) {
                document.body.style.cursor = cursor
                hovered = true
                break
            }
        }

        if(!hovered) {
            const { cursor } = document.body.style
            if(cursor !== 'default' && cursor !== "grabbing") {
                document.body.style.cursor = 'default'
            }
        }
    }

    private hitTestClick(data: { x: number, y: number, shiftKey: boolean } & ReactMouseEvent): void {
        if(!this.engine) return

        const { camera } = this.viewportSystem.viewport
        let hit = false

        for(const node of this.clickableNodes) {
            const { clickable: { size: { width, height }, onClick, entity } } = node
            const [entityX, entityY, entityZ] = getAbsolute(node.entity, this.engine!)
            const projected = camera.project(entityX, entityY, entityZ)
            if(!projected) {
                continue
            }

            const halfX = (width / 2) * projected.scale
            const halfY = (height / 2) * projected.scale

            if(
                onClick &&
                projected.x - halfX < data.x
                && projected.x + halfX > data.x
                && projected.y - halfY < data.y
                && projected.y + halfY > data.y) {
                onClick({ target: entity!, event: data, worldX: entityX, worldY: entityY })
                hit = true
                break
            }
        }

        if(!hit) {
            const selectionSystem = this.engine.getSystem(SelectionManager)

            if(data.shiftKey) {
                const targetSystem = this.engine.getSystem(TargetSystem)
                const selection = selectionSystem?.currentSelection

                if(selection) {
                    const { camera } = this.viewportSystem.viewport
                    const { x: worldX, y: worldY } = camera.screenToWorld(data.x, data.y)
                    const bestEntity = targetSystem?.findNearestTarget(selection, worldX, worldY)

                    if(bestEntity) {
                        targetSystem?.setTargetForOrbitSelection(selection, bestEntity, worldX, worldY)
                    }
                }
            } else {
                selectionSystem?.unselect()
            }
        }
    }

    update(_dt: number): void {
        if(!this.engine) return

        const clickQueue = this.engine.getEvents(ClickEventData)
        const mouseMovedQueue = this.engine.getEvents(MousemoveEvent)

        if(mouseMovedQueue?.length) {
            for(const { data } of mouseMovedQueue) {
                this.doHover(data)
            }
            mouseMovedQueue.clear()
        }

        if(clickQueue?.length) {
            if(this.viewportSystem.consumeDragMoved()) {
                clickQueue.clear()
                return
            }

            for(const { data } of clickQueue) {
                this.hitTestClick(data)
            }

            clickQueue.clear()
        }
    }
}
