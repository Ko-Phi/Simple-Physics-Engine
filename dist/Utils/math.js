export const sq = (n) => n * n;
export const constrain = (n, maxi, mini) => Math.max(maxi, Math.min(mini, n));
export const rounD = (num, deciPlace) => Math.round(num * Math.pow(10, deciPlace)) / Math.pow(10, deciPlace);
export const random = (min, max) => Math.random() * (max - min) + min;
export const range = (start, stop, step = 1) => Array.from({ length: Math.ceil((stop - start) / step) }, (_, i) => start + i * step);
export const rgba = (...inputs) => {
    let channels;
    if (inputs.length === 1)
        channels = [inputs[0], inputs[0], inputs[0], 255];
    else if (inputs.length === 2)
        channels = [inputs[0], inputs[0], inputs[0], inputs[1]];
    else if (inputs.length === 3)
        channels = inputs.concat(255);
    else
        channels = inputs;
    return "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("");
};
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
