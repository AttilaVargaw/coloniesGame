import { TWO_PI, ORBITAL_SPEED } from "../constants"

export function angularSpeed(radius: number): number {
    return TWO_PI / Math.pow(radius, 1.5) * ORBITAL_SPEED
}