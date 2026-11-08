import { ctx, draw as drawer, outline } from "../Globals/init.js"
import { zipShift } from "../Utils/arrays.js"
import { Color } from "./color.js"
import { Vector, sq } from "../Utils/math.js"

export function regularPolyVerts(x: number, y: number, radius: number, sideCount: number) {
  const vertices = []
  for (let i = 0; i < sideCount; i++)
    vertices.push(
      new Vector(
        x + radius * Math.cos((2 * Math.PI * i) / sideCount),
        y + radius * Math.sin((2 * Math.PI * i) / sideCount)
      )
    )
  return vertices
}

export function polyVerts(...inputs: number[]): Vector[] {
  let vertices = []
  for (let i = 0; i < inputs.length; i += 2) vertices.push(new Vector(inputs[i], inputs[i + 1]))
  return vertices
}

type ShapeType = "Polygon" | "Circle"
type WindingOrder = "CW" | "CCW"

abstract class AShape {
  abstract type: ShapeType
  abstract centroid: Vector
  abstract radius: number
  abstract color: Color
  abstract draw: (x: number, y: number, θ: number) => void
  abstract area: number
}

export class Polygon implements AShape {
  type: ShapeType
  centroid: Vector
  color: Color
  radius: number
  vertices: Vector[]
  area: number
  windingOrder: WindingOrder
  constructor(vertices: Vector[], color: Color = new Color([0, 0, 0, 0])) {
    this.type = "Polygon"
    this.vertices = vertices
    this.color = color
    this.centroid = this.vertices
      .reduce((sum, vertex) => sum.add(vertex), new Vector(0, 0))
      .divide(this.vertices.length)
    this.radius = Math.sqrt(
      this.vertices.reduce(
        (maxSqRadius, vertex) => Math.max(vertex.subtract(this.centroid).getSqMag(), maxSqRadius),
        -Infinity
      )
    )
    this.area = zipShift(this.vertices).reduce(
      (area, [vertex, nextVertex]) => area + vertex.crossProduct(nextVertex),
      0
    )
    this.windingOrder = this.area < 0 ? "CW" : "CCW"
    this.area = Math.abs(this.area) / 2
  }
  draw(dx: number, dy: number, dir: number) {
    ctx.save()
    ctx.translate(dx, dy)
    ctx.rotate(dir)
    drawer.polygon(this.vertices, this.color.cachedValue, 1, outline)
    ctx.restore()
  }
}

export class Circle implements AShape {
  type: ShapeType
  centroid: Vector
  color: Color
  radius: number
  area: number
  constructor(
    radius: number,
    color: Color = new Color([0, 0, 0, 0]),
    centroid: Vector = new Vector(0, 0)
  ) {
    this.type = "Circle"
    this.centroid = centroid
    this.radius = radius
    this.color = color
    this.area = Math.PI * sq(this.radius)
  }
  draw(dx: number, dy: number, θ: number) {
    ctx.save()
    ctx.translate(dx + this.centroid.x, dy + this.centroid.y)
    drawer.ellipse(0, 0, this.radius * 2, this.radius * 2, this.color.cachedValue, 2, outline)
    drawer.line(0, 0, this.radius * Math.cos(θ), this.radius * Math.sin(θ), 0.5, outline)
    ctx.restore()
  }
}

export type Shape = Polygon | Circle
