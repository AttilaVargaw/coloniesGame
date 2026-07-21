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
const todaysJumps = new Map<Entity, Entity[]>();

export function getActivePaths(): { ship: Entity; waypoints: Entity[] }[] {
    const result: { ship: Entity; waypoints: Entity[] }[] = [];
    for(const [ship, waypoints] of shipWaypoints) {
        if(waypoints.length > 0) {
            result.push({ ship, waypoints });
        }
    }
    return result;
}

export function getTodaysJumps(): { ship: Entity; path: Entity[] }[] {
    const result: { ship: Entity; path: Entity[] }[] = [];
    for(const [ship, path] of todaysJumps) {
        if(path.length > 0) {
            result.push({ ship, path });
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
    const drive = ship.getComponent(JumpDriveComponent);
    if(drive) {
        drive.target = undefined;
    }
}

export function clearAllPaths() {
    shipWaypoints.clear()
    todaysJumps.clear()
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

        todaysJumps.clear();
        const alreadyMoved = new Set<Entity>();

        for(const { entity, jumpDrive: { target }, sensorSuite: { range } } of this.nodes) {
            if(!target || entity === target || alreadyMoved.has(entity)) continue

            const waypoints = shipWaypoints.get(entity);
            const shipNode = this.engine.getSceneNode(entity)!

            if(waypoints && waypoints.length > 0) {
                const maxJumps = Math.max(1, range);
                const jumpedCount = Math.min(maxJumps, waypoints.length);
                const jumped = waypoints.slice(0, jumpedCount);
                const remaining = waypoints.slice(jumpedCount);

                const currentParent = shipNode.parentRef?.entity ?? entity;
                const finalSector = jumped[jumped.length - 1];
                const targetNode = this.engine.getSceneNode(finalSector)!
                shipNode.parentRef?.removeChild(shipNode)
                targetNode.addChild(shipNode)

                const drive = entity.getComponent(JumpDriveComponent);
                if(remaining.length > 0) {
                    shipWaypoints.set(entity, remaining);
                    if(drive) {
                        drive.target = remaining[0];
                    }
                    todaysJumps.set(entity, [currentParent, ...jumped]);
                } else {
                    shipWaypoints.delete(entity);
                    if(drive) {
                        drive.target = undefined;
                    }
                    const selectionSystem = this.engine!.getSystem(SelectionSystem)
                    selectionSystem?.unTarget()
                    this.engine.addCommand(new RedrawCommand)
                }
            } else {
                const targetNode = this.engine.getSceneNode(target)!
                shipNode.parentRef?.removeChild(shipNode)
                targetNode.addChild(shipNode)
            }

            this.engine.addCommand(new RedrawCommand)
            alreadyMoved.add(entity)
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
