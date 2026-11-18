import { Shape } from "./shape.js"

export class Sprite {
  constructor(
    public shapes: Shape[],
    public fx = (x: string): string => x
  ) {}
  draw(dx: number, dy: number, dir: number) {
    this.shapes.forEach((shape) => shape.draw(dx, dy, dir))
  }
}
