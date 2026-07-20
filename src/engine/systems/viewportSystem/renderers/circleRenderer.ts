import { World } from "../../../core/world";
import { CircleNode } from "./circleNode";
import { SystemWithNodes } from "../../system";
import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { sortByDepth } from "@/lib/sortByIndex";
import { isVisible } from "./isVisible";
import { ViewportSystem } from "../viewportSystem";
import { Entity } from "@/engine/entities/entity";

function getAbsolute(entity: Entity, engine: World): [number, number] {
    const sceneNode = engine.getSceneNode(entity);
    const parentPosition = sceneNode?.parentRef?.entity;

    let absoluteX: number;
    let absoluteY: number;

    if(!parentPosition) {
        const position = entity.getComponent(PositionComponent)!;
        absoluteX = position.x;
        absoluteY = position.y;
    } else {
        const [parentX, parentY] = getAbsolute(sceneNode.parentRef.entity, engine);
        const position = entity.getComponent(PositionComponent)!;
        absoluteX = parentX + position.x;
        absoluteY = parentY + position.y;
    }

    return [absoluteX, absoluteY];
}


export class CircleRenderer extends SystemWithNodes<CircleNode> {
    constructor(private readonly viewportSystem: ViewportSystem) {
        super()
    }

    protected filterNodes: ((node: CircleNode) => boolean) = (node) => {
        const { camera } = this.viewportSystem.viewport;
        return isVisible(camera.visibleBounds, node.radius.radius, node.entity!, this.engine!);
    };

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(CircleNode)
        //engine.subscribe("entityAdded", this.onEntityAdded)

        return this
    }

    protected registerNodes(engine: World): this {
        engine.registerNodeType(CircleNode,
            new Set([PositionComponent, RadiusComponent, ColorComponent]),
            (entity) => new CircleNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(RadiusComponent)!,
                entity.getComponent(ColorComponent)
            )
        )

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(CircleNode)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unsubscribe("entityAdded", this.onEntityAdded)
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    updateNode = (circle: CircleNode) => {
        const { camera } = this.viewportSystem.viewport;

        const ctx = camera.context

        ctx.save();
        circle.setColor(ctx);

        ctx.translate(...getAbsolute(circle.entity!, this.engine!));

        ctx.beginPath();
        ctx.arc(0, 0, circle.radius.radius, 0, Math.PI * 2);
        ctx.closePath();
        circle.draw(ctx);
        ctx.restore();
    }

    private onEntityAdded = () => {
        if(this.sortOnEveryEntityAddition) {
            this.nodes.sort(sortByDepth)
        }
    }
}
