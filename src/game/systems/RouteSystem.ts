import { SystemWithNodes } from "@engine/systems/system";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent } from "@/engine/lib/events";
import { PositionComponent } from "@/engine/components/position";
import { EntityComponent } from "@engine/entities/entityComponent";
import { EntityNode, EntityNodeConstructor } from "@engine/entities/entityNode";
import { Entity } from "@/engine/entities/entity";
import { v4 as uuid } from "uuid";
import { Queue } from "@/engine/lib/commandQueue";
import { createEntity } from "@/engine/lib/entityRegistry";
import { EventBase } from "@/engine/lib/events";
import { CommandBase } from "@/engine/lib/CommandBase";

export interface RouteComponentData extends EntityComponent {
    sourceEntityId: string;
    destinationEntityId: string;
    travelDaysRemaining: number;
    totalTravelDays: number;
    speed: number;
}

export abstract class RouteSystem<
    TNode extends EntityNode,
> extends SystemWithNodes<TNode> {
    protected abstract readonly nodeConstructor: EntityNodeConstructor<TNode>;
    protected abstract readonly componentConstructor: new (...args: any[]) => EntityComponent;

    protected abstract readonly createdEventClass: new (data: { routeEntityId: string }) => EventBase<{ routeEntityId: string }>;
    protected abstract readonly completedEventClass: new (data: { routeEntityId: string }) => EventBase<{ routeEntityId: string }>;
    protected abstract readonly cancelledEventClass: new (data: { routeEntityId: string }) => EventBase<{ routeEntityId: string }>;

    protected abstract readonly createCommandClass: new (...args: any[]) => CommandBase;
    protected abstract readonly cancelCommandClass: new (...args: any[]) => CommandBase;

    protected abstract getRouteComponent(node: TNode): RouteComponentData;

    protected abstract createRouteComponent(
        sourceEntityId: string,
        destinationEntityId: string,
        payload: unknown,
        travelDays: number,
        speed: number,
    ): RouteComponentData;

    // Returns the route payload after deducting from the source, or null if the route cannot be created.
    protected abstract prepareSource(source: Entity, command: CommandBase): unknown | null;

    // Refund route contents back to the source settlement.
    protected abstract refundSource(source: Entity, route: RouteComponentData): void;

    // Deliver route contents to the destination settlement.
    protected abstract deliverDestination(destination: Entity, route: RouteComponentData): void;

    // Optional validation before creating a route (e.g. industry present, free workers).
    protected validateCreate(_source: Entity, _destination: Entity): boolean {
        return true;
    }

    private createdEvents: Queue<EventBase<{ routeEntityId: string }>> | null = null;
    private completedEvents: Queue<EventBase<{ routeEntityId: string }>> | null = null;
    private cancelledEvents: Queue<EventBase<{ routeEntityId: string }>> | null = null;

    private createCommands: Queue<CommandBase> | null = null;
    private cancelCommands: Queue<CommandBase> | null = null;

    update(_dt: number): void {
        // Route lifecycle is driven by DayPassedEvent, not per-frame ticks.
    }

    protected updateNode(_node: TNode, _dT?: number): void {
        // no-op
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this;
        }

        this.engine.unregisterNodeType(this.nodeConstructor);
        this.engine.unsubscribe(DayPassedEvent, this.onDayPassed);
        this.engine.removeCommandQueue(this.createCommandClass);
        this.engine.removeCommandQueue(this.cancelCommandClass);
        super.removeFromEngine();

        this.createdEvents = null;
        this.completedEvents = null;
        this.cancelledEvents = null;
        this.createCommands = null;
        this.cancelCommands = null;

        return this;
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.registerNodeType(
            this.nodeConstructor,
            new Set([this.componentConstructor]),
            (entity) => new this.nodeConstructor(entity.getComponent(this.componentConstructor)!, entity),
        );
        engine.registerEventQueue(this.createdEventClass);
        engine.registerEventQueue(this.completedEventClass);
        engine.registerEventQueue(this.cancelledEventClass);

        engine.subscribe(DayPassedEvent, this.onDayPassed);

        engine.registerCommandQueue(this.createCommandClass);
        engine.registerCommandQueue(this.cancelCommandClass);

        this.createdEvents = engine.getEvents(this.createdEventClass);
        this.completedEvents = engine.getEvents(this.completedEventClass);
        this.cancelledEvents = engine.getEvents(this.cancelledEventClass);

        this.createCommands = engine.getCommands(this.createCommandClass);
        this.cancelCommands = engine.getCommands(this.cancelCommandClass);

        this.nodes = engine.getNodeList(this.nodeConstructor);

        return this;
    }

    protected computeTravelDays(distance: number, speed: number): number {
        return Math.max(1, Math.ceil(distance / (speed * 0.5)));
    }

    private onDayPassed = () => {
        if(!this.createCommands || !this.cancelCommands) {
            return;
        }

        for(const cmd of this.createCommands) {
            this.handleCreateRoute(cmd);
        }
        this.createCommands.clear();

        for(const cmd of this.cancelCommands) {
            this.handleCancelRoute(cmd);
        }
        this.cancelCommands.clear();

        const routesToRemove: TNode[] = [];

        for(const node of this.nodes) {
            const route = this.getRouteComponent(node);
            route.travelDaysRemaining -= 1;

            if(route.travelDaysRemaining <= 0) {
                this.completeRoute(node);
                routesToRemove.push(node);
            }
        }

        for(const node of routesToRemove) {
            this.engine?.removeEntity(node.entity);
        }

        this.createdEvents?.clear();
        this.completedEvents?.clear();
        this.cancelledEvents?.clear();
    };

    private handleCreateRoute(command: CommandBase): void {
        const { sourceEntityId, destinationEntityId } = command as { sourceEntityId: string; destinationEntityId: string };
        const source = this.engine?.getEntityById(sourceEntityId);
        const destination = this.engine?.getEntityById(destinationEntityId);

        if(!source || !destination) return;
        if(!this.validateCreate(source, destination)) return;

        const sourcePos = source.getComponent(PositionComponent);
        const destPos = destination.getComponent(PositionComponent);
        if(!sourcePos || !destPos) return;

        const speed = (command as { speed?: number }).speed ?? 1;
        const distance = Math.hypot(destPos.x - sourcePos.x, destPos.y - sourcePos.y);
        const travelDays = this.computeTravelDays(distance, speed);

        const payload = this.prepareSource(source, command);
        if(payload === null) return;

        const routeEntity = createEntity(uuid());
        if(!routeEntity) return;

        routeEntity.addComponent(this.createRouteComponent(
            sourceEntityId,
            destinationEntityId,
            payload,
            travelDays,
            speed,
        ));

        this.engine?.addEntity(routeEntity);
        this.engine?.dispatchEvent(new this.createdEventClass({ routeEntityId: routeEntity.id }));
    }

    private handleCancelRoute(command: CommandBase): void {
        const { routeEntityId } = command as { routeEntityId: string };
        const routeEntity = this.engine?.getEntityById(routeEntityId);
        if(!routeEntity) return;

        const route = routeEntity.getComponent(this.componentConstructor);
        if(!route) return;

        const routeData = route as RouteComponentData;
        const source = this.engine?.getEntityById(routeData.sourceEntityId);
        if(source) {
            this.refundSource(source, routeData);
        }

        this.engine?.removeEntity(routeEntity);
        this.engine?.dispatchEvent(new this.cancelledEventClass({ routeEntityId }));
    }

    private completeRoute(node: TNode): void {
        const route = this.getRouteComponent(node);
        const { destinationEntityId } = route;
        const destination = this.engine?.getEntityById(destinationEntityId);
        if(!destination) return;

        this.deliverDestination(destination, route);

        this.engine?.dispatchEvent(new this.completedEventClass({ routeEntityId: node.entity.id }));
    }
}
