import { Vector } from "./vector.js"
import { Polygon, Circle } from "./shape.js"
import { zipShift, zipWith, shift } from "../Utils/arrays.js"
import { draw, ctx, halfHeight, halfWidth } from "../Data/world.js"
import * as Settings from "../Data/world.js"
import { rgba, sq, constrain } from "../Utils/math.js"

type Collision = { colliding: true; axis: Vector; overlap: number }
type Seperation = { colliding: false }
type PossibleCollision = Collision | Seperation

export class Aabb {
  width: number
  height: number
  centroid: Vector
  constructor(width: number, height: number, centroid: Vector) {
    this.width = width
    this.height = height
    this.centroid = centroid
  }
  draw(position: Vector) {
    ctx.setTransform(
      1,
      0,
      0,
      1,
      this.centroid.x + position.x + halfWidth,
      this.centroid.y + position.y + halfHeight
    )
    draw.rect(-this.width / 2, -this.height / 2, this.width, this.height, rgba(128, 50))
    draw.ellipse(0, 0, this.width, this.width, rgba(128, 50), 0, rgba(0, 0))
  }
}

export type WindingOrder = "CW" | "CCW"
export type UpdateType = "None" | "AABB" | "SAT"
export abstract class AHitbox {
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
  abstract shallowUpdate: (position: Vector, dir: number) => void
  abstract narrowUpdate: (position: Vector, dir: number) => void
  abstract project: (axis: Vector, position: Vector) => { min: number; max: number }
  abstract closestPointToCentroidOf: (position: Vector) => Vector
  abstract checkCollision: (
    hitboxB: Hitbox,
    positionA: Vector,
    positionB: Vector
  ) => PossibleCollision
}

export class PolygonHitbox extends Polygon implements AHitbox {
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

  constructor(shape: Polygon, position: Vector, dir: number, rho?: number) {
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
    this.rotatedVertices = this.rotatedVertices.map((v) => v.rotate(dir))
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

    this.shallowUpdate(position, dir)
  }
  shallowUpdate(position: Vector, dir: number) {
    this.lastUpdate = "AABB"
    // check if rotation recalc neccessary
    if (dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
      this.centroid.rotate(dir)
    if (!Settings.displayAABB) return
    // display AABB (note aabb centroid points to base centroid)
    this.aabb.draw(position)
  }
  narrowUpdate(position: Vector, dir: number) {
    if (this.lastUpdate !== "AABB") return
    this.lastUpdate = "SAT"
    this.transformedVertices = this.vertices.map((vertex) => vertex.rotate(dir).add(position))
    this.normals = this.cachedNormals.map((cachedNormal) => cachedNormal.rotate(dir))
  }
  project(axis: Vector, _position: Vector): { min: number; max: number } {
    const projections = this.transformedVertices.map((vertex) => vertex.dotProduct(axis))
    return {
      min: Math.min(...projections),
      max: Math.max(...projections),
    }
  }
  closestPointToCentroidOf(position: Vector): Vector {
    let closestPoint = new Vector(0, 0)
    let minDistanceSquared = Infinity
    const centroid = position.add(this.centroid)
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
  checkCollision(baseB: Hitbox, positionA: Vector, positionB: Vector): PossibleCollision {
    const baseA = this
    const tCentroidA = baseA.centroid.add(positionA)
    const tCentroidB = baseB.centroid.add(positionB)

    // common seperation axis first
    const axes = [tCentroidB.subtract(tCentroidA).normalize(), ...baseA.normals, ...baseB.normals]

    const collisions: PossibleCollision[] = []

    for (const axis of axes) {
      collisions.push(projectCheck(axis, baseA, positionA, baseB, positionB))
    }

    // Circle-Polygon Edge Case
    if (baseB.type === "Circle") {
      collisions.push(circlePolygonCheck(baseA, positionA, baseB, positionB))
    }

    // reorient axis when neccessary
    const min = collisions.reduce((prev, curr) =>
      prev.colliding === false
        ? prev
        : curr.colliding === false
          ? curr
          : curr.overlap < prev.overlap
            ? curr
            : prev
    )
    if (min.colliding === false) return min

    const direction = tCentroidB.subtract(tCentroidA)
    if (min.axis.dotProduct(direction) < 0) min.axis = min.axis.negate()

    return min
  }
}

export class CircleHitbox extends Circle implements AHitbox {
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

  constructor(circle: Circle, position: Vector, dir: number, rho?: number) {
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

    this.shallowUpdate(position, dir)
  }
  shallowUpdate(position: Vector, dir: number) {
    this.lastUpdate = "AABB"

    // check if rotation recalc neccessary
    if (dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
      this.centroid.rotate(dir)
    if (!Settings.displayAABB) return
    // display AABB (note aabb centroid points to base centroid)
    this.aabb.draw(position)
  }
  narrowUpdate() {
    return
  }
  project(axis: Vector, position: Vector): { min: number; max: number } {
    const centroid = this.centroid.add(position)
    const projection = axis.dotProduct(centroid)
    return {
      min: projection - this.radius,
      max: projection + this.radius,
    }
  }
  closestPointToCentroidOf(): Vector {
    throw "Uncalleable"
  }
  checkCollision(baseB: Hitbox, positionA: Vector, positionB: Vector): PossibleCollision {
    const baseA = this
    const tCentroidA = baseA.centroid.add(positionA)
    const tCentroidB = baseB.centroid.add(positionB)

    // common seperation axis first
    const axes = [tCentroidB.subtract(tCentroidA).normalize(), ...baseA.normals, ...baseB.normals]

    // Circle-Circle test
    if (baseA.type === baseB.type && baseA.type === "Circle") {
      const sqDistance = baseA.centroid
        .add(positionA)
        .subtract(baseB.centroid.add(positionB))
        .getSqMag()
      const radiiSum = baseA.radius + baseB.radius
      if (sqDistance > sq(radiiSum)) {
        return { colliding: false }
      } else {
        const overlap = Math.sqrt(sqDistance) - radiiSum
        const normal = tCentroidA.subtract(tCentroidB).normalize()
        return {
          colliding: true,
          axis: normal,
          overlap: overlap,
        }
      }
    }

    const collisions: PossibleCollision[] = []

    for (const axis of axes) {
      collisions.push(projectCheck(axis, baseA, positionA, baseB, positionB))
    }

    // Circle-Polygon Edge Case
    if (baseB.type === "Polygon") {
      collisions.push(circlePolygonCheck(baseA, positionA, baseB, positionB))
    }

    // reorient axis when neccessary
    const min = collisions.reduce((prev, curr) =>
      prev.colliding === false
        ? prev
        : curr.colliding === false
          ? curr
          : curr.overlap < prev.overlap
            ? curr
            : prev
    )
    if (min.colliding === false) return min

    const direction = tCentroidB.subtract(tCentroidA)
    if (min.axis.dotProduct(direction) < 0) min.axis = min.axis.negate()

    return min
  }
}

function projectCheck(
  axis: Vector,
  baseA: Hitbox,
  positionA: Vector,
  baseB: Hitbox,
  positionB: Vector
): PossibleCollision {
  // project each hitbox's vertices
  const projA = baseA.project(axis, positionA)
  const projB = baseB.project(axis, positionB)

  // check if seperate
  if (projA.max < projB.min || projB.max < projA.min) return { colliding: false }

  const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min)
  return { colliding: true, overlap: overlap, axis: axis }
}

function circlePolygonCheck(
  baseA: Hitbox,
  positionA: Vector,
  baseB: Hitbox,
  positionB: Vector
): PossibleCollision {
  // get closest point on edge and add to normals
  let [circle, positionC, polygon] =
    baseA.type === "Circle" ? [baseA, positionA, baseB] : [baseB, positionB, baseA]
  const centroid = positionC.add(circle.centroid)

  const closestPoint = polygon.closestPointToCentroidOf(positionC)
  const axis = closestPoint.subtract(centroid).normalize()

  return projectCheck(axis, baseA, positionA, baseB, positionB)
}

export type Hitbox = PolygonHitbox | CircleHitbox
