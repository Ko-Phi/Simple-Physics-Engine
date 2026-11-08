export const sq = (n: number): number => n * n
export const constrain = (n: number, maxi: number, mini: number) =>
  Math.max(maxi, Math.min(mini, n))
export const rounD = (num: number, deciPlace: number): number =>
  Math.round(num * Math.pow(10, deciPlace)) / Math.pow(10, deciPlace)
export const roundToNearest = (num: number, rounder: number) => Math.round(num / rounder) * rounder
export const random = (min: number, max: number) => Math.random() * (max - min) + min
export const range = (start: number, stop: number, step: number = 1) =>
  Array.from({ length: Math.ceil((stop - start) / step) }, (_, i) => start + i * step)
export const rgba = (...inputs: number[]): string => {
  let channels
  if (inputs.length === 1) channels = [inputs[0], inputs[0], inputs[0], 255]
  else if (inputs.length === 2) channels = [inputs[0], inputs[0], inputs[0], inputs[1]]
  else if (inputs.length === 3) channels = inputs.concat(255)
  else channels = inputs
  return "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("")
}

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
