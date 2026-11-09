import { Shape } from "./shape.js"

export class Sprite {
  shapes: Shape[]
  fx: (x: string) => string
  constructor(shapes: Shape[], fx = (x: string): string => x) {
    this.shapes = shapes
    this.fx = fx
  }
  draw(dx: number, dy: number, dir: number) {
    this.shapes.forEach((shape) => shape.draw(dx, dy, dir))
  }
}
