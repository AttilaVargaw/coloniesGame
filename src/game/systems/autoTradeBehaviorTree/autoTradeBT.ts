export interface TradeBlackboard {
    settlements: any[];
    activeRoutes: Set<string>;
    incomingMigrationDestinations: Set<string>;
    engine: any;
    pairRoutes: Map<string, any>;
    decisions: Array<() => void>;
}

export const defaultTradeBlackboard: TradeBlackboard = {
    settlements: [],
    activeRoutes: new Set(),
    incomingMigrationDestinations: new Set(),
    engine: null,
    pairRoutes: new Map(),
    decisions: [],
};
