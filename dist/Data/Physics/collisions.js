import { Polygon, Circle } from "../../Data/shape.js";
import { zipShift, zipWith, shift } from "../../Utils/arrays.js";
import { draw, ctx } from "../../Globals/init.js";
import * as Settings from "../../Globals/settings.js";
import { Vector, rgba, sq, constrain } from "../../Utils/math.js";
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
        ctx.save();
        ctx.translate(this.centroid.x + position.x, this.centroid.y + position.y);
        draw.rect(-this.width / 2, -this.height / 2, this.width, this.height, rgba(128, 50));
        draw.ellipse(0, 0, this.width, this.width, rgba(128, 50), 0, rgba(0, 0));
        ctx.restore();
    }
}
export class AHitbox {
}
export class PolygonHitbox extends Polygon {
    normals;
    aabb;
    transformedVertices;
    cachedDir;
    lastUpdate;
    cachedNormals;
    cachedCentroid;
    constructor(shape, position, dir) {
        super(shape.vertices, shape.color);
        this.transformedVertices = [];
        this.normals = [];
        this.cachedDir = 0;
        this.lastUpdate = "None";
        this.cachedNormals = [];
        this.cachedNormals = zipWith(this.vertices, shift(this.vertices), (vertex, nextVertex) => nextVertex.subtract(vertex).perpendicular().normalize());
        this.normals = this.cachedNormals.map((n) => n.copy());
        this.cachedCentroid = this.centroid.copy();
        this.aabb = new Aabb(this.radius * 2, this.radius * 2, this.centroid);
        this.shallowUpdate(position, dir);
    }
    shallowUpdate = (position, dir) => shallowUpdate(this, position, dir);
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
}
export const isPolygonHitbox = (shape) => shape.type === "Polygon";
export class CircleHitbox extends Circle {
    normals;
    aabb;
    cachedDir;
    lastUpdate;
    cachedCentroid;
    constructor(circle, position, dir) {
        super(circle.radius, circle.color, circle.centroid);
        this.normals = [];
        this.cachedDir = 0;
        this.lastUpdate = "None";
        this.aabb = new Aabb(this.radius * 2, this.radius * 2, this.centroid);
        this.cachedCentroid = this.centroid.copy();
        this.shallowUpdate(position, dir);
    }
    shallowUpdate = (position, dir) => shallowUpdate(this, position, dir);
    narrowUpdate = () => undefined;
    project(axis, position) {
        const centroid = this.centroid.add(position);
        const projection = axis.dotProduct(centroid);
        return {
            min: projection - this.radius,
            max: projection + this.radius,
        };
    }
}
export class Collidable {
    indices;
    position;
    dir;
    hitbox;
    constructor(hitbox, position, dir) {
        this.indices = [];
        this.hitbox = hitbox;
        this.position = position;
        this.dir = dir;
    }
    checkCollision(refB) {
        const refA = this;
        const tCentroidA = refA.hitbox.centroid.add(refA.position);
        const tCentroidB = refB.hitbox.centroid.add(refB.position);
        // common seperation axis first
        const axes = [
            tCentroidB.subtract(tCentroidA).normalize(),
            ...refA.hitbox.normals,
            ...refB.hitbox.normals,
        ];
        // Circle-Circle test
        if (refA.hitbox.type === refB.hitbox.type && refA.hitbox.type === "Circle") {
            const sqDistance = refA.hitbox.centroid
                .add(refA.position)
                .subtract(refB.hitbox.centroid.add(refB.position))
                .getSqMag();
            const radiiSum = refA.hitbox.radius + refB.hitbox.radius;
            if (sqDistance > sq(radiiSum)) {
                return false;
            }
            else {
                const overlap = Math.sqrt(sqDistance) - radiiSum;
                const normal = tCentroidA.subtract(tCentroidB).normalize();
                const centroidAToCentroidB = refB.position.subtract(refA.position).normalize();
                const contact = refA.position.add(centroidAToCentroidB.scale(refA.hitbox.radius));
                return {
                    axis: normal,
                    overlap,
                    contacts: [contact],
                    refA: refA,
                    refB: refB,
                };
            }
        }
        // Base Checks
        const collisions = axes.map((axis) => projectCheck(axis, refA, refB));
        // Circle-Polygon "Edge" Case
        if (refA.hitbox.type !== refB.hitbox.type)
            collisions.push(circlePolygonCheck(refA, refB));
        // Check for seperation
        const min = collisions.reduce((prev, curr) => prev === false || curr === false ? false : curr.overlap < prev.overlap ? curr : prev);
        if (min === false)
            return min;
        // reorient axis when neccessary
        const direction = tCentroidB.subtract(tCentroidA);
        if (min.axis.dotProduct(direction) < 0)
            min.axis = min.axis.negate();
        let contactPoints = [];
        const collisionType = refA.hitbox.type + "-" + refB.hitbox.type;
        if (collisionType === "Polygon-Polygon") {
            const [polyA, polyB] = [refA.hitbox, refB.hitbox];
            /* Visualization:
                 A is the checked vertex. BC is the current edge of the other base. P is the closest point
                   B
                  /|
                 A-P
                  \|
                   C
              */
            // base loop -> vertex -> side loop
            zipShift([polyA, polyB]).forEach(([hitbox, otherHitbox]) => {
                const vertices = hitbox.transformedVertices;
                const otherVertices = otherHitbox.transformedVertices;
                vertices.forEach((vertexA) => {
                    zipShift(otherVertices).forEach(([vertexB, vertexC]) => {
                        const sideBC = vertexC.subtract(vertexB);
                        const sideBA = vertexA.subtract(vertexB);
                        let projection = constrain(sideBA.dotProduct(sideBC) / sideBC.getSqMag(), 0, 1);
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
                contactPoints.push(polyA.closestPointToCentroidOf(refB.position));
        }
        else if (collisionType === "Polygon-Circle" || collisionType === "Circle-Polygon") {
            let [circleBase, polyBox] = (refA.hitbox.type === "Circle" ? [refA, refB.hitbox] : [refB, refA.hitbox]);
            contactPoints.push(polyBox.closestPointToCentroidOf(circleBase.position));
        }
        return { ...min, contacts: contactPoints };
    }
}
function shallowUpdate(hitbox, position, dir) {
    hitbox.lastUpdate = "AABB";
    // check if rotation recalc neccessary
    if (dir !== hitbox.cachedDir && hitbox.cachedCentroid.getSqMag() !== 0) {
        hitbox.centroid = hitbox.cachedCentroid.rotate(dir);
        hitbox.aabb.centroid = hitbox.centroid;
        hitbox.cachedDir = dir;
    }
    if (!Settings.displayAABB)
        return;
    // display AABB (note aabb centroid points to base centroid)
    hitbox.aabb.draw(position);
}
function projectCheck(axis, refA, refB) {
    // project each hitbox's vertices
    const projA = refA.hitbox.project(axis, refA.position);
    const projB = refB.hitbox.project(axis, refB.position);
    // check if seperate
    if (projA.max < projB.min || projB.max < projA.min)
        return false;
    const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
    return { overlap, axis, refA, refB };
}
function circlePolygonCheck(refA, refB) {
    // get closest point on edge and add to normals
    let [circle, positionC, polygon] = (refA.hitbox.type === "Circle"
        ? [refA.hitbox, refA.position, refB.hitbox]
        : [refB.hitbox, refB.position, refA.hitbox]);
    const centroid = positionC.add(circle.centroid);
    const closestPoint = polygon.closestPointToCentroidOf(positionC);
    const axis = closestPoint.subtract(centroid).normalize();
    return projectCheck(axis, refA, refB);
}
export class CollisionHandler {
}
