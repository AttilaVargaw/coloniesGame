import { SHIP_RADIUS } from "../constants";
import { createMarker } from "../factories/createSpaceship";

export function createSpaceshipSelector(color: string) {
    return createMarker({ color, radius: SHIP_RADIUS * 2, offset: { x: 0, y: 0, z: -1 } });
}
