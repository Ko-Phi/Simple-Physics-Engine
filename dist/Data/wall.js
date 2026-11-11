import { outline, draw, ctx, newid } from "../Globals/init.js";
import { Vector, random, rgba } from "../Utils/math.js";
import { Polygon } from "./shape.js";
import { Color } from "./color.js";
import { Sprite } from "./sprite.js";
import { Collidable, CircleHitbox, PolygonHitbox, } from "./Collisions/collisions.js";
export class Immovable extends Collidable {
    id;
    mass = Infinity;
    inertia = Infinity;
    velocity = new Vector(0, 0);
    omega = 0;
    sprite;
    trueColor;
    ticks;
    constructor(position, dir, shape) {
        const hitbox = shape instanceof Polygon
            ? new PolygonHitbox(shape, position, dir)
            : new CircleHitbox(shape, position, dir);
        super(hitbox, position, dir);
        this.id = newid();
        this.sprite = new Sprite([shape]);
        this.trueColor = new Color([random(-15, 40), 0.6, 1], "HSV");
        this.ticks = Math.floor(random(0, 50));
    }
    draw() {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        this.sprite.draw(0, 0, this.dir);
        ctx.translate(this.hitbox.centroid.x, this.hitbox.centroid.y);
        draw.ellipse(0, 0, 5, 5, rgba(211, 175, 55), 1, outline);
        ctx.restore();
    }
    handleCollision(data) {
        for (const contact of data.contacts)
            draw.ellipse(contact.x, contact.y, 25, 25, rgba(100, 50));
    }
}
