import { Draw } from "../Utils/drawing.js";
import { rgba, Vector } from "../Utils/math.js";
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
export const focus = 0;
export const keys = {
    ArrowUp: false,
};
"abcdefghijklmnopqrstuvwxyz ".split("").forEach((c) => {
    keys[c] = false;
    keys[c.toUpperCase()] = false;
});
window.addEventListener("keydown", (event) => {
    if (event.key in keys) {
        keys[event.key] = true;
        event.preventDefault();
    }
});
window.addEventListener("keyup", (event) => {
    if (event.key in keys) {
        keys[event.key] = false;
    }
});
export const period = 16.67;
export const initialVelocity = 0; // objects begin with an intial velocity
export const periodicVelocityShifts = false; // velocity randomized periodically
export const velocityMagnitude = 1; // alters the magnitude of said velocity
export const collisionImpulse = true; // objects bounce off each other on collision
export const restitution = 1; // collision bounciness. Values < 1 yield loss of energy. Values > 1 break the first law of thermodynamics
export const mu = 0.005; // add friction (should be quite small)
export const boundedWorld = false; // whether the world teleports you at the edges or not
export const allCircles = false; // all shapes are circles. Increases performance as well
export const allPolys = false; // all shapes are polygons. Slightly more performance intensive
export const gridSize = 100; // influences hashgrid check. Can queak for minor performance improvement
// Box Count
export const insertCount = 100;
export const scale = 20;
export const scaleVariance = 0;
// Visuals
// 16.67 ms is the sweet spot. If your device can average below this, you can swap to 60 fps
export const drawAsCircles = false; // shapes drawn as circles. Increases performance
export const displayAABB = false; // aabbs drawn. Uses rect() so not very good for performance
export const displayGridCheck = false; // checked grids are highlighted. Very performance intensive
export const cameraTrack = true; // track them shapes
class Camera {
    position;
    target;
    smoothing = 1;
    trauma = 0;
    constructor(target, position = target.position) {
        this.target = target;
        this.position = position;
    }
    update() {
        this.position = this.position.add(this.target.position.subtract(this.position).scale(this.smoothing));
        this.position = this.target.position;
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
