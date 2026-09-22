import { PlanetArchetype } from "../factories/helpers";
import { VesselBlueprint } from "./VesselBlueprint";
import { OrbitalBlueprint } from "./OrbitalBlueprint";
import { MapMarker } from "./MapMarker";

export type BodyBlueprint = Readonly<{
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
    asteroidBelts?: { innerRadius: number; outerRadius: number; color: string, }[];
}>
