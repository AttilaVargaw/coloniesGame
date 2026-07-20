import { PositionComponent } from "../components/position";
import { World } from "../core/world";
import { Entity } from "../entities/entity";
import { EntityNode } from "../entities/entityNode";
import { SystemWithNodes } from "./system";
import { EntityComponent } from "../entities/entityComponent";

export class JumpDriveComponent extends EntityComponent {
    target?: Entity
}
export class SensorSuiteComponent {

}
// export class EcmSuiteComponent { }
// export class ArmorComponent { }

export class MoveNode extends EntityNode {
    constructor(entity: Entity, public position: PositionComponent, public jumpDrive: JumpDriveComponent, public sensorSuite: SensorSuiteComponent) {
        super(entity)
    }
}

export class MoveSystem extends SystemWithNodes<MoveNode> {
    protected updateNode(_node: MoveNode, _dT?: number): void {
    }
    update(_dt: number): void {
        // this.nodes.forEach((node) => {
        //     node.goalSector = node.position
        // })
    }

    moveNodes = () => {
        if(!this.engine) return

        for(const { entity, jumpDrive: { target } } of this.nodes) {
            if(target && entity && target !== entity.parent) {
                entity.parent?.removeChild(entity)
                target.addChild(entity)
                this.engine.addCommand("redraw", { data: {} })
            }
        }
    }

    addToEngine(engine: World): this {
        if(!engine) {
            return this

        }

        super.addToEngine(engine)

        this.engine =
            engine.subscribe("dayPassed", this.moveNodes)
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

        this.engine.unsubscribe("dayPassed", this.moveNodes)
        super.removeFromEngine()

        return this
    }
}
