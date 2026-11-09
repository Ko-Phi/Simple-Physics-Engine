export class Sprite {
    shapes;
    fx;
    constructor(shapes, fx = (x) => x) {
        this.shapes = shapes;
        this.fx = fx;
    }
    draw(dx, dy, dir) {
        this.shapes.forEach((shape) => shape.draw(dx, dy, dir));
    }
}
