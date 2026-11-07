import { draw, ctx, newid, halfWidth, halfHeight } from "./world.js";
import * as Settings from "./world.js";
import { Vector, random, sq, rgba } from "../Utils/math.js";
import { Polygon } from "./shape.js";
import { Color } from "./color.js";
import { Collidable, CircleHitbox, PolygonHitbox, } from "./collisions.js";
export class Base extends Collidable {
    id;
    indices;
    velocity;
    omega;
    shape;
    trueColor;
    axesBuffer;
    ticks;
    constructor(position, dir, shape, velocity) {
        const hitbox = shape instanceof Polygon
            ? new PolygonHitbox(shape, position, dir)
            : new CircleHitbox(shape, position, dir);
        super(hitbox, position, dir);
        this.id = newid();
        this.indices = [];
        this.shape = shape;
        this.trueColor = new Color([random(-15, 40), 0.6, 1], "HSV");
        this.axesBuffer = [];
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
        // const input_x = (keys[RIGHT] || keys[68]) - (keys[LEFT] || keys[65])
        // const input_y = (keys[DOWN] || keys[83]) - (keys[UP] || keys[87])
        // const input_dir = keys[69] - keys[81]
        // const translation = new Vector(input_x, input_y).normalize()
        // if (this.velocity.getMag() < 3) this.velocity = this.velocity.add(translation.divide(5))
        // else this.velocity = this.velocity.normalize().scale(2.9)
        // if (Math.abs(this.omega) < 0.1) this.omega += input_dir / 100
        // else this.omega = Math.sign(this.omega) * 0.09
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
        if (Math.abs(this.position.x) > halfWidth + this.hitbox.aabb.width / 2) {
            this.position.x = -Math.sign(this.position.x) * (halfWidth + this.hitbox.aabb.width / 2);
        }
        if (Math.abs(this.position.y) > halfHeight + this.hitbox.aabb.height / 2) {
            this.position.y = -Math.sign(this.position.y) * (halfHeight + this.hitbox.aabb.width / 2);
        }
        if (this.ticks % (60 * dt) === 0 && Settings.periodicVelocityShifts) {
            this.velocity = new Vector(random(0, 2 * Math.PI), Settings.velocityMagnitude * random(0.75, 1.25), "dirMag");
            this.omega = random(-0.01, 0.01) * Settings.scale;
        }
        this.shape.color = this.trueColor;
    }
    draw() {
        this.shape.draw(this.position.x + halfWidth, this.position.y + halfHeight, this.dir);
    }
    handleCollision(data) {
        if (!data.colliding)
            return;
        const axis = data.axis;
        const MTV = data.axis.scale(data.overlap);
        const baseA = data.refA;
        const baseB = data.refB;
        const massA = baseA.hitbox.mass, massB = baseB.hitbox.mass;
        const displacementA = MTV.scale(massB / (massA + massB));
        const displacementB = MTV.scale(massA / (massA + massB));
        baseA.position = baseA.position.subtract(displacementA);
        baseB.position = baseB.position.add(displacementB);
        // get contact points
        for (const point of data.contacts) {
            ctx.setTransform(1, 0, 0, 1, halfWidth + point.x, halfHeight + point.y);
            draw.ellipse(0, 0, 25, 25, rgba(100, 50));
        }
        if (!Settings.collisionImpulse)
            return;
        for (const contactPoint of data.contacts) {
            const vectorAC = contactPoint.subtract(baseA.position);
            const vectorBC = contactPoint.subtract(baseB.position);
            const contactVelocityA = baseA.velocity.add(vectorAC.perpendicular().scale(baseA.omega));
            const contactVelocityB = baseB.velocity.add(vectorBC.perpendicular().scale(baseB.omega));
            const velocityAB = contactVelocityB.subtract(contactVelocityA);
            const inertiaA = baseA.hitbox.momentOfInertia;
            const inertiaB = baseB.hitbox.momentOfInertia;
            const impulseScalar = velocityAB.scale(-1 - Settings.restitution).dotProduct(axis) /
                (axis.dotProduct(axis.scale(1 / massA + 1 / massB)) +
                    sq(vectorAC.crossProduct(axis)) / inertiaA +
                    sq(vectorBC.crossProduct(axis)) / inertiaB);
            baseA.velocity = baseA.velocity.subtract(axis.scale(impulseScalar / massA));
            baseA.omega += (vectorAC.crossProduct(axis) * impulseScalar) / inertiaA;
            baseB.velocity = baseB.velocity.add(axis.scale(impulseScalar / massB));
            baseB.omega -= (vectorBC.crossProduct(axis) * impulseScalar) / inertiaB;
        }
    }
}
