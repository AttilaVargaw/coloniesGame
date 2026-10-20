import { PlanetArchetype } from "../factories/helpers";
import { VesselBlueprint } from "./VesselBlueprint";
import { OrbitalBlueprint } from "./OrbitalBlueprint";
import { MapMarker } from "./MapMarker";
import { IndustrialSectors } from "../components/Factories";

export type BodyBlueprint = Readonly<{
    buildable?: boolean;
    allowedSettlementTypes?: ("colony" | "outpost" | "hydrocarbonRefinery")[];
    navigationalPoint?: boolean
    population?: number;
    name: string;
    radius?: number;
    archetype: PlanetArchetype;
    color?: string;
    marker: MapMarker;
    mass?: number;
    orbit: OrbitalBlueprint;
    vessels?: VesselBlueprint[];
    systems?: { bodies: BodyBlueprint[]; satellites?: BodyBlueprint[]; orbit?: OrbitalBlueprint; angle?: number }[];
    rings?: { innerRadius: number; outerRadius: number; color: string }[];
    asteroidBelts?: { innerRadius: number; outerRadius: number; color: string, name: string }[];
    starterIndustries?: Partial<IndustrialSectors>;
}>

