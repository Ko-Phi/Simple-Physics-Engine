declare function title(text: string | number): void
declare function size(width: number, height: number): void
declare function frameRate(fps: number): void
declare function color(c1: number, c2?: number, c3?: number, alpha?: number): number
declare function background(c1: number, c2?: number, c3?: number, alpha?: number): any
declare function noFill(): void
declare function fill(c1: number | object, c2?: number, c3?: number, alpha?: number): any
declare function noStroke(): void
declare function stroke(c1: number | object, c2?: number, c3?: number, alpha?: number): any
declare function millis(): number
declare function createFont(font: string): object
declare function textFont(font: object, size: number): void
declare function textAlign(x: number, y: number): void
declare function textAscent(): number
declare function runPJS(program: object): void

declare function line(x1: number, y1: number, x2: number, y2: number): void
declare function text(text: string | number, x: number, y: number): void
declare function triangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
): void
declare function rect(x: number, y: number, width: number, height: number): void
declare function ellipse(x: number, y: number, radius1: number, radius2: number): void
declare function beginShape(): void
declare function vertex(x: number, y: number): void
declare const CLOSE: number
declare function endShape(type: number): void

declare const width: number
declare const height: number
declare let angleMode: string
declare let keyCode: number
declare let keyPressed: Function
declare let keyReleased: Function
declare const UP: number
declare const DOWN: number
declare const RIGHT: number

declare function pushMatrix(): void
declare function rotate(theta: number): void
declare function translate(x: number, y: number): void
declare function popMatrix(): void

declare const LEFT: number
declare const TOP: number
