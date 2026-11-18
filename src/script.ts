import { Vector, sq, random, rgba } from "./Utils/math.js"
import { keys, mouse } from "./Globals/input.js"

import { cam, draw, ctx, width, height, setFocus, worldWidth, worldHeight } from "./Globals/init.js"

import * as Settings from "./Globals/settings.js"

import { SpatialHashGrid } from "./Data/Physics/spatialHashGrid.js"

const world = new SpatialHashGrid(Settings.gridSize, new Vector(width, height))

import { Polygon, Circle, regularPolyVerts, polyVerts } from "./Data/shape.js"

import { RigidBody, Immovable, Bounded } from "./Data/Physics/base.js"

let boxes: Array<RigidBody | Immovable> = []
for (let i = 0; i < Settings.insertCount; i++) {
  const factory = random(1, 20) > 19 ? Immovable : RigidBody
  let color = rgba(160, 160, 160)

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
          color
        )
      : new Circle(Math.ceil(Settings.scale * random(0.9, 1.1)), color)
  if (random(0, 5) > 4) {
    let hWidth =
      Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * random(2, 4)
    let hHeight =
      Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * 0.5
    shape = new Polygon(
      polyVerts(-hWidth, -hHeight, hWidth, -hHeight, hWidth, hHeight, -hWidth, hHeight),
      color
    )
  }
  boxes.push(
    new factory(
      new Vector(random(-worldWidth, worldWidth) / 2, random(-worldHeight, worldHeight) / 2),
      random(0, 2 * Math.PI),
      shape
    )
  )
}

if (Settings.insertCount === 0)
  boxes.push(
    new RigidBody(new Vector(-100, 0), 0, new Circle(20, rgba(255, 0, 0)), new Vector(1, 0)),
    new RigidBody(new Vector(100, 0), 0, new Circle(100, rgba(255, 0, 0))),
    new RigidBody(new Vector(0, -100), 0, new Circle(35, rgba(255, 0, 0))),
    new RigidBody(
      new Vector(0, 100),
      1.5,
      new Polygon(regularPolyVerts(0, 0, 35, 5), rgba(255, 0, 0))
    ),
    new RigidBody(
      new Vector(0, 200),
      1.2,
      new Polygon(polyVerts(-25, -50, 25, -50, 25, 50, -25, 50), rgba(255, 0, 0))
    )
  )
let color = rgba(160, 160, 160)
let hWidth =
  Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * random(2, 4)
let hHeight = Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * 0.5
const shape = new Polygon(
  polyVerts(-hWidth, -hHeight, hWidth, -hHeight, hWidth, hHeight, -hWidth, hHeight),
  color
)
boxes.push(new Bounded(new RigidBody(new Vector(0, 100), 0, shape), new Vector(0, 0), 50))
import { PerformanceProfile } from "./Utils/profiler.js"
import { UIContainer, UIText } from "./Utils/ui.js"

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

for (const client of boxes) world.newClient(client)

const collisionSet = new Set()
let collisionChecks = 0
let ME = 0

const totalCells = (worldWidth * worldHeight) / Settings.gridSize ** 2

let lastTime = 0
function drawLoop(timestamp: number) {
  if (ctx === null) throw "e"
  ctx.resetTransform()

  //let dt = timestamp - lastTime
  lastTime = timestamp
  let dt = Settings.period
  if (isNaN(dt)) dt = 0

  ctx.clearRect(0, 0, width, height)

  ME = 0
  collisionChecks = 0
  Perf.resetMetrics()
  collisionSet.clear()
  collisions = []
  world.cellsChecked = 0
  draw.rect(0, 0, width, height, "#404040")

  ctx.translate(width / 2 - cam.position.x, height / 2 - cam.position.y)
  world.draw()

  Perf.getTime()

  for (const box of boxes) {
    if (box instanceof RigidBody) {
      ME += box.getME()
      box.update(dt)
      box.getInput(dt)
    }
    Perf.updateMetric("boxUpdate")
    box.hitbox.shallowUpdate(box.position, box.dir)
    Perf.updateMetric("aabbUpdate")
    world.update(box)
    Perf.updateMetric("gridUpdate")
  }

  if (ticksSinceInput > 30) {
    if (keys[" "]) {
      setFocus(NaN)
      cam.target = { position: new Vector(0, 0) }
      ticksSinceInput = 0
    } else if (mouse.isDown) {
      const [closest, _] = boxes.reduce(
        ([minBox, min], box): [RigidBody | Immovable, number] => {
          const distance = mouse.position.add(cam.position).subtract(box.position).getMag()
          return distance < min ? [box, distance] : [minBox, min]
        },
        [boxes[0], Infinity] as [RigidBody | Immovable, number]
      )
      setFocus(closest.id)
      ticksSinceInput = 0
    }
  } else ticksSinceInput++

  cam.update()

  // check collisions
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
      if (collision) collisions.push({ ...collision, refA: box, refB: client })
    }
  }

  if (ticks === 0) {
    Perf.getTime()
    Perf.updateMetric("priorCheck")
    Perf.updateMetric("hitboxUpdate")
    Perf.updateMetric("satCheck")
  }

  // draw them boxes
  for (const box of boxes) box.draw()
  Perf.updateMetric("drawBoxes")

  // handle collisions
  for (const collision of collisions) {
    const propA = collision.refA.handleCollision(collision)
    const propB = collision.refB.handleCollision(collision)
    Object.assign(collision.refA, propA)
    Object.assign(collision.refB, propB)
  }
  Perf.updateMetric("handleCollisions")

  Perf.getTotal()

  ctx.resetTransform()
  if (ticks % 60 === 0) Perf.updateMetrics()
  Perf.draw(["average", "max", "percentage"], dt)

  draw.text("", 0, 0)
  ctx.resetTransform()
  let countMetrics: Record<string, string | number> = {
    "Cells Filled": world.grid.size + " / " + totalCells,
    "Cells Checked": world.cellsChecked + " / " + totalCells,
    "SAT Calls": collisionChecks,
    "Object Count": boxes.length,
    "Collision Count": collisions.length,
    "Mechanical Energy": ME.toFixed(3),
  }
  const count = Object.keys(countMetrics).map((s, i) => {
    const color = i % 2 ? "#00000000" : "#00000040"
    const con = new UIContainer(
      [new UIText(s + "", "bold 24px sans-serif", "#ffffff")],
      0,
      "column",
      color,
      8
    )
    con.width = 234
    return con
  })
  const metric = Object.values(countMetrics).map((s, i) => {
    const color = i % 2 ? "#00000000" : "#00000040"
    const con = new UIContainer(
      [new UIText(s + "", "bold 24px sans-serif", "#ffffff")],
      0,
      "column",
      color,
      8
    )
    con.width = 170
    return con
  })
  const full = new UIContainer(
    [
      new UIContainer(count, 0, "column", "#00000090", 0),
      new UIContainer(metric, 0, "column", "#00000090", 0),
    ],
    0,
    "row",
    "#00000000",
    0
  )
  full.draw(-width / 2 + 8, height / 2 - full.height - 8)

  ticks += 1

  requestAnimationFrame(drawLoop)
}

requestAnimationFrame(drawLoop)
