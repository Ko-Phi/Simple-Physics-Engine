import { Draw } from "../Utils/drawing.js"
import { Vector, rgba } from "../Utils/math.js"

export const outline = rgba(0)

export const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
if (ctx === null) throw "e"
export const draw = new Draw(ctx)

export const [width, height] = [canvas.width, canvas.height]
export const [halfWidth, halfHeight] = [width / 2, height / 2]

let idCount = 0
export const newid = () => idCount++

export let focus = NaN
export const setFocus = (n: number) => (focus = n)

class Camera<Type extends { position: Vector }> {
  position: Vector
  target: Type
  smoothing: number = 0.1
  trauma: number = 0
  constructor(target: Type, position: Vector = target.position) {
    this.target = target
    this.position = position
  }
  update() {
    this.position = this.position.add(this.target.position.subtract(this.position).scale(0.4))
    //this.position = this.position.add(
    //  new Vector(
    //    noise(millis() * 0.02, 1) * (Math.random() < 0.5 ? -1 : 1),
    //    noise(millis() * 0.02, 10) * (Math.random() < 0.5 ? -1 : 1)
    //  ).scale(Math.pow(this.trauma, 3) * 60)
    //)
    this.trauma = Math.max(this.trauma - 1 / 120, 0)
  }
}

export const cam = new Camera({ position: new Vector(0, 0) })
