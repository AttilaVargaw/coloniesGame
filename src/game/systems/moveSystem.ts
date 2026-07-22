import { PositionComponent } from "@engine/components/position";
import { RadiusComponent } from "@engine/components/radiusComponent";
import { World } from "@engine/core/world";
import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@engine/entities/entityNode";
import { SystemWithNodes } from "@game/systems/system";
import { JumpDriveComponent, SensorSuiteComponent } from "@game/components/vessel";
import { TargetSystem } from "./targetSystem";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";
import { DayPassedEvent } from "@/engine/lib/events";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { OrbitComponent } from "@engine/components/orbitComponent";
import { SoiComponent } from "@engine/components/soiComponent";
import { StartState } from "@game/data/types";

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
        drive.clickX = undefined;
        drive.clickY = undefined;
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

                const position = entity.getComponent(PositionComponent)
                if(position) {
                    const targetRadius = finalSector.getComponent(RadiusComponent)?.radius ?? 0
                    const targetSoi = finalSector.getComponent(SoiComponent)?.radius
                    if(targetSoi) {
                        position.x = targetRadius + 30
                        position.y = 0
                    } else {
                        position.x = 0
                        position.y = 0
                    }
                }

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
                    const targetSystem = this.engine!.getSystem(TargetSystem)
                    targetSystem?.clearTarget(entity)
                    this.engine.addCommand(new RedrawCommand)
                }
            } else {
                const targetNode = this.engine.getSceneNode(target)!
                shipNode.parentRef?.removeChild(shipNode)
                targetNode.addChild(shipNode)

                const position = entity.getComponent(PositionComponent)
                if(position) {
                    const targetRadius = target.getComponent(RadiusComponent)?.radius ?? 0
                    const targetSoi = target.getComponent(SoiComponent)?.radius
                    if(targetSoi) {
                        position.x = targetRadius + 30
                        position.y = 0
                    } else {
                        position.x = 0
                        position.y = 0
                    }
                }
            }

            this.resolveOrbit(entity)

            const shipParent = shipNode.parentRef?.entity
            if(shipParent && shipParent.getComponent(SoiComponent)) {
                shipWaypoints.delete(entity)
                const drive = entity.getComponent(JumpDriveComponent)
                if(drive) {
                    drive.target = undefined
                    drive.clickX = undefined
                    drive.clickY = undefined
                }
                const targetSystem = this.engine!.getSystem(TargetSystem)
                targetSystem?.clearTarget(entity)
            }

            this.engine.addCommand(new RedrawCommand)
            alreadyMoved.add(entity)
        }
    }

    private resolveOrbit = (entity: Entity): void => {
        if(!this.engine) return

        const [shipX, shipY] = getAbsolute(entity, this.engine)
        let bestSoiEntity: Entity | null = null
        let bestDist = Infinity

        for(const attractor of StartState.map.attractors.values()) {
            const [ax, ay] = getAbsolute(attractor, this.engine)
            const dist = Math.hypot(shipX - ax, shipY - ay)
            const soi = attractor.getComponent(SoiComponent)?.radius ?? 0
            if(dist <= soi && dist < bestDist) {
                bestSoiEntity = attractor
                bestDist = dist
            }
        }

        if(!bestSoiEntity) return

        const shipNode = this.engine.getSceneNode(entity)!
        const attractorNode = this.engine.getSceneNode(bestSoiEntity)!

        if(shipNode.parentRef?.entity !== bestSoiEntity) {
            shipNode.parentRef?.removeChild(shipNode)
            attractorNode.addChild(shipNode)
        }

        const [ax, ay] = getAbsolute(bestSoiEntity, this.engine)
        const orbit = entity.getComponent(OrbitComponent)
        const attractorRadius = bestSoiEntity.getComponent(RadiusComponent)?.radius ?? 0
        const drive = entity.getComponent(JumpDriveComponent)
        const newAngle = (drive && drive.clickX !== undefined && drive.clickY !== undefined)
            ? Math.atan2(drive.clickY - ay, drive.clickX - ax)
            : Math.atan2(shipY - ay, shipX - ax)
        const newRadius = (drive && drive.clickX !== undefined && drive.clickY !== undefined)
            ? Math.hypot(drive.clickX - ax, drive.clickY - ay)
            : attractorRadius + 30

        const position = entity.getComponent(PositionComponent)
        if(position) {
            position.x = Math.cos(newAngle) * newRadius
            position.y = Math.sin(newAngle) * newRadius
        }

        if(orbit) {
            orbit.centerEntityId = bestSoiEntity.id
            orbit.radius = newRadius
            orbit.angle = newAngle
            orbit.angularSpeed = 1.5 / Math.sqrt(newRadius)
        } else {
            entity.addComponent(new OrbitComponent(bestSoiEntity.id, newRadius, 1.5 / Math.sqrt(newRadius), newAngle))
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