import { keys } from "../../Globals/input.js"
import {
  outline,
  focus,
  draw,
  ctx,
  newid,
  cam,
  worldWidth,
  worldHeight,
} from "../../Globals/init.js"
import * as Settings from "../../Globals/settings.js"
import { Vector, random, sq, rgba, hsva } from "../../Utils/math.js"
import { zipShift } from "../../Utils/arrays.js"
import { Shape, Polygon } from ".././shape.js"
import { Sprite } from ".././sprite.js"
import {
  Collidable,
  CircleHitbox,
  PolygonHitbox,
  CollisionHandler,
  Collision,
  isPolygonHitbox,
} from "./collisions.js"

export class RigidBody
  extends Collidable
  implements
    CollisionHandler<RigidBody, RigidBody, { position: Vector; velocity: Vector; omega: number }>
{
  readonly id: number
  readonly rho: number
  readonly mass: number
  readonly inertia: number
  readonly sprite: Sprite
  velocity: Vector
  omega: number
  trueColor: string
  forces: Record<string, Vector>
  torques: Record<string, number>

  ticks: number
  constructor(position: Vector, dir: number, shape: Shape, velocity?: Vector, rho: number = 1e-3) {
    const hitbox =
      shape instanceof Polygon
        ? new PolygonHitbox(shape, position, dir)
        : new CircleHitbox(shape, position, dir)
    super(hitbox, position, dir)
    this.id = newid()
    this.sprite = new Sprite([shape])
    this.trueColor = hsva(random(-15, 40), 0.6, 1)

    this.rho = rho
    this.mass = this.hitbox.area * this.rho
    if (this.hitbox.type === "Circle") {
      this.inertia = 0.5 * this.mass * sq(this.hitbox.radius)
    } else if (isPolygonHitbox(this.hitbox)) {
      const loopedVertices =
        this.hitbox.windingOrder === "CW" ? this.hitbox.vertices.reverse() : this.hitbox.vertices
      this.inertia =
        zipShift(loopedVertices).reduce(
          (acc, [vertex, nextVertex]) =>
            acc +
            vertex.crossProduct(nextVertex) *
              (vertex.getSqMag() + vertex.dotProduct(nextVertex) + nextVertex.getSqMag()),
          0
        ) *
          (this.rho / 12) -
        this.mass * this.hitbox.centroid.getSqMag()
    } else throw "impossible"

    this.velocity =
      velocity ??
      new Vector(random(0, 2 * Math.PI), Settings.velocityMagnitude * random(0.75, 1.25), "dirMag")
    this.omega = random(-0.15, 0.15) * Settings.velocityMagnitude

    this.ticks = Math.floor(random(0, 50))
    this.forces = {}
    this.torques = {}
  }
  getInput(_dt: number) {
    if (focus !== this.id) return
    if (Settings.cameraTrack && cam.target !== this) cam.target = this
    const inputX = +keys.d - +keys.a
    const inputY = +keys.s - +keys.w
    const inputDir = +keys.e - +keys.q
    this.forces["input"] = new Vector(inputX, inputY).normalize().scale(500 * this.mass)
    this.torques["input"] = inputDir * 10 * this.inertia
  }
  update(dt: number) {
    const friction = this.velocity
      .normalize()
      .scale(-Math.min(Settings.mu, this.velocity.getMag()) * this.mass)
    this.forces["friction"] = this instanceof Immovable ? new Vector(0, 0) : friction

    let torque =
      -Math.sign(this.omega) *
      Math.min(Settings.mu * this.hitbox.radius * this.mass, Math.abs(this.omega) * this.inertia)
    this.torques["friction"] = this instanceof Immovable ? 0 : torque

    if (focus !== this.id) this.sprite.shapes[0].color = this.trueColor
    else this.sprite.shapes[0].color = rgba(150, 200, 150)

    this.ticks++
    if (Settings.boundedWorld) {
      if (Math.abs(this.position.x) > worldWidth / 2 + this.hitbox.aabb.width / 2)
        this.position.x =
          -Math.sign(this.position.x) * (worldWidth / 2 + this.hitbox.aabb.width / 2)
      if (Math.abs(this.position.y) > worldHeight / 2 + this.hitbox.aabb.height / 2)
        this.position.y =
          -Math.sign(this.position.y) * (worldHeight / 2 + this.hitbox.aabb.width / 2)
    }

    this.velocity = this.velocity.add(
      Object.values(this.forces)
        .reduce((acc, curr) => acc.add(curr), new Vector(0, 0))
        .scale(dt / (this.mass * 1000))
    )
    this.omega +=
      (Object.values(this.torques).reduce((acc, curr) => acc + curr, 0) * (dt / 1000)) /
      this.inertia

    this.position = this.position.add(this.velocity.scale(dt / 1000))
    this.dir += this.omega * (dt / 1000)
    this.forces = {}
    this.torques = {}
  }
  draw() {
    ctx.save()
    ctx.translate(this.position.x, this.position.y)
    this.sprite.draw(0, 0, this.dir)
    ctx.translate(this.hitbox.centroid.x, this.hitbox.centroid.y)
    draw.ellipse(0, 0, 5, 5, rgba(211, 175, 55), 1, outline)
    ctx.restore()
  }
  handleCollision(data: Collision<RigidBody, RigidBody>) {
    let { axis, refA, refB, contacts, overlap } = data
    const [other, sign] = this === refA ? [refB, -1] : [refA, 1]

    const displacementScalar =
      other instanceof Immovable ? 1 : other.mass / (this.mass + other.mass)
    const displacement = axis.scale(sign * overlap * displacementScalar)
    const position = this.position.add(displacement)

    for (const contact of contacts) draw.ellipse(contact.x, contact.y, 25, 25, rgba(100, 50))
    let { velocity, omega } = this
    for (const contact of data.contacts) {
      const [vAC, vBC] = [refA, refB].map((ref) => contact.subtract(ref.position))
      const contactVelocityA = refA.velocity.add(vAC.perpendicular().scale(refA.omega))
      const contactVelocityB = refB.velocity.add(vBC.perpendicular().scale(refB.omega))

      const velocityAB = contactVelocityB.subtract(contactVelocityA)
      const impulseScalar =
        velocityAB.scale(-1 - Settings.restitution).dotProduct(axis) /
        (axis.dotProduct(axis.scale(1 / refA.mass + 1 / refB.mass)) +
          sq(vAC.crossProduct(axis)) / refA.inertia +
          sq(vBC.crossProduct(axis)) / refB.inertia)

      const vTC = this === refA ? vAC : vBC
      velocity = this.velocity.add(axis.scale((impulseScalar / this.mass) * sign))
      omega = this.omega - ((vTC.crossProduct(axis) * impulseScalar) / this.inertia) * sign
    }
    return { position, velocity, omega }
  }
  getME() {
    return (this.mass * this.velocity.getSqMag() + this.inertia * sq(this.omega)) / 2
  }
}

export class Immovable extends RigidBody {
  readonly mass: number = Infinity
  readonly inertia: number = Infinity
  velocity: Vector = new Vector(0, 0)
  omega: number = 0
  constructor(position: Vector, dir: number, shape: Shape) {
    super(position, dir, shape)
    this.trueColor = rgba(160, 160, 160)
  }
  handleCollision(data: Collision<RigidBody, RigidBody>) {
    for (const contact of data.contacts) draw.ellipse(contact.x, contact.y, 25, 25, rgba(100, 50))
    return { position: this.position, velocity: this.velocity, omega: this.omega }
  }
  getInput(dt: number) {
    if (focus !== this.id) return
    if (Settings.cameraTrack && cam.target !== this) cam.target = this
    const inputX = +keys.d - +keys.a
    const inputY = +keys.s - +keys.w
    const inputDir = +keys.e - +keys.q
    this.velocity = this.velocity.add(
      new Vector(inputX, inputY).normalize().scale((500 * dt) / 1000)
    )
    this.omega += (inputDir * 10 * dt) / 1000
  }
  getME = () => 0
}
export class Bounded extends RigidBody {
  readonly tether: Vector
  readonly springConstant: number
  constructor(base: RigidBody, tether: Vector, springConstant: number) {
    super(base.position, base.dir, base.hitbox, base.velocity, base.rho)
    this.tether = tether
    this.springConstant = springConstant
  }
  draw() {
    super.draw()
    draw.line(this.position.x, this.position.y, this.tether.x, this.tether.y, 3, outline)
  }
  update(dt: number) {
    const dir = this.tether.subtract(this.position).normalize()
    const distance = this.tether.subtract(this.position).getMag()
    this.forces["spring"] = dir.scale(distance * this.springConstant)
    super.update(dt)
  }
  getME() {
    const distSq = this.tether.subtract(this.position).getSqMag()
    return super.getME() + 0.5 * this.springConstant * distSq
  }
}
