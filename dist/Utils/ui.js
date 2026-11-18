import { ctx, draw, height, width } from "../Globals/init.js";
export class UIText {
    text;
    font;
    fill;
    width;
    height;
    constructor(text, font, fill) {
        this.text = text;
        this.font = font;
        this.fill = fill;
        ctx.save();
        ctx.font = this.font;
        const { width, hangingBaseline, alphabeticBaseline } = ctx.measureText(text);
        this.width = width;
        this.height = Math.abs(hangingBaseline + alphabeticBaseline);
        ctx.restore();
    }
    draw(x = 0, y = 0) {
        ctx.save();
        ctx.resetTransform();
        ctx.translate(width / 2, height / 2);
        draw.text(this.text, x, y, this.font, "left", "top", this.fill);
        ctx.restore();
    }
}
export class UIContainer {
    elements;
    gap;
    direction;
    fill;
    padding;
    width;
    height;
    constructor(elements, gap = 8, direction = "column", fill = "#00000000", padding = 8) {
        this.elements = elements;
        this.gap = gap;
        this.direction = direction;
        this.fill = fill;
        this.padding = padding;
        if (this.direction === "column") {
            this.width = Math.max(...this.elements.map((e) => e.width)) + 2 * padding;
            this.height =
                (this.elements.length - 1) * this.gap +
                    this.elements.reduce((acc, e) => e.height + acc, 0) +
                    2 * padding;
        }
        else {
            this.height = Math.max(...this.elements.map((e) => e.height)) + 2 * padding;
            this.width =
                (this.elements.length - 1) * this.gap +
                    this.elements.reduce((acc, e) => e.width + acc, 0) +
                    2 * padding;
        }
    }
    draw(x = 0, y = 0) {
        ctx.save();
        ctx.resetTransform();
        ctx.translate(width / 2, height / 2);
        ctx.fillStyle = this.fill;
        ctx.fillRect(x, y, this.width, this.height);
        if (this.direction === "column") {
            this.elements.reduce((dy, e) => {
                e.draw(x + this.padding, dy);
                return dy + e.height + this.gap;
            }, y + this.padding);
        }
        else {
            this.elements.reduce((dx, e) => {
                e.draw(dx, y + this.padding);
                return dx + e.width + this.gap;
            }, x + this.padding);
        }
        ctx.restore();
    }
}
