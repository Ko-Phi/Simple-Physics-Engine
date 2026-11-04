export class Draw {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    setSettings(fill = "#00000000", weight = 4, stroke = "#000000") {
        this.ctx.fillStyle = fill;
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = weight;
    }
    rect(x, y, w, h, fill, weight, stroke) {
        this.setSettings(fill, weight, stroke);
        this.ctx.fillRect(x, y, w, h);
    }
    ellipse(x, y, w, h, fill, weight, stroke) {
        this.setSettings(fill, weight, stroke);
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 2 * Math.PI);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
    }
    line(x1, y1, x2, y2, weight, stroke) {
        this.setSettings("#00000000", weight, stroke);
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
    polygon(vertices, fill, weight, stroke) {
        this.setSettings(fill, weight, stroke);
        this.ctx.beginPath();
        this.ctx.moveTo(vertices[0].x, vertices[0].y);
        for (const vert of vertices)
            this.ctx.lineTo(vert.x, vert.y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }
    text(str, x, y, fill = "#ffffff", weight, stroke) {
        this.setSettings(fill, weight, stroke);
        this.ctx.fillText(str, x, y);
    }
    noStroke() {
        this.ctx.lineWidth = 0;
    }
}
