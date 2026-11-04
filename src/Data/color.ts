import type { NArray } from "../Utils/arrays.js"
type ColorModel = "HSV" | "RGB"
export class Color {
  channels: NArray<number, 3>
  alpha: number
  model: ColorModel
  cachedValue: string
  constructor(channels: NArray<number, 3> | NArray<number, 4>, model: ColorModel = "RGB") {
    this.channels = channels.slice(0, 3) as NArray<number, 3>
    this.alpha = channels.length === 4 ? channels[3] : 255
    this.model = model
    this.cachedValue = this.value()
    this.toRGB()
    this.toHSV()
    this.toRGB()
    this.toHSV()
  }
  toRGB() {
    if (this.model === "RGB") return
    const [hue, sat, val] = [this.channels[0], this.channels[1], this.channels[2]]
    const hueP = hue / 60
    const chroma = val * sat
    const x = chroma * (1 - Math.abs((hueP % 2) - 1))

    let r, g, b
    if (hueP < 1) [r, g, b] = [chroma, x, 0]
    else if (hueP < 2) [r, g, b] = [x, chroma, 0]
    else if (hueP < 3) [r, g, b] = [0, chroma, x]
    else if (hueP < 4) [r, g, b] = [0, x, chroma]
    else if (hueP < 5) [r, g, b] = [x, 0, chroma]
    else if (hueP < 6) [r, g, b] = [chroma, 0, x]
    else throw new Error("RGB undefined")

    this.channels = [r, g, b].map((c) => (c + val - chroma) * 255) as NArray<number, 3>
    this.model = "RGB"
  }
  toHSV() {
    if (this.model === "HSV") return
    const [rP, gP, bP] = this.channels.slice(0, 3).map((c) => c / 255)
    const cMax = Math.max(rP, gP, bP)
    const cMin = Math.min(rP, gP, bP)
    const delta = cMax - cMin

    let hue
    if (delta === 0) hue = 0
    else if (cMax === rP) hue = (((gP - bP) / delta) % 6) * 60
    else if (cMax === gP) hue = ((bP - rP) / delta + 2) * 60
    else throw new Error("Hue undefined")

    const sat = cMax === 0 ? 0 : delta / cMax

    this.channels = [hue, sat, cMax]
    this.model = "HSV"
  }
  value() {
    if (this.model === "HSV") this.toRGB()
    return `rgba(${this.channels[0]}, ${this.channels[1]}, ${this.channels[2]}, ${Math.floor(this.alpha / 255)})`
  }
}
