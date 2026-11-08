import { Vector } from "../Utils/math.js"
import { canvas, halfWidth, halfHeight } from "./init.js"

interface Keys {
  [indexParameterName: string]: boolean
}
export const keys: Keys = {
  ArrowUp: false,
}
"abcdefghijklmnopqrstuvwxyz ".split("").forEach((c) => {
  keys[c] = false
  keys[c.toUpperCase()] = false
})
window.addEventListener("keydown", (event) => {
  if (event.key in keys) {
    keys[event.key] = true
    event.preventDefault()
  }
})
window.addEventListener("keyup", (event) => {
  if (event.key in keys) {
    keys[event.key] = false
  }
})
export const mouse = { position: new Vector(0, 0), isDown: false }
function getMousePos(canvas: HTMLCanvasElement, { clientX, clientY }: MouseEvent) {
  const { left, top, width, height } = canvas.getBoundingClientRect()
  return new Vector(
    ((clientX - left) * canvas.width) / width - halfWidth,
    ((clientY - top) * canvas.height) / height - halfHeight
  )
}
canvas.addEventListener("mousemove", (event) => {
  const pos = getMousePos(canvas, event)
  mouse.position = pos
})
canvas.addEventListener("mousedown", () => (mouse.isDown = true))
canvas.addEventListener("mouseup", () => (mouse.isDown = false))
