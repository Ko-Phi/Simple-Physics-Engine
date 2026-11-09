import { Draw } from "../Utils/drawing.js";
import { Vector, rgba } from "../Utils/math.js";
export const outline = rgba(0);
export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");
if (ctx === null)
    throw "e";
export const draw = new Draw(ctx);
export const [width, height] = [canvas.width, canvas.height];
export const [halfWidth, halfHeight] = [width / 2, height / 2];
let idCount = 0;
export const newid = () => idCount++;
export let focus = NaN;
export const setFocus = (n) => (focus = n);
class Camera {
    position;
    target;
    smoothing = 0.1;
    trauma = 0;
    constructor(target, position = target.position) {
        this.target = target;
        this.position = position;
    }
    update() {
        this.position = this.position.add(this.target.position.subtract(this.position).scale(0.4));
        //this.position = this.position.add(
        //  new Vector(
        //    noise(millis() * 0.02, 1) * (Math.random() < 0.5 ? -1 : 1),
        //    noise(millis() * 0.02, 10) * (Math.random() < 0.5 ? -1 : 1)
        //  ).scale(Math.pow(this.trauma, 3) * 60)
        //)
        this.trauma = Math.max(this.trauma - 1 / 120, 0);
    }
}
export const cam = new Camera({ position: new Vector(0, 0) });
