import { keys } from "../../Globals/input.js"
import { outline, focus, draw, ctx, newid, halfWidth, halfHeight, cam } from "../../Globals/init.js"
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
  id: number

  rho: number
  mass: number
  inertia: number

  velocity: Vector
  omega: number
  sprite: Sprite
  trueColor: string

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
  }
  getInput() {
    if (focus !== this.id) return
    if (Settings.cameraTrack && cam.target !== this) cam.target = this
    const input_x = +keys.d - +keys.a
    const input_y = +keys.s - +keys.w
    const input_dir = +keys.e - +keys.q
    const translation = new Vector(input_x, input_y).normalize()
    this.velocity = this.velocity.add(translation.scale(10))
    this.omega += input_dir / 10
  }
  update(dt: number) {
    this.ticks++
    this.position = this.position.add(this.velocity.scale(dt / 1000))
    this.dir += this.omega * (dt / 1000)

    const velocity = this.velocity.getMag()
    if (velocity > Settings.mu)
      this.velocity = this.velocity.subtract(this.velocity.scale(Settings.mu / velocity))
    else this.velocity = new Vector(0, 0)
    let torque =
      this instanceof Immovable ? 0 : (Settings.mu * this.hitbox.radius * this.mass) / this.inertia
    if (Math.abs(this.omega) > torque) {
      this.omega -= Math.sign(this.omega) * torque
    } else this.omega = 0

    if (Settings.boundedWorld) {
      if (Math.abs(this.position.x) > halfWidth + this.hitbox.aabb.width / 2)
        this.position.x = -Math.sign(this.position.x) * (halfWidth + this.hitbox.aabb.width / 2)
      if (Math.abs(this.position.y) > halfHeight + this.hitbox.aabb.height / 2)
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
    if (focus !== this.id) this.sprite.shapes[0].color = this.trueColor
    else this.sprite.shapes[0].color = rgba(150, 200, 150)
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
  getKE = () => (this.mass * this.velocity.getSqMag()) / 2 + (this.inertia * sq(this.omega)) / 2
}

export class Immovable extends RigidBody {
  mass: number = Infinity
  inertia: number = Infinity

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
  getKE = () => 0
}
export class Bounded extends RigidBody {
  tether: Vector
  springConstant: number
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
    this.velocity = this.velocity.add(dir.scale((distance * this.springConstant) / this.mass))
    super.update(dt)
  }
  getKE = () =>
    (this.mass * this.velocity.getSqMag()) / 2 +
    (this.inertia * sq(this.omega)) / 2 +
    (this.tether.subtract(this.position).getSqMag() * this.springConstant) / 2
}
