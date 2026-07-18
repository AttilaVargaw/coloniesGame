import { Engine } from "../../../engine";
import { HexagoneNode } from "./HexagoneNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { ShapeComponent } from "../../../components/ShapeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { shortByIndex } from "@/lib/shortByIndex";
import { transverseAndSumPositionComponents } from "../transverseAndSumPositionComponents";

const HEXAGON_SIDES = 6;
const PIThird = Math.PI / 3;

export class HexagonRenderer extends SystemWithNodes<HexagoneNode> {
    addToEngine(engine: Engine) {
        engine.registerNodeType(HexagoneNode,
            new Set([PositionComponent, ShapeComponent, ColorComponent]),
            (entity) => new HexagoneNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(ColorComponent)!,
                entity.getComponent(ShapeComponent)!,
            )
        )
        this.nodes = engine.getNodeList(HexagoneNode)
        engine.subscribe("entityAdded", this.onEntityAdded)
        super.addToEngine(engine)
    }

    removeFromEngine() {
        if(!this.engine) return
        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.engine.unregisterNodeType(HexagoneNode)
        this.nodes.length = 0
        super.removeFromEngine()
    }

    render(ctx: CanvasRenderingContext2D) {
        for(const shape of this.nodes) {
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
    }

    private onEntityAdded = () => {
        this.nodes.sort(shortByIndex)
    }
}
