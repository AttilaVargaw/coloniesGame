import { EventBase } from "@/engine/lib/events";

export class TechResearchedEvent extends EventBase<{ techId: string; entityId: string }> { }
export class TechAdoptionProgressEvent extends EventBase<{ techId: string; entityId: string; adoption: number }> { }
export class TechFullyAdoptedEvent extends EventBase<{ techId: string; entityId: string }> { }
export class TechUnlockedSectorEvent extends EventBase<{ techId: string; entityId: string; sector: string }> { }
