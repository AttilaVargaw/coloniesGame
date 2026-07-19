import { SystemWithNodes } from "./system";
import { ClickableNode } from "./viewportSystem/ClickableNode";
import { Engine } from "../engine";
import { ClickableComponent } from "../components/clickableComponent";
import { PositionComponent } from "../components/position";
import { shortByDepth } from "@/lib/shortByIndex";
import { ViewportSystem } from "./viewportSystem/viewportSystem";
import { CommandQueue } from "../lib/commandQueue";

export class ClickableSystem extends SystemWithNodes<ClickableNode> {
    protected updateNode(_node: ClickableNode, _dT?: number): void {
    }
    private clickArray?: CommandQueue;
    private viewport?: ViewportSystem;

    protected unregisterNodeTypes(): this | undefined {
        this.engine?.unregisterNodeType(ClickableNode);
        this.engine?.removeCommandQueue("click");
        this.engine?.unsubscribe("entityAdded", this.onUpdateIndices);

        return this;
    }

    removeFromEngine(): this {
        this.clickArray = undefined;
        this.viewport = undefined;
        super.removeFromEngine();

        return this
    }

    private onUpdateIndices = () => {
        this.nodes.sort(shortByDepth)
    }

    protected registerNodes(engine: Engine): this {
        engine.registerNodeType(ClickableNode, new Set([ClickableComponent]), (entity) =>
        ({
            clickable: entity.getComponent(ClickableComponent)!,
            position: entity.getComponent(PositionComponent)!,
            entity
        }))

        this.engine?.registerCommandQueue("click")
        this.engine?.subscribe("entityAdded", this.onUpdateIndices);

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        this.clickArray = engine.commands.get("click");

        this.nodes = engine.getNodeList(ClickableNode);
        this.nodes.sort(shortByDepth)
        this.viewport = engine.getSystem(ViewportSystem)

        return this
    }

    update(): void {
        if(this.nodes.length === 0 || !this.engine || !this.clickArray?.length || !this.viewport) return;

        if(this.viewport.consumeDragMoved()) {
            this.clickArray.clear()
            return
        }

        for(const { data } of this.clickArray) {
            const { x, y } = this.viewport.viewport.camera.screenToWorld(data.x, data.y);

            for(const node of this.nodes) {
                const { clickable: { size: { width, height }, clickable, onClick, entity } } = node
                const [correctedPositionX, correctedPositionY] = node.position.getAbsolute()
                const halfX = width / 2
                const halfY = height / 2

                if(clickable
                    && correctedPositionX - halfX < x
                    && correctedPositionX + halfX > x
                    && correctedPositionY - halfY < y
                    && correctedPositionY + halfY > y) {
                    onClick?.({ engine: this.engine, target: entity!, data })
                }
            }
        }

        this.clickArray.clear()
    }
}