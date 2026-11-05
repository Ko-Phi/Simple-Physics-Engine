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

  abstract transformedVertices: Vector[]
  abstract cachedDir: number
  abstract cachedNormals: Vector[]
  abstract cachedCentroid: Vector

  abstract lastUpdate: UpdateType
  abstract shallowUpdate: (position: Vector, dir: number) => void
  abstract narrowUpdate: (position: Vector, dir: number) => void
  abstract project: (axis: Vector, position: Vector) => { min: number; max: number }
  abstract closestPointToCentroidOf: (position: Vector) => Vector
}

export class PolygonHitbox extends Polygon implements AHitbox {
  normals: Vector[]

  rho: number
  aabb: Aabb
  area: number
  mass: number
  momentOfInertia: number
  windingOrder: WindingOrder

  transformedVertices: Vector[]
  cachedDir: number
  lastUpdate: UpdateType
  cachedNormals: Vector[]
  cachedCentroid: Vector

  constructor(shape: Polygon, position: Vector, dir: number, rho?: number) {
    super(shape.vertices, shape.color)
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
}

export class CircleHitbox extends Circle implements AHitbox {
  normals: Vector[]

  rho: number
  aabb: Aabb
  area: number
  mass: number
  momentOfInertia: number
  windingOrder: WindingOrder

  transformedVertices: Vector[]
  cachedDir: number
  lastUpdate: UpdateType
  cachedNormals: Vector[]
  cachedCentroid: Vector

  constructor(circle: Circle, position: Vector, dir: number, rho?: number) {
    super(circle.radius, circle.color, circle.centroid)
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
}

export class Collidable {
  position: Vector
  dir: number
  hitbox: Hitbox
  constructor(hitbox: Hitbox, position: Vector, dir: number) {
    this.hitbox = hitbox
    this.position = position
    this.dir = dir
  }
  checkCollision(baseB: Collidable): PossibleCollision {
    const baseA = this
    const tCentroidA = baseA.hitbox.centroid.add(baseA.position)
    const tCentroidB = baseB.hitbox.centroid.add(baseB.position)

    // common seperation axis first
    const axes = [
      tCentroidB.subtract(tCentroidA).normalize(),
      ...baseA.hitbox.normals,
      ...baseB.hitbox.normals,
    ]

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
        }
      }
    }

    // Base Checks
    const collisions: PossibleCollision[] = axes.map((axis) => projectCheck(axis, baseA, baseB))

    // Circle-Polygon "Edge" Case
    if (baseA.hitbox.type !== baseB.hitbox.type) {
      collisions.push(circlePolygonCheck(baseA, baseB))
    }

    // Check for seperation
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

    // reorient axis when neccessary
    const direction = tCentroidB.subtract(tCentroidA)
    if (min.axis.dotProduct(direction) < 0) min.axis = min.axis.negate()

    return min
  }
}

function projectCheck(axis: Vector, baseA: Collidable, baseB: Collidable): PossibleCollision {
  // project each hitbox's vertices
  const projA = baseA.hitbox.project(axis, baseA.position)
  const projB = baseB.hitbox.project(axis, baseB.position)

  // check if seperate
  if (projA.max < projB.min || projB.max < projA.min) return { colliding: false }

  const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min)
  return { colliding: true, overlap: overlap, axis: axis }
}

function circlePolygonCheck(baseA: Collidable, baseB: Collidable): PossibleCollision {
  // get closest point on edge and add to normals
  let [circle, positionC, polygon] =
    baseA.hitbox.type === "Circle"
      ? [baseA.hitbox, baseA.position, baseB.hitbox]
      : [baseB.hitbox, baseB.position, baseA.hitbox]
  const centroid = positionC.add(circle.centroid)
  const closestPoint = polygon.closestPointToCentroidOf(positionC)
  const axis = closestPoint.subtract(centroid).normalize()

  return projectCheck(axis, baseA, baseB)
}

export type Hitbox = PolygonHitbox | CircleHitbox
