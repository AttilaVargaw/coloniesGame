import { OrbitComponent } from "../../components/orbitComponent";

export function precomputeOrbitalTrig(orbit: OrbitComponent) {
    const inclination = orbit.inclination || 0
    const cosI = Math.cos(inclination)
    const sinI = Math.sin(inclination)
    const arg = orbit.argumentOfPeriapsis || 0
    const cosA = Math.cos(arg)
    const sinA = Math.sin(arg)
    const lan = orbit.longitudeOfAscendingNode || 0
    const cosL = Math.cos(lan)
    const sinL = Math.sin(lan)

    return { inclination, cosI, sinI, arg, cosA, sinA, lan, cosL, sinL }
}
