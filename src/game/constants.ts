export const UNIVERSE_SCALE = 20

export const SHIP_RADIUS = 6
export const SENSOR_SUITE_DEFAULT_RANGE = 30

export const FIELD_OF_VIEW = Math.PI / 3
export const CAMERA_INITIAL_DISTANCE = 100
export const CAMERA_MIN_DISTANCE = 50
export const CAMERA_MAX_DISTANCE = 10000

export const TWO_PI = 2 * Math.PI
export const KEPLER_EPSILON = 1e-6
export const KEPLER_EPSILON_TIGHT = 1e-10
export const KEPLER_MAX_ITERATIONS = 20

export const SHIP_ORBIT_BUFFER_RATIO = 0.5
export const G = 0.0004

export const workingRatio = 0.6
export const pensionerRatio = 0.2
export const studentRatio = 0.2

export const MAX_SOLAR_SYSTEM_DISTNACE = 100 * UNIVERSE_SCALE
export const HABITABLE_ZONE = [0.95, 1.37] as const
export const SOLAR_UNIT = UNIVERSE_SCALE
export const LUNAR_UNIT = 1 / 389 * SOLAR_UNIT * 10

export const STAR_SIZE = 30
export const DEFAULT_ORBIT_INCLINATION_RANGE = [0, 0.8] as const

export const MASS = {
    star: 100000,
    gasGiant: 500,
    iceGiant: 100,
    terrestrial: 10,
    moon: 1,
    dwarfPlanet: 0.5,
    asteroid: 0.1,
}

export const JUMP_HOP_PENALTY = 5000
export const JUMP_GRAPH_MAX_DISTANCE = 7000
export const JUMP_GRAPH_MIN_DISTANCE = 1000
export const DEBUG_VISUALIZE_JUMP_GRAPH = true
export const DEBUG_VISUALIZE_PATHS = true

export const ColonyType = {
    standard: "standard",
    asteroid: "asteroid",
    moon: "moon",
    orbital: "orbital",
} as const

export type ColonyType = typeof ColonyType[keyof typeof ColonyType]