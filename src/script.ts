import { sq, constrain, random, rgba } from "./Utils/math.js"
import { shift, zipWith, zipShift } from "./Utils/arrays.js"
import { Vector } from "./Data/vector.js"
import { Color } from "./Data/color.js"

const outline = rgba(0)

import { canvas, draw, ctx } from "./Data/world.js"
import * as Settings from "./Data/world.js"

const [width, height] = [canvas.width, canvas.height]
const [halfWidth, halfHeight] = [width / 2, height / 2]

let idCount = 0
const newid = () => idCount++

import { SpatialHashGrid } from "./Data/spatialHashGrid.js"

const world = new SpatialHashGrid(Settings.gridSize, new Vector(width, height), draw)

function regularPolyVerts(x: number, y: number, radius: number, sideCount: number) {
  const vertices = []
  for (let i = 0; i < sideCount; i++)
    vertices.push(
      new Vector(
        x + radius * Math.cos((2 * Math.PI * i) / sideCount),
        y + radius * Math.sin((2 * Math.PI * i) / sideCount)
      )
    )
  return vertices
}
function polyVerts(...inputs: number[]): Vector[] {
  let vertices = []
  for (let i = 0; i < inputs.length; i += 2) vertices.push(new Vector(inputs[i], inputs[i + 1]))
  return vertices
}

type ShapeType = "Polygon" | "Circle"

abstract class AShape {
  abstract type: ShapeType
  abstract centroid: Vector
  abstract radius: number
  abstract color: Color
  abstract draw: (x: number, y: number, θ: number) => void
}

class Polygon implements AShape {
  type: ShapeType
  centroid: Vector
  color: Color
  radius: number
  vertices: Vector[]
  constructor(vertices: Vector[], color: Color = new Color([0, 0, 0, 0])) {
    this.type = "Polygon"
    this.vertices = vertices
    this.color = color
    let maxSqRadius = -Infinity
    this.centroid = this.vertices
      .reduce(
        (sum, vertex) => {
          maxSqRadius = Math.max(vertex.getSqMag(), maxSqRadius)
          return sum.add(vertex)
        },
        new Vector(0, 0)
      )
      .divide(this.vertices.length)
    this.radius = Math.sqrt(maxSqRadius)
  }
  draw(dx: number, dy: number, θ: number) {
    ctx.setTransform(1, 0, 0, 1, dx, dy)
    ctx.transform(Math.cos(θ), Math.sin(θ), -Math.sin(θ), Math.cos(θ), 0, 0)
    draw.polygon(this.vertices, this.color.cachedValue, 1, outline)
  }
}

class Circle implements AShape {
  type: ShapeType
  centroid: Vector
  color: Color
  radius: number
  constructor(
    radius: number,
    color: Color = new Color([0, 0, 0, 0]),
    centroid: Vector = new Vector(0, 0)
  ) {
    this.type = "Circle"
    this.centroid = centroid
    this.radius = radius
    this.color = color
  }
  draw(dx: number, dy: number, θ: number) {
    ctx.setTransform(1, 0, 0, 1, dx, dy)
    draw.ellipse(
      this.centroid.x,
      this.centroid.y,
      this.radius * 2,
      this.radius * 2,
      this.color.cachedValue,
      2,
      outline
    )
    draw.line(
      this.centroid.x,
      this.centroid.y,
      this.radius * Math.cos(θ),
      this.radius * Math.sin(θ),
      0.5,
      outline
    )
  }
}

type Shape = Polygon | Circle

class Aabb {
  width: number
  height: number
  centroid: Vector
  constructor(width: number, height: number, centroid: Vector) {
    this.width = width
    this.height = height
    this.centroid = centroid
  }
  draw(base: Base) {
    ctx.setTransform(
      1,
      0,
      0,
      1,
      this.centroid.x + base.position.x + halfWidth,
      this.centroid.y + base.position.y + halfHeight
    )
    draw.rect(-this.width / 2, -this.height / 2, this.width, this.height, rgba(128, 50))
    draw.ellipse(0, 0, this.width, this.width, rgba(128, 50), 0, rgba(0, 0))
  }
}

type WindingOrder = "CW" | "CCW"
type UpdateType = "None" | "AABB" | "SAT"
abstract class AHitbox {
  abstract normals: Vector[]

  abstract rho: number
  abstract aabb: Aabb
  abstract area: number
  abstract mass: number
  abstract momentOfInertia: number
  abstract windingOrder: WindingOrder

  abstract rotatedVertices: Vector[]
  abstract transformedVertices: Vector[]
  abstract cachedDir: number
  abstract cachedNormals: Vector[]
  abstract cachedCentroid: Vector

  abstract lastUpdate: UpdateType
  abstract shallowUpdate: (base: Base) => void
  abstract narrowUpdate: (base: Base) => void
  abstract project: (axis: Vector, base: Base) => { min: number; max: number }
  abstract closestPointToCentroidOf: (base: Base) => Vector
}

class PolygonHitbox extends Polygon implements AHitbox {
  normals: Vector[]

  rho: number
  aabb: Aabb
  area: number
  mass: number
  momentOfInertia: number
  windingOrder: WindingOrder

  rotatedVertices: Vector[]
  transformedVertices: Vector[]
  cachedDir: number
  lastUpdate: UpdateType
  cachedNormals: Vector[]
  cachedCentroid: Vector

  constructor(shape: Polygon, base: Base, rho?: number) {
    super(shape.vertices, shape.color)
    this.rotatedVertices = []
    this.transformedVertices = []
    this.normals = []
    this.cachedDir = 0
    this.lastUpdate = "None"
    this.cachedNormals = []
    this.rho = rho ?? 1

    this.area = zipShift(this.vertices).reduce(
      (area, [vertex, nextVertex]) => area + vertex.crossProduct(nextVertex),
      0
    )
    this.windingOrder = this.area < 0 ? "CW" : "CCW"
    this.area = Math.abs(this.area) / 2
    this.mass = this.area * this.rho
    this.rotatedVertices = this.rotatedVertices.map((v) => v.rotate(base.dir))
    const loopedVertices =
      this.windingOrder === "CW" ? this.vertices.slice().reverse() : this.vertices.slice()
    this.momentOfInertia =
      zipShift(loopedVertices).reduce(
        (inertia, [vertex, nextVertex]) =>
          ((subArea) =>
            inertia +
            subArea * (vertex.getSqMag() + vertex.dotProduct(nextVertex) + nextVertex.getSqMag()))(
            vertex.crossProduct(nextVertex)
          ),
        0
      ) *
        (this.rho / 12) -
      this.mass * this.centroid.getSqMag()

    this.cachedNormals = zipWith(this.vertices, shift(this.vertices), (vertex, nextVertex) =>
      nextVertex.subtract(vertex).perpendicular().normalize()
    )
    this.normals = this.cachedNormals.map((n) => n.copy())

    this.cachedCentroid = this.centroid.copy()
    const doubleRadius =
      2 *
      Math.sqrt(
        this.vertices.reduce(
          (maxSqRadius, vertex) =>
            Math.max(vertex.subtract(this.cachedCentroid).getSqMag(), maxSqRadius),
          -Infinity
        )
      )
    // Better for more uniform shapes (this scenario)
    this.aabb = new Aabb(doubleRadius, doubleRadius, this.centroid)

    this.shallowUpdate(base)
  }
  shallowUpdate(base: Base) {
    this.lastUpdate = "AABB"
    // check if rotation recalc neccessary
    if (base.dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
      this.centroid.rotate(base.dir)
    if (!Settings.displayAABB) return
    // display AABB (note aabb centroid points to base centroid)
    this.aabb.draw(base)
  }
  narrowUpdate(base: Base) {
    if (this.lastUpdate !== "AABB") return
    this.lastUpdate = "SAT"
    this.transformedVertices = this.vertices.map((vertex) =>
      vertex.rotate(base.dir).add(base.position)
    )
    this.normals = this.cachedNormals.map((cachedNormal) => cachedNormal.rotate(base.dir))
  }
  project(axis: Vector): { min: number; max: number } {
    const projections = this.transformedVertices.map((vertex) => vertex.dotProduct(axis))
    return {
      min: Math.min(...projections),
      max: Math.max(...projections),
    }
  }
  closestPointToCentroidOf(base: Base): Vector {
    let closestPoint = new Vector(0, 0)
    let minDistanceSquared = Infinity
    const centroid = base.position.add(base.hitbox.centroid)
    // loop over this object's edges
    zipShift(this.transformedVertices).forEach(([vertexA, vertexB]) => {
      // get closest point on side
      const sideAB = vertexB.subtract(vertexA)
      const sideACentroid = centroid.subtract(vertexA)
      let projection = sideACentroid.dotProduct(sideAB) / sideAB.getSqMag()
      projection = constrain(projection, 0, 1)

      const point = vertexA.add(sideAB.scale(projection))
      const difference = point.subtract(centroid)
      const distanceSquared = difference.getSqMag()
      if (distanceSquared < minDistanceSquared) {
        minDistanceSquared = distanceSquared
        closestPoint = point
      }
    })
    return closestPoint
  }
}

class CircleHitbox extends Circle implements AHitbox {
  normals: Vector[]

  rho: number
  aabb: Aabb
  area: number
  mass: number
  momentOfInertia: number
  windingOrder: WindingOrder

  rotatedVertices: Vector[]
  transformedVertices: Vector[]
  cachedDir: number
  lastUpdate: UpdateType
  cachedNormals: Vector[]
  cachedCentroid: Vector

  constructor(circle: Circle, base: Base, rho?: number) {
    super(circle.radius, circle.color, circle.centroid)
    this.rotatedVertices = []
    this.transformedVertices = []
    this.normals = []
    this.cachedDir = 0
    this.lastUpdate = "None"
    this.cachedNormals = []

    this.rho = rho ?? 1

    this.area = Math.PI * sq(this.radius)
    this.mass = this.area * this.rho
    this.momentOfInertia = 0.5 * this.mass * sq(this.radius)

    this.aabb = new Aabb(this.radius * 2, this.radius * 2, this.centroid)
    this.cachedCentroid = this.centroid.copy()
    this.windingOrder = "CW"

    this.shallowUpdate(base)
  }
  shallowUpdate(base: Base) {
    this.lastUpdate = "AABB"

    // check if rotation recalc neccessary
    if (base.dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
      this.centroid.rotate(base.dir)
    if (!Settings.displayAABB) return
    // display AABB (note aabb centroid points to base centroid)
    this.aabb.draw(base)
  }
  narrowUpdate() {
    return
  }
  project(axis: Vector, base: Base): { min: number; max: number } {
    const centroid = this.centroid.add(base.position)
    const projection = axis.dotProduct(centroid)
    return {
      min: projection - this.radius,
      max: projection + this.radius,
    }
  }
  closestPointToCentroidOf(): Vector {
    throw "Uncalleable"
  }
}

type Hitbox = PolygonHitbox | CircleHitbox

// temp
export class Base {
  id: number
  indices: Vector[]

  position: Vector
  dir: number
  velocity: Vector
  omega: number
  shape: Shape
  trueColor: Color

  hitbox: Hitbox
  axesBuffer: Vector[]
  ticks: number

  constructor(position: Vector, dir: number, shape: Shape, velocity?: Vector) {
    this.id = newid()
    this.indices = []
    this.position = position
    this.dir = dir
    this.shape = shape
    this.trueColor = new Color([random(-15, 40), 0.6, 1], "HSV")

    if (shape instanceof Polygon) this.hitbox = new PolygonHitbox(shape, this)
    else this.hitbox = new CircleHitbox(shape, this)

    this.axesBuffer = []
    if (Settings.initialVelocity) {
      this.velocity = new Vector(
        random(0, 2 * Math.PI),
        Settings.velocityMagnitude * random(0.75, 1.25),
        "dirMag"
      )
      this.omega = random(-0.15, 0.15)
    } else {
      this.velocity = velocity ?? new Vector(0, 0)
      this.omega = 0
    }
    this.ticks = Math.floor(random(0, 50))
  }
  getInput() {
    // const input_x = (keys[RIGHT] || keys[68]) - (keys[LEFT] || keys[65])
    // const input_y = (keys[DOWN] || keys[83]) - (keys[UP] || keys[87])
    // const input_dir = keys[69] - keys[81]
    // const translation = new Vector(input_x, input_y).normalize()
    // if (this.velocity.getMag() < 3) this.velocity = this.velocity.add(translation.divide(5))
    // else this.velocity = this.velocity.normalize().scale(2.9)
    // if (Math.abs(this.omega) < 0.1) this.omega += input_dir / 100
    // else this.omega = Math.sign(this.omega) * 0.09
  }
  update(dt: number) {
    this.ticks++
    this.position = this.position.add(this.velocity.scale(dt / Settings.period))
    this.dir += this.omega * (dt / Settings.period)

    const velocity = this.velocity.getMag()
    if (velocity > Settings.mu)
      this.velocity = this.velocity.subtract(this.velocity.scale(Settings.mu / velocity))
    else this.velocity = new Vector(0, 0)

    if (Math.abs(this.position.x) > halfWidth + this.hitbox.aabb.width / 2) {
      this.position.x = -Math.sign(this.position.x) * (halfWidth + this.hitbox.aabb.width / 2)
    }
    if (Math.abs(this.position.y) > halfHeight + this.hitbox.aabb.height / 2) {
      this.position.y = -Math.sign(this.position.y) * (halfHeight + this.hitbox.aabb.width / 2)
    }

    if (this.ticks % (60 * dt) === 0 && Settings.periodicVelocityShifts) {
      this.velocity = new Vector(
        random(0, 2 * Math.PI),
        Settings.velocityMagnitude * random(0.75, 1.25),
        "dirMag"
      )
      this.omega = random(-0.01, 0.01) * Settings.scale
    }
    this.shape.color = this.trueColor
  }
  draw() {
    this.shape.draw(this.position.x + halfWidth, this.position.y + halfHeight, this.dir)
  }
  checkCollision(otherBase: Base) {
    const baseA = this
    const baseB = otherBase
    const tCentroidA = baseA.hitbox.centroid.add(baseA.position)
    const tCentroidB = baseB.hitbox.centroid.add(baseB.position)

    this.axesBuffer.length = 0
    // common seperation axis first
    this.axesBuffer.push(tCentroidB.subtract(tCentroidA).normalize())
    for (const normal of baseA.hitbox.normals) this.axesBuffer.push(normal)
    for (const normal of baseB.hitbox.normals) this.axesBuffer.push(normal)

    let axes = this.axesBuffer
    // Circle-Circle test
    if (baseA.hitbox.type === baseB.hitbox.type && baseA.hitbox.type === "Circle") {
      const sqDistance = baseA.hitbox.centroid
        .add(baseA.position)
        .subtract(baseB.hitbox.centroid.add(baseB.position))
        .getSqMag()
      const radiiSum = baseA.hitbox.radius + baseB.hitbox.radius
      if (sqDistance > sq(radiiSum)) {
        return { colliding: false }
      } else {
        const overlap = Math.sqrt(sqDistance) - radiiSum
        const normal = tCentroidA.subtract(tCentroidB).normalize()
        return {
          colliding: true,
          axis: normal,
          overlap: overlap,
          MTV: normal.scale(overlap),
          baseA: baseA,
          baseB: baseB,
        }
      }
    }

    // Polygon-Polygon / Circle-Polygon Test
    // project each hitbox on each axis, checking for seperation
    let minOverlap = Infinity
    let minNormal: Vector = axes[0]
    for (const axis of axes) {
      // project each hitbox's vertices
      const projA = baseA.hitbox.project(axis, baseA)
      const projB = baseB.hitbox.project(axis, baseB)

      // check if seperate
      if (projA.max < projB.min || projB.max < projA.min) return { colliding: false }

      const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min)
      if (overlap < minOverlap) {
        minOverlap = overlap
        minNormal = axis
      }
    }

    // Circle-Polygon Edge Case
    if (baseA.hitbox.type !== baseB.hitbox.type) {
      // get closest point on edge and add to normals
      let circleBase, otherBase
      if (baseA.hitbox.type === "Circle") [circleBase, otherBase] = [baseA, baseB]
      else [circleBase, otherBase] = [baseB, baseA]
      const centroid = circleBase.position.add(circleBase.hitbox.centroid)

      const closestPoint = otherBase.hitbox.closestPointToCentroidOf(circleBase)
      const axis = closestPoint.subtract(centroid).normalize()

      // project each hitbox's vertices
      const projA = baseA.hitbox.project(axis, baseA)
      const projB = baseB.hitbox.project(axis, baseB)

      // check if seperate
      if (projA.max < projB.min || projB.max < projA.min) return { colliding: false }

      const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min)
      if (overlap < minOverlap) {
        minOverlap = overlap
        minNormal = axis
      }
    }

    // reorient axis when neccessary
    const direction = tCentroidB.subtract(tCentroidA)
    const dotProd = minNormal.x * direction.x + minNormal.y * direction.y
    if (dotProd < 0) minNormal = minNormal.negate()

    return {
      colliding: true,
      axis: minNormal,
      overlap: minOverlap,
      baseA: baseA,
      baseB: baseB,
    }
  }
  handleCollision(data: {
    colliding: boolean
    axis: Vector
    overlap: number
    baseA: Base
    baseB: Base
  }) {
    if (!data.colliding) return
    const axis = data.axis
    const MTV = data.axis.scale(data.overlap)
    const baseB = data.baseB
    const baseA = data.baseA
    const bases = [baseA, baseB]

    const massA = baseA.hitbox.mass,
      massB = baseB.hitbox.mass

    const displacementA = MTV.scale(massB / (massA + massB))
    const displacementB = MTV.scale(massA / (massA + massB))
    baseA.position = baseA.position.subtract(displacementA)
    baseB.position = baseB.position.add(displacementB)
    // get contact points
    let contactPoints: Vector[] = []
    const collisionType = baseA.hitbox.type + "-" + baseB.hitbox.type
    if (collisionType === "Polygon-Polygon") {
      /* Visualization:
           A is the checked vertex. BC is the current edge of the other base. P is the closest point
              /B
             / |
            /  |
           A---P
            \  |
             \ |
              \C
        */

      // base loop
      bases.forEach((base: Base, index: number, bases: Base[]) => {
        const otherBase = bases[(index + 1) % bases.length]
        const vertices = base.hitbox.transformedVertices
        const otherVertices = otherBase.hitbox.transformedVertices
        // vertex loop
        vertices.forEach((vertexA) => {
          // side loop
          otherVertices.forEach((vertexB, index, bVertices) => {
            const vertexC = bVertices[(index + 1) % bVertices.length]
            const sideBC = vertexC.subtract(vertexB)
            const sideBA = vertexA.subtract(vertexB)

            let projection = sideBA.dotProduct(sideBC) / sideBC.getSqMag()
            projection = constrain(projection, 0, 1)

            const point = vertexB.add(sideBC.scale(projection))
            const sideAP = point.subtract(vertexA)
            const distanceSquared = sideAP.getSqMag()
            if (distanceSquared < 1 && contactPoints.length < 2) {
              if (contactPoints.length === 1) {
                if (contactPoints[0].subtract(point).getSqMag() > 0.01) contactPoints.push(point)
              } else contactPoints.push(point)
            }
          })
        })
      })
      if (contactPoints.length === 0)
        contactPoints.push(baseA.hitbox.closestPointToCentroidOf(baseB))
    } else if (collisionType === "Polygon-Circle" || collisionType === "Circle-Polygon") {
      let circleBase, otherBase
      if (baseA.hitbox.type === "Circle") [circleBase, otherBase] = [baseA, baseB]
      else [circleBase, otherBase] = [baseB, baseA]
      contactPoints.push(otherBase.hitbox.closestPointToCentroidOf(circleBase))
    } else if (collisionType === "Circle-Circle") {
      const centroidAToCentroidB = baseB.position.subtract(baseA.position).normalize()
      contactPoints.push(baseA.position.add(centroidAToCentroidB.scale(baseA.hitbox.radius)))
    }

    for (const point of contactPoints) {
      ctx.setTransform(1, 0, 0, 1, halfWidth + point.x, halfHeight + point.y)
      draw.ellipse(0, 0, 5, 5, rgba(100, 50))
    }
    if (!Settings.collisionImpulse) return

    for (const contactPoint of contactPoints) {
      const vectorAC = contactPoint.subtract(baseA.position)
      const vectorBC = contactPoint.subtract(baseB.position)
      const contactVelocityA = baseA.velocity.add(vectorAC.perpendicular().scale(baseA.omega))
      const contactVelocityB = baseB.velocity.add(vectorBC.perpendicular().scale(baseB.omega))

      const velocityAB = contactVelocityB.subtract(contactVelocityA)

      const inertiaA = baseA.hitbox.momentOfInertia
      const inertiaB = baseB.hitbox.momentOfInertia
      const impulseScalar =
        velocityAB.scale(-1 - Settings.restitution).dotProduct(axis) /
        (axis.dotProduct(axis.scale(1 / massA + 1 / massB)) +
          sq(vectorAC.crossProduct(axis)) / inertiaA +
          sq(vectorBC.crossProduct(axis)) / inertiaB)

      baseA.velocity = baseA.velocity.subtract(axis.scale(impulseScalar / massA))
      baseA.omega += (vectorAC.crossProduct(axis) * impulseScalar) / inertiaA

      baseB.velocity = baseB.velocity.add(axis.scale(impulseScalar / massB))
      baseB.omega -= (vectorBC.crossProduct(axis) * impulseScalar) / inertiaB
    }
  }
}

let boxes: Base[] = []
for (let i = 0; i < Settings.insertCount; i++) {
  let shape =
    (Math.ceil(random(0, 5)) > 3 && !Settings.allCircles) || Settings.allPolys
      ? new Polygon(
          regularPolyVerts(
            0,
            0,
            Math.ceil(
              Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance)
            ),
            Math.ceil(random(2, 7))
          ),
          new Color([255, 0, 0])
        )
      : new Circle(Math.ceil(Settings.scale * random(0.9, 1.1)), new Color([255, 0, 0]))
  if (random(0, 5) > 4) {
    let hWidth =
      Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * random(2, 4)
    let hHeight =
      Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * 0.5
    shape = new Polygon(
      polyVerts(-hWidth, -hHeight, hWidth, -hHeight, hWidth, hHeight, -hWidth, hHeight),
      new Color([255, 0, 0])
    )
  }
  boxes.push(
    new Base(
      new Vector(random(-halfWidth, halfWidth), random(-halfHeight, halfHeight)),
      random(0, 2 * Math.PI),
      shape
    )
  )
}
if (Settings.insertCount === 0)
  boxes.push(
    new Base(new Vector(-100, 0), 0, new Circle(20, new Color([255, 0, 0])), new Vector(1, 0)),
    new Base(new Vector(100, 0), 0, new Circle(100, new Color([255, 0, 0]))),
    new Base(new Vector(0, -100), 0, new Circle(35, new Color([255, 0, 0]))),
    new Base(
      new Vector(0, 100),
      1.5,
      new Polygon(regularPolyVerts(0, 0, 35, 5), new Color([255, 0, 0]))
    ),
    new Base(
      new Vector(0, 200),
      1.2,
      new Polygon(polyVerts(-25, -50, 25, -50, 25, 50, -25, 50), new Color([255, 0, 0]))
    )
  )

const displayPeriod = 60

class PerformanceProfile {
  metrics: Record<string, any>
  ticks: number
  constructor() {
    this.metrics = {}
    this.ticks = 0
  }
  getTime() {
    const result = performance.now() - this.ticks
    this.ticks = performance.now()
    return result
  }
  updateMetric(key: string) {
    if (this.metrics[key] === undefined) {
      this.metrics[key] = {}
      this.metrics[key].buffer = []
    }
    let metric = this.metrics[key]
    metric.buffer[0] += this.getTime()
  }
  getMetricData(key: string): {
    min: number
    max: number
    average: number
    percentage: number
  } {
    let buffer = this.metrics[key].buffer

    const average = buffer.reduce((acc: number, time: number) => acc + time) / buffer.length

    let percentage = 100
    if (key !== "total") percentage = (average / this.metrics.total.savedData.average) * 100

    return {
      min: Math.min(...buffer),
      max: Math.max(...buffer),
      average: average,
      percentage: percentage,
    }
  }
  // for next frame
  resetMetrics() {
    for (const key in this.metrics) {
      const metric = this.metrics[key]
      if (metric.buffer.unshift(0) > displayPeriod) {
        metric.buffer.pop()
      }
    }
  }
  getTotal() {
    let sum = 0
    for (const key in this.metrics) {
      if (key === "total") {
        continue
      }
      sum += this.metrics[key].buffer[0]
    }
    if (this.metrics.total === undefined) {
      this.metrics.total = {}
      this.metrics.total.buffer = []
    }
    const total = this.metrics.total
    total.buffer[0] = sum
  }
}

