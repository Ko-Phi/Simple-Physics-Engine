import { ctx, draw, height, width } from "../Globals/init.js"

interface UIElement {
  width: number
  height: number
  draw: (x: number, y: number) => void
}

export class UIText implements UIElement {
  width: number
  height: number
  constructor(
    public text: string,
    public font: string,
    public fill: string
  ) {
    ctx.save()
    ctx.font = this.font
    const { width, hangingBaseline, alphabeticBaseline } = ctx.measureText(text)
    this.width = width
    this.height = Math.abs(hangingBaseline + alphabeticBaseline)
    ctx.restore()
  }
  draw(x: number = 0, y: number = 0) {
    ctx.save()
    ctx.resetTransform()
    ctx.translate(width / 2, height / 2)
    draw.text(this.text, x, y, this.font, "left", "top", this.fill)
    ctx.restore()
  }
}

export class UIContainer implements UIElement {
  width: number
  height: number
  constructor(
    public elements: UIElement[],
    public gap: number = 8,
    public direction: "column" | "row" = "column",
    public fill: string = "#00000000",
    public padding: number = 8
  ) {
    if (this.direction === "column") {
      this.width = Math.max(...this.elements.map((e) => e.width)) + 2 * padding
      this.height =
        (this.elements.length - 1) * this.gap +
        this.elements.reduce((acc, e) => e.height + acc, 0) +
        2 * padding
    } else {
      this.height = Math.max(...this.elements.map((e) => e.height)) + 2 * padding
      this.width =
        (this.elements.length - 1) * this.gap +
        this.elements.reduce((acc, e) => e.width + acc, 0) +
        2 * padding
    }
  }
  draw(x: number = 0, y: number = 0) {
    ctx.save()
    ctx.resetTransform()
    ctx.translate(width / 2, height / 2)
    ctx.fillStyle = this.fill
    ctx.fillRect(x, y, this.width, this.height)
    if (this.direction === "column") {
      this.elements.reduce((dy, e) => {
        e.draw(x + this.padding, dy)
        return dy + e.height + this.gap
      }, y + this.padding)
    } else {
      this.elements.reduce((dx, e) => {
        e.draw(dx, y + this.padding)
        return dx + e.width + this.gap
      }, x + this.padding)
    }
    ctx.restore()
  }
}
