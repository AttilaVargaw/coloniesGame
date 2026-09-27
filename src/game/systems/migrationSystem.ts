import { MigrationRouteNode } from "@game/systems/MigrationRouteNode";
import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent } from "@/engine/lib/events";
import { MigrationRouteComponent } from "@game/components/migrationRouteComponent";
import { IndustryComponent } from "@game/components/industryComponent";
import { PositionComponent } from "@/engine/components/position";
import { MigrationRouteCreatedEvent, MigrationRouteCompletedEvent, MigrationRouteCancelledEvent } from "@game/events/migrationEvents";
import { CreateMigrationRouteCommand } from "@game/commands/createMigrationRouteCommand";
import { CancelMigrationRouteCommand } from "@game/commands/cancelMigrationRouteCommand";
import { v4 as uuid } from "uuid";
import { Queue } from "@/engine/lib/commandQueue";
import { createEntity } from "@/engine/lib/entityRegistry";

export class MigrationSystem extends SystemWithNodes<MigrationRouteNode> {
    private migrationRouteCreatedEvents: Queue<MigrationRouteCreatedEvent> | null = null
    private migrationRouteCompletedEvents: Queue<MigrationRouteCompletedEvent> | null = null
    private migrationRouteCancelledEvents: Queue<MigrationRouteCancelledEvent> | null = null

    private createMigrationRouteCommands: Queue<CreateMigrationRouteCommand> | null = null
    private cancelMigrationRouteCommands: Queue<CancelMigrationRouteCommand> | null = null

    update(_dt: number): void {
        this.migrationRouteCancelledEvents?.clear()
        this.migrationRouteCompletedEvents?.clear()
        this.migrationRouteCreatedEvents?.clear()

        this.createMigrationRouteCommands?.clear()
        this.cancelMigrationRouteCommands?.clear()
    }

    protected updateNode(_node: MigrationRouteNode, _dT?: number): void {
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.engine?.unregisterNodeType(MigrationRouteNode);
        this.engine?.unsubscribe(DayPassedEvent, this.onDayPassed);
        this.engine?.removeCommandQueue(CreateMigrationRouteCommand);
        this.engine?.removeCommandQueue(CancelMigrationRouteCommand);
        super.removeFromEngine();

        this.migrationRouteCreatedEvents = null;
        this.migrationRouteCompletedEvents = null;
        this.migrationRouteCancelledEvents = null;

        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(
            MigrationRouteNode,
            new Set([MigrationRouteComponent]),
            (entity) => new MigrationRouteNode(entity.getComponent(MigrationRouteComponent)!, entity)
        );
        engine.registerEventQueue(MigrationRouteCreatedEvent);
        engine.registerEventQueue(MigrationRouteCompletedEvent);
        engine.registerEventQueue(MigrationRouteCancelledEvent);

        engine.subscribe(DayPassedEvent, this.onDayPassed);

        engine.registerCommandQueue(CreateMigrationRouteCommand);
        engine.registerCommandQueue(CancelMigrationRouteCommand);

        this.migrationRouteCreatedEvents = engine.getEvents(MigrationRouteCreatedEvent);
        this.migrationRouteCompletedEvents = engine.getEvents(MigrationRouteCompletedEvent);
        this.migrationRouteCancelledEvents = engine.getEvents(MigrationRouteCancelledEvent);

        this.createMigrationRouteCommands = engine.getCommands(CreateMigrationRouteCommand);
        this.cancelMigrationRouteCommands = engine.getCommands(CancelMigrationRouteCommand);

        this.nodes = engine.getNodeList(MigrationRouteNode);

        return this;
    }

    private onDayPassed = () => {
        const createCommands = this.engine?.getCommands(CreateMigrationRouteCommand);
        if(createCommands) {
            for(const cmd of [...createCommands]) {
                this.handleCreateMigrationRoute(cmd);
            }
        }

        const cancelCommands = this.engine?.getCommands(CancelMigrationRouteCommand);
        if(cancelCommands) {
            for(const cmd of [...cancelCommands]) {
                this.handleCancelMigrationRoute(cmd);
            }
        }

        const routesToRemove: MigrationRouteNode[] = [];

        for(const node of this.nodes) {
            node.migrationRoute.travelDaysRemaining -= 1;

            if(node.migrationRoute.travelDaysRemaining <= 0) {
                this.completeMigrationRoute(node);
                routesToRemove.push(node);
            }
        }

        for(const node of routesToRemove) {
            this.engine?.removeEntity(node.entity);
        }
    };

    private handleCreateMigrationRoute(command: CreateMigrationRouteCommand) {
        const { sourceEntityId, destinationEntityId, workerCount, speed } = command;
        const source = this.engine?.getAllEntities().find(e => e.id === sourceEntityId);
        const destination = this.engine?.getAllEntities().find(e => e.id === destinationEntityId);

        if(!source || !destination) return;

        const sourceIndustry = source.getComponent(IndustryComponent);
        if(!sourceIndustry) return;

        const sourcePos = source.getComponent(PositionComponent);
        const destPos = destination.getComponent(PositionComponent);
        if(!sourcePos || !destPos) return;

        const distance = Math.hypot(destPos.x - sourcePos.x, destPos.y - sourcePos.y);
        const travelDays = Math.max(1, Math.ceil(distance / (speed * 0.5)));

        const actualWorkerCount = Math.min(workerCount, sourceIndustry.freeWorkers.worker.number);
        if(actualWorkerCount <= 0) return;

        sourceIndustry.freeWorkers.worker.number -= actualWorkerCount;
        sourceIndustry.population.worker.number -= actualWorkerCount;
        this.engine?.reindexEntity(source);

        const routeEntity = createEntity(uuid());
        if(!routeEntity) return;

        routeEntity.addComponent(new MigrationRouteComponent(
            sourceEntityId,
            destinationEntityId,
            actualWorkerCount,
            travelDays,
            travelDays,
            speed
        ));

        this.engine?.addEntity(routeEntity);
        this.engine?.dispatchEvent(new MigrationRouteCreatedEvent({ routeEntityId: routeEntity.id }));
    }

    private handleCancelMigrationRoute(command: CancelMigrationRouteCommand) {
        const routeEntity = this.engine?.getAllEntities().find(e => e.id === command.routeEntityId);
        if(!routeEntity) return;

        const route = routeEntity.getComponent(MigrationRouteComponent);
        if(!route) return;

        const source = this.engine?.getAllEntities().find(e => e.id === route.sourceEntityId);
        if(source) {
            const sourceIndustry = source.getComponent(IndustryComponent);
            if(sourceIndustry) {
                sourceIndustry.freeWorkers.worker.number += route.workerCount;
                sourceIndustry.population.worker.number += route.workerCount;
                this.engine?.reindexEntity(source);
            }
        }

        this.engine?.removeEntity(routeEntity);
        this.engine?.dispatchEvent(new MigrationRouteCancelledEvent({ routeEntityId: command.routeEntityId }));
    }

    private completeMigrationRoute(node: MigrationRouteNode) {
        const { destinationEntityId, workerCount } = node.migrationRoute;
        const destination = this.engine?.getAllEntities().find(e => e.id === destinationEntityId);
        if(!destination) return;

        const destIndustry = destination.getComponent(IndustryComponent);
        if(!destIndustry) return;

        destIndustry.freeWorkers.worker.number += workerCount;
        destIndustry.population.worker.number += workerCount;
        this.engine?.reindexEntity(destination);

        this.engine?.dispatchEvent(new MigrationRouteCompletedEvent({ routeEntityId: node.entity.id }));
    }
}
