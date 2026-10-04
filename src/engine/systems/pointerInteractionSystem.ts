import { System } from "./system";
import { ClickableNode } from "./viewportSystem/ClickableNode";
import { HoverableNode, HoverableComponent } from "@game/systems/cursorSystem";
import type { Engine } from "@/engine/core/engine";
import { ClickableComponent } from "../components/clickableComponent";
import { ViewportSystem } from "./viewportSystem/viewportSystem";
import { PositionComponent } from "../components/position";
import { RadiusComponent } from "../components/radiusComponent";
import { getAbsolute } from "../lib/getAbsolute";
import { ClickEventData, MousemoveEvent, ContextMenuEvent, ContextMenuOpenEvent, PointerEventData } from "../lib/events";
import { getPlatform } from "@/engine/lib/platform";
import { SelectionManager } from "@game/systems/selectionSystem";
import { TargetSystem } from "@game/systems/targetSystem";

export class PointerInteractionSystem extends System {
    private clickableNodes: ClickableNode[] = []
    private hoverableNodes: HoverableNode[] = []

    private hoveredProjected: { x: number, y: number, radius: number } | null = null

    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    getHoveredProjected(): { x: number, y: number, radius: number } | null {
        return this.hoveredProjected
    }

    private hitTestCircle(px: number, py: number, projected: { x: number, y: number, scale: number }, radius: number): boolean {
        const screenRadius = radius * projected.scale
        const dx = px - projected.x
        const dy = py - projected.y
        return dx * dx + dy * dy < screenRadius * screenRadius
    }

    private hitTestBox(px: number, py: number, projected: { x: number, y: number, scale: number }, width: number, height: number): boolean {
        const halfX = (width / 2) * projected.scale
        const halfY = (height / 2) * projected.scale
        return (
            projected.x - halfX < px
            && projected.x + halfX > px
            && projected.y - halfY < py
            && projected.y + halfY > py
        )
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
        if(!this.engine || !this.viewportSystem.camera) return

        const { camera } = this.viewportSystem

        for(const node of this.clickableNodes) {
            const { clickable: { size, contextMenuItems, entity } } = node
            if(!contextMenuItems || contextMenuItems.length === 0) continue

            const [entityX, entityY, entityZ] = getAbsolute(node.entity, this.engine!)
            const projected = camera.project(entityX, entityY, entityZ)
            if(!projected) {
                continue
            }

            const radius = node.entity.getComponent(RadiusComponent)?.radius
            const hit = radius !== undefined
                ? this.hitTestCircle(x, y, projected, radius)
                : this.hitTestBox(x, y, projected, size.width, size.height)

            if(hit) {
                this.engine.dispatchEvent(new ContextMenuOpenEvent({ entity: entity!, screenX: x, screenY: y }))
                return
            }
        }
    }

    private doHover(data: PointerEventData): void {
        if(!this.engine || !this.viewportSystem.camera) return

        if(this.viewportSystem.isDragging) {
            return
        }

        const { camera } = this.viewportSystem
        let hovered = false

        for(const hoverableNode of this.hoverableNodes) {
            const [wx, wy, wz] = getAbsolute(hoverableNode.entity, this.engine!)
            const { hoverable: { size, cursor } } = hoverableNode
            const projected = camera.project(wx, wy, wz)
            if(!projected) {
                continue
            }

            const radius = hoverableNode.entity.getComponent(RadiusComponent)?.radius
            const hit = radius !== undefined
                ? this.hitTestCircle(data.x, data.y, projected, radius)
                : this.hitTestBox(data.x, data.y, projected, size.width, size.height)

            if(hit) {
                getPlatform().document.body.style.cursor = cursor
                const screenRadius = (radius ?? Math.max(size.width, size.height) / 2) * projected.scale
                this.hoveredProjected = { x: projected.x, y: projected.y, radius: screenRadius }
                hovered = true
                break
            }
        }

        if(!hovered) {
            this.hoveredProjected = null
            const { cursor } = getPlatform().document.body.style
            if(cursor !== 'default' && cursor !== "grabbing") {
                getPlatform().document.body.style.cursor = 'default'
            }
        }
    }

    private hitTestClick(data: PointerEventData): void {
        if(!this.engine || !this.viewportSystem.camera) return

        const { camera } = this.viewportSystem
        let hit = false

        for(const node of this.clickableNodes) {
            const { clickable: { size, onClick, entity } } = node
            const [entityX, entityY, entityZ] = getAbsolute(node.entity, this.engine!)
            const projected = camera.project(entityX, entityY, entityZ)
            if(!projected) {
                continue
            }

            const radius = node.entity.getComponent(RadiusComponent)?.radius
            const isHit = radius !== undefined
                ? this.hitTestCircle(data.x, data.y, projected, radius)
                : this.hitTestBox(data.x, data.y, projected, size.width, size.height)

            if(
                onClick &&
                isHit) {
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
