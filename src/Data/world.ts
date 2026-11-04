import { Draw } from "../Utils/drawing.js"
import { rgba } from "../Utils/math.js"

export const outline = rgba(0)
export const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
if (ctx === null) throw "e"
export const draw = new Draw(ctx)

export const period = 16.67

export const initialVelocity = true // objects begin with an intial velocity
export const periodicVelocityShifts = false // velocity randomized periodically
export const velocityMagnitude = 3 // alters the magnitude of said velocity
export const collisionImpulse = true // objects bounce off each other on collision
export const restitution = 1 // collision bounciness. Values < 1 yield loss of energy. Values > 1 break the first law of thermodynamics
export const mu = 0 // add friction (should be quite small)

export const allCircles = false // all shapes are circles. Increases performance as well
export const allPolys = false // all shapes are polygons. Slightly more performance intensive
export const gridSize = 25 // influences hashgrid check. Can queak for minor performance improvement

// Box Count
export const insertCount: number = 100
export const scale = 20
export const scaleVariance = 0

// Visuals
// 16.67 ms is the sweet spot. If your device can average below this, you can swap to 60 fps
export const drawAsCircles = false // shapes drawn as circles. Increases performance
export const displayAABB = false // aabbs drawn. Uses rect() so not very good for performance
export const displayGridCheck = false // checked grids are highlighted. Very performance intensive
