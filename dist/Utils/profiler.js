import { draw, ctx } from "../Data/world.js";
import { rgba } from "./math.js";
export const displayPeriod = 60;
export class PerformanceProfile {
    metrics;
    ticks;
    constructor(...metrics) {
        this.metrics = {};
        metrics.forEach((metric) => (this.metrics[metric] = {
            buffer: [],
            count: 0,
            max: 0,
            average: 0,
            percentage: 0,
        }));
        this.metrics.total = { buffer: [], count: 0, max: 0, average: 0, percentage: 0 };
        this.ticks = 0;
    }
    getTime() {
        const result = performance.now() - this.ticks;
        this.ticks = performance.now();
        return result;
    }
    updateMetric(key) {
        if (key in this.metrics) {
            let metric = this.metrics[key];
            metric.buffer[0] += this.getTime();
            metric.count++;
        }
        else {
            this.metrics[key] = { buffer: [], count: 0, max: 0, average: 0, percentage: 0 };
            this.metrics[key].buffer[0] += this.getTime();
        }
    }
    getMetricData(key) {
        let buffer = this.metrics[key].buffer;
        const average = buffer.reduce((acc, time) => acc + time) / buffer.length;
        let percentage = (average / this.metrics.total.average) * 100;
        return {
            buffer: buffer,
            count: this.metrics[key].count,
            max: Math.max(...buffer),
            average: average,
            percentage: percentage,
        };
    }
    updateMetrics() {
        for (const key in this.metrics) {
            const metricData = this.getMetricData(key);
            this.metrics[key] = Object.assign({}, metricData);
        }
    }
    // for next frame
    resetMetrics() {
        for (const key in this.metrics) {
            const metric = this.metrics[key];
            if (metric.buffer.unshift(0) > displayPeriod) {
                metric.buffer.pop();
            }
            metric.count = 0;
        }
        this.ticks++;
    }
    getTotal() {
        let sum = 0;
        for (const key in this.metrics) {
            if (key === "total") {
                continue;
            }
            sum += this.metrics[key].buffer[0];
        }
        const total = this.metrics.total;
        total.buffer[0] = sum;
    }
    draw(dataToDisplay, dt) {
        ctx.save();
        ctx.resetTransform();
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
        const metricCount = Object.keys(this.metrics).length;
        draw.rect(margin, margin, metricDisplayWidth, padding + (metricCount + 1) * rowHeight + metricCount * rowGap + initialRowGap + padding, rgba(0, 120));
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
        for (const key in this.metrics) {
            let ddx = dx;
            const metric = this.metrics[key];
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
                const data = metric[dataKey];
                const unit = dataKey === "percentage" ? "%" : "ms";
                const text = isNaN(data)
                    ? displayPeriod - this.ticks / dt + ""
                    : `${data.toFixed(3)} ${unit}`;
                draw.text(text, ddx, dy);
                ddx += dataWidth + columnGap;
            }
            dy += rowHeight + rowGap;
            i++;
        }
        ctx.restore();
    }
}