const Perf = new PerformanceProfile()

let ticksSinceInput = 0

let ticks = 0
let collisions = []

// const font = createFont("sans-serif")
// const fontBold = createFont("sans-serif Bold")

for (const client of boxes) {
  client.getInput()
  world.newClient(client)
}

const collisionSet = new Set()
let KE = 0

let lastTime = 0
function drawLoop(timestamp: number) {
  if (ctx === null) throw "e"
  ctx.resetTransform()
  let dt = timestamp - lastTime
  lastTime = timestamp
  if (isNaN(dt)) dt = 0

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  KE = 0
  Perf.resetMetrics()
  collisionSet.clear()
  collisions = []
  world.cellsChecked = 0
  ticksSinceInput++
  //background(255)
  draw.rect(0, 0, width, height, "#ffffff")

  world.draw()

  Perf.getTime()

  for (const box of boxes) {
    KE +=
      (box.hitbox.mass * box.velocity.getSqMag()) / 2 +
      (box.hitbox.momentOfInertia * sq(box.omega)) / 2
    box.update(dt)
    Perf.updateMetric("boxUpdate")
    box.hitbox.shallowUpdate(box)
    Perf.updateMetric("aabbUpdate")
    world.update(box)
    Perf.updateMetric("gridUpdate")
  }

  // check collisions
  let collisionChecks = 0
  for (const box of boxes) {
    const aabb = box.hitbox.aabb
    Perf.getTime()
    const clients = world.queryGrid(box.position.add(aabb.centroid), aabb.width, aabb.height)
    Perf.updateMetric("gridQuery")

    for (const client of clients) {
      // skip duplicate collision check with self
      if (client.id === box.id) continue
      // skip duplicate collision checks
      const formattedCollision =
        box.id < client.id ? box.id + "," + client.id : client.id + "," + box.id
      if (collisionSet.has(formattedCollision)) continue

      collisionSet.add(formattedCollision)
      // quick radii check
      const sqDistance = box.hitbox.centroid
        .add(box.position)
        .subtract(client.hitbox.centroid.add(client.position))
        .getSqMag()
      const radiiSum = box.hitbox.radius + client.hitbox.radius
      if (sqDistance > sq(radiiSum)) continue

      Perf.updateMetric("priorCheck")

      // narrow update before full check
      box.hitbox.narrowUpdate(box)
      client.hitbox.narrowUpdate(client)
      Perf.updateMetric("hitboxUpdate")

      const collision = box.checkCollision(client)
      Perf.updateMetric("satCheck")
      collisionChecks++
      if (collision.colliding) collisions.push(collision)
    }
  }

  if (ticks === 0) {
    Perf.getTime()
    Perf.updateMetric("priorCheck")
    Perf.updateMetric("hitboxUpdate")
    Perf.updateMetric("satCheck")
  }

  // draw them boxes
  for (const box of boxes) {
    ctx.setTransform(1, 0, 0, 1, halfWidth, halfHeight)
    if (Settings.drawAsCircles) {
      const diameter = box.hitbox.aabb.width
      draw.ellipse(
        box.position.x + box.hitbox.centroid.x,
        box.position.y + box.hitbox.centroid.y,
        diameter,
        diameter,
        box.shape.color.cachedValue,
        1,
        outline
      )
    } else box.draw()

    ctx.setTransform(1, 0, 0, 1, halfWidth, halfHeight)
    ctx.setTransform(1, 0, 0, 1, halfWidth, halfHeight)
    draw.ellipse(
      box.position.x + box.hitbox.centroid.x,
      box.position.y + box.hitbox.centroid.y,
      5,
      5,
      rgba(211, 175, 55),
      1,
      outline
    )
  }
  Perf.updateMetric("drawBoxes")

  // handle collisions
  for (const collision of collisions) {
    if (collision.baseA === undefined) continue
    collision.baseA.handleCollision(collision)
  }
  Perf.updateMetric("handleCollisions")

  Perf.getTotal()

  const totalCells = (halfWidth * 2 * (halfHeight * 2)) / Settings.gridSize ** 2
  const countMetrics = [
    "Cells Filled",
    world.grid.size + " / " + totalCells,
    "Cells Checked",
    world.cellsChecked + " / " + totalCells,
    "SAT Calls",
    collisionChecks,
    "Object Count",
    boxes.length,
    "Collision Count",
    collisions.length,
    "Kinetic Energy",
    KE.toFixed(3),
  ]

  // textAlign(LEFT, TOP)
  // textFont(fontBold, 24)
  ctx.font = "bold 24px Arial"
  const dataToDisplay = ["average", "max", "percentage"]
  const margin = 4
  const padding = 8

  const dataWidth = 140
  const keyWidth = 210
  const columnGap = 16

  //const rowHeight = textAscent() * 2
  const rowHeight = 15 * 2
  const initialRowGap = 16
  const rowGap = 0
  const start = margin + padding

  const metricDisplayWidth =
    padding + keyWidth + dataToDisplay.length * (dataWidth + columnGap) + padding
  ctx.resetTransform()
  const metricCount = Object.keys(Perf.metrics).length
  draw.rect(
    margin,
    margin,
    metricDisplayWidth,
    padding + (metricCount + 1) * rowHeight + metricCount * rowGap + initialRowGap + padding,
    rgba(0, 120)
  )
  if (ticks % displayPeriod === 0) {
    const totalData = Perf.getMetricData("total")
    Perf.metrics.total.savedData = Object.assign({}, totalData)
    for (const key in Perf.metrics) {
      const metricData = Perf.getMetricData(key)
      Perf.metrics[key].savedData = Object.assign({}, metricData)
    }
  }

  let dx, dy
  dy = dx = start
  draw.text("Key", dx, dy)
  dx += keyWidth + columnGap
  for (const dataKey of dataToDisplay) {
    draw.text(dataKey[0].toUpperCase() + dataKey.slice(1), dx, dy)
    dx += dataWidth + columnGap
  }

  draw.rect(
    start,
    start + rowHeight,
    dataToDisplay.length * (dataWidth + columnGap) + keyWidth,
    3,
    rgba(0, 120)
  )

  //textFont(font, 24)
  ctx.font = "bold 24px Arial"

  dx = start + keyWidth + columnGap
  dy += rowHeight + initialRowGap

  let i = 0
  for (const key in Perf.metrics) {
    let ddx = dx
    const metric = Perf.metrics[key].savedData

    if (i % 2 === 0) draw.rect(margin, dy, metricDisplayWidth, rowHeight, rgba(0, 50))

    let formattedKey = []
    for (let i = 0; i < key.length; i++) {
      const character = key[i]
      if (i === 0) {
        formattedKey.push(character.toUpperCase())
        continue
      }
      if (character.toUpperCase() === character) formattedKey.push(" ", character)
      else formattedKey.push(character)
    }

    draw.text(`${formattedKey.join("")}:`, start, dy)

    for (const dataKey of dataToDisplay) {
      let data = metric[dataKey]
      const unit = dataKey === "percentage" ? "%" : "ms"
      data = isNaN(data) ? displayPeriod - ticks / dt : `${data.toFixed(3)} ${unit}`

      draw.text(data, ddx, dy)
      ddx += dataWidth + columnGap
    }

    dy += rowHeight + rowGap
    i++
  }

  const counterDisplayHeight = padding + (countMetrics.length / 2) * (rowHeight + rowGap) + padding
  const counterDisplayWidth = padding + keyWidth + columnGap + dataWidth + padding
  draw.rect(
    margin,
    height - margin - counterDisplayHeight,
    counterDisplayWidth,
    counterDisplayHeight,
    rgba(0, 120)
  )
  dy = height - margin - counterDisplayHeight + padding
  for (let i = 0; i < countMetrics.length; i += 2) {
    if (i % 4 === 0) draw.rect(margin, dy, counterDisplayWidth, rowHeight, rgba(0, 0, 0, 50))
    draw.text(countMetrics[i] + ":", start, dy)
    draw.text(countMetrics[i + 1] + "", start + keyWidth + columnGap, dy)
    dy += rowHeight + rowGap
  }

  ticks += 1

  requestAnimationFrame(drawLoop)
}

requestAnimationFrame(drawLoop)
