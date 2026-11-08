import { Vector, sq, random, rgba } from "./Utils/math.js"
import { keys, mouse } from "./Data/world.js"
import { Color } from "./Data/color.js"

import {
  cam,
  canvas,
  draw,
  ctx,
  outline,
  width,
  height,
  halfHeight,
  halfWidth,
  period,
} from "./Data/world.js"
import * as Settings from "./Data/world.js"

import { SpatialHashGrid } from "./Data/Collisions/spatialHashGrid.js"

const world = new SpatialHashGrid(Settings.gridSize, new Vector(width, height), draw)

import { Polygon, Circle, regularPolyVerts, polyVerts } from "./Data/shape.js"

import { Shapeoid } from "./Data/base.js"

let boxes: Shapeoid[] = []
for (let i = 0; i < Settings.insertCount; i++) {
  let shape =
    (Math.ceil(random(0, 5)) > 3 && !Settings.allCircles) || Settings.allPolys
      ? new Polygon(
          regularPolyVerts(
            0,
            0,
            Math.ceil(
              Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance)
            ),
            Math.ceil(random(2, 7))
          ),
          new Color([255, 0, 0])
        )
      : new Circle(Math.ceil(Settings.scale * random(0.9, 1.1)), new Color([255, 0, 0]))
  if (random(0, 5) > 4) {
    let hWidth =
      Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * random(2, 4)
    let hHeight =
      Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * 0.5
    shape = new Polygon(
      polyVerts(-hWidth, -hHeight, hWidth, -hHeight, hWidth, hHeight, -hWidth, hHeight),
      new Color([255, 0, 0])
    )
  }
  boxes.push(
    new Shapeoid(
      new Vector(random(-halfWidth, halfWidth), random(-halfHeight, halfHeight)),
      random(0, 2 * Math.PI),
      shape
    )
  )
}
if (Settings.insertCount === 0)
  boxes.push(
    new Shapeoid(new Vector(-100, 0), 0, new Circle(20, new Color([255, 0, 0])), new Vector(1, 0)),
    new Shapeoid(new Vector(100, 0), 0, new Circle(100, new Color([255, 0, 0]))),
    new Shapeoid(new Vector(0, -100), 0, new Circle(35, new Color([255, 0, 0]))),
    new Shapeoid(
      new Vector(0, 100),
      1.5,
      new Polygon(regularPolyVerts(0, 0, 35, 5), new Color([255, 0, 0]))
    ),
    new Shapeoid(
      new Vector(0, 200),
      1.2,
      new Polygon(polyVerts(-25, -50, 25, -50, 25, 50, -25, 50), new Color([255, 0, 0]))
    )
  )

import { PerformanceProfile } from "./Utils/profiler.js"

const Perf = new PerformanceProfile(
  "boxUpdate",
  "aabbUpdate",
  "gridUpdate",
  "gridQuery",
  "priorCheck",
  "hitboxUpdate",
  "satCheck",
  "drawBoxes",
  "handleCollisions"
)

let ticksSinceInput = 0

let ticks = 0
let collisions = []

// const font = createFont("sans-serif")
// const fontBold = createFont("sans-serif Bold")

for (const client of boxes) {
  client.getInput()
  world.newClient(client)
}

const collisionSet = new Set()
let KE = 0

