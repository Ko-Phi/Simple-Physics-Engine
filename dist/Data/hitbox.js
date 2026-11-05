import { Vector } from "./vector.js";
import { Polygon, Circle } from "./shape.js";
import { zipShift, zipWith, shift } from "../Utils/arrays.js";
import { draw, ctx, halfHeight, halfWidth } from "../Data/world.js";
import * as Settings from "../Data/world.js";
import { rgba, sq, constrain } from "../Utils/math.js";
export class Aabb {
    width;
    height;
    centroid;
    constructor(width, height, centroid) {
        this.width = width;
        this.height = height;
        this.centroid = centroid;
    }
    draw(position) {
        ctx.setTransform(1, 0, 0, 1, this.centroid.x + position.x + halfWidth, this.centroid.y + position.y + halfHeight);
        draw.rect(-this.width / 2, -this.height / 2, this.width, this.height, rgba(128, 50));
        draw.ellipse(0, 0, this.width, this.width, rgba(128, 50), 0, rgba(0, 0));
    }
}
export class AHitbox {
}
export class PolygonHitbox extends Polygon {
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
    constructor(shape, position, dir, rho) {
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
        this.rotatedVertices = this.rotatedVertices.map((v) => v.rotate(dir));
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
        this.shallowUpdate(position, dir);
    }
    shallowUpdate(position, dir) {
        this.lastUpdate = "AABB";
        // check if rotation recalc neccessary
        if (dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
            this.centroid.rotate(dir);
        if (!Settings.displayAABB)
            return;
        // display AABB (note aabb centroid points to base centroid)
        this.aabb.draw(position);
    }
    narrowUpdate(position, dir) {
        if (this.lastUpdate !== "AABB")
            return;
        this.lastUpdate = "SAT";
        this.transformedVertices = this.vertices.map((vertex) => vertex.rotate(dir).add(position));
        this.normals = this.cachedNormals.map((cachedNormal) => cachedNormal.rotate(dir));
    }
    project(axis, _position) {
        const projections = this.transformedVertices.map((vertex) => vertex.dotProduct(axis));
        return {
            min: Math.min(...projections),
            max: Math.max(...projections),
        };
    }
    closestPointToCentroidOf(position) {
        let closestPoint = new Vector(0, 0);
        let minDistanceSquared = Infinity;
        const centroid = position.add(this.centroid);
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
    checkCollision(baseB, positionA, positionB) {
        const baseA = this;
        const tCentroidA = baseA.centroid.add(positionA);
        const tCentroidB = baseB.centroid.add(positionB);
        const axes = [tCentroidB.subtract(tCentroidA).normalize(), ...baseA.normals, ...baseB.normals];
        // common seperation axis first
        // Polygon-Polygon / Circle-Polygon Test
        // project each hitbox on each axis, checking for seperation
        let minOverlap = Infinity;
        let minNormal = axes[0];
        for (const axis of axes) {
            // project each hitbox's vertices
            const projA = baseA.project(axis, positionA);
            const projB = baseB.project(axis, positionB);
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
        if (baseB.type === "Circle") {
            // get closest point on edge and add to normals
            const centroid = positionB.add(baseB.centroid);
            const closestPoint = baseA.closestPointToCentroidOf(positionB);
            const axis = closestPoint.subtract(centroid).normalize();
            // project each hitbox's vertices
            const projA = baseA.project(axis, positionA);
            const projB = baseB.project(axis, positionB);
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
        if (minNormal.dotProduct(direction) < 0)
            minNormal = minNormal.negate();
        return {
            colliding: true,
            axis: minNormal,
            overlap: minOverlap,
        };
    }
}
export class CircleHitbox extends Circle {
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
    constructor(circle, position, dir, rho) {
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
        this.shallowUpdate(position, dir);
    }
    shallowUpdate(position, dir) {
        this.lastUpdate = "AABB";
        // check if rotation recalc neccessary
        if (dir !== this.cachedDir && this.cachedCentroid.x + this.cachedCentroid.y !== 0)
            this.centroid.rotate(dir);
        if (!Settings.displayAABB)
            return;
        // display AABB (note aabb centroid points to base centroid)
        this.aabb.draw(position);
    }
    narrowUpdate() {
        return;
    }
    project(axis, position) {
        const centroid = this.centroid.add(position);
        const projection = axis.dotProduct(centroid);
        return {
            min: projection - this.radius,
            max: projection + this.radius,
        };
    }
    closestPointToCentroidOf() {
        throw "Uncalleable";
    }
    checkCollision(baseB, positionA, positionB) {
        const baseA = this;
        const tCentroidA = baseA.centroid.add(positionA);
        const tCentroidB = baseB.centroid.add(positionB);
        const axes = [];
        // common seperation axis first
        axes.push(tCentroidB.subtract(tCentroidA).normalize());
        for (const normal of baseA.normals)
            axes.push(normal);
        for (const normal of baseB.normals)
            axes.push(normal);
        // Circle-Circle test
        if (baseA.type === baseB.type && baseA.type === "Circle") {
            const sqDistance = baseA.centroid
                .add(positionA)
                .subtract(baseB.centroid.add(positionB))
                .getSqMag();
            const radiiSum = baseA.radius + baseB.radius;
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
                };
            }
        }
        // Polygon-Polygon / Circle-Polygon Test
        // project each hitbox on each axis, checking for seperation
        let minOverlap = Infinity;
        let minNormal = axes[0];
        for (const axis of axes) {
            // project each hitbox's vertices
            const projA = baseA.project(axis, positionA);
            const projB = baseB.project(axis, positionB);
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
        if (baseB.type === "Polygon") {
            // get closest point on edge and add to normals
            let [circle, positionC, polygon] = baseA.type === "Circle" ? [baseA, positionA, baseB] : [baseB, positionB, baseA];
            const centroid = positionC.add(circle.centroid);
            const closestPoint = polygon.closestPointToCentroidOf(positionC);
            const axis = closestPoint.subtract(centroid).normalize();
            // project each hitbox's vertices
            const projA = baseA.project(axis, positionA);
            const projB = baseB.project(axis, positionB);
            // check if seperate
            if (projA.max < projB.min || projB.max < projA.min) {
                return { colliding: false };
            }
            const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
            if (overlap < minOverlap) {
                minOverlap = overlap;
                minNormal = axis;
            }
        }
        // reorient axis when neccessary
        const direction = tCentroidB.subtract(tCentroidA);
        if (minNormal.dotProduct(direction) < 0)
            minNormal = minNormal.negate();
        return {
            colliding: true,
            axis: minNormal,
            overlap: minOverlap,
        };
    }
}
function circlePolygonCheck(baseA, positionA, baseB, positionB) {
    // get closest point on edge and add to normals
    let [circle, positionC, polygon] = baseA.type === "Circle" ? [baseA, positionA, baseB] : [baseB, positionB, baseA];
    const centroid = positionC.add(circle.centroid);
    const closestPoint = polygon.closestPointToCentroidOf(positionC);
    const axis = closestPoint.subtract(centroid).normalize();
    // project each hitbox's vertices
    const projA = baseA.project(axis, positionA);
    const projB = baseB.project(axis, positionB);
    // check if seperate
    if (projA.max < projB.min || projB.max < projA.min)
        return { colliding: false };
    return {
        colliding: true,
        axis: axis,
        overlap: Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min),
    };
}
