import { ctx, width, height, bg, nill, layr } from "../Globals/init.js"
import { camelToTitle } from "./math.js"
import { UIContainer, UIText } from "./ui.js"
export const displayPeriod = 60

export type Metric = {
  buffer: number[]
  max: number
  average: number
  percentage: number
  count: number
}
export class PerformanceProfile {
  metrics: Record<string, Metric>
  ticks: number
  constructor(...metrics: string[]) {
    this.metrics = {}
    metrics.forEach(
      (metric) =>
        (this.metrics[metric] = {
          buffer: [],

          count: 0,
          max: 0,
          average: 0,
          percentage: 0,
        })
    )
    this.metrics.total = { buffer: [], count: 0, max: 0, average: 0, percentage: 0 }
    this.ticks = 0
  }
  getTime() {
    const result = performance.now() - this.ticks
    this.ticks = performance.now()
    return result
  }
  updateMetric(key: string) {
    if (key in this.metrics) {
      let metric = this.metrics[key]
      metric.buffer[0] += this.getTime()
      metric.count++
    } else {
      this.metrics[key] = { buffer: [], count: 0, max: 0, average: 0, percentage: 0 }
      this.metrics[key].buffer[0] += this.getTime()
    }
  }
  getMetricData(key: string): Metric {
    let buffer = this.metrics[key].buffer
    const average = buffer.reduce((acc: number, time: number) => acc + time) / buffer.length
    let percentage = (average / this.metrics.total.average) * 100
    return {
      buffer: buffer,
      count: this.metrics[key].count,
      max: Math.max(...buffer),
      average: average,
      percentage: percentage,
    }
  }
  updateMetrics() {
    for (const key in this.metrics) {
      const metricData = this.getMetricData(key)
      this.metrics[key] = Object.assign({}, metricData)
    }
  }
  // for next frame
  resetMetrics() {
    for (const key in this.metrics) {
      const metric = this.metrics[key]
      if (metric.buffer.unshift(0) > displayPeriod) {
        metric.buffer.pop()
      }
      metric.count = 0
    }
    this.ticks++
  }
  getTotal() {
    let sum = 0
    for (const key in this.metrics) {
      if (key === "total") {
        continue
      }
      sum += this.metrics[key].buffer[0]
    }
    const total = this.metrics.total
    total.buffer[0] = sum
  }
  draw() {
    ctx.save()
    ctx.resetTransform()

    const count = new UIContainer(
      Object.keys(this.metrics).map(
        (s, i) =>
          new UIContainer([new UIText(camelToTitle(s))], {
            fill: i % 2 ? nill : layr,
            width: 234,
          })
      ),
      { fill: bg, padding: 0, gap: 0 }
    )

    const defaults = { width: 140 }
    const metric = new UIContainer(
      Object.values(this.metrics).map(
        (s, i) =>
          new UIContainer(
            [
              new UIText(s.average.toFixed(3) + "ms", defaults),
              new UIText(s.max.toFixed(3) + "ms", defaults),
              new UIText(s.percentage.toFixed(3) + "%", defaults),
            ],
            {
              direction: "row",
              gap: 16,
              fill: i % 2 ? nill : layr,
            }
          )
      ),
      { fill: bg, padding: 0, gap: 0 }
    )
    const full = new UIContainer(
      [
        new UIContainer(
          [
            new UIContainer([new UIText("Key")], { width: count.width }),
            new UIContainer(
              [
                new UIText("Average", defaults),
                new UIText("Maximum", defaults),
                new UIText("Percentage", defaults),
              ],
              { direction: "row", gap: 16 }
            ),
          ],
          { padding: 0, direction: "row", gap: 0, fill: bg }
        ),
        new UIContainer([count, metric], { direction: "row", padding: 0, gap: 0 }),
      ],
      { padding: 0, gap: 0 }
    )
    full.draw(-width / 2 + 8, -height / 2 + 8)
    ctx.restore()
  }
}
