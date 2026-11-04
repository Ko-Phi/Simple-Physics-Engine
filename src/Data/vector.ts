import { sq, rounD } from "../Utils/math.js"
type VectorInit = "component" | "dirMag"
export class Vector {
  x: number
  y: number
  constructor(input1: number, input2: number, init: VectorInit = "component") {
    ;[this.x, this.y] =
      init === "component"
        ? [input1, input2]
        : [input2 * Math.cos(input1), input2 * Math.sin(input1)]
  }
  copy = () => new Vector(this.x, this.y)
  getSqMag = () => sq(this.x) + sq(this.y)
  getMag = () => Math.sqrt(this.getSqMag())
  theta = () => Math.atan2(this.y, this.x)
  add = (v: Vector): Vector => new Vector(this.x + v.x, this.y + v.y)
  negate = () => new Vector(-this.x, -this.y)
  subtract = (v: Vector): Vector => this.add(v.negate())
  scale = (c: number): Vector => new Vector(this.x * c, this.y * c)
  divide = (c: number): Vector => this.scale(1 / c)
  normalize = (): Vector => ((r) => (r !== 0 ? this.divide(r) : this.copy()))(this.getMag()) // I miss u haskell </3
  dotProduct = (v: Vector): number => this.x * v.x + this.y * v.y
  crossProduct = (v: Vector): number => -(this.x * v.y - this.y * v.x) // As world is inverted-cartesian
  perpendicular = (): Vector => new Vector(-this.y, this.x)
  rotate = (θ: number): Vector =>
    new Vector(
      this.x * Math.cos(θ) - this.y * Math.sin(θ),
      this.x * Math.sin(θ) + this.y * Math.cos(θ)
    )
  display = () => rounD(this.x, 3) + ", " + rounD(this.y, 3)
  equalTo = (vector: Vector) => this.x === vector.x && this.y === vector.y
}
