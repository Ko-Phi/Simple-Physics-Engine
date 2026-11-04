import { ctx, draw as drawer, outline } from "./world.js"
import { Vector } from "./vector.js"
import { Color } from "./color.js"

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

abstract class AShape {
  abstract type: ShapeType
  abstract centroid: Vector
  abstract radius: number
  abstract color: Color
  abstract draw: (x: number, y: number, θ: number) => void
}

export class Polygon implements AShape {
  type: ShapeType
  centroid: Vector
  color: Color
  radius: number
  vertices: Vector[]
  constructor(vertices: Vector[], color: Color = new Color([0, 0, 0, 0])) {
    this.type = "Polygon"
    this.vertices = vertices
    this.color = color
    let maxSqRadius = -Infinity
    this.centroid = this.vertices
      .reduce(
        (sum, vertex) => {
          maxSqRadius = Math.max(vertex.getSqMag(), maxSqRadius)
          return sum.add(vertex)
        },
        new Vector(0, 0)
      )
      .divide(this.vertices.length)
    this.radius = Math.sqrt(maxSqRadius)
  }
  draw(dx: number, dy: number, θ: number) {
    ctx.setTransform(1, 0, 0, 1, dx, dy)
    ctx.transform(Math.cos(θ), Math.sin(θ), -Math.sin(θ), Math.cos(θ), 0, 0)
    drawer.polygon(this.vertices, this.color.cachedValue, 1, outline)
  }
}

export class Circle implements AShape {
  type: ShapeType
  centroid: Vector
  color: Color
  radius: number
  constructor(
    radius: number,
    color: Color = new Color([0, 0, 0, 0]),
    centroid: Vector = new Vector(0, 0)
  ) {
    this.type = "Circle"
    this.centroid = centroid
    this.radius = radius
    this.color = color
  }
  draw(dx: number, dy: number, θ: number) {
    ctx.setTransform(1, 0, 0, 1, dx, dy)
    drawer.ellipse(
      this.centroid.x,
      this.centroid.y,
      this.radius * 2,
      this.radius * 2,
      this.color.cachedValue,
      2,
      outline
    )
    drawer.line(
      this.centroid.x,
      this.centroid.y,
      this.radius * Math.cos(θ),
      this.radius * Math.sin(θ),
      0.5,
      outline
    )
  }
}

export type Shape = Polygon | Circle
