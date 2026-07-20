import { SystemWithNodes } from "./system";
import { ClickableNode } from "./viewportSystem/ClickableNode";
import { World } from "../core/world";
import { ClickableComponent } from "../components/clickableComponent";
import { PositionComponent } from "../components/position";
import { sortByDepth } from "@/lib/sortByIndex";
import { ViewportSystem } from "./viewportSystem/viewportSystem";
import { Queue, QueueItem } from "../lib/commandQueue";

export class ClickEvent extends QueueItem<MouseEvent> {
    constructor(public event: MouseEvent, public x: number, public y: number) {
        super(event);
    }
}

export class ClickableSystem extends SystemWithNodes<ClickableNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    protected updateNode(_node: ClickableNode, _dt?: number): void {
    }
    private clickQueue?: Queue<ClickEvent>;

    protected unregisterNodeTypes(): this {
        this.engine?.unregisterNodeType(ClickableNode);
        this.engine?.unsubscribe("entityAdded", this.onUpdateIndices);

        return this;
    }

    removeFromEngine(): this {
        this.clickQueue = undefined;
        super.removeFromEngine();

        return this
    }

    private onUpdateIndices = () => {
        this.nodes.sort(sortByDepth)
    }

    protected registerNodes(engine: World): this {
        engine.registerNodeType(ClickableNode, new Set([ClickableComponent]), (entity) =>
            new ClickableNode(
                entity.getComponent(PositionComponent)!,
                entity.getComponent(ClickableComponent)!
            )
        )

        //this.engine?.subscribe("entityAdded", this.onUpdateIndices);

        return this
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine);
        this.clickQueue = engine.events.get("click");

        this.nodes = engine.getNodeList(ClickableNode);
        this.nodes.sort(sortByDepth)

        return this
    }

    update(): void {
        if(this.nodes.length === 0 || !this.engine || !this.clickQueue?.length) return;

        if(this.viewportSystem.consumeDragMoved()) {
            this.clickQueue.clear()
            return
        }

        for(const { data } of this.clickQueue) {
            const { x, y } = this.viewportSystem.viewport.camera.screenToWorld(data.x, data.y);

            for(const node of this.nodes) {
                const { clickable: { size: { width, height }, clickable, onClick, entity } } = node
                const [correctedPositionX, correctedPositionY] = node.position.getAbsolute()
                const halfX = width / 2
                const halfY = height / 2

                if(
                    onClick &&
                    clickable
                    && correctedPositionX - halfX < x
                    && correctedPositionX + halfX > x
                    && correctedPositionY - halfY < y
                    && correctedPositionY + halfY > y) {
                    onClick({ target: entity!, event: data.event })
                }
            }
        }

        this.clickQueue.clear()
    }
}
