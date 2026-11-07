import { ctx, draw as drawer, outline } from "./world.js";
import { zipShift } from "../Utils/arrays.js";
import { Color } from "./color.js";
import { Vector, sq } from "../Utils/math.js";
export function regularPolyVerts(x, y, radius, sideCount) {
    const vertices = [];
    for (let i = 0; i < sideCount; i++)
        vertices.push(new Vector(x + radius * Math.cos((2 * Math.PI * i) / sideCount), y + radius * Math.sin((2 * Math.PI * i) / sideCount)));
    return vertices;
}
export function polyVerts(...inputs) {
    let vertices = [];
    for (let i = 0; i < inputs.length; i += 2)
        vertices.push(new Vector(inputs[i], inputs[i + 1]));
    return vertices;
}
class AShape {
}
export class Polygon {
    type;
    centroid;
    color;
    radius;
    vertices;
    area;
    windingOrder;
    constructor(vertices, color = new Color([0, 0, 0, 0])) {
        this.type = "Polygon";
        this.vertices = vertices;
        this.color = color;
        this.centroid = this.vertices
            .reduce((sum, vertex) => sum.add(vertex), new Vector(0, 0))
            .divide(this.vertices.length);
        this.radius = Math.sqrt(this.vertices.reduce((maxSqRadius, vertex) => Math.max(vertex.subtract(this.centroid).getSqMag(), maxSqRadius), -Infinity));
        this.area = zipShift(this.vertices).reduce((area, [vertex, nextVertex]) => area + vertex.crossProduct(nextVertex), 0);
        this.windingOrder = this.area < 0 ? "CW" : "CCW";
        this.area = Math.abs(this.area) / 2;
    }
    draw(dx, dy, θ) {
        ctx.setTransform(1, 0, 0, 1, dx, dy);
        ctx.transform(Math.cos(θ), Math.sin(θ), -Math.sin(θ), Math.cos(θ), 0, 0);
        drawer.polygon(this.vertices, this.color.cachedValue, 1, outline);
        ctx.resetTransform();
    }
}
export class Circle {
    type;
    centroid;
    color;
    radius;
    area;
    constructor(radius, color = new Color([0, 0, 0, 0]), centroid = new Vector(0, 0)) {
        this.type = "Circle";
        this.centroid = centroid;
        this.radius = radius;
        this.color = color;
        this.area = Math.PI * sq(this.radius);
    }
    draw(dx, dy, θ) {
        ctx.setTransform(1, 0, 0, 1, dx, dy);
        drawer.ellipse(this.centroid.x, this.centroid.y, this.radius * 2, this.radius * 2, this.color.cachedValue, 2, outline);
        drawer.line(this.centroid.x, this.centroid.y, this.radius * Math.cos(θ), this.radius * Math.sin(θ), 0.5, outline);
        ctx.resetTransform();
    }
}
