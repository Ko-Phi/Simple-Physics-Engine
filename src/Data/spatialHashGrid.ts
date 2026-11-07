import { displayGridCheck } from "./world.js"
import { Draw } from "../Utils/drawing.js"
import { Collidable } from "./collisions.js"
import { Vector, rgba } from "../Utils/math.js"

export class SpatialHashGrid {
  cellsChecked
  grid: Map<string, any>
  dimensions: Vector
  cellSize: number
  queryIds: number
  drawer: Draw
  constructor(cellSize: number, dimensions: Vector, draw: Draw) {
    this.grid = new Map()
    this.dimensions = dimensions
    this.cellSize = cellSize
    this.queryIds = 0
    this.cellsChecked = 0
    this.drawer = draw
  }
  key = (x: number, y: number): string => x + "," + y
  getIndex = (x: number, y: number): Vector =>
    new Vector(...([x, y].map((c) => Math.floor(c / this.cellSize)) as [number, number]))
  newClient<Type extends Collidable>(client: Type) {
    client.indices = []
    this.insert(client)
    this.queryIds = -1
    return client
  }
  insert<Type extends Collidable>(client: Type) {
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
    if (displayGridCheck)
      this.drawer.ctx.setTransform(1, 0, 0, 1, this.dimensions.x / 2, this.dimensions.y / 2)
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
          this.drawer.rect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize,
            rgba(100, 15)
          )
        this.cellsChecked++
      }
    }
    return clients
  }
  remove<Type extends Collidable>(client: Type) {
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
  update<Type extends Collidable>(client: Type) {
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
    this.drawer.ctx.setTransform(1, 0, 0, 1, this.dimensions.x / 2, this.dimensions.y / 2)
    for (
      let x = Math.ceil(-this.dimensions.x / this.cellSize) * this.cellSize;
      x <= this.dimensions.x / 2;
      x += this.cellSize
    )
      this.drawer.line(x, this.dimensions.y, x, -this.dimensions.y, 1, rgba(204))
    for (
      let y = Math.ceil(-this.dimensions.y / this.cellSize) * this.cellSize;
      y <= this.dimensions.y / 2;
      y += this.cellSize
    )
      this.drawer.line(this.dimensions.x, y, -this.dimensions.x, y, 1, rgba(204))
  }
}
