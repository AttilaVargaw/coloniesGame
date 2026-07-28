import { PlanetArchetype } from "../factories/helpers";
import { VesselBlueprint } from "./VesselBlueprint";
import { OrbitalBlueprint } from "./OrbitalBlueprint";
import { MapMarker } from "./MapMarker";

export type BodyBlueprint = {
    readonly population?: number;
    readonly name: string;
    readonly radius?: number;
    readonly archetype: PlanetArchetype;
    readonly color?: string;
    readonly marker: MapMarker;
    readonly orbit: OrbitalBlueprint;
    readonly children?: BodyBlueprint[];
    readonly vessels?: VesselBlueprint[];
    readonly binaryPairs?: { bodies: [BodyBlueprint, BodyBlueprint]; separation: number; orbit: OrbitalBlueprint; }[];
};
