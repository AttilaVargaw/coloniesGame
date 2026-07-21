import { PositionComponent } from "@engine/components/position";
import { World } from "@engine/core/world";
import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@engine/entities/entityNode";
import { SystemWithNodes } from "@game/systems/system";
import { JumpDriveComponent, SensorSuiteComponent } from "@game/components/vessel";
import { SelectionSystem } from "./selectionSystem";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";
import { DayPassedEvent } from "@/engine/lib/events";

export const DEBUG_VISUALIZE_PATHS = true;

const shipWaypoints = new Map<Entity, Entity[]>();

export function getActivePaths(): { ship: Entity; waypoints: Entity[] }[] {
    const result: { ship: Entity; waypoints: Entity[] }[] = [];
    for(const [ship, waypoints] of shipWaypoints) {
        if(waypoints.length > 0) {
            result.push({ ship, waypoints });
        }
    }
    return result;
}

export function setShipPath(ship: Entity, path: Entity[]) {
    if(path.length <= 1) return;
    const waypoints = path.slice(1);
    shipWaypoints.set(ship, waypoints);
    const drive = ship.getComponent(JumpDriveComponent);
    if(drive) {
        drive.target = waypoints[0];
    }
}

export function clearShipPath(ship: Entity) {
    shipWaypoints.delete(ship);
}

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

        const toAdvance: [Entity, Entity[]][] = [];
        const alreadyMoved = new Set<Entity>();

        for(const { entity, jumpDrive: { target } } of this.nodes) {
            if(!target || entity === target || alreadyMoved.has(entity)) continue

            const entityNode = this.engine.getSceneNode(entity)!
            const targetNode = this.engine.getSceneNode(target)!
            entityNode.parentRef?.removeChild(entityNode)
            targetNode.addChild(entityNode)
            this.engine.addCommand(new RedrawCommand)
            alreadyMoved.add(entity)

            const waypoints = shipWaypoints.get(entity);
            if(waypoints && waypoints.length > 0) {
                toAdvance.push([entity, waypoints]);
            }
        }

        for(const [entity, waypoints] of toAdvance) {
            console.log({ waypoints })
            waypoints.shift();
            const drive = entity.getComponent(JumpDriveComponent);

            if(waypoints.length > 0) {
                if(drive) {
                    drive.target = waypoints[0];
                }
            } else {
                shipWaypoints.delete(entity);
                if(drive) {
                    drive.target = undefined;
                }
                const selectionSystem = this.engine!.getSystem(SelectionSystem)
                selectionSystem?.unTarget()
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
