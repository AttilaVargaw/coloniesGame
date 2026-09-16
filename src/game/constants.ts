export const UNIVERSE_SCALE = 20

export const STAR_RADIUS = 20
export const SHIP_RADIUS = 6
export const SENSOR_SUITE_DEFAULT_RANGE = 30

export const FIELD_OF_VIEW = Math.PI / 4
export const CAMERA_INITIAL_DISTANCE = 3000
export const CAMERA_MIN_DISTANCE = 100
export const CAMERA_MAX_DISTANCE = 120000

export const TWO_PI = 2 * Math.PI
export const KEPLER_EPSILON = 1e-6
export const KEPLER_EPSILON_TIGHT = 1e-10
export const KEPLER_MAX_ITERATIONS = 20

export const SHIP_ORBIT_BUFFER_RATIO = 0.5
export const ORBITAL_SPEED = 1
export const TIME_ACCELERATION = 50000

export const workingRatio = 0.6
export const pensionerRatio = 0.2
export const studentRatio = 0.2

export const MAX_SOLAR_SYSTEM_DISTNACE = 100 * UNIVERSE_SCALE
export const HABITABLE_ZONE = [0.95, 1.37] as const
export const SOLAR_UNIT = UNIVERSE_SCALE

export const STAR_SIZE = 30
export const DEFAULT_ORBIT_INCLINATION_RANGE = [0, 0.3] as const