import { cam, displayGridCheck } from "../../Data/world.js";
import { Vector, rgba } from "../../Utils/math.js";
export class SpatialHashGrid {
    cellsChecked;
    grid;
    dimensions;
    cellSize;
    queryIds;
    drawer;
    constructor(cellSize, dimensions, draw) {
        this.grid = new Map();
        this.dimensions = dimensions;
        this.cellSize = cellSize;
        this.queryIds = 0;
        this.cellsChecked = 0;
        this.drawer = draw;
    }
    key = (x, y) => x + "," + y;
    getIndex = (x, y) => new Vector(...[x, y].map((c) => Math.floor(c / this.cellSize)));
    newClient(client) {
        client.indices = [];
        this.insert(client);
        this.queryIds = -1;
        return client;
    }
    insert(client) {
        const x = client.position.x + client.hitbox.aabb.centroid.x;
        const y = client.position.y + client.hitbox.aabb.centroid.y;
        const w = client.hitbox.aabb.width;
        const h = client.hitbox.aabb.height;
        // get the client's span
        const i1 = this.getIndex(x - w / 2, y - h / 2);
        const i2 = this.getIndex(x + w / 2, y + h / 2);
        client.indices = [i1, i2];
        // iterate over span, adding client to each cell
        for (let x = i1.x; x <= i2.x; ++x) {
            for (let y = i1.y; y <= i2.y; ++y) {
                const key = this.key(x, y);
                if (!this.grid.has(key))
                    this.grid.set(key, new Set());
                this.grid.get(key).add(client);
            }
        }
    }
    queryGrid(position, w, h) {
        const [x, y] = [position.x, position.y];
        // get span of checked area
        const i1 = this.getIndex(x - w / 2, y - h / 2);
        const i2 = this.getIndex(x + w / 2, y + h / 2);
        // iterate over spanned area for clients
        if (displayGridCheck) {
            this.drawer.ctx.setTransform(1, 0, 0, 1, this.dimensions.x / 2 - cam.position.x, this.dimensions.y / 2 - cam.position.y);
            this.drawer.rect(...[i1.x, i1.y, i2.x - i1.x + 1, i2.y - i1.y + 1].map((n) => n * this.cellSize), rgba(100, 30));
        }
        let clients = [];
        const queryId = this.queryIds++;
        for (let x = i1.x; x <= i2.x; ++x) {
            for (let y = i1.y; y <= i2.y; ++y) {
                let key = this.key(x, y);
                if (!this.grid.has(key))
                    continue;
                for (const client of this.grid.get(key)) {
                    if (client.queryId !== queryId) {
                        client.queryId = queryId;
                        clients.push(client);
                    }
                }
                this.cellsChecked++;
            }
        }
        return clients;
    }
    remove(client) {
        const i1 = client.indices[0];
        const i2 = client.indices[1];
        // iterate over client's span, removing it from each cell
        for (let x = i1.x; x <= i2.x; ++x) {
            for (let y = i1.y; y <= i2.y; ++y) {
                const key = this.key(x, y);
                const cell = this.grid.get(key);
                cell.delete(client);
                if (cell.size === 0)
                    this.grid.delete(key);
            }
        }
    }
    update(client) {
        const x = client.position.x + client.hitbox.aabb.centroid.x;
        const y = client.position.y + client.hitbox.aabb.centroid.y;
        const w = client.hitbox.aabb.width;
        const h = client.hitbox.aabb.height;
        // get the client's span
        const i1 = this.getIndex(x - w / 2, y - h / 2);
        const i2 = this.getIndex(x + w / 2, y + h / 2);
        // check for change in grid position
        if (!i1.equalTo(client.indices[0]) || !i2.equalTo(client.indices[1])) {
            this.remove(client);
            this.insert(client);
        }
    }
    draw() {
        this.drawer.ctx.setTransform(1, 0, 0, 1, this.dimensions.x / 2 - (cam.position.x % this.cellSize), this.dimensions.y / 2 - (cam.position.y % this.cellSize));
        for (let x = Math.ceil(-this.dimensions.x / this.cellSize) * this.cellSize; x <= this.dimensions.x / 2; x += this.cellSize)
            this.drawer.line(x, this.dimensions.y, x, -this.dimensions.y, 2, rgba(204));
        for (let y = Math.ceil(-this.dimensions.y / this.cellSize) * this.cellSize; y <= this.dimensions.y / 2; y += this.cellSize)
            this.drawer.line(this.dimensions.x, y, -this.dimensions.x, y, 2, rgba(204));
    }
}
