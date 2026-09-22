import { G } from "../constants"

export function angularSpeed(radius: number, mass: number): number {
    const r = Math.max(radius, 1)
    return Math.sqrt(G * mass / r ** 3)
}
