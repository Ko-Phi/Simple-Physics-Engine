import { sq, random, rgba } from "./Utils/math.js";
import { Vector } from "./Data/vector.js";
import { Color } from "./Data/color.js";
import { canvas, draw, ctx, outline, width, height, halfHeight, halfWidth } from "./Data/world.js";
import * as Settings from "./Data/world.js";
import { SpatialHashGrid } from "./Data/spatialHashGrid.js";
const world = new SpatialHashGrid(Settings.gridSize, new Vector(width, height), draw);
import { Polygon, Circle, regularPolyVerts, polyVerts } from "./Data/shape.js";
import { Base } from "./Data/base.js";
let boxes = [];
for (let i = 0; i < Settings.insertCount; i++) {
    let shape = (Math.ceil(random(0, 5)) > 3 && !Settings.allCircles) || Settings.allPolys
        ? new Polygon(regularPolyVerts(0, 0, Math.ceil(Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance)), Math.ceil(random(2, 7))), new Color([255, 0, 0]))
        : new Circle(Math.ceil(Settings.scale * random(0.9, 1.1)), new Color([255, 0, 0]));
    if (random(0, 5) > 4) {
        let hWidth = Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * random(2, 4);
        let hHeight = Settings.scale * random(1 - Settings.scaleVariance, 1 + Settings.scaleVariance) * 0.5;
        shape = new Polygon(polyVerts(-hWidth, -hHeight, hWidth, -hHeight, hWidth, hHeight, -hWidth, hHeight), new Color([255, 0, 0]));
    }
    boxes.push(new Base(new Vector(random(-halfWidth, halfWidth), random(-halfHeight, halfHeight)), random(0, 2 * Math.PI), shape));
}
if (Settings.insertCount === 0)
    boxes.push(new Base(new Vector(-100, 0), 0, new Circle(20, new Color([255, 0, 0])), new Vector(1, 0)), new Base(new Vector(100, 0), 0, new Circle(100, new Color([255, 0, 0]))), new Base(new Vector(0, -100), 0, new Circle(35, new Color([255, 0, 0]))), new Base(new Vector(0, 100), 1.5, new Polygon(regularPolyVerts(0, 0, 35, 5), new Color([255, 0, 0]))), new Base(new Vector(0, 200), 1.2, new Polygon(polyVerts(-25, -50, 25, -50, 25, 50, -25, 50), new Color([255, 0, 0]))));
