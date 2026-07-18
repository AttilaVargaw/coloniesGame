import { Engine } from "../../../engine";
import { HexagoneNode } from "./HexagoneNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { ShapeComponent } from "../../../components/ShapeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { shortByIndex } from "@/lib/shortByIndex";
import { transverseAndSumPositionComponents } from "../transverseAndSumPositionComponents";
import { isVisible } from "./isVisible";
import { ViewportSystem } from "../viewportSystem";

const HEXAGON_SIDES = 6;
const PIThird = Math.PI / 3;

export class HexagonRenderer extends SystemWithNodes<HexagoneNode> {
    protected updateNode(shape: HexagoneNode, _dT?: number): void {
        const { camera } = (this.parent as ViewportSystem).viewport;
        if(!isVisible(shape.position, camera.visibleBounds, shape.hexagon.radius)) return;

        const ctx = camera.context

        ctx.save();
        shape.setColor(ctx);
        const [translatedPosX, translatedPosY] = transverseAndSumPositionComponents(shape.position);

        ctx.beginPath();
        for(let i = 0; i < HEXAGON_SIDES; i++) {
            const rotation = PIThird * i;
            const { radius } = shape.hexagon;

            const x = radius * Math.sin(rotation) + translatedPosX;
            const y = radius * Math.cos(rotation) + translatedPosY;

            (i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        shape.draw(ctx);
        ctx.restore();
    }

    protected registerNodes(engine: Engine): this {
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

    addToEngine(engine: Engine): this {
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
        this.nodes.sort(shortByIndex)
    }
}
