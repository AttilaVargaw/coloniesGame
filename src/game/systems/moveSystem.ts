import { PositionComponent } from "@engine/components/position";
import { RadiusComponent } from "@engine/components/radiusComponent";
import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@engine/entities/entityNode";
import { SystemWithNodes } from "@game/systems/system";
import { JumpDriveComponent, SensorSuiteComponent, FuelComponent } from "@game/components/vessel";
import { TargetSystem } from "./targetSystem";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";
import { DayPassedEvent } from "@/engine/lib/events";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { OrbitComponent } from "@engine/components/orbitComponent";
import { SoiComponent } from "@engine/components/soiComponent";
import { angularSpeed } from "@/game/utils/orbital";
import { StartState } from "@game/data/types";
import { KEPLER_EPSILON, KEPLER_EPSILON_TIGHT, KEPLER_MAX_ITERATIONS, SHIP_ORBIT_BUFFER_RATIO } from "../constants";
import { Engine } from "@/engine/core/engine";

export const DEBUG_VISUALIZE_PATHS = true;

function trueAnomalyToMeanAnomaly(trueAnomaly: number, e: number): number {
    if(e < KEPLER_EPSILON) return trueAnomaly

    const cosTrue = Math.cos(trueAnomaly)
    const cosE = (e + cosTrue) / (1 + e * cosTrue)
    const sinE = Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(trueAnomaly) / (1 + e * cosTrue)
    const E = Math.atan2(sinE, cosE)

    return E - e * Math.sin(E)
}

function positionOnOrbit(radius: number, eccentricity: number, meanAnomaly: number): { x: number, y: number } {
    if(eccentricity < KEPLER_EPSILON) {
        return { x: Math.cos(meanAnomaly) * radius, y: Math.sin(meanAnomaly) * radius }
    }

    let E = meanAnomaly
    for(let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
        const dE = (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E))
        E -= dE
        if(Math.abs(dE) < KEPLER_EPSILON_TIGHT) break
    }

    const r = radius * (1 - eccentricity * Math.cos(E))
    const theta = 2 * Math.atan2(
        Math.sqrt(1 + eccentricity) * Math.sin(E / 2),
        Math.sqrt(Math.max(KEPLER_EPSILON_TIGHT, 1 - eccentricity)) * Math.cos(E / 2)
    )

    return { x: r * Math.cos(theta), y: r * Math.sin(theta) }
}

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

            const fuel = entity.getComponent(FuelComponent)
            if(fuel) {
                const pos = entity.getComponent(PositionComponent)
                const targetPos = target.getComponent(PositionComponent)
                if(pos && targetPos) {
                    const dist = Math.hypot(targetPos.x - pos.x, targetPos.y - pos.y)
                    const cost = dist * fuel.consumptionRate * 0.01
                    if(fuel.tylium < cost) continue
                    fuel.tylium -= cost
                }
            }

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

                this.positionShipAtTarget(entity, finalSector)

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

                this.positionShipAtTarget(entity, target)
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

    positionShipAtTarget(entity: Entity, targetEntity: Entity): void {
        const position = entity.getComponent(PositionComponent)
        if(!position) return

        const targetRadius = targetEntity.getComponent(RadiusComponent)?.radius ?? 0
        const targetSoi = targetEntity.getComponent(SoiComponent)?.radius
        if(targetSoi) {
            const soiDepth = Math.max(0, targetSoi - targetRadius)
            const buffer = Math.min(SHIP_ORBIT_BUFFER_RATIO * targetSoi, soiDepth * 0.5)
            position.x = targetRadius + buffer
            position.y = 0
        } else {
            position.x = 0
            position.y = 0
        }
    }

    private resolveOrbit = (entity: Entity): void => {
        if(!this.engine) {
            return
        }

        const [shipX, shipY] = getAbsolute(entity, this.engine)

        const drive = entity.getComponent(JumpDriveComponent)
        const useClick = drive && drive.clickX !== undefined && drive.clickY !== undefined

        const attractors = [...StartState.map.attractors.values()]

        let bestSoiEntity: Entity | null = null
        let bestDist = Infinity

        for(const attractor of attractors) {
            const [ax, ay] = getAbsolute(attractor, this.engine)
            const soi = attractor.getComponent(SoiComponent)?.radius ?? 0
            const distToShip = Math.hypot(shipX - ax, shipY - ay)
            const distToClick = useClick ? Math.hypot(drive.clickX! - ax, drive.clickY! - ay) : distToShip

            if(distToShip <= soi && distToClick < bestDist) {
                bestSoiEntity = attractor
                bestDist = distToClick
            }
        }

        if(bestSoiEntity) {
            this.orbit(this.engine, entity, bestSoiEntity, shipX, shipY)
        }
    }

    private orbit(engine: Engine, entity: Entity, bestSoiEntity: Entity, shipX: number, shipY: number) {
        const shipNode = engine.getSceneNode(entity)!
        const attractorNode = engine.getSceneNode(bestSoiEntity)!

        if(shipNode.parentRef?.entity !== bestSoiEntity) {
            shipNode.parentRef?.removeChild(shipNode)
            attractorNode.addChild(shipNode)
        }

        const [ax, ay] = getAbsolute(bestSoiEntity, engine)
        const attractorRadius = bestSoiEntity.getComponent(RadiusComponent)?.radius ?? 0
        const drive = entity.getComponent(JumpDriveComponent)
        const newAngle = (drive && drive.clickX !== undefined && drive.clickY !== undefined)
            ? Math.atan2(drive.clickY - ay, drive.clickX - ax)
            : Math.atan2(shipY - ay, shipX - ax)
        const newRadius = (drive && drive.clickX !== undefined && drive.clickY !== undefined)
            ? Math.hypot(drive.clickX - ax, drive.clickY - ay)
            : attractorRadius + 30

        const orbit = entity.getComponent(OrbitComponent)
        const e = orbit?.eccentricity ?? 0
        const meanAnomaly = trueAnomalyToMeanAnomaly(newAngle, e)
        const pos = positionOnOrbit(newRadius, e, meanAnomaly)

        const position = entity.getComponent(PositionComponent)
        if(position) {
            position.x = pos.x
            position.y = pos.y
        }

        if(orbit) {
            orbit.centerEntityId = bestSoiEntity.id
            orbit.radius = newRadius
            orbit.meanAnomaly = meanAnomaly
            orbit.angularSpeed = angularSpeed(newRadius)
        } else {
            entity.addComponent(new OrbitComponent(bestSoiEntity.id, newRadius, angularSpeed(newRadius), meanAnomaly))
        }
    }

    addToEngine(engine: Engine): this {
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