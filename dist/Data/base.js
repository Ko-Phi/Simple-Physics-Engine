import { keys } from "../Globals/input.js";
import { outline, focus, draw, ctx, newid, halfWidth, halfHeight, cam } from "../Globals/init.js";
import * as Settings from "../Globals/settings.js";
import { Vector, random, sq, rgba } from "../Utils/math.js";
import { zipShift } from "../Utils/arrays.js";
import { Polygon } from "./shape.js";
import { Color } from "./color.js";
import { Sprite } from "./sprite.js";
import { Collidable, CircleHitbox, PolygonHitbox, isPolygonHitbox, } from "./Collisions/collisions.js";
export class RigidBody extends Collidable {
    id;
    rho;
    mass;
    inertia;
    velocity;
    omega;
    sprite;
    trueColor;
    ticks;
    constructor(position, dir, shape, velocity, rho = 1) {
        const hitbox = shape instanceof Polygon
            ? new PolygonHitbox(shape, position, dir)
            : new CircleHitbox(shape, position, dir);
        super(hitbox, position, dir);
        this.id = newid();
        this.sprite = new Sprite([shape]);
        this.trueColor = new Color([random(-15, 40), 0.6, 1], "HSV");
        this.rho = rho;
        this.mass = this.hitbox.area * this.rho;
        if (this.hitbox.type === "Circle") {
            this.inertia = 0.5 * this.mass * sq(this.hitbox.radius);
        }
        else if (isPolygonHitbox(this.hitbox)) {
            const loopedVertices = this.hitbox.windingOrder === "CW" ? this.hitbox.vertices.reverse() : this.hitbox.vertices;
            this.inertia =
                zipShift(loopedVertices).reduce((acc, [vertex, nextVertex]) => acc +
                    vertex.crossProduct(nextVertex) *
                        (vertex.getSqMag() + vertex.dotProduct(nextVertex) + nextVertex.getSqMag()), 0) *
                    (this.rho / 12) -
                    this.mass * this.hitbox.centroid.getSqMag();
        }
        else
            throw "impossible";
        if (Settings.initialVelocity) {
            this.velocity = new Vector(random(0, 2 * Math.PI), Settings.velocityMagnitude * random(0.75, 1.25), "dirMag");
            this.omega = random(-0.15, 0.15);
        }
        else {
            this.velocity = velocity ?? new Vector(0, 0);
            this.omega = 0;
        }
        this.ticks = Math.floor(random(0, 50));
    }
    getInput() {
        if (focus !== this.id)
            return;
        if (Settings.cameraTrack && cam.target !== this)
            cam.target = this;
        const input_x = +keys.d - +keys.a;
        const input_y = +keys.s - +keys.w;
        const input_dir = +keys.e - +keys.q;
        const translation = new Vector(input_x, input_y).normalize();
        this.velocity = this.velocity.add(translation.divide(5));
        this.omega += input_dir / 1000;
        console.log(this.omega);
    }
    update(dt) {
        this.ticks++;
        this.position = this.position.add(this.velocity.scale(dt / Settings.period));
        this.dir += this.omega * (dt / Settings.period);
        const velocity = this.velocity.getMag();
        if (velocity > Settings.mu)
            this.velocity = this.velocity.subtract(this.velocity.scale(Settings.mu / velocity));
        else
            this.velocity = new Vector(0, 0);
        const torque = (Settings.mu * this.hitbox.radius * this.mass) / this.inertia;
        if (Math.abs(this.omega) > torque) {
            this.omega -= Math.sign(this.omega) * torque;
        }
        else
            this.omega = 0;
        if (Settings.boundedWorld) {
            if (Math.abs(this.position.x) > halfWidth + this.hitbox.aabb.width / 2) {
                this.position.x = -Math.sign(this.position.x) * (halfWidth + this.hitbox.aabb.width / 2);
            }
            if (Math.abs(this.position.y) > halfHeight + this.hitbox.aabb.height / 2) {
                this.position.y = -Math.sign(this.position.y) * (halfHeight + this.hitbox.aabb.width / 2);
            }
        }
        if (this.ticks % (60 * dt) === 0 && Settings.periodicVelocityShifts) {
            this.velocity = new Vector(random(0, 2 * Math.PI), Settings.velocityMagnitude * random(0.75, 1.25), "dirMag");
            this.omega = random(-0.01, 0.01) * Settings.scale;
        }
        if (focus !== this.id)
            this.sprite.shapes[0].color = this.trueColor;
        else
            this.sprite.shapes[0].color = new Color([150, 200, 150]);
    }
    draw() {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        this.sprite.draw(0, 0, this.dir);
        ctx.translate(this.hitbox.centroid.x, this.hitbox.centroid.y);
        draw.ellipse(0, 0, 5, 5, rgba(211, 175, 55), 1, outline);
        ctx.restore();
    }
    handleCollision(data) {
        let { axis, refA, refB, contacts, overlap } = data;
        const [other, sign] = this === refA ? [refB, -1] : [refA, 1];
        const displacementScalar = other instanceof Immovable ? 1 : other.mass / (this.mass + other.mass);
        const displacement = axis.scale(sign * overlap * displacementScalar);
        const position = this.position.add(displacement);
        for (const contact of contacts)
            draw.ellipse(contact.x, contact.y, 25, 25, rgba(100, 50));
        let { velocity, omega } = this;
        if (Settings.collisionImpulse) {
            for (const contact of data.contacts) {
                const [vAC, vBC] = [refA, refB].map((ref) => contact.subtract(ref.position));
                const contactVelocityA = refA.velocity.add(vAC.perpendicular().scale(refA.omega));
                const contactVelocityB = refB.velocity.add(vBC.perpendicular().scale(refB.omega));
                const velocityAB = contactVelocityB.subtract(contactVelocityA);
                const impulseScalar = velocityAB.scale(-1 - Settings.restitution).dotProduct(axis) /
                    (axis.dotProduct(axis.scale(1 / refA.mass + 1 / refB.mass)) +
                        sq(vAC.crossProduct(axis)) / refA.inertia +
                        sq(vBC.crossProduct(axis)) / refB.inertia);
                const vTC = this === refA ? vAC : vBC;
                velocity = this.velocity.add(axis.scale((impulseScalar / this.mass) * sign));
                omega = this.omega - ((vTC.crossProduct(axis) * impulseScalar) / this.inertia) * sign;
            }
        }
        return { position, velocity, omega };
    }
    getKE = () => (this.mass * this.velocity.getSqMag()) / 2 + (this.inertia * sq(this.omega)) / 2;
}
export class Immovable extends RigidBody {
    mass = Infinity;
    inertia = Infinity;
    velocity = new Vector(0, 0);
    omega = 0;
    constructor(position, dir, shape) {
        super(position, dir, shape);
        this.trueColor = new Color([160, 160, 160]);
    }
    handleCollision(data) {
        for (const contact of data.contacts)
            draw.ellipse(contact.x, contact.y, 25, 25, rgba(100, 50));
        return { position: this.position, velocity: this.velocity, omega: this.omega };
    }
    getKE = () => 0;
}
