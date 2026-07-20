import { World } from "../../../core/world";
import { HexagoneNode } from "./HexagonNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { ShapeComponent } from "../../../components/ShapeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { sortByDepth } from "@/lib/sortByIndex";
import { isVisible } from "./isVisible";
import { ViewportSystem } from "../viewportSystem";

const HEXAGON_SIDES = 6;
const PIThird = Math.PI / 3;

export class HexagonRenderer extends SystemWithNodes<HexagoneNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    protected filterNodes: ((node: HexagoneNode) => boolean) = (node) => {
        const { camera } = this.viewportSystem.viewport;
        return isVisible(node.position, camera.visibleBounds, node.hexagon.radius);
    };

    protected updateNode(shape: HexagoneNode, _dT?: number): void {
        const { camera } = this.viewportSystem.viewport;

        const ctx = camera.context

        ctx.save();
        shape.setColor(ctx);
        const [translatedPosX, translatedPosY] = shape.position.getAbsolute();

        ctx.beginPath();
        for(let i = 0; i < HEXAGON_SIDES; i++) {
            const rotation = PIThird * i;
            const { radius } = shape.hexagon;

            const x = radius * Math.sin(rotation) + translatedPosX;
            const y = radius * Math.cos(rotation) + translatedPosY;

            if (i === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        }
        ctx.closePath();
        shape.draw(ctx);
        ctx.restore();
    }

    protected registerNodes(engine: World): this {
        engine.registerNodeType(HexagoneNode,
            new Set([PositionComponent, ShapeComponent, ColorComponent]),
            (entity) => new HexagoneNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(ColorComponent)!,
                entity.getComponent(ShapeComponent)!,
            )
        )

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(HexagoneNode)

        return this
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(HexagoneNode)
        engine.subscribe("entityAdded", this.onEntityAdded)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) return this
        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.engine.unregisterNodeType(HexagoneNode)
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    private onEntityAdded = () => {
        if (this.sortOnEveryEntityAddition) {
            this.nodes.sort(sortByDepth)
        }
    }
}
