import { MapMarker } from "./MapMarker";
import { OrbitalBlueprint } from "./OrbitalBlueprint";

export type VesselBlueprint = Readonly<{
    marker: MapMarker;
    orbit: OrbitalBlueprint;
}>;
