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
    orbit: OrbitalBlueprint;
    children?: BodyBlueprint[];
    vessels?: VesselBlueprint[];
    binaryPairs?: { bodies: [BodyBlueprint, BodyBlueprint]; separation: number; orbit: OrbitalBlueprint; children?: BodyBlueprint[] }[];
    rings?: { innerRadius: number; outerRadius: number; color: string }[];
    asteroidBelts?: { innerRadius: number; outerRadius: number; color: string, }[];
}>
