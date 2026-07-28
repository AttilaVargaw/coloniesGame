import { MapMarker } from "./MapMarker";
import { OrbitalBlueprint } from "./OrbitalBlueprint";

export type VesselBlueprint = {
    readonly marker: MapMarker;
    readonly orbit: OrbitalBlueprint;
};
