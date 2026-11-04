import { Vector } from "./vector.js";
import { Polygon, Circle } from "./shape.js";
import { zipShift, zipWith, shift } from "../Utils/arrays.js";
import { draw, ctx, halfHeight, halfWidth, newid } from "../Data/world.js";
import * as Settings from "../Data/world.js";
import { Color } from "./color.js";
import { rgba, sq, constrain, random } from "../Utils/math.js";
export class Aabb {
    width;
    height;
    centroid;
    constructor(width, height, centroid) {
        this.width = width;
        this.height = height;
        this.centroid = centroid;
    }
    draw(base) {
        ctx.setTransform(1, 0, 0, 1, this.centroid.x + base.position.x + halfWidth, this.centroid.y + base.position.y + halfHeight);
        draw.rect(-this.width / 2, -this.height / 2, this.width, this.height, rgba(128, 50));
        draw.ellipse(0, 0, this.width, this.width, rgba(128, 50), 0, rgba(0, 0));
    }
}
class AHitbox {
}
class PolygonHitbox extends Polygon {
    normals;
    rho;
    aabb;
    area;
    mass;
    momentOfInertia;
    windingOrder;
    rotatedVertices;
    transformedVertices;
    cachedDir;
    lastUpdate;
    cachedNormals;
    cachedCentroid;
    constructor(shape, base, rho) {
        super(shape.vertices, shape.color);
        this.rotatedVertices = [];
        this.transformedVertices = [];
        this.normals = [];
        this.cachedDir = 0;
        this.lastUpdate = "None";
        this.cachedNormals = [];
        this.rho = rho ?? 1;
        this.area = zipShift(this.vertices).reduce((area, [vertex, nextVertex]) => area + vertex.crossProduct(nextVertex), 0);
        this.windingOrder = this.area < 0 ? "CW" : "CCW";
        this.area = Math.abs(this.area) / 2;
        this.mass = this.area * this.rho;
        this.rotatedVertices = this.rotatedVertices.map((v) => v.rotate(base.dir));
        const loopedVertices = this.windingOrder === "CW" ? this.vertices.slice().reverse() : this.vertices.slice();
        this.momentOfInertia =
            zipShift(loopedVertices).reduce((inertia, [vertex, nextVertex]) => ((subArea) => inertia +
                subArea * (vertex.getSqMag() + vertex.dotProduct(nextVertex) + nextVertex.getSqMag()))(vertex.crossProduct(nextVertex)), 0) *
                (this.rho / 12) -
                this.mass * this.centroid.getSqMag();
        this.cachedNormals = zipWith(this.vertices, shift(this.vertices), (vertex, nextVertex) => nextVertex.subtract(vertex).perpendicular().normalize());
        this.normals = this.cachedNormals.map((n) => n.copy());
        this.cachedCentroid = this.centroid.copy();
        const doubleRadius = 2 *
            Math.sqrt(this.vertices.reduce((maxSqRadius, vertex) => Math.max(vertex.subtract(this.cachedCentroid).getSqMag(), maxSqRadius), -Infinity));
        // Better for more uniform shapes (this scenario)
        this.aabb = new Aabb(doubleRadius, doubleRadius, this.centroid);
        this.shallowUpdate(base);
    }
    shallowUpdate(base) {
        this.lastUpdate = "AABB";
        // check if rotation recalc neccessary
        if (base.dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
            this.centroid.rotate(base.dir);
        if (!Settings.displayAABB)
            return;
        // display AABB (note aabb centroid points to base centroid)
        this.aabb.draw(base);
    }
    narrowUpdate(base) {
        if (this.lastUpdate !== "AABB")
            return;
        this.lastUpdate = "SAT";
        this.transformedVertices = this.vertices.map((vertex) => vertex.rotate(base.dir).add(base.position));
        this.normals = this.cachedNormals.map((cachedNormal) => cachedNormal.rotate(base.dir));
    }
    project(axis) {
        const projections = this.transformedVertices.map((vertex) => vertex.dotProduct(axis));
        return {
            min: Math.min(...projections),
            max: Math.max(...projections),
        };
    }
    closestPointToCentroidOf(base) {
        let closestPoint = new Vector(0, 0);
        let minDistanceSquared = Infinity;
        const centroid = base.position.add(base.hitbox.centroid);
        // loop over this object's edges
        zipShift(this.transformedVertices).forEach(([vertexA, vertexB]) => {
            // get closest point on side
            const sideAB = vertexB.subtract(vertexA);
            const sideACentroid = centroid.subtract(vertexA);
            let projection = sideACentroid.dotProduct(sideAB) / sideAB.getSqMag();
            projection = constrain(projection, 0, 1);
            const point = vertexA.add(sideAB.scale(projection));
            const difference = point.subtract(centroid);
            const distanceSquared = difference.getSqMag();
            if (distanceSquared < minDistanceSquared) {
                minDistanceSquared = distanceSquared;
                closestPoint = point;
            }
        });
        return closestPoint;
    }
}
class CircleHitbox extends Circle {
    normals;
    rho;
    aabb;
    area;
    mass;
    momentOfInertia;
    windingOrder;
    rotatedVertices;
    transformedVertices;
    cachedDir;
    lastUpdate;
    cachedNormals;
    cachedCentroid;
    constructor(circle, base, rho) {
        super(circle.radius, circle.color, circle.centroid);
        this.rotatedVertices = [];
        this.transformedVertices = [];
        this.normals = [];
        this.cachedDir = 0;
        this.lastUpdate = "None";
        this.cachedNormals = [];
        this.rho = rho ?? 1;
        this.area = Math.PI * sq(this.radius);
        this.mass = this.area * this.rho;
        this.momentOfInertia = 0.5 * this.mass * sq(this.radius);
        this.aabb = new Aabb(this.radius * 2, this.radius * 2, this.centroid);
        this.cachedCentroid = this.centroid.copy();
        this.windingOrder = "CW";
        this.shallowUpdate(base);
    }
    shallowUpdate(base) {
        this.lastUpdate = "AABB";
        // check if rotation recalc neccessary
        if (base.dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
            this.centroid.rotate(base.dir);
        if (!Settings.displayAABB)
            return;
        // display AABB (note aabb centroid points to base centroid)
        this.aabb.draw(base);
    }
    narrowUpdate() {
        return;
    }
    project(axis, base) {
        const centroid = this.centroid.add(base.position);
        const projection = axis.dotProduct(centroid);
        return {
            min: projection - this.radius,
            max: projection + this.radius,
        };
    }
    closestPointToCentroidOf() {
        throw "Uncalleable";
    }
}
// temp
class Base {
    id;
    indices;
    position;
    dir;
    velocity;
    omega;
    shape;
    trueColor;
    hitbox;
    axesBuffer;
    ticks;
    constructor(position, dir, shape, velocity) {
        this.id = newid();
        this.indices = [];
        this.position = position;
        this.dir = dir;
        this.shape = shape;
        this.trueColor = new Color([random(-15, 40), 0.6, 1], "HSV");
        if (shape instanceof Polygon)
            this.hitbox = new PolygonHitbox(shape, this);
        else
            this.hitbox = new CircleHitbox(shape, this);
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
    checkCollision(otherBase) {
        const baseA = this;
        const baseB = otherBase;
        const tCentroidA = baseA.hitbox.centroid.add(baseA.position);
        const tCentroidB = baseB.hitbox.centroid.add(baseB.position);
        this.axesBuffer.length = 0;
        // common seperation axis first
        this.axesBuffer.push(tCentroidB.subtract(tCentroidA).normalize());
        for (const normal of baseA.hitbox.normals)
            this.axesBuffer.push(normal);
        for (const normal of baseB.hitbox.normals)
            this.axesBuffer.push(normal);
        let axes = this.axesBuffer;
        // Circle-Circle test
        if (baseA.hitbox.type === baseB.hitbox.type && baseA.hitbox.type === "Circle") {
            const sqDistance = baseA.hitbox.centroid
                .add(baseA.position)
                .subtract(baseB.hitbox.centroid.add(baseB.position))
                .getSqMag();
            const radiiSum = baseA.hitbox.radius + baseB.hitbox.radius;
            if (sqDistance > sq(radiiSum)) {
                return { colliding: false };
            }
            else {
                const overlap = Math.sqrt(sqDistance) - radiiSum;
                const normal = tCentroidA.subtract(tCentroidB).normalize();
                return {
                    colliding: true,
                    axis: normal,
                    overlap: overlap,
                    MTV: normal.scale(overlap),
                    baseA: baseA,
                    baseB: baseB,
                };
            }
        }
        // Polygon-Polygon / Circle-Polygon Test
        // project each hitbox on each axis, checking for seperation
        let minOverlap = Infinity;
        let minNormal = axes[0];
        for (const axis of axes) {
            // project each hitbox's vertices
            const projA = baseA.hitbox.project(axis, baseA);
            const projB = baseB.hitbox.project(axis, baseB);
            // check if seperate
            if (projA.max < projB.min || projB.max < projA.min)
                return { colliding: false };
            const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
            if (overlap < minOverlap) {
                minOverlap = overlap;
                minNormal = axis;
            }
        }
        // Circle-Polygon Edge Case
        if (baseA.hitbox.type !== baseB.hitbox.type) {
            // get closest point on edge and add to normals
            let circleBase, otherBase;
            if (baseA.hitbox.type === "Circle")
                [circleBase, otherBase] = [baseA, baseB];
            else
                [circleBase, otherBase] = [baseB, baseA];
            const centroid = circleBase.position.add(circleBase.hitbox.centroid);
            const closestPoint = otherBase.hitbox.closestPointToCentroidOf(circleBase);
            const axis = closestPoint.subtract(centroid).normalize();
            // project each hitbox's vertices
            const projA = baseA.hitbox.project(axis, baseA);
            const projB = baseB.hitbox.project(axis, baseB);
            // check if seperate
            if (projA.max < projB.min || projB.max < projA.min)
                return { colliding: false };
            const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
            if (overlap < minOverlap) {
                minOverlap = overlap;
                minNormal = axis;
            }
        }
        // reorient axis when neccessary
        const direction = tCentroidB.subtract(tCentroidA);
        const dotProd = minNormal.x * direction.x + minNormal.y * direction.y;
        if (dotProd < 0)
            minNormal = minNormal.negate();
        return {
            colliding: true,
            axis: minNormal,
            overlap: minOverlap,
            baseA: baseA,
            baseB: baseB,
        };
    }
    handleCollision(data) {
        if (!data.colliding)
            return;
        const axis = data.axis;
        const MTV = data.axis.scale(data.overlap);
        const baseB = data.baseB;
        const baseA = data.baseA;
        const bases = [baseA, baseB];
        const massA = baseA.hitbox.mass, massB = baseB.hitbox.mass;
        const displacementA = MTV.scale(massB / (massA + massB));
        const displacementB = MTV.scale(massA / (massA + massB));
        baseA.position = baseA.position.subtract(displacementA);
        baseB.position = baseB.position.add(displacementB);
        // get contact points
        let contactPoints = [];
        const collisionType = baseA.hitbox.type + "-" + baseB.hitbox.type;
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
            bases.forEach((base, index, bases) => {
                const otherBase = bases[(index + 1) % bases.length];
                const vertices = base.hitbox.transformedVertices;
                const otherVertices = otherBase.hitbox.transformedVertices;
                // vertex loop
                vertices.forEach((vertexA) => {
                    // side loop
                    otherVertices.forEach((vertexB, index, bVertices) => {
                        const vertexC = bVertices[(index + 1) % bVertices.length];
                        const sideBC = vertexC.subtract(vertexB);
                        const sideBA = vertexA.subtract(vertexB);
                        let projection = sideBA.dotProduct(sideBC) / sideBC.getSqMag();
                        projection = constrain(projection, 0, 1);
                        const point = vertexB.add(sideBC.scale(projection));
                        const sideAP = point.subtract(vertexA);
                        const distanceSquared = sideAP.getSqMag();
                        if (distanceSquared < 1 && contactPoints.length < 2) {
                            if (contactPoints.length === 1) {
                                if (contactPoints[0].subtract(point).getSqMag() > 0.01)
                                    contactPoints.push(point);
                            }
                            else
                                contactPoints.push(point);
                        }
                    });
                });
            });
            if (contactPoints.length === 0)
                contactPoints.push(baseA.hitbox.closestPointToCentroidOf(baseB));
        }
        else if (collisionType === "Polygon-Circle" || collisionType === "Circle-Polygon") {
            let circleBase, otherBase;
            if (baseA.hitbox.type === "Circle")
                [circleBase, otherBase] = [baseA, baseB];
            else
                [circleBase, otherBase] = [baseB, baseA];
            contactPoints.push(otherBase.hitbox.closestPointToCentroidOf(circleBase));
        }
        else if (collisionType === "Circle-Circle") {
            const centroidAToCentroidB = baseB.position.subtract(baseA.position).normalize();
            contactPoints.push(baseA.position.add(centroidAToCentroidB.scale(baseA.hitbox.radius)));
        }
        for (const point of contactPoints) {
            ctx.setTransform(1, 0, 0, 1, halfWidth + point.x, halfHeight + point.y);
            draw.ellipse(0, 0, 5, 5, rgba(100, 50));
        }
        if (!Settings.collisionImpulse)
            return;
        for (const contactPoint of contactPoints) {
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