let lastTime = 0
function drawLoop(timestamp: number) {
  if (ctx === null) throw "e"
  ctx.resetTransform()

  //let dt = timestamp - lastTime
  let dt = period
  lastTime = timestamp
  if (isNaN(dt)) dt = 0

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  KE = 0
  Perf.resetMetrics()
  collisionSet.clear()
  collisions = []
  world.cellsChecked = 0
  draw.rect(0, 0, width, height, "#ffffff")

  ctx.translate(halfWidth - cam.position.x, halfHeight - cam.position.y)
  world.draw()

  Perf.getTime()

  for (const box of boxes) {
    KE += (box.mass * box.velocity.getSqMag()) / 2 + (box.inertia * sq(box.omega)) / 2
    box.update(dt)
    box.getInput()
    Perf.updateMetric("boxUpdate")
    box.hitbox.shallowUpdate(box.position, box.dir)
    Perf.updateMetric("aabbUpdate")
    world.update(box)
    Perf.updateMetric("gridUpdate")
  }

  if (ticksSinceInput > 30) {
    if (keys[" "]) {
      Settings.setFocus(Settings.focus + 1)
      ticksSinceInput = 0
    } else if (mouse.isDown) {
      const [closest, _] = boxes.reduce(
        ([minBox, min], box): [Shapeoid, number] => {
          const distance = mouse.position.add(cam.position).subtract(box.position).getMag()
          return distance < min ? [box, distance] : [minBox, min]
        },
        [boxes[0], Infinity] as [Shapeoid, number]
      )
      Settings.setFocus(closest.id)
      ticksSinceInput = 0
    }
  } else ticksSinceInput++

  cam.update()

  // check collisions
  let collisionChecks = 0
  for (const box of boxes) {
    const aabb = box.hitbox.aabb
    Perf.getTime()
    const clients = world.queryGrid(box.position.add(aabb.centroid), aabb.width, aabb.height)
    Perf.updateMetric("gridQuery")

    for (const client of clients) {
      // skip duplicate collision check with self
      if (client.id === box.id) continue
      // skip duplicate collision checks
      const formattedCollision =
        box.id < client.id ? box.id + "," + client.id : client.id + "," + box.id
      if (collisionSet.has(formattedCollision)) continue

      collisionSet.add(formattedCollision)
      // quick radii check
      const sqDistance = box.hitbox.centroid
        .add(box.position)
        .subtract(client.hitbox.centroid.add(client.position))
        .getSqMag()
      const radiiSum = box.hitbox.radius + client.hitbox.radius
      if (sqDistance > sq(radiiSum)) continue

      Perf.updateMetric("priorCheck")

      // narrow update before full check
      box.hitbox.narrowUpdate(box.position, box.dir)
      client.hitbox.narrowUpdate(client.position, client.dir)
      Perf.updateMetric("hitboxUpdate")

      const collision = box.checkCollision(client)
      Perf.updateMetric("satCheck")
      collisionChecks++
      if (collision) collisions.push({ ...collision, baseA: box, baseB: client })
    }
  }

  if (ticks === 0) {
    Perf.getTime()
    Perf.updateMetric("priorCheck")
    Perf.updateMetric("hitboxUpdate")
    Perf.updateMetric("satCheck")
  }

  // draw them boxes
  for (const box of boxes) {
    if (Settings.drawAsCircles) {
      const diameter = box.hitbox.aabb.width
      draw.ellipse(
        box.position.x + box.hitbox.centroid.x,
        box.position.y + box.hitbox.centroid.y,
        diameter,
        diameter,
        box.shape.color.cachedValue,
        1,
        outline
      )
    } else box.draw()
  }
  Perf.updateMetric("drawBoxes")

  // handle collisions
  for (const collision of collisions) {
    if (collision.baseA === undefined) continue
    collision.baseA.handleCollision(collision)
  }
  Perf.updateMetric("handleCollisions")

  Perf.getTotal()

  ctx.resetTransform()

  const totalCells = (halfWidth * 2 * (halfHeight * 2)) / Settings.gridSize ** 2
  const countMetrics: Record<string, string | number> = {
    "Cells Filled": world.grid.size + " / " + totalCells,
    "Cells Checked": world.cellsChecked + " / " + totalCells,
    "SAT Calls": collisionChecks,
    "Object Count": boxes.length,
    "Collision Count": collisions.length,
    "Kinetic Energy": KE.toFixed(3),
  }

  ctx.font = "bold 24px Arial"
  const margin = 4
  const padding = 8

  const dataWidth = 140
  const keyWidth = 210
  const columnGap = 16

  //const rowHeight = textAscent() * 2
  const rowHeight = 15 * 2
  const rowGap = 0
  const start = margin + padding

  if (ticks % 60 === 0) Perf.updateMetrics()
  Perf.draw(["average", "max", "percentage"], dt)

  const counterDisplayHeight =
    padding + Object.keys(countMetrics).length * (rowHeight + rowGap) + padding
  const counterDisplayWidth = padding + keyWidth + columnGap + dataWidth + padding
  draw.rect(
    margin,
    height - margin - counterDisplayHeight,
    counterDisplayWidth,
    counterDisplayHeight,
    rgba(0, 120)
  )
  let dy = height - margin - counterDisplayHeight + padding
  let i = 0
  for (const metric in countMetrics) {
    if (i % 2 === 0) draw.rect(margin, dy, counterDisplayWidth, rowHeight, rgba(0, 0, 0, 50))
    draw.text(metric + ":", start, dy)
    draw.text(countMetrics[metric] + "", start + keyWidth + columnGap, dy)
    dy += rowHeight + rowGap
    i++
  }

  ticks += 1

  requestAnimationFrame(drawLoop)
}

requestAnimationFrame(drawLoop)
