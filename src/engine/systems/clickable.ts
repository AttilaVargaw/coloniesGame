import { SystemWithNodes } from "./system";
import { ClickableNode } from "./viewportSystem/ClickableNode";
import type { Engine } from "@/engine/core/engine";
import { ClickableComponent } from "../components/clickableComponent";
import { ViewportSystem } from "./viewportSystem/viewportSystem";
import { Queue } from "../lib/commandQueue";
import { getAbsolute } from "../lib/getAbsolute";
import { ClickEventData, EntityAddedEvent, MouseEventData } from "../lib/events";
import { SelectionManager } from "@game/systems/selectionSystem";
import { TargetSystem } from "@game/systems/targetSystem";
export class ClickableSystem extends SystemWithNodes<ClickableNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    protected updateNode(_node: ClickableNode, _dt?: number): void {
    }
    private clickQueue?: Queue<MouseEventData>

    protected unregisterNodeTypes(): this {
        this.engine?.unregisterNodeType(ClickableNode);
        this.engine?.unsubscribe(EntityAddedEvent, this.onUpdateIndices);

        return this;
    }

    removeFromEngine(): this {
        this.clickQueue = undefined;
        super.removeFromEngine();

        return this
    }

    private onUpdateIndices = () => {
        this.nodes.sort((a, b) => a.clickable.zIndex - b.clickable.zIndex)
    }

    protected registerNodes(engine: Engine): this {
        engine.registerNodeType(ClickableNode, new Set([ClickableComponent]), (entity) =>
            new ClickableNode(
                entity.getComponent(ClickableComponent)!,
                entity
            )
        )

        //this.engine?.subscribe("entityAdded", this.onUpdateIndices);

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        this.clickQueue = engine.getEvents(ClickEventData);
        this.nodes = engine.getNodeList(ClickableNode);
        this.nodes.sort()

        return this
    }

    update(_dt: number): void {
        if(this.nodes.length === 0 || !this.engine || !this.clickQueue?.length) return;

        if(this.viewportSystem.consumeDragMoved()) {
            this.clickQueue.clear()
            return
        }

        for(const { data } of this.clickQueue) {
            let hit = false
            const { camera } = this.viewportSystem.viewport

            for(const node of this.nodes) {
                const { clickable: { size: { width, height }, clickable, onClick, entity } } = node
                const [entityX, entityY, entityZ] = getAbsolute(node.entity, this.engine!)
                const projected = camera.project(entityX, entityY, entityZ)
                if (!projected) {
                    continue
                }

                const halfX = (width / 2) * projected.scale
                const halfY = (height / 2) * projected.scale

                if(
                    onClick &&
                    clickable
                    && projected.x - halfX < data.x
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
                            hit = true
                        }
                    }
                }

                if(!hit) {
                    selectionSystem?.unselect()
                }
            }
        }

        this.clickQueue.clear()
    }
}
