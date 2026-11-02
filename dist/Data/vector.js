import { sq, rounD } from "../utils.js";
export class Vector {
    x;
    y;
    constructor(input1, input2, init = "component") {
        ;
        [this.x, this.y] =
            init === "component"
                ? [input1, input2]
                : [input2 * Math.cos(input1), input2 * Math.sin(input1)];
    }
    copy = () => new Vector(this.x, this.y);
    getSqMag = () => sq(this.x) + sq(this.y);
    getMag = () => Math.sqrt(this.getSqMag());
    theta = () => Math.atan2(this.y, this.x);
    add = (v) => new Vector(this.x + v.x, this.y + v.y);
    negate = () => new Vector(-this.x, -this.y);
    subtract = (v) => this.add(v.negate());
    scale = (c) => new Vector(this.x * c, this.y * c);
    divide = (c) => this.scale(1 / c);
    normalize = () => ((r) => (r !== 0 ? this.divide(r) : this.copy()))(this.getMag()); // I miss u haskell </3
    dotProduct = (v) => this.x * v.x + this.y * v.y;
    crossProduct = (v) => -(this.x * v.y - this.y * v.x); // As world is inverted-cartesian
    perpendicular = () => new Vector(-this.y, this.x);
    rotate = (θ) => new Vector(this.x * Math.cos(θ) - this.y * Math.sin(θ), this.x * Math.sin(θ) + this.y * Math.cos(θ));
    display = () => rounD(this.x, 3) + ", " + rounD(this.y, 3);
    equalTo = (vector) => this.x === vector.x && this.y === vector.y;
}
