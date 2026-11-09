import { keys } from "../Globals/input.js";
import { outline, focus, draw, ctx, newid, halfWidth, halfHeight, cam } from "../Globals/init.js";
import * as Settings from "../Globals/settings.js";
import { Vector, random, sq, rgba } from "../Utils/math.js";
import { zipShift } from "../Utils/arrays.js";
import { Polygon } from "./shape.js";
import { Color } from "./color.js";
import { Sprite } from "./sprite.js";
import { Collidable, CircleHitbox, PolygonHitbox, isPolygonHitbox, } from "./Collisions/collisions.js";
export class Shapeoid extends Collidable {
    id;
    indices;
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
        this.indices = [];
        this.sprite = new Sprite([shape]);
        this.trueColor = new Color([random(-15, 40), 0.6, 1], "HSV");
        this.rho = rho;
        this.mass = this.hitbox.area * this.rho;
        if (this.hitbox.type === "Circle") {
            this.inertia = 0.5 * this.mass * sq(this.hitbox.radius);
        }
        else if (isPolygonHitbox(this.hitbox)) {
            const loopedVertices = this.hitbox.windingOrder === "CW"
                ? this.hitbox.vertices.slice().reverse()
                : this.hitbox.vertices.slice();
            this.inertia =
                zipShift(loopedVertices).reduce((inertia, [vertex, nextVertex]) => ((subArea) => inertia +
                    subArea *
                        (vertex.getSqMag() + vertex.dotProduct(nextVertex) + nextVertex.getSqMag()))(vertex.crossProduct(nextVertex)), 0) *
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
        this.omega += input_dir / 100;
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
        const { axis, refA, refB } = data;
        const MTV = data.axis.scale(data.overlap);
        const [massA, massB] = [refA.mass, refB.mass];
        const displacementA = MTV.scale(massB / (massA + massB));
        const displacementB = MTV.scale(massA / (massA + massB));
        refA.position = refA.position.subtract(displacementA);
        refB.position = refB.position.add(displacementB);
        for (const contact of data.contacts) {
            ctx.save();
            ctx.translate(contact.x, contact.y);
            draw.ellipse(0, 0, 25, 25, rgba(100, 50));
            ctx.restore();
        }
        if (!Settings.collisionImpulse)
            return;
        for (const contact of data.contacts) {
            const [vAC, vBC] = [refA, refB].map((ref) => contact.subtract(ref.position));
            const contactVelocityA = refA.velocity.add(vAC.perpendicular().scale(refA.omega));
            const contactVelocityB = refB.velocity.add(vBC.perpendicular().scale(refB.omega));
            const velocityAB = contactVelocityB.subtract(contactVelocityA);
            const impulseScalar = velocityAB.scale(-1 - Settings.restitution).dotProduct(axis) /
                (axis.dotProduct(axis.scale(1 / massA + 1 / massB)) +
                    sq(vAC.crossProduct(axis)) / refA.inertia +
                    sq(vBC.crossProduct(axis)) / refB.inertia);
            refA.velocity = refA.velocity.subtract(axis.scale(impulseScalar / massA));
            refA.omega += (vAC.crossProduct(axis) * impulseScalar) / refA.inertia;
            refB.velocity = refB.velocity.add(axis.scale(impulseScalar / massB));
            refB.omega -= (vBC.crossProduct(axis) * impulseScalar) / refB.inertia;
        }
    }
}
