function program() {
  title("Mass Object Collision Handler")
  size(1800, 1200)

  const canvasHalfWidth = width / 2
  const canvasHalfHeight = height / 2

  // Simulation Options
  const initialVelocity = true // objects begin with an intial velocity
  const periodicVelocityShifts = false // velocity randomized periodically
  const velocityMagnitude = 5 // alters the magnitude of said velocity

  const collisionImpulse = true // objects bounce off each other on collision
  const restitution = 1 // collision bounciness. Values < 1 yield loss of energy. Values > 1 break the first law of thermodynamics
  const mu = 0 // add friction (should be quite small)

  const allCircles = false // all shapes are circles. Increases performance as well
  const allPolys = false // all shapes are polygons. Slightly more performance intensive
  const gridSize = 50 // influences hashgrid check. Can queak for minor performance improvement

  // Box Count
  const insertCount: number = 50
  const scale = 32
  const scaleVariance = 0

  // Visuals
  // 16.67 ms is the sweet spot. If your device can average below this, you can swap to 60 fps
  const FPS = insertCount >= 750 ? 30 : 60
  const drawAsCircles = false // shapes drawn as circles. Increases performance
  const displayAABB = false // aabbs drawn. Uses rect() so not very good for performance
  const displayGridCheck = true // checked grids are highlighted. Very performance intensive
  const sameColor = false // shapes drawn with the same color. Minor performance gain

  angleMode = "radians"
  frameRate(FPS)
  const dt = 60 / FPS

  const rounD = (num: number, deciPlace: number): number =>
    round(num * pow(10, deciPlace)) / pow(10, deciPlace)

  let idCount = 0
  const newid = () => idCount++

  var keys = Array(100).fill(false)
  keyPressed = () => (keys[keyCode] = true)
  keyReleased = () => (keys[keyCode] = false)

  // componentInit: x, y
  // dirMagInit: dir, mag
  type VectorInit = "component" | "dirMag"
  class Vector {
    x: number
    y: number
    constructor(
      input1: number,
      input2: number,
      init: VectorInit = "component",
    ) {
      ;[this.x, this.y] =
        init === "component"
          ? [input1, input2]
          : [input2 * Math.cos(input1), input2 * Math.sin(input1)]
    }
    copy = () => new Vector(this.x, this.y)
    getSqMag = () => sq(this.x) + sq(this.y)
    getMag = () => sqrt(this.getSqMag())
    theta = () => Math.atan2(this.y, this.x)
    add = (v: Vector): Vector => new Vector(this.x + v.x, this.y + v.y)
    negate = () => new Vector(-this.x, -this.y)
    subtract = (v: Vector): Vector => this.add(v.negate())
    scale = (c: number): Vector => new Vector(this.x * c, this.y * c)
    divide = (c: number): Vector => this.scale(1 / c)
    normalize = (): Vector =>
      (r => (r !== 0 ? this.divide(r) : this.copy()))(this.getMag()) // I miss u haskell </3
    dotProduct = (v: Vector): number => this.x * v.x + this.y * v.y
    crossProduct = (v: Vector): number => -(this.x * v.y - this.y * v.x) // As world is inverted-cartesian
    perpendicular = (): Vector => new Vector(-this.y, this.x)
    rotate = (θ: number): Vector =>
      new Vector(
        this.x * Math.cos(θ) - this.y * Math.sin(θ),
        this.x * Math.sin(θ) + this.y * Math.cos(θ),
      )
    display = () => rounD(this.x, 3) + ", " + rounD(this.y, 3)
    equalTo = (vector: Vector) => this.x === vector.x && this.y === vector.y
  }

  type NArray<T, N extends number, R extends T[] = []> = R["length"] extends N
    ? R
    : NArray<T, N, [...R, T]>
  type ColorModel = "HSV" | "RGB"

  class Color {
    channels: NArray<number, 3>
    alpha: number
    model: ColorModel
    cachedValue: number
    constructor(
      channels: NArray<number, 3> | NArray<number, 4>,
      model: ColorModel = "RGB",
    ) {
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
      const [hue, sat, val] = [
        this.channels[0],
        this.channels[1],
        this.channels[2],
      ]
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

      this.channels = [r, g, b].map(c => (c + val - chroma) * 255) as NArray<
        number,
        3
      >
      this.model = "RGB"
    }
    toHSV() {
      if (this.model === "HSV") return
      const [rP, gP, bP] = this.channels.slice(0, 3).map(c => c / 255)
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
      return color(
        this.channels[0],
        this.channels[1],
        this.channels[2],
        this.alpha,
      )
    }
  }

  let cellsChecked = 0
  class SpatialHashGrid {
    grid: Map<string, any>
    cellSize: number
    queryIds: number
    constructor(cellSize: number) {
      this.grid = new Map()
      this.cellSize = cellSize
      this.queryIds = 0
    }
    key = (x: number, y: number): string => x + "," + y
    getIndex = (x: number, y: number): Vector =>
      new Vector(
        ...([x, y].map(c => Math.floor(c / this.cellSize)) as [number, number]),
      )
    newClient(client: Base) {
      client.indices = []
      this.insert(client)
      this.queryIds = -1
      return client
    }
    insert(client: Base) {
      const x = client.position.x + client.hitbox.aabb.centroid.x
      const y = client.position.y + client.hitbox.aabb.centroid.y
      const w = client.hitbox.aabb.width
      const h = client.hitbox.aabb.height

      // get the client's span
      const i1 = this.getIndex(x - w / 2, y - h / 2)
      const i2 = this.getIndex(x + w / 2, y + h / 2)
      client.indices = [i1, i2]

      // iterate over span, adding client to each cell
      for (let x = i1.x; x <= i2.x; ++x) {
        for (let y = i1.y; y <= i2.y; ++y) {
          const key = this.key(x, y)
          if (!this.grid.has(key)) this.grid.set(key, new Set())
          this.grid.get(key).add(client)
        }
      }
    }
    queryGrid(position: Vector, w: number, h: number) {
      const [x, y] = [position.x, position.y]

      // get span of checked area
      const i1 = this.getIndex(x - w / 2, y - h / 2)
      const i2 = this.getIndex(x + w / 2, y + h / 2)

      // iterate over spanned area for clients
      if (displayGridCheck) {
        pushMatrix()
        translate(canvasHalfWidth, canvasHalfHeight)
        fill(180, 30)
        stroke(180, 90)
      }
      let clients = []
      const queryId = this.queryIds++
      for (let x = i1.x; x <= i2.x; ++x) {
        for (let y = i1.y; y <= i2.y; ++y) {
          let key = this.key(x, y)
          if (!this.grid.has(key)) continue
          for (const client of this.grid.get(key)) {
            if (client.queryId !== queryId) {
              client.queryId = queryId
              clients.push(client)
            }
          }
          if (displayGridCheck)
            rect(
              x * this.cellSize,
              y * this.cellSize,
              this.cellSize,
              this.cellSize,
            )
          cellsChecked++
        }
      }
      if (displayGridCheck) popMatrix()
      return clients
    }
    remove(client: Base) {
      const i1 = client.indices[0]
      const i2 = client.indices[1]
      // iterate over client's span, removing it from each cell
      for (let x = i1.x; x <= i2.x; ++x) {
        for (let y = i1.y; y <= i2.y; ++y) {
          const key = this.key(x, y)
          const cell = this.grid.get(key)
          cell.delete(client)
          if (cell.size === 0) this.grid.delete(key)
        }
      }
    }
    update(client: Base) {
      const x = client.position.x + client.hitbox.aabb.centroid.x
      const y = client.position.y + client.hitbox.aabb.centroid.y
      const w = client.hitbox.aabb.width
      const h = client.hitbox.aabb.height

      // get the client's span
      const i1 = this.getIndex(x - w / 2, y - h / 2)
      const i2 = this.getIndex(x + w / 2, y + h / 2)
      // check for change in grid position
      if (!i1.equalTo(client.indices[0]) || !i2.equalTo(client.indices[1])) {
        this.remove(client)
        this.insert(client)
      }
    }
    draw() {
      stroke(204)
      pushMatrix()
      translate(canvasHalfWidth, canvasHalfHeight)
      for (
        let x = ceil(-width / this.cellSize) * this.cellSize;
        x <= canvasHalfWidth;
        x += this.cellSize
      )
        line(x, height, x, -height)
      for (
        let y = ceil(-height / this.cellSize) * this.cellSize;
        y <= canvasHalfHeight;
        y += this.cellSize
      )
        line(width, y, -width, y)
      popMatrix()
    }
  }

  const world = new SpatialHashGrid(gridSize)

  function regularPolyVerts(
    x: number,
    y: number,
    radius: number,
    sideCount: number,
  ) {
    const vertices = []
    for (let i = 0; i < sideCount; i++)
      vertices.push(
        new Vector(
          x + radius * Math.cos((2 * PI * i) / sideCount),
          y + radius * Math.sin((2 * PI * i) / sideCount),
        ),
      )
    return vertices
  }
  function polyVerts(...inputs: number[]): Vector[] {
    let vertices = []
    for (let i = 0; i < inputs.length; i += 2)
      vertices.push(new Vector(inputs[i], inputs[i + 1]))
    return vertices
  }

  type ShapeType = "Polygon" | "Circle"

  abstract class AShape {
    abstract type: ShapeType
    abstract centroid: Vector
    abstract radius: number
    abstract color: Color
    abstract draw: (x: number, y: number, base: Base) => void
  }

  class Polygon implements AShape {
    type: ShapeType
    centroid: Vector
    color: Color
    radius: number
    vertices: Vector[]
    constructor(vertices: Vector[], color: Color = new Color([0, 0, 0, 0])) {
      this.type = "Polygon"
      this.vertices = vertices
      this.color = color
      let maxSqRadius = -Infinity
      this.centroid = this.vertices
        .reduce(
          (sum, vertex) => {
            maxSqRadius = max(vertex.getSqMag(), maxSqRadius)
            return sum.add(vertex)
          },
          new Vector(0, 0),
        )
        .divide(this.vertices.length)
      this.radius = sqrt(maxSqRadius)
    }
    draw(dx: number, dy: number, base: Base) {
      if (!sameColor) fill(this.color.cachedValue)
      beginShape()
      for (const vert of this.vertices) vertex(vert.x + dx, vert.y + dy)
      endShape(CLOSE)
    }
  }

  class Circle implements AShape {
    type: ShapeType
    centroid: Vector
    color: Color
    radius: number
    constructor(
      centroid: Vector,
      radius: number,
      color: Color = new Color([0, 0, 0, 0]),
    ) {
      this.type = "Circle"
      this.centroid = centroid
      this.radius = radius
      this.color = color
    }
    draw(dx: number, dy: number, base: Base) {
      if (!sameColor) fill(this.color.cachedValue)
      ellipse(
        this.centroid.x,
        this.centroid.y,
        this.radius * 2,
        this.radius * 2,
      )
      line(
        this.centroid.x,
        this.centroid.y,
        this.radius * cos(base.dir),
        this.radius * sin(base.dir),
      )
    }
  }

  type Shape = Polygon | Circle

  class Aabb {
    width: number
    height: number
    centroid: Vector
    constructor(width: number, height: number, centroid: Vector) {
      this.width = width
      this.height = height
      this.centroid = centroid
    }
  }

  type WindingOrder = "CW" | "CCW"
  abstract class AHitbox {
    abstract normals: Vector[]

    abstract rho: number
    abstract aabb: Aabb
    abstract area: number
    abstract mass: number
    abstract momentOfInertia: number
    abstract windingOrder: WindingOrder

    abstract rotatedVertices: Vector[]
    abstract transformedVertices: Vector[]
    abstract cachedDir: number
    abstract cachedNormals: Vector[]
    abstract cachedCentroid: Vector

    abstract lastUpdate: "None" | "AABB" | "SAT"
    abstract shallowUpdate: (base: Base) => void
    abstract narrowUpdate: (base: Base) => void
    abstract project: (axis: Vector, base: Base) => { min: number; max: number }
    abstract closestPointToCentroidOf: (base: Base) => Vector
  }

  class PolygonHitbox extends Polygon implements AHitbox {
    normals: Vector[]

    rho: number
    aabb: Aabb
    area: number
    mass: number
    momentOfInertia: number
    windingOrder: WindingOrder

    rotatedVertices: Vector[]
    transformedVertices: Vector[]
    cachedDir: number
    lastUpdate: "None" | "AABB" | "SAT"
    cachedNormals: Vector[]
    cachedCentroid: Vector

    constructor(shape: Polygon, base: Base, rho?: number) {
      super(shape.vertices, shape.color)
      this.rotatedVertices = []
      this.transformedVertices = []
      this.normals = []
      this.cachedDir = 0
      this.lastUpdate = "None"
      this.cachedNormals = []

      this.rho = rho ?? 1
      this.area = this.vertices.reduce((area, vertex, index, vertices) => {
        const nextVertex = vertices[(index + 1) % vertices.length]
        return area + vertex.crossProduct(nextVertex)
      }, 0)
      if (this.area < 0) this.windingOrder = "CW"
      else this.windingOrder = "CCW"
      this.area = abs(this.area) / 2
      console.log(this.area, this.windingOrder)

      let loopedVertices = this.vertices
      if (this.windingOrder === "CW")
        loopedVertices = this.vertices.slice().reverse()

      let inertiaOrigin = 0
      this.centroid = new Vector(0, 0)

      const cosT = Math.cos(base.dir)
      const sinT = Math.sin(base.dir)

      loopedVertices.forEach((vertex, index, vertices) => {
        const nextVertex = vertices[(index + 1) % vertices.length]
        const subArea = vertex.crossProduct(nextVertex)

        this.centroid = this.centroid.add(vertex.add(nextVertex).scale(subArea))
        inertiaOrigin +=
          subArea *
          (vertex.getSqMag() +
            vertex.dotProduct(nextVertex) +
            nextVertex.getSqMag())

        this.rotatedVertices[index] = new Vector(
          vertex.x * cosT - vertex.y * sinT,
          vertex.x * sinT + vertex.y * cosT,
        )
      })
      this.mass = this.area * this.rho
      this.cachedCentroid = this.centroid.copy()
      inertiaOrigin *= this.rho / 12
      this.momentOfInertia =
        inertiaOrigin - this.mass * this.centroid.getSqMag()

      let maxSqRadius = -Infinity
      this.vertices.forEach((vertex, index, vertices) => {
        const nextVertex = vertices[(index + 1) % vertices.length]
        const edge = nextVertex.subtract(vertex)
        let normal = edge.perpendicular().normalize()

        const direction = this.cachedCentroid.subtract(normal)
        maxSqRadius = max(
          vertex.subtract(this.cachedCentroid).getSqMag(),
          maxSqRadius,
        )
        if (normal.dotProduct(direction) < 0) normal = normal.negate()
        this.cachedNormals[index] = normal.normalize()
        this.normals[index] = this.cachedNormals[index].copy()
      })

      let doubleRadius = 2 * sqrt(maxSqRadius)
      // Better for more uniform shapes (this scenario)
      this.aabb = new Aabb(doubleRadius, doubleRadius, this.centroid)

      this.shallowUpdate(base)
    }
    shallowUpdate(base: Base) {
      this.lastUpdate = "AABB"

      // check if rotation recalc neccessary
      if (
        base.dir !== this.cachedDir &&
        this.cachedCentroid.x + this.cachedCentroid.y !== 0
      )
        this.centroid.rotate(base.dir)
      if (!displayAABB) return
      // display AABB (note aabb centroid points to base centroid)
      const aabbWidth = this.aabb.width
      const aabbHeight = this.aabb.height

      fill(128, 50)
      stroke(128, 50)
      pushMatrix()
      translate(
        this.centroid.x + base.position.x + canvasHalfWidth,
        this.centroid.y + base.position.y + canvasHalfHeight,
      )
      rect(-aabbWidth / 2, -aabbHeight / 2, aabbWidth, aabbHeight)
      ellipse(0, 0, this.radius * 2, this.radius * 2)
    }
    narrowUpdate(base: Base) {
      if (this.lastUpdate !== "AABB") return
      this.lastUpdate = "SAT"

      this.transformedVertices = this.vertices.map(vertex =>
        vertex.rotate(base.dir).add(base.position),
      )
      this.normals = this.cachedNormals.map(cachedNormal =>
        cachedNormal.rotate(base.dir),
      )
    }
    project(axis: Vector): { min: number; max: number } {
      const projections = this.transformedVertices.map(vertex =>
        vertex.dotProduct(axis),
      )
      return { min: Math.min(...projections), max: Math.max(...projections) }
    }
    closestPointToCentroidOf(base: Base): Vector {
      let closestPoint = new Vector(0, 0)
      let minDistanceSquared = Infinity
      const centroid = base.position.add(base.hitbox.centroid)
      // loop over this object's edges
      this.transformedVertices.forEach(
        (vertexA: Vector, index: number, vertices: Vector[]) => {
          const vertexB = vertices[(index + 1) % vertices.length]

          // get closest point on side
          const sideAB = vertexB.subtract(vertexA)
          const sideACentroid = centroid.subtract(vertexA)
          let projection = sideACentroid.dotProduct(sideAB) / sideAB.getSqMag()
          projection = constrain(projection, 0, 1)

          const point = vertexA.add(sideAB.scale(projection))
          const difference = point.subtract(centroid)
          const distanceSquared = difference.getSqMag()
          if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared
            closestPoint = point
          }
        },
      )
      return closestPoint
    }
  }

  class CircleHitbox extends Circle implements AHitbox {
    normals: Vector[]

    rho: number
    aabb: Aabb
    area: number
    mass: number
    momentOfInertia: number
    windingOrder: WindingOrder

    rotatedVertices: Vector[]
    transformedVertices: Vector[]
    cachedDir: number
    lastUpdate: "None" | "AABB" | "SAT"
    cachedNormals: Vector[]
    cachedCentroid: Vector

    constructor(circle: Circle, base: Base, rho?: number) {
      super(circle.centroid, circle.radius, circle.color)
      this.rotatedVertices = []
      this.transformedVertices = []
      this.normals = []
      this.cachedDir = 0
      this.lastUpdate = "None"
      this.cachedNormals = []

      this.rho = rho ?? 1

      this.area = PI * sq(this.radius)
      this.mass = this.area * this.rho
      this.momentOfInertia = 0.5 * this.mass * sq(this.radius)

      this.aabb = new Aabb(this.radius * 2, this.radius * 2, this.centroid)
      this.cachedCentroid = this.centroid.copy()
      this.windingOrder = "CW"

      this.shallowUpdate(base)
    }
    shallowUpdate(base: Base) {
      this.lastUpdate = "AABB"

      // check if rotation recalc neccessary
      if (
        base.dir !== this.cachedDir &&
        this.cachedCentroid.x + this.cachedCentroid.y !== 0
      )
        this.centroid.rotate(base.dir)
      if (!displayAABB) return
      // display AABB (note aabb centroid points to base centroid)
      const aabbWidth = this.aabb.width
      const aabbHeight = this.aabb.height

      fill(128, 50)
      stroke(128, 50)
      pushMatrix()
      translate(
        this.centroid.x + base.position.x + canvasHalfWidth,
        this.centroid.y + base.position.y + canvasHalfHeight,
      )
      rect(-aabbWidth / 2, -aabbHeight / 2, aabbWidth, aabbHeight)
      ellipse(0, 0, this.radius * 2, this.radius * 2)
    }
    narrowUpdate() {
      return
    }
    project(axis: Vector, base: Base): { min: number; max: number } {
      const centroid = this.centroid.add(base.position)
      const projection = axis.dotProduct(centroid)
      return { min: projection - this.radius, max: projection + this.radius }
    }
    closestPointToCentroidOf(base: Base): Vector {
      let closestPoint = new Vector(0, 0)
      let minDistanceSquared = Infinity
      const centroid = base.position.add(base.hitbox.centroid)
      // loop over this object's edges
      this.transformedVertices.forEach(
        (vertexA: Vector, index: number, vertices: Vector[]) => {
          const vertexB = vertices[(index + 1) % vertices.length]

          // get closest point on side
          const sideAB = vertexB.subtract(vertexA)
          const sideACentroid = centroid.subtract(vertexA)
          let projection = sideACentroid.dotProduct(sideAB) / sideAB.getSqMag()
          projection = constrain(projection, 0, 1)

          const point = vertexA.add(sideAB.scale(projection))
          const difference = point.subtract(centroid)
          const distanceSquared = difference.getSqMag()
          if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared
            closestPoint = point
          }
        },
      )
      return closestPoint
    }
  }

  type Hitbox = PolygonHitbox | CircleHitbox

  // temp
  class Base {
    id: number
    indices: Vector[]

    position: Vector
    dir: number
    velocity: Vector
    omega: number
    shape: Shape
    trueColor: Color

    hitbox: Hitbox
    axesBuffer: Vector[]
    ticks: number

    constructor(
      position: Vector,
      dir: number,
      shape: Shape,
      velocity?: Vector,
    ) {
      this.id = newid()
      this.indices = []
      this.position = position
      this.dir = dir
      this.shape = shape
      this.trueColor = new Color([random(-15, 40), 0.6, 1], "HSV")

      if (shape instanceof Polygon) this.hitbox = new PolygonHitbox(shape, this)
      else this.hitbox = new CircleHitbox(shape, this)

      this.axesBuffer = []
      if (initialVelocity) {
        this.velocity = new Vector(
          random(0, 2 * PI),
          velocityMagnitude * random(0.75, 1.25),
          "dirMag",
        )
        this.omega = random(-0.15, 0.15)
      } else {
        this.velocity = new Vector(0, 0)
        this.omega = 0
      }
      this.velocity = velocity ?? new Vector(0, 0)
      this.ticks = floor(random(0, 50))
    }
    getInput() {
      const input_x = (keys[RIGHT] || keys[68]) - (keys[LEFT] || keys[65])
      const input_y = (keys[DOWN] || keys[83]) - (keys[UP] || keys[87])
      const input_dir = keys[69] - keys[81]
      const translation = new Vector(input_x, input_y).normalize()

      if (this.velocity.getMag() < 3)
        this.velocity = this.velocity.add(translation.divide(5))
      else this.velocity = this.velocity.normalize().scale(2.9)
      if (abs(this.omega) < 0.1) this.omega += input_dir / 100
      else this.omega = Math.sign(this.omega) * 0.09
    }
    update() {
      this.ticks++
      this.position = this.position.add(this.velocity.scale(dt))
      this.dir += this.omega * dt

      const velocity = this.velocity.getMag()
      if (velocity > mu)
        this.velocity = this.velocity.subtract(
          this.velocity.scale(mu / velocity),
        )
      else this.velocity = new Vector(0, 0)

      if (abs(this.position.x) > canvasHalfWidth + this.hitbox.aabb.width / 2) {
        this.position.x =
          -Math.sign(this.position.x) *
          (canvasHalfWidth + this.hitbox.aabb.width / 2)
      }
      if (
        abs(this.position.y) >
        canvasHalfHeight + this.hitbox.aabb.height / 2
      ) {
        this.position.y =
          -Math.sign(this.position.y) *
          (canvasHalfHeight + this.hitbox.aabb.width / 2)
      }

      if (this.ticks % (60 * dt) === 0 && periodicVelocityShifts) {
        this.velocity = new Vector(
          random(0, 2 * PI),
          velocityMagnitude * random(0.75, 1.25),
          "dirMag",
        )
        this.omega = random(-0.01, 0.01) * scale
      }

      if (focus === this.id) this.shape.color = new Color([110, 0.4, 1], "HSV")
      else this.shape.color = this.trueColor
    }
    draw() {
      pushMatrix()
      translate(this.position.x + canvasHalfWidth, this.position.y + height / 2)
      if (this.shape.type !== "Circle") rotate(this.dir)
      this.shape.draw(0, 0, this)
      popMatrix()
    }
    checkCollision(otherBase: Base) {
      const baseA = this
      const baseB = otherBase
      const tCentroidA = baseA.hitbox.centroid.add(baseA.position)
      const tCentroidB = baseB.hitbox.centroid.add(baseB.position)

      this.axesBuffer.length = 0
      // common seperation axis first
      this.axesBuffer.push(tCentroidB.subtract(tCentroidA).normalize())
      for (const normal of baseA.hitbox.normals) this.axesBuffer.push(normal)
      for (const normal of baseB.hitbox.normals) this.axesBuffer.push(normal)

      let axes = this.axesBuffer
      // Circle-Circle test
      if (
        baseA.hitbox.type === baseB.hitbox.type &&
        baseA.hitbox.type === "Circle"
      ) {
        const sqDistance = baseA.hitbox.centroid
          .add(baseA.position)
          .subtract(baseB.hitbox.centroid.add(baseB.position))
          .getSqMag()
        const radiiSum = baseA.hitbox.radius + baseB.hitbox.radius
        if (sqDistance > sq(radiiSum)) {
          return { colliding: false }
        } else {
          const overlap = sqrt(sqDistance) - radiiSum
          const normal = tCentroidA.subtract(tCentroidB).normalize()
          return {
            colliding: true,
            axis: normal,
            overlap: overlap,
            MTV: normal.scale(overlap),
            baseA: baseA,
            baseB: baseB,
          }
        }
      }

      // Polygon-Polygon / Circle-Polygon Test
      // project each hitbox on each axis, checking for seperation
      let minOverlap = Infinity
      let minNormal: Vector = axes[0]
      for (const axis of axes) {
        // project each hitbox's vertices
        const projA = baseA.hitbox.project(axis, baseA)
        const projB = baseB.hitbox.project(axis, baseB)

        // check if seperate
        if (projA.max < projB.min || projB.max < projA.min)
          return { colliding: false }

        const overlap = min(projA.max, projB.max) - max(projA.min, projB.min)
        if (overlap < minOverlap) {
          minOverlap = overlap
          minNormal = axis
        }
      }

      // Circle-Polygon Edge Case
      if (baseA.hitbox.type !== baseB.hitbox.type) {
        // get closest point on edge and add to normals
        let circleBase, otherBase
        if (baseA.hitbox.type === "Circle")
          [circleBase, otherBase] = [baseA, baseB]
        else[circleBase, otherBase] = [baseB, baseA]
        const centroid = circleBase.position.add(circleBase.hitbox.centroid)

        const closestPoint =
          otherBase.hitbox.closestPointToCentroidOf(circleBase)
        const axis = closestPoint.subtract(centroid).normalize()

        // project each hitbox's vertices
        const projA = baseA.hitbox.project(axis, baseA)
        const projB = baseB.hitbox.project(axis, baseB)

        // check if seperate
        if (projA.max < projB.min || projB.max < projA.min)
          return { colliding: false }

        const overlap = min(projA.max, projB.max) - max(projA.min, projB.min)
        if (overlap < minOverlap) {
          minOverlap = overlap
          minNormal = axis
        }
      }

      // reorient axis when neccessary
      const direction = tCentroidB.subtract(tCentroidA)
      const dotProd = minNormal.x * direction.x + minNormal.y * direction.y
      if (dotProd < 0) minNormal = minNormal.negate()

      return {
        colliding: true,
        axis: minNormal,
        overlap: minOverlap,
        baseA: baseA,
        baseB: baseB,
      }
    }
    handleCollision(data: {
      colliding: boolean
      axis: Vector
      overlap: number
      baseA: Base
      baseB: Base
    }) {
      if (!data.colliding) return
      const axis = data.axis
      const MTV = data.axis.scale(data.overlap)
      const baseB = data.baseB
      const baseA = data.baseA
      const bases = [baseA, baseB]

      const massA = baseA.hitbox.mass,
        massB = baseB.hitbox.mass

      const displacementA = MTV.scale(massB / (massA + massB))
      const displacementB = MTV.scale(massA / (massA + massB))
      baseA.position = baseA.position.subtract(displacementA)
      baseB.position = baseB.position.add(displacementB)
      // get contact points
      let contactPoints: Vector[] = []
      const collisionType = baseA.hitbox.type + "-" + baseB.hitbox.type
      if (collisionType === "Polygon-Polygon") {
        /* Visualization:
           A is the checked vertex. BC is the current edge of the other base. P is the closest point
              /B
             / |
            /  |
           A---P
            \  |
             \ |
              \C
        */

        // base loop
        bases.forEach((base: Base, index: number, bases: Base[]) => {
          const otherBase = bases[(index + 1) % bases.length]
          const vertices = base.hitbox.transformedVertices
          const otherVertices = otherBase.hitbox.transformedVertices
          // vertex loop
          vertices.forEach(vertexA => {
            // side loop
            otherVertices.forEach((vertexB, index, bVertices) => {
              const vertexC = bVertices[(index + 1) % bVertices.length]
              const sideBC = vertexC.subtract(vertexB)
              const sideBA = vertexA.subtract(vertexB)

              let projection = sideBA.dotProduct(sideBC) / sideBC.getSqMag()
              projection = constrain(projection, 0, 1)

              const point = vertexB.add(sideBC.scale(projection))
              const sideAP = point.subtract(vertexA)
              const distanceSquared = sideAP.getSqMag()
              if (distanceSquared < 1 && contactPoints.length < 2) {
                if (contactPoints.length === 1) {
                  if (contactPoints[0].subtract(point).getSqMag() > 0.01)
                    contactPoints.push(point)
                } else contactPoints.push(point)
              }
            })
          })
        })
        if (contactPoints.length === 0)
          contactPoints.push(baseA.hitbox.closestPointToCentroidOf(baseB))
      } else if (
        collisionType === "Polygon-Circle" ||
        collisionType === "Circle-Polygon"
      ) {
        let circleBase, otherBase
        if (baseA.hitbox.type === "Circle")
          [circleBase, otherBase] = [baseA, baseB]
        else[circleBase, otherBase] = [baseB, baseA]
        contactPoints.push(
          otherBase.hitbox.closestPointToCentroidOf(circleBase),
        )
      } else if (collisionType === "Circle-Circle") {
        const centroidAToCentroidB = baseB.position
          .subtract(baseA.position)
          .normalize()
        contactPoints.push(
          baseA.position.add(centroidAToCentroidB.scale(baseA.hitbox.radius)),
        )
      }

      for (const point of contactPoints) {
        pushMatrix()
        translate(canvasHalfWidth + point.x, canvasHalfHeight + point.y)
        ellipse(0, 0, 5, 5)
        popMatrix()
      }
      if (!collisionImpulse) return

      for (const contactPoint of contactPoints) {
        const vectorAC = contactPoint.subtract(baseA.position)
        const vectorBC = contactPoint.subtract(baseB.position)
        const contactVelocityA = baseA.velocity.add(
          vectorAC.perpendicular().scale(baseA.omega),
        )
        const contactVelocityB = baseB.velocity.add(
          vectorBC.perpendicular().scale(baseB.omega),
        )

        const velocityAB = contactVelocityB.subtract(contactVelocityA)

        const inertiaA = baseA.hitbox.momentOfInertia
        const inertiaB = baseB.hitbox.momentOfInertia
        const impulseScalar =
          velocityAB.scale(-1 - restitution).dotProduct(axis) /
          (axis.dotProduct(axis.scale(1 / massA + 1 / massB)) +
            sq(vectorAC.crossProduct(axis)) / inertiaA +
            sq(vectorBC.crossProduct(axis)) / inertiaB)

        baseA.velocity = baseA.velocity.subtract(
          axis.scale(impulseScalar / massA),
        )
        baseA.omega += (vectorAC.crossProduct(axis) * impulseScalar) / inertiaA

        baseB.velocity = baseB.velocity.add(axis.scale(impulseScalar / massB))
        baseB.omega -= (vectorBC.crossProduct(axis) * impulseScalar) / inertiaB
      }
    }
  }

  let boxes: Base[] = []
  for (let i = 0; i < insertCount; i++) {
    let shape =
      (ceil(random(0, 5)) > 3 && !allCircles) || allPolys
        ? new Polygon(
          regularPolyVerts(
            0,
            0,
            ceil(scale * random(1 - scaleVariance, 1 + scaleVariance)),
            ceil(random(2, 7)),
          ),
          new Color([255, 0, 0]),
        )
        : new Circle(
          new Vector(0, 0),
          ceil(scale * random(0.9, 1.1)),
          new Color([255, 0, 0]),
        )
    if (random(0, 5) > 4) {
      let hWidth =
        scale * random(1 - scaleVariance, 1 + scaleVariance) * random(2, 4)
      let hHeight = scale * random(1 - scaleVariance, 1 + scaleVariance) * 0.5
      shape = new Polygon(
        polyVerts(
          -hWidth,
          -hHeight,
          hWidth,
          -hHeight,
          hWidth,
          hHeight,
          -hWidth,
          hHeight,
        ),
        new Color([255, 0, 0]),
      )
    }
    boxes.push(
      new Base(
        new Vector(
          random(-canvasHalfWidth, canvasHalfWidth),
          random(-canvasHalfHeight, canvasHalfHeight),
        ),
        random(0, 2 * PI),
        shape,
      ),
    )
  }
  if (insertCount === 0)
    boxes.push(
      new Base(
        new Vector(-100, 0),
        0,
        new Circle(new Vector(0, 0), 20, new Color([255, 0, 0])),
        new Vector(1, 0),
      ),
      new Base(
        new Vector(100, 0),
        0,
        new Circle(new Vector(0, 0), 100, new Color([255, 0, 0])),
      ),
      new Base(
        new Vector(0, -100),
        0,
        new Circle(new Vector(0, 0), 35, new Color([255, 0, 0])),
      ),
      new Base(
        new Vector(0, 100),
        1.5,
        new Polygon(regularPolyVerts(0, 0, 35, 5), new Color([255, 0, 0])),
      ),
      new Base(
        new Vector(0, 200),
        1.2,
        new Polygon(
          polyVerts(-25, -50, 25, -50, 25, 50, -25, 50),
          new Color([255, 0, 0]),
        ),
      ),
    )

  const displayPeriod = 60
  class Performance {
    metrics: Record<string, any>
    ticks: number
    constructor() {
      this.metrics = {}
      this.ticks = 0
    }
    getTime() {
      const result = performance.now() - this.ticks
      this.ticks = performance.now()
      return result
    }
    updateMetric(key: string) {
      if (this.metrics[key] === undefined) {
        this.metrics[key] = {}
        this.metrics[key].buffer = []
      }
      let metric = this.metrics[key]
      metric.buffer[0] += this.getTime()
    }
    getMetricData(key: string): {
      min: number
      max: number
      average: number
      percentage: number
    } {
      let buffer = this.metrics[key].buffer

      const average =
        buffer.reduce((acc: number, time: number) => acc + time) / buffer.length

      let percentage = 100
      if (key !== "total")
        percentage = (average / this.metrics.total.savedData.average) * 100

      return {
        min: min(buffer),
        max: max(buffer),
        average: average,
        percentage: percentage,
      }
    }
    // for next frame
    resetMetrics() {
      for (const key in this.metrics) {
        const metric = this.metrics[key]
        if (metric.buffer.unshift(0) > displayPeriod) {
          metric.buffer.pop()
        }
      }
    }
    getTotal() {
      let sum = 0
      for (const key in this.metrics) {
        if (key === "total") {
          continue
        }
        sum += this.metrics[key].buffer[0]
      }
      if (this.metrics.total === undefined) {
        this.metrics.total = {}
        this.metrics.total.buffer = []
      }
      const total = this.metrics.total
      total.buffer[0] = sum
    }
  }

  const Perf = new Performance()

  let focus = 0
  let ticksSinceInput = 0

  let ticks = 0
  let lastFrame = millis()
  let collisions = []

  const font = createFont("sans-serif")
  const fontBold = createFont("sans-serif Bold")

  for (const client of boxes) {
    client.getInput()
    world.newClient(client)
  }

  const collisionSet = new Set()
  let KE = 0
  function draw() {
    KE = 0
    lastFrame = millis()
    Perf.resetMetrics()
    collisionSet.clear()
    collisions = []
    cellsChecked = 0
    ticksSinceInput++
    background(255)
    fill(255, 0, 0)
    world.draw()

    Perf.getTime()

    if (keys[32] && ticksSinceInput >= 30) {
      focus = (focus + 1) % boxes.length
      ticksSinceInput = 0
    }
    for (const box of boxes) {
      KE +=
        (box.hitbox.mass * box.velocity.getSqMag()) / 2 +
        (box.hitbox.momentOfInertia * sq(box.omega)) / 2
      box.update()
      Perf.updateMetric("boxUpdate")
      if (focus === box.id) box.getInput()
      box.hitbox.shallowUpdate(box)
      Perf.updateMetric("aabbUpdate")
      world.update(box)
      Perf.updateMetric("gridUpdate")
    }

    // check collisions
    let collisionChecks = 0
    for (const box of boxes) {
      const aabb = box.hitbox.aabb
      Perf.getTime()
      const clients = world.queryGrid(
        box.position.add(aabb.centroid),
        aabb.width,
        aabb.height,
      )
      Perf.updateMetric("gridQuery")

      for (const client of clients) {
        // skip duplicate collision check with self
        if (client.id === box.id) continue
        // skip duplicate collision checks
        const formattedCollision =
          box.id < client.id
            ? box.id + "," + client.id
            : client.id + "," + box.id
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
        box.hitbox.narrowUpdate(box)
        client.hitbox.narrowUpdate(client)
        Perf.updateMetric("hitboxUpdate")

        const collision = box.checkCollision(client)
        Perf.updateMetric("satCheck")
        collisionChecks++
        if (collision.colliding) collisions.push(collision)
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
      stroke(46)
      if (sameColor) fill(255, 120, 120)
      if (drawAsCircles) {
        if (!sameColor) fill(box.shape.color.cachedValue)
        const diameter = box.hitbox.aabb.width
        ellipse(
          box.position.x + box.hitbox.centroid.x + canvasHalfWidth,
          box.position.y + box.hitbox.centroid.y + canvasHalfHeight,
          diameter,
          diameter,
        )
      } else box.draw()
      fill(211, 175, 55)
      ellipse(
        box.position.x + box.hitbox.centroid.x + canvasHalfWidth,
        box.position.y + box.hitbox.centroid.y + canvasHalfHeight,
        5,
        5,
      )
    }
    Perf.updateMetric("drawBoxes")

    // handle collisions
    for (const collision of collisions) {
      if (collision.baseA === undefined) continue
      collision.baseA.handleCollision(collision)
    }
    Perf.updateMetric("handleCollisions")

    Perf.getTotal()

    const totalCells =
      (canvasHalfWidth * 2 * (canvasHalfHeight * 2)) / gridSize ** 2
    const countMetrics = [
      "Cells Filled",
      world.grid.size + " / " + totalCells,
      "Cells Checked",
      cellsChecked + " / " + totalCells,
      "SAT Calls",
      collisionChecks,
      "Object Count",
      boxes.length,
      "Collision Count",
      collisions.length,
      "Kinetic Energy",
      KE.toFixed(3),
    ]

    textAlign(LEFT, TOP)
    textFont(fontBold, 24)

    const dataToDisplay = ["average", "max", "percentage"]
    const margin = 4
    const padding = 8

    const dataWidth = 140
    const keyWidth = 210
    const columnGap = 16

    const rowHeight = textAscent() * 2
    const initialRowGap = 16
    const rowGap = 0
    const start = margin + padding

    const metricDisplayWidth =
      padding +
      keyWidth +
      dataToDisplay.length * (dataWidth + columnGap) +
      padding
    fill(0, 0, 0, 120)
    pushMatrix()
    const metricCount = Object.keys(Perf.metrics).length
    rect(
      margin,
      margin,
      metricDisplayWidth,
      padding +
      (metricCount + 1) * rowHeight +
      metricCount * rowGap +
      initialRowGap +
      padding,
    )
    fill(255, 255, 255)

    if (ticks % displayPeriod === 0) {
      const totalData = Perf.getMetricData("total")
      Perf.metrics.total.savedData = Object.assign({}, totalData)
      for (const key in Perf.metrics) {
        const metricData = Perf.getMetricData(key)
        Perf.metrics[key].savedData = Object.assign({}, metricData)
      }
    }

    let dx, dy
    dy = dx = start
    text("Key", dx, dy)
    dx += keyWidth + columnGap
    for (const dataKey of dataToDisplay) {
      text(dataKey[0].toUpperCase() + dataKey.slice(1), dx, dy)
      dx += dataWidth + columnGap
    }

    fill(255, 255, 255)
    noStroke()
    rect(
      start,
      start + rowHeight,
      dataToDisplay.length * (dataWidth + columnGap) + keyWidth,
      3,
    )

    textFont(font, 24)
    dx = start + keyWidth + columnGap
    dy += rowHeight + initialRowGap

    let i = 0
    for (const key in Perf.metrics) {
      let ddx = dx
      const metric = Perf.metrics[key].savedData

      if (i % 2 === 0) {
        fill(0, 0, 0, 50)
        rect(margin, dy, metricDisplayWidth, rowHeight)
        fill(255)
      }

      let formattedKey = []
      for (let i = 0; i < key.length; i++) {
        const character = key[i]
        if (i === 0) {
          formattedKey.push(character.toUpperCase())
          continue
        }
        if (character.toUpperCase() === character)
          formattedKey.push(" ", character)
        else formattedKey.push(character)
      }

      text(`${formattedKey.join("")}:`, start, dy)

      for (const dataKey of dataToDisplay) {
        let data = metric[dataKey]
        const unit = dataKey === "percentage" ? "%" : "ms"
        data = isNaN(data)
          ? displayPeriod - ticks / dt
          : `${data.toFixed(3)} ${unit}`

        text(data, ddx, dy)
        ddx += dataWidth + columnGap
      }

      dy += rowHeight + rowGap
      i++
    }

    fill(0, 0, 0, 120)
    stroke(0)
    const counterDisplayHeight =
      padding + (countMetrics.length / 2) * (rowHeight + rowGap) + padding
    const counterDisplayWidth =
      padding + keyWidth + columnGap + dataWidth + padding
    rect(
      margin,
      height - margin - counterDisplayHeight,
      counterDisplayWidth,
      counterDisplayHeight,
    )
    fill(255)
    dy = height - margin - counterDisplayHeight + padding
    for (let i = 0; i < countMetrics.length; i += 2) {
      if (i % 4 === 0) {
        fill(0, 0, 0, 50)
        rect(margin, dy, counterDisplayWidth, rowHeight)
        fill(255)
      }
      text(countMetrics[i] + ":", start, dy)
      text(countMetrics[i + 1], start + keyWidth + columnGap, dy)
      dy += rowHeight + rowGap
    }
    popMatrix()

    ticks += dt
  }
}

runPJS(program)

