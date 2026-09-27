import { PositionComponent } from "@engine/components/position";
import { RadiusComponent } from "@engine/components/radiusComponent";
import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@engine/entities/entityNode";
import { SystemWithNodes } from "@game/systems/system";
import { JumpDriveComponent, SensorSuiteComponent, FuelComponent } from "@game/components/vessel";
import { TargetSystem } from "./targetSystem";
import { HourPassedEvent } from "@/engine/lib/events";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { OrbitComponent } from "@engine/components/orbitComponent";
import { SoiComponent } from "@engine/components/soiComponent";
import { MassComponent } from "@engine/components/massComponent";
import { angularSpeed } from "@/game/utils/orbital";
import { StartState } from "../data/StartState";
import { KEPLER_EPSILON, KEPLER_EPSILON_TIGHT, KEPLER_MAX_ITERATIONS, SHIP_ORBIT_BUFFER_RATIO, DEFAULT_ORBIT_INCLINATION_RANGE } from "../constants";
import { Engine } from "@/engine/core/engine";
import { generateRandomNumber } from "@/lib/generateRandomNumber";

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

        for(const { entity, jumpDrive } of this.nodes) {
            if(!this.canMove(entity, jumpDrive, alreadyMoved)) continue

            if(!this.consumeFuel(entity, jumpDrive.target)) continue

            const waypoints = shipWaypoints.get(entity)
            if(waypoints && waypoints.length > 0) {
                const hasRemaining = this.processWaypoints(entity, waypoints, alreadyMoved)
                if(hasRemaining) continue
            } else {
                this.jumpToTarget(entity, jumpDrive.target)
            }

            this.resolveOrbit(entity)

            if(this.arrivedAtSoi(entity)) {
                this.clearShipNavigation(entity)
            }

            alreadyMoved.add(entity)
        }
    }

    private canMove(entity: Entity, jumpDrive: JumpDriveComponent, alreadyMoved: Set<Entity>): boolean {
        if(!jumpDrive.target || entity === jumpDrive.target || alreadyMoved.has(entity)) return false
        if(jumpDrive.isOrbitSelecting) return false
        return true
    }

    private consumeFuel(entity: Entity, target: Entity | undefined): boolean {
        if(!target) return true

        const fuel = entity.getComponent(FuelComponent)
        if(!fuel) return true

        const pos = entity.getComponent(PositionComponent)
        const targetPos = target.getComponent(PositionComponent)
        if(!pos || !targetPos) return true

        const dist = Math.hypot(targetPos.x - pos.x, targetPos.y - pos.y)
        const cost = dist * fuel.consumptionRate * 0.01
        if(fuel.tylium < cost) return false

        return true
    }

    private processWaypoints(entity: Entity, waypoints: Entity[], alreadyMoved: Set<Entity>): boolean {
        if(!this.engine) return false

        const jumped = waypoints.slice(0, 1)
        const remaining = waypoints.slice(1)

        const shipNode = this.engine.getSceneNode(entity)!
        if(!shipNode) return false

        const currentParent = shipNode.parent?.entity ?? entity
        const finalSector = jumped[jumped.length - 1]
        const targetNode = this.engine.getSceneNode(finalSector)
        if(!targetNode) return false

        shipNode.parent?.removeChild(shipNode)
        targetNode.addChild(shipNode)

        this.positionShipAtTarget(entity, finalSector)

        if(remaining.length > 0) {
            shipWaypoints.set(entity, remaining)
            const drive = entity.getComponent(JumpDriveComponent)
            if(drive) {
                drive.target = remaining[0]
            }
            todaysJumps.set(entity, [currentParent, ...jumped])
            alreadyMoved.add(entity)
            return true
        } else {
            shipWaypoints.delete(entity)
            const drive = entity.getComponent(JumpDriveComponent)
            if(drive) {
                drive.target = undefined
            }
            return false
        }
    }

    private jumpToTarget(entity: Entity, target: Entity | undefined) {
        if(!target || !this.engine) return

        const shipNode = this.engine.getSceneNode(entity)!
        if(!shipNode) return

        const targetNode = this.engine.getSceneNode(target)
        if(!targetNode) return

        shipNode.parent?.removeChild(shipNode)
        targetNode.addChild(shipNode)

        this.positionShipAtTarget(entity, target)
    }

    private arrivedAtSoi(entity: Entity): boolean {
        if(!this.engine) return false

        const shipNode = this.engine.getSceneNode(entity)
        if(!shipNode) return false

        const shipParent = shipNode.parent?.entity
        if(shipParent && shipParent.getComponent(SoiComponent)) {
            shipWaypoints.delete(entity)
            return true
        }
        return false
    }

    private clearShipNavigation(entity: Entity) {
        const drive = entity.getComponent(JumpDriveComponent)
        if(drive) {
            drive.target = undefined
            drive.clickX = undefined
            drive.clickY = undefined
        }
        const targetSystem = this.engine!.getSystem(TargetSystem)
        targetSystem?.clearTarget(entity)
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
        } else {
            position.x = 0
        }
        position.y = 0
    }

    private resolveOrbit = (entity: Entity): void => {
        if(!this.engine) {
            return
        }

        const [shipX, shipY] = getAbsolute(entity, this.engine)

        const attractors = [...StartState.map.attractors.values()]

        let bestSoiEntity: Entity | null = null
        let bestDist = Infinity

        for(const attractor of attractors) {
            const [ax, ay] = getAbsolute(attractor, this.engine)
            const soi = attractor.getComponent(SoiComponent)?.radius ?? 0
            const distToShip = Math.hypot(shipX - ax, shipY - ay)

            if(distToShip <= soi && distToShip < bestDist) {
                bestSoiEntity = attractor
                bestDist = distToShip
            }
        }

        if(bestSoiEntity) {
            this.orbit(this.engine, entity, bestSoiEntity, shipX, shipY)
        }
    }

    private orbit(engine: Engine, entity: Entity, bestSoiEntity: Entity, shipX: number, shipY: number) {
        const shipNode = engine.getSceneNode(entity)!
        const attractorNode = engine.getSceneNode(bestSoiEntity)!

        if(shipNode.parent?.entity !== bestSoiEntity) {
            shipNode.parent?.removeChild(shipNode)
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
        const { x, y } = positionOnOrbit(newRadius, e, meanAnomaly)

        const position = entity.getComponent(PositionComponent)
        if(position) {
            position.x = x
            position.y = y
        }

        const attractorMass = bestSoiEntity.getComponent(MassComponent)?.mass ?? 0

        if(orbit) {
            orbit.centerEntityId = bestSoiEntity.id
            orbit.radius = newRadius
            orbit.meanAnomaly = meanAnomaly
            orbit.angularSpeed = angularSpeed(newRadius, attractorMass)
        } else {
            const inclination = generateRandomNumber(...DEFAULT_ORBIT_INCLINATION_RANGE)
            entity.addComponent(new OrbitComponent(bestSoiEntity.id, newRadius, angularSpeed(newRadius, attractorMass), meanAnomaly, 0, inclination, 0, 0))
        }
    }

    addToEngine(engine: Engine): this {
        if(!engine) {
            return this
        }

        super.addToEngine(engine)

        this.engine =
            engine.subscribe(HourPassedEvent, this.moveNodes)
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

        this.engine.unsubscribe(HourPassedEvent, this.moveNodes)
        super.removeFromEngine()

        return this
    }
}