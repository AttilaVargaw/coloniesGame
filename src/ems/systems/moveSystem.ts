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
    constructor(public position: PositionComponent, public jumpDrive: JumpDriveComponent, public sensorSuite: SensorSuiteComponent) {
        super()
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

        for(const { jumpDrive, entity } of this.nodes) {
            //remove from the old node and move it to the new node
            if(jumpDrive.target && entity && jumpDrive.target !== entity.parent) {
                entity.parent?.removeChild(entity)
                //this.engine?.removeEntity(entity)
                jumpDrive.target.addChild(entity)
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
