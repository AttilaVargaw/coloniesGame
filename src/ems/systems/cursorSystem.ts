import { Engine } from "@/ems/engine";
import { SystemWithNodes } from "./system";
import { ViewportSystem } from "./viewportSystem/viewportSystem";
import { PositionComponent } from "../components/position";
import { PositionNode } from "./viewportSystem/positionNode";
import { EntityComponent } from "../entities/entityComponent";
import { isContained } from "@/lib/isContained";

export class HoverableComponent extends EntityComponent {
    constructor(
        public cursor: "default" | "pointer" | "none" | "not-allowed" = "pointer",
        public size: { width: number, height: number }) {
        super()
    }
}

export class HoverableNode extends PositionNode {
    constructor(public position: PositionComponent, public hoverable: HoverableComponent) {
        super(position);
    }
}

export class CursorSystem extends SystemWithNodes<HoverableNode> {
    removeFromEngine(): void {
        this.engine?.unregisterNodeType(HoverableNode);
        super.removeFromEngine();
    }

    addToEngine(engine: Engine) {
        super.addToEngine(engine);

        engine.registerNodeType(HoverableNode, new Set([HoverableComponent]), (entity) =>
        ({
            hoverable: entity.getComponent(HoverableComponent)!,
            position: entity.getComponent(PositionComponent)!,
            entity
        }));

        this.nodes = engine.getNodeList(HoverableNode)
    }

    update() {
        if(!this.engine) return

        const mouseMovedCommand = this.engine.commands.get("mouseMoved")!

        if(!mouseMovedCommand.length) {
            return
        }

        this.engine.commands.get("mouseMoved")?.forEach(({ data }) => {
            if(!this.engine) return

            const { camera } = this.engine.getSystem(ViewportSystem)!.viewport
            const { x, y } = camera.screenToWorld(data.x, data.y)

            for(const hoverableNode of this.nodes) {
                const { hoverable: { size, cursor } } = hoverableNode

                if(isContained({ x, y }, { position: hoverableNode.position, size })) {
                    document.body.style.cursor = cursor;
                    return
                }
            }

            if(document.body.style.cursor !== 'default') {
                document.body.style.cursor = 'default';
            }
        })

        mouseMovedCommand.length = 0
    }

}