import { RouteSystem } from "./RouteSystem";
import { MigrationRouteNode } from "./MigrationRouteNode";
import { MigrationRouteComponent } from "@game/components/migrationRouteComponent";
import { IndustryComponent } from "@game/components/industryComponent";
import { MigrationRouteCreatedEvent, MigrationRouteCompletedEvent, MigrationRouteCancelledEvent } from "@game/events/migrationEvents";
import { CreateMigrationRouteCommand } from "@game/commands/createMigrationRouteCommand";
import { CancelMigrationRouteCommand } from "@game/commands/cancelMigrationRouteCommand";
import { Entity } from "@/engine/entities/entity";
import { CommandBase } from "@/engine/lib/CommandBase";

export class MigrationSystem extends RouteSystem<MigrationRouteNode> {
    protected readonly nodeConstructor = MigrationRouteNode;
    protected readonly componentConstructor = MigrationRouteComponent;

    protected readonly createdEventClass = MigrationRouteCreatedEvent;
    protected readonly completedEventClass = MigrationRouteCompletedEvent;
    protected readonly cancelledEventClass = MigrationRouteCancelledEvent;

    protected readonly createCommandClass = CreateMigrationRouteCommand;
    protected readonly cancelCommandClass = CancelMigrationRouteCommand;

    protected getRouteComponent(node: MigrationRouteNode): MigrationRouteComponent {
        return node.migrationRoute;
    }

    protected createRouteComponent(
        sourceEntityId: string,
        destinationEntityId: string,
        payload: unknown,
        travelDays: number,
        speed: number,
    ): MigrationRouteComponent {
        const workerCount = payload as number;
        return new MigrationRouteComponent(sourceEntityId, destinationEntityId, workerCount, travelDays, travelDays, speed);
    }

    protected validateCreate(source: Entity): boolean {
        const sourceIndustry = source.getComponent(IndustryComponent);
        return !!sourceIndustry && sourceIndustry.freeWorkers.worker.number > 0;
    }

    protected prepareSource(source: Entity, command: CommandBase): number | null {
        const { workerCount } = command as { workerCount: number; speed?: number };
        const sourceIndustry = source.getComponent(IndustryComponent);
        if(!sourceIndustry) return null;

        const actualWorkerCount = Math.min(workerCount, sourceIndustry.freeWorkers.worker.number);
        if(actualWorkerCount <= 0) return null;

        sourceIndustry.freeWorkers.worker.number -= actualWorkerCount;
        sourceIndustry.population.worker.number -= actualWorkerCount;
        this.engine?.reindexEntity(source);

        return actualWorkerCount;
    }

    protected refundSource(source: Entity, route: MigrationRouteComponent): void {
        const sourceIndustry = source.getComponent(IndustryComponent);
        if(sourceIndustry) {
            sourceIndustry.freeWorkers.worker.number += route.workerCount;
            sourceIndustry.population.worker.number += route.workerCount;
            this.engine?.reindexEntity(source);
        }
    }

    protected deliverDestination(destination: Entity, route: MigrationRouteComponent): void {
        const destIndustry = destination.getComponent(IndustryComponent);
        if(destIndustry) {
            destIndustry.freeWorkers.worker.number += route.workerCount;
            destIndustry.population.worker.number += route.workerCount;
            this.engine?.reindexEntity(destination);
        }
    }
}
