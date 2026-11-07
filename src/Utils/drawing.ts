import { Vector } from "../Utils/math.js"

export class Draw {
  ctx: CanvasRenderingContext2D
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
  }
  setSettings(fill: string = "#00000000", weight: number = 4, stroke: string = "#000000") {
    this.ctx.fillStyle = fill
    this.ctx.strokeStyle = stroke
    this.ctx.lineWidth = weight
  }
  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill?: string,
    weight?: number,
    stroke?: string
  ) {
    this.setSettings(fill, weight, stroke)
    this.ctx.fillRect(x, y, w, h)
  }
  ellipse(
    x: number,
    y: number,
    w: number,
    h: number,
    fill?: string,
    weight?: number,
    stroke?: string
  ) {
    this.setSettings(fill, weight, stroke)
    this.ctx.beginPath()
    this.ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 2 * Math.PI)
    this.ctx.closePath()
    this.ctx.stroke()
    this.ctx.fill()
  }
  line(x1: number, y1: number, x2: number, y2: number, weight?: number, stroke?: string) {
    this.setSettings("#00000000", weight, stroke)
    this.ctx.closePath()
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.stroke()
  }
  polygon(vertices: Vector[], fill?: string, weight?: number, stroke?: string) {
    this.setSettings(fill, weight, stroke)
    this.ctx.beginPath()
    this.ctx.moveTo(vertices[0].x, vertices[0].y)
    for (const vert of vertices) this.ctx!.lineTo(vert.x, vert.y)
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.stroke()
  }
  text(
    str: string,
    x: number,
    y: number,
    align: CanvasTextAlign = "left",
    baseline: CanvasTextBaseline = "top",
    fill: string = "#ffffff",
    weight?: number,
    stroke?: string
  ) {
    ;((this.ctx.textAlign = align), (this.ctx.textBaseline = baseline))
    this.setSettings(fill, weight, stroke)
    this.ctx.fillText(str, x, y)
  }
  noStroke() {
    this.ctx.lineWidth = 0
  }
}
