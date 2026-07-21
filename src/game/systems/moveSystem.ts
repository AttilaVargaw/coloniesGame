import { PositionComponent } from "@engine/components/position";
import { World } from "@engine/core/world";
import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@engine/entities/entityNode";
import { SystemWithNodes } from "@game/systems/system";
import { JumpDriveComponent, SensorSuiteComponent } from "@game/components/vessel";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";
import { DayPassedEvent } from "@/engine/lib/events";

export class MoveNode extends EntityNode {
    constructor(entity: Entity, public position: PositionComponent, public jumpDrive: JumpDriveComponent, public sensorSuite: SensorSuiteComponent) {
        super(entity)
    }
}

export class MoveSystem extends SystemWithNodes<MoveNode> {
    protected updateNode(_node: MoveNode, _dT?: number): void {
    }
    update(_dt: number): void {
    }

    moveNodes = () => {
        if(!this.engine) return

        for(const { entity, jumpDrive: { target } } of this.nodes) {
            if(target && entity && target !== entity) {
                const entityNode = this.engine.getSceneNode(entity)!
                const targetNode = this.engine.getSceneNode(target)!
                entityNode.parentRef?.removeChild(entityNode)
                targetNode.addChild(entityNode)
                this.engine.addCommand(new RedrawCommand)
            }
        }
    }

    addToEngine(engine: World): this {
        if(!engine) {
            return this

        }

        super.addToEngine(engine)

        this.engine =
            engine.subscribe(DayPassedEvent, this.moveNodes)
        engine.registerNodeType(MoveNode,
            new Set([PositionComponent, JumpDriveComponent, SensorSuiteComponent]),
            (entity) => {
                return new MoveNode(
                    entity,
                    entity.getComponent(PositionComponent)!,
                    entity.getComponent(JumpDriveComponent)!,
                    entity.getComponent(SensorSuiteComponent)!
                )
            });

        this.nodes = engine.getNodeList(MoveNode)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(MoveNode)

        this.engine.unsubscribe(DayPassedEvent, this.moveNodes)
        super.removeFromEngine()

        return this
    }
}
