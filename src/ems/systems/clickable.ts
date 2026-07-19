import { SystemWithNodes } from "./system";
import { ClickableNode } from "./viewportSystem/ClickableNode";
import { Command, Engine } from "../engine";
import { ClickableComponent } from "../components/clickableComponent";
import { PositionComponent } from "../components/position";
import { shortByIndex } from "@/lib/shortByIndex";
import { ViewportSystem } from "./viewportSystem/viewportSystem";

export class ClickableSystem extends SystemWithNodes<ClickableNode> {
    protected updateNode(_node: ClickableNode, _dT?: number): void {
    }
    private clickArray?: Command[];
    private viewport?: ViewportSystem;

    removeFromEngine(): this {
        this.clickArray = undefined;
        this.viewport = undefined;
        this.engine?.unregisterNodeType(ClickableNode)
        this.engine?.unsubscribe("entityAdded", this.onUpdateIndices)
        super.removeFromEngine();

        return this
    }

    private onUpdateIndices = () => {
        this.nodes.sort(shortByIndex)
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        this.clickArray = engine.commands.get("click");

        engine.registerNodeType(ClickableNode, new Set([ClickableComponent]), (entity) =>
        ({
            clickable: entity.getComponent(ClickableComponent)!,
            position: entity.getComponent(PositionComponent)!,
            entity
        }))

        this.nodes = engine.getNodeList(ClickableNode);
        this.nodes.sort(shortByIndex)
        engine.subscribe("entityAdded", this.onUpdateIndices)

        this.viewport = engine.getSystem(ViewportSystem)

        return this
    }

    update(): void {
        if(this.nodes.length === 0 || !this.engine || !this.clickArray?.length || !this.viewport) return;

        if(this.viewport.consumeDragMoved()) {
            this.clickArray.length = 0
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

        this.clickArray.length = 0
    }
}