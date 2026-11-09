export const period = 16.67

export const initialVelocity = 0 // objects begin with an intial velocity
export const periodicVelocityShifts = false // velocity randomized periodically
export const velocityMagnitude = 1 // alters the magnitude of said velocity
export const collisionImpulse = true // objects bounce off each other on collision
export const restitution = 1 // collision bounciness. Values < 1 yield loss of energy. Values > 1 break the first law of thermodynamics
export const mu = 0 // add friction (should be quite small)
export const boundedWorld = false // whether the world teleports you at the edges or not

export const allCircles = false // all shapes are circles. Increases performance as well
export const allPolys = false // all shapes are polygons. Slightly more performance intensive
export const gridSize = 100 // influences hashgrid check. Can queak for minor performance improvement

// Box Count
export const insertCount: number = 100
export const scale = 20
export const scaleVariance = 0

// Visuals
// 16.67 ms is the sweet spot. If your device can average below this, you can swap to 60 fps
export const displayAABB = true // aabbs drawn. Uses rect() so not very good for performance
export const displayGridCheck = true // checked grids are highlighted. Very performance intensive
export const cameraTrack = true // track them shapes
