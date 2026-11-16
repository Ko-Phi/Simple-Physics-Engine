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
export const nearlyEqual = (x: number, y: number, scale: number = 1e-6) => Math.abs(x - y) < scale
export const compareWithBy = <A, B, C>(
  c: (x: C, y: C) => boolean,
  f: (x: A | B) => C,
  x: A,
  y: B
): boolean => c(f(x), f(y))
export const minBy = <A, B>(f: (x: A | B) => number, x: A, y: B) =>
  compareWithBy((x, y) => x < y, f, x, y) ? x : y

export const pair = <A, B>(x: A, y: B): [A, B] => [x, y]
export const liftA2 = <A, B, C, D>(p: (c: B, d: C) => D, f: (a: A) => B, g: (a: A) => C, x: A): D =>
  p(f(x), g(x))
export const liftPair = <A, B, C>(f: (a: A) => B, g: (a: A) => C, x: A) => liftA2(pair, f, g, x)

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
  projectConstrain = (v: Vector): Vector =>
    v.scale(constrain(this.dotProduct(v) / v.getSqMag(), 0, 1))
  pointTo = (v: Vector): Vector => (this.dotProduct(v) < 0 ? this.negate() : this.copy())
  display = () => rounD(this.x, 3) + ", " + rounD(this.y, 3)
  equalTo = (v: Vector, scale: number = 1e-6): boolean => this.subtract(v).getMag() < scale
}
