import { Polygon, Circle } from "../../Data/shape.js";
import { zipShift, zipWith, shift } from "../../Utils/arrays.js";
import { draw, ctx } from "../../Globals/init.js";
import * as Settings from "../../Globals/settings.js";
import { Vector, rgba, constrain, nearlyEqual, minBy } from "../../Utils/math.js";
export class Aabb {
    width;
    height;
    centroid;
    constructor(width, height, centroid) {
        ;
        [this.width, this.height, this.centroid] = [width, height, centroid];
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
        const centroid = position.add(this.centroid);
        // loop over this object's edges
        return zipShift(this.transformedVertices).reduce((minPair, [vertexA, vertexB]) => {
            // get closest point on side
            const sideAB = vertexB.subtract(vertexA);
            const sideACentroid = centroid.subtract(vertexA);
            const projection = constrain(sideACentroid.dotProduct(sideAB) / sideAB.getSqMag(), 0, 1);
            const point = vertexA.add(sideAB.scale(projection));
            const distSq = point.subtract(centroid).getSqMag();
            return minBy((x) => x.distSq, minPair, { point, distSq });
        }, { point: this.transformedVertices[0], distSq: Infinity }).point;
    }
}
export const isPolygonHitbox = (shape) => shape.type === "Polygon";
export const isCircleHitbox = (shape) => shape.type === "Circle";
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
        const [boxA, boxB] = [refA.hitbox, refB.hitbox];
        const tCentroidA = boxA.centroid.add(refA.position);
        const tCentroidB = boxB.centroid.add(refB.position);
        // common seperation axis first
        const vBA = tCentroidB.subtract(tCentroidA);
        const axes = [vBA.normalize(), ...boxA.normals, ...boxB.normals];
        // Circle-Circle test
        if (isCircleHitbox(boxA) && isCircleHitbox(boxB)) {
            const radiiSum = boxA.radius + boxB.radius;
            return vBA.getMag() > radiiSum
                ? false
                : {
                    axis: vBA.normalize().negate(),
                    overlap: vBA.getMag() - radiiSum,
                    contacts: [refA.position.add(new Vector(vBA.theta(), boxB.radius, "dirMag"))],
                    refA,
                    refB,
                };
        }
        // Base Checks
        const collisions = axes.map((axis) => projectCheck(axis, refA, refB));
        // Circle-Polygon "Edge" Case
        if (boxA.type !== boxB.type)
            collisions.push(circlePolygonCheck(refA, refB));
        // Check for seperation
        const min = collisions.reduce((p, c) => (!p || !c ? false : minBy((x) => x.overlap, c, p)));
        if (min === false)
            return min;
        // reorient axis when neccessary
        const direction = tCentroidB.subtract(tCentroidA);
        if (min.axis.dotProduct(direction) < 0)
            min.axis = min.axis.negate();
        return { ...min, contacts: getContacts(refA, refB) };
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
/* Visualization:
       A is the checked vertex. BC is the current edge of the other base. P is the closest point
         B
        /|
       A-P
        \|
         C
*/
// base loop -> vertex -> side loop
function project(A, B, C) {
    const BC = C.subtract(B);
    const BA = A.subtract(B);
    const projection = constrain(BA.dotProduct(BC) / BC.getSqMag(), 0, 1);
    const point = B.add(BC.scale(projection));
    const distSq = point.subtract(A).getSqMag();
    return { point, distSq };
}
function getContacts(refA, refB) {
    let contacts = [];
    if (isPolygonHitbox(refA.hitbox) && isPolygonHitbox(refB.hitbox)) {
        let minDistSq = Infinity;
        const [polyA, polyB] = [refA.hitbox, refB.hitbox];
        let pair1 = project(polyA.transformedVertices[0], polyB.transformedVertices[0], polyB.transformedVertices[1]);
        let pair2 = { point: pair1.point.copy(), distSq: pair1.distSq };
        zipShift([polyA, polyB]).forEach(([hitbox, otherHitbox]) => {
            hitbox.transformedVertices.forEach((A) => {
                zipShift(otherHitbox.transformedVertices).forEach(([B, C]) => {
                    const { point: point, distSq: distSq } = project(A, B, C);
                    if (nearlyEqual(minDistSq, distSq, 5)) {
                        if (!pair1.point.equalTo(point)) {
                            pair2 = { point, distSq };
                        }
                    }
                    else if (distSq < minDistSq)
                        [minDistSq, pair1] = [distSq, { point, distSq }];
                });
            });
        });
        contacts =
            !nearlyEqual(pair1.distSq, pair2.distSq, 5) || pair1.point.equalTo(pair2.point)
                ? [pair1.point]
                : [pair1.point, pair2.point];
    }
    else if (refA.hitbox.type !== refB.hitbox.type) {
        if (isPolygonHitbox(refA.hitbox) && isCircleHitbox(refB.hitbox))
            contacts.push(refA.hitbox.closestPointToCentroidOf(refB.position));
        else if (isPolygonHitbox(refB.hitbox) && isCircleHitbox(refA.hitbox))
            contacts.push(refB.hitbox.closestPointToCentroidOf(refA.position));
    }
    return contacts;
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