const displayPeriod = 60;
class PerformanceProfile {
    metrics;
    ticks;
    constructor() {
        this.metrics = {};
        this.ticks = 0;
    }
    getTime() {
        const result = performance.now() - this.ticks;
        this.ticks = performance.now();
        return result;
    }
    updateMetric(key) {
        if (this.metrics[key] === undefined) {
            this.metrics[key] = {};
            this.metrics[key].buffer = [];
        }
        let metric = this.metrics[key];
        metric.buffer[0] += this.getTime();
    }
    getMetricData(key) {
        let buffer = this.metrics[key].buffer;
        const average = buffer.reduce((acc, time) => acc + time) / buffer.length;
        let percentage = 100;
        if (key !== "total")
            percentage = (average / this.metrics.total.savedData.average) * 100;
        return {
            min: Math.min(...buffer),
            max: Math.max(...buffer),
            average: average,
            percentage: percentage,
        };
    }
    // for next frame
    resetMetrics() {
        for (const key in this.metrics) {
            const metric = this.metrics[key];
            if (metric.buffer.unshift(0) > displayPeriod) {
                metric.buffer.pop();
            }
        }
    }
    getTotal() {
        let sum = 0;
        for (const key in this.metrics) {
            if (key === "total") {
                continue;
            }
            sum += this.metrics[key].buffer[0];
        }
        if (this.metrics.total === undefined) {
            this.metrics.total = {};
            this.metrics.total.buffer = [];
        }
        const total = this.metrics.total;
        total.buffer[0] = sum;
    }
}
const Perf = new PerformanceProfile();
let ticksSinceInput = 0;
let ticks = 0;
let collisions = [];
// const font = createFont("sans-serif")
// const fontBold = createFont("sans-serif Bold")
for (const client of boxes) {
    client.getInput();
    world.newClient(client);
}
const collisionSet = new Set();
let KE = 0;
let lastTime = 0;
function drawLoop(timestamp) {
    if (ctx === null)
        throw "e";
    ctx.resetTransform();
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    if (isNaN(dt))
        dt = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    KE = 0;
    Perf.resetMetrics();
    collisionSet.clear();
    collisions = [];
    world.cellsChecked = 0;
    ticksSinceInput++;
    //background(255)
    draw.rect(0, 0, width, height, "#ffffff");
    world.draw();
    Perf.getTime();
    for (const box of boxes) {
        KE +=
            (box.hitbox.mass * box.velocity.getSqMag()) / 2 +
                (box.hitbox.momentOfInertia * sq(box.omega)) / 2;
        box.update(dt);
        Perf.updateMetric("boxUpdate");
        box.hitbox.shallowUpdate(box.position, box.dir);
        Perf.updateMetric("aabbUpdate");
        world.update(box);
        Perf.updateMetric("gridUpdate");
    }
    // check collisions
    let collisionChecks = 0;
    for (const box of boxes) {
        const aabb = box.hitbox.aabb;
        Perf.getTime();
        const clients = world.queryGrid(box.position.add(aabb.centroid), aabb.width, aabb.height);
        Perf.updateMetric("gridQuery");
        for (const client of clients) {
            // skip duplicate collision check with self
            if (client.id === box.id)
                continue;
            // skip duplicate collision checks
            const formattedCollision = box.id < client.id ? box.id + "," + client.id : client.id + "," + box.id;
            if (collisionSet.has(formattedCollision))
                continue;
            collisionSet.add(formattedCollision);
            // quick radii check
            const sqDistance = box.hitbox.centroid
                .add(box.position)
                .subtract(client.hitbox.centroid.add(client.position))
                .getSqMag();
            const radiiSum = box.hitbox.radius + client.hitbox.radius;
            if (sqDistance > sq(radiiSum))
                continue;
            Perf.updateMetric("priorCheck");
            // narrow update before full check
            box.hitbox.narrowUpdate(box.position, box.dir);
            client.hitbox.narrowUpdate(client.position, client.dir);
            Perf.updateMetric("hitboxUpdate");
            const collision = box.checkCollision(client);
            Perf.updateMetric("satCheck");
            collisionChecks++;
            if (collision.colliding)
                collisions.push(collision);
        }
    }
    if (ticks === 0) {
        Perf.getTime();
        Perf.updateMetric("priorCheck");
        Perf.updateMetric("hitboxUpdate");
        Perf.updateMetric("satCheck");
    }
    // draw them boxes
    for (const box of boxes) {
        ctx.setTransform(1, 0, 0, 1, halfWidth, halfHeight);
        if (Settings.drawAsCircles) {
            const diameter = box.hitbox.aabb.width;
            draw.ellipse(box.position.x + box.hitbox.centroid.x, box.position.y + box.hitbox.centroid.y, diameter, diameter, box.shape.color.cachedValue, 1, outline);
        }
        else
            box.draw();
        ctx.setTransform(1, 0, 0, 1, halfWidth, halfHeight);
        ctx.setTransform(1, 0, 0, 1, halfWidth, halfHeight);
        draw.ellipse(box.position.x + box.hitbox.centroid.x, box.position.y + box.hitbox.centroid.y, 5, 5, rgba(211, 175, 55), 1, outline);
    }
    Perf.updateMetric("drawBoxes");
    // handle collisions
    for (const collision of collisions) {
        if (collision.baseA === undefined)
            continue;
        collision.baseA.handleCollision(collision);
    }
    Perf.updateMetric("handleCollisions");
    Perf.getTotal();
    const totalCells = (halfWidth * 2 * (halfHeight * 2)) / Settings.gridSize ** 2;
    const countMetrics = [
        "Cells Filled",
        world.grid.size + " / " + totalCells,
        "Cells Checked",
        world.cellsChecked + " / " + totalCells,
        "SAT Calls",
        collisionChecks,
        "Object Count",
        boxes.length,
        "Collision Count",
        collisions.length,
        "Kinetic Energy",
        KE.toFixed(3),
    ];
    // textAlign(LEFT, TOP)
    // textFont(fontBold, 24)
    ctx.font = "bold 24px Arial";
    const dataToDisplay = ["average", "max", "percentage"];
    const margin = 4;
    const padding = 8;
    const dataWidth = 140;
    const keyWidth = 210;
    const columnGap = 16;
    //const rowHeight = textAscent() * 2
    const rowHeight = 15 * 2;
    const initialRowGap = 16;
    const rowGap = 0;
    const start = margin + padding;
    const metricDisplayWidth = padding + keyWidth + dataToDisplay.length * (dataWidth + columnGap) + padding;
    ctx.resetTransform();
    const metricCount = Object.keys(Perf.metrics).length;
    draw.rect(margin, margin, metricDisplayWidth, padding + (metricCount + 1) * rowHeight + metricCount * rowGap + initialRowGap + padding, rgba(0, 120));
    if (ticks % displayPeriod === 0) {
        const totalData = Perf.getMetricData("total");
        Perf.metrics.total.savedData = Object.assign({}, totalData);
        for (const key in Perf.metrics) {
            const metricData = Perf.getMetricData(key);
            Perf.metrics[key].savedData = Object.assign({}, metricData);
        }
    }
    let dx, dy;
    dy = dx = start;
    draw.text("Key", dx, dy);
    dx += keyWidth + columnGap;
    for (const dataKey of dataToDisplay) {
        draw.text(dataKey[0].toUpperCase() + dataKey.slice(1), dx, dy);
        dx += dataWidth + columnGap;
    }
    draw.rect(start, start + rowHeight, dataToDisplay.length * (dataWidth + columnGap) + keyWidth, 3, rgba(0, 120));
    //textFont(font, 24)
    ctx.font = "normal 24px Arial";
    dx = start + keyWidth + columnGap;
    dy += rowHeight + initialRowGap;
    let i = 0;
    for (const key in Perf.metrics) {
        let ddx = dx;
        const metric = Perf.metrics[key].savedData;
        if (i % 2 === 0)
            draw.rect(margin, dy, metricDisplayWidth, rowHeight, rgba(0, 50));
        let formattedKey = [];
        for (let i = 0; i < key.length; i++) {
            const character = key[i];
            if (i === 0) {
                formattedKey.push(character.toUpperCase());
                continue;
            }
            if (character.toUpperCase() === character)
                formattedKey.push(" ", character);
            else
                formattedKey.push(character);
        }
        draw.text(`${formattedKey.join("")}:`, start, dy);
        for (const dataKey of dataToDisplay) {
            let data = metric[dataKey];
            const unit = dataKey === "percentage" ? "%" : "ms";
            data = isNaN(data) ? displayPeriod - ticks / dt : `${data.toFixed(3)} ${unit}`;
            draw.text(data, ddx, dy);
            ddx += dataWidth + columnGap;
        }
        dy += rowHeight + rowGap;
        i++;
    }
    const counterDisplayHeight = padding + (countMetrics.length / 2) * (rowHeight + rowGap) + padding;
    const counterDisplayWidth = padding + keyWidth + columnGap + dataWidth + padding;
    draw.rect(margin, height - margin - counterDisplayHeight, counterDisplayWidth, counterDisplayHeight, rgba(0, 120));
    dy = height - margin - counterDisplayHeight + padding;
    for (let i = 0; i < countMetrics.length; i += 2) {
        if (i % 4 === 0)
            draw.rect(margin, dy, counterDisplayWidth, rowHeight, rgba(0, 0, 0, 50));
        draw.text(countMetrics[i] + ":", start, dy);
        draw.text(countMetrics[i + 1] + "", start + keyWidth + columnGap, dy);
        dy += rowHeight + rowGap;
    }
    ticks += 1;
    requestAnimationFrame(drawLoop);
}
requestAnimationFrame(drawLoop);
