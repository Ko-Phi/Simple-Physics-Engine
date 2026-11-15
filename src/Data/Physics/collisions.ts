import { Polygon, Circle } from "../../Data/shape.js"
import { zipShift, zipWith, shift } from "../../Utils/arrays.js"
import { draw, ctx } from "../../Globals/init.js"
import * as Settings from "../../Globals/settings.js"
import { Vector, rgba, nearlyEqual, minBy } from "../../Utils/math.js"

type Intersection<A extends Collidable, B extends Collidable> = {
  axis: Vector
  overlap: number
  refA: A
  refB: B
}
export type Collision<A extends Collidable, B extends Collidable> = Intersection<A, B> & {
  contacts: Vector[]
}

type Seperation = false

export class Aabb {
  width: number
  height: number
  centroid: Vector
  constructor(width: number, height: number, centroid: Vector) {
    ;[this.width, this.height, this.centroid] = [width, height, centroid]
  }
  draw(position: Vector) {
    ctx.save()
    ctx.translate(this.centroid.x + position.x, this.centroid.y + position.y)
    draw.rect(-this.width / 2, -this.height / 2, this.width, this.height, rgba(128, 50))
    draw.ellipse(0, 0, this.width, this.width, rgba(128, 50), 0, rgba(0, 0))
    ctx.restore()
  }
}

export type UpdateType = "None" | "AABB" | "SAT"
export abstract class AHitbox {
  abstract normals: Vector[]
  abstract aabb: Aabb
  abstract cachedDir: number
  abstract cachedCentroid: Vector
  abstract lastUpdate: UpdateType
  abstract shallowUpdate: (position: Vector, dir: number) => void
  abstract narrowUpdate: (position: Vector, dir: number) => void
  abstract project: (axis: Vector, position: Vector) => { min: number; max: number }
}

export class PolygonHitbox extends Polygon implements AHitbox {
  normals: Vector[]
  aabb: Aabb
  transformedVertices: Vector[]
  cachedDir: number
  lastUpdate: UpdateType
  cachedNormals: Vector[]
  cachedCentroid: Vector
  constructor(shape: Polygon, position: Vector, dir: number) {
    super(shape.vertices, shape.color)
    this.transformedVertices = []
    this.normals = []
    this.cachedDir = 0
    this.lastUpdate = "None"
    this.cachedNormals = zipWith(this.vertices, shift(this.vertices), (vertex, nextVertex) =>
      nextVertex.subtract(vertex).perpendicular().normalize()
    )
    this.normals = this.cachedNormals.map((n) => n.copy())
    this.cachedCentroid = this.centroid.copy()
    this.aabb = new Aabb(this.radius * 2, this.radius * 2, this.centroid)
    this.shallowUpdate(position, dir)
  }
  shallowUpdate = (position: Vector, dir: number) => shallowUpdate(this, position, dir)
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
    const centroid = position.add(this.centroid)
    // loop over this object's edges
    return zipShift(this.transformedVertices).reduce(
      (minPair, [vertexA, vertexB]): { point: Vector; distSq: number } => {
        // get closest point on side
        const sideAB = vertexB.subtract(vertexA)
        const sideAC = centroid.subtract(vertexA)
        const point = vertexA.add(sideAC.projectConstrain(sideAB))
        const distSq = point.subtract(centroid).getSqMag()
        return minBy((x) => x.distSq, minPair, { point, distSq })
      },
      { point: this.transformedVertices[0], distSq: Infinity } as { point: Vector; distSq: number }
    ).point
  }
}
export const isPolygonHitbox = (shape: Hitbox): shape is PolygonHitbox => shape.type === "Polygon"
export const isCircleHitbox = (shape: Hitbox): shape is CircleHitbox => shape.type === "Circle"

export class CircleHitbox extends Circle implements AHitbox {
  normals: Vector[]
  aabb: Aabb
  cachedDir: number
  lastUpdate: UpdateType
  cachedCentroid: Vector
  constructor(circle: Circle, position: Vector, dir: number) {
    super(circle.radius, circle.color, circle.centroid)
    this.normals = []
    this.cachedDir = 0
    this.lastUpdate = "None"
    this.aabb = new Aabb(this.radius * 2, this.radius * 2, this.centroid)
    this.cachedCentroid = this.centroid.copy()
    this.shallowUpdate(position, dir)
  }
  shallowUpdate = (position: Vector, dir: number) => shallowUpdate(this, position, dir)
  narrowUpdate = () => undefined
  project(axis: Vector, position: Vector): { min: number; max: number } {
    const centroid = this.centroid.add(position)
    const projection = axis.dotProduct(centroid)
    return {
      min: projection - this.radius,
      max: projection + this.radius,
    }
  }
}

export class Collidable {
  indices: Vector[]
  position: Vector
  dir: number
  hitbox: Hitbox
  constructor(hitbox: Hitbox, position: Vector, dir: number) {
    this.indices = []
    this.hitbox = hitbox
    this.position = position
    this.dir = dir
  }
  checkCollision<B extends Collidable>(refB: B): Collision<typeof this, B> | Seperation {
    const refA = this
    const [boxA, boxB] = [refA.hitbox, refB.hitbox]
    const tCentroidA = boxA.centroid.add(refA.position)
    const tCentroidB = boxB.centroid.add(refB.position)
    // common seperation axis first
    const vBA = tCentroidB.subtract(tCentroidA)
    const axes = [vBA.normalize(), ...boxA.normals, ...boxB.normals]
    // Circle-Circle test
    if (isCircleHitbox(boxA) && isCircleHitbox(boxB)) {
      const radiiSum = boxA.radius + boxB.radius
      return vBA.getMag() > radiiSum
        ? false
        : {
            axis: vBA.normalize().negate(),
            overlap: vBA.getMag() - radiiSum,
            contacts: [refA.position.add(new Vector(vBA.theta(), boxB.radius, "dirMag"))],
            refA,
            refB,
          }
    }
    // Base Checks
    const collisions = axes.map((axis) => projectCheck(axis, refA, refB))
    // Circle-Polygon "Edge" Case
    if (boxA.type !== boxB.type) collisions.push(circlePolygonCheck(refA, refB))
    // Check for seperation
    const min = collisions.reduce((p, c) => (!p || !c ? false : minBy((x) => x.overlap, c, p)))

    // reorient axis when neccessary
    return !min
      ? min
      : {
          ...{ ...min, axis: min.axis.pointTo(tCentroidB.subtract(tCentroidA)) },
          contacts: getContacts(refA, refB),
        }
  }
}
function shallowUpdate(hitbox: Hitbox, position: Vector, dir: number) {
  hitbox.lastUpdate = "AABB"
  // check if rotation recalc neccessary
  if (dir !== hitbox.cachedDir && hitbox.cachedCentroid.getSqMag() !== 0)
    hitbox.aabb.centroid = hitbox.centroid = hitbox.cachedCentroid.rotate((hitbox.cachedDir = dir))
  if (Settings.displayAABB) hitbox.aabb.draw(position)
}
function projectCheck<A extends Collidable, B extends Collidable>(
  axis: Vector,
  refA: A,
  refB: B
): Intersection<A, B> | Seperation {
  // project each hitbox's vertices
  const projA = refA.hitbox.project(axis, refA.position)
  const projB = refB.hitbox.project(axis, refB.position)
  // check if seperate
  if (projA.max < projB.min || projB.max < projA.min) return false
  const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min)
  return { overlap, axis, refA, refB }
}
/* Visualization:                                                                                 
       A is the checked vertex. BC is the current edge of the other base. P is the closest point  
         B                                                                                        
        /|                                                                                        
       A-P                                                                                        
        \|                                                                                        
         C                                                                                        
*/
// base loop -> vertex -> side loop
function project(A: Vector, B: Vector, C: Vector) {
  const [BC, BA] = [C.subtract(B), A.subtract(B)]
  const point = B.add(BA.projectConstrain(BC))
  const distSq = point.subtract(A).getSqMag()
  return { point, distSq }
}
function getContacts<A extends Collidable, B extends Collidable>(refA: A, refB: B): Vector[] {
  let contacts: Vector[] = []
  if (isPolygonHitbox(refA.hitbox) && isPolygonHitbox(refB.hitbox)) {
    let minDistSq = Infinity
    const [polyA, polyB] = [refA.hitbox, refB.hitbox]
    let pair1 = project(
      polyA.transformedVertices[0],
      polyB.transformedVertices[0],
      polyB.transformedVertices[1]
    )
    let pair2 = { point: pair1.point.copy(), distSq: pair1.distSq }
    zipShift([polyA, polyB]).forEach(([hitbox, otherHitbox]) => {
      hitbox.transformedVertices.forEach((A) => {
        zipShift(otherHitbox.transformedVertices).forEach(([B, C]) => {
          const curr = project(A, B, C)
          if (nearlyEqual(minDistSq, curr.distSq, 5) && !pair1.point.equalTo(curr.point))
            pair2 = curr
          else pair1 = minBy((x) => x.distSq, pair1, curr)
        })
      })
    })
    contacts =
      !nearlyEqual(pair1.distSq, pair2.distSq, 5) || pair1.point.equalTo(pair2.point)
        ? [pair1.point]
        : [pair1.point, pair2.point]
  } else if (refA.hitbox.type !== refB.hitbox.type) {
    if (isPolygonHitbox(refA.hitbox) && isCircleHitbox(refB.hitbox))
      contacts.push(refA.hitbox.closestPointToCentroidOf(refB.position))
    else if (isPolygonHitbox(refB.hitbox) && isCircleHitbox(refA.hitbox))
      contacts.push(refB.hitbox.closestPointToCentroidOf(refA.position))
  }
  return contacts
}

function circlePolygonCheck<A extends Collidable, B extends Collidable>(
  refA: A,
  refB: B
): Intersection<A, B> | Seperation {
  // get closest point on edge and add to normals
  let [circle, positionC, polygon] = (
    refA.hitbox.type === "Circle"
      ? [refA.hitbox, refA.position, refB.hitbox]
      : [refB.hitbox, refB.position, refA.hitbox]
  ) as [CircleHitbox, Vector, PolygonHitbox]
  const centroid = positionC.add(circle.centroid)
  const closestPoint = polygon.closestPointToCentroidOf(positionC)
  const axis = closestPoint.subtract(centroid).normalize()
  return projectCheck(axis, refA, refB)
}

export abstract class CollisionHandler<A extends Collidable, B extends Collidable, Ret> {
  abstract handleCollision: (collision: Collision<A, B>) => Ret
}

export type Hitbox = PolygonHitbox | CircleHitbox
