var canvas = document.querySelector(".hacker_3d"),
    ctx = canvas.getContext("2d"),
    canvasBars = document.querySelector(".hacker_bars"),
    ctxBars = canvasBars.getContext("2d");

canvas.width = (window.innerWidth / 3) * 2;
canvas.height = window.innerHeight / 3;

canvasBars.width = window.innerWidth / 3;
canvasBars.height = canvas.height;

/* Graphics stuff */
function Square(z) {
    this.width = canvas.width / 2;

    if (canvas.height < 200) {
        this.width = 200;
    };

    this.height = canvas.height;
    z = z || 0;

    this.points = [
        new Point({
            x: (canvas.width / 2) - this.width,
            y: (canvas.height / 2) - this.height,
            z: z
        }),
        new Point({
            x: (canvas.width / 2) + this.width,
            y: (canvas.height / 2) - this.height,
            z: z
        }),
        new Point({
            x: (canvas.width / 2) + this.width,
            y: (canvas.height / 2) + this.height,
            z: z
        }),
        new Point({
            x: (canvas.width / 2) - this.width,
            y: (canvas.height / 2) + this.height,
            z: z
        })];
    this.dist = 0;
}

Square.prototype.update = function () {
    for (var p = 0; p < this.points.length; p++) {
        this.points[p].rotateZ(0.001);
        this.points[p].z -= 3;
        if (this.points[p].z < -300) {
            this.points[p].z = 2700;
        }
        this.points[p].map2D();
    }
}

Square.prototype.render = function () {
    ctx.beginPath();
    ctx.moveTo(this.points[0].xPos, this.points[0].yPos);
    for (var p = 1; p < this.points.length; p++) {
        if (this.points[p].z > -(focal - 50)) {
            ctx.lineTo(this.points[p].xPos, this.points[p].yPos);
        }
    }

    ctx.closePath();
    ctx.stroke();

    this.dist = this.points[this.points.length - 1].z;

};

function Point(pos) {
    this.x = pos.x - canvas.width / 2 || 0;
    this.y = pos.y - canvas.height / 2 || 0;
    this.z = pos.z || 0;

    this.cX = 0;
    this.cY = 0;
    this.cZ = 0;

    this.xPos = 0;
    this.yPos = 0;
    this.map2D();
}

Point.prototype.rotateZ = function (angleZ) {
    var cosZ = Math.cos(angleZ),
        sinZ = Math.sin(angleZ),
        x1 = this.x * cosZ - this.y * sinZ,
        y1 = this.y * cosZ + this.x * sinZ;

    this.x = x1;
    this.y = y1;
}

Point.prototype.map2D = function () {
    var scaleX = focal / (focal + this.z + this.cZ),
        scaleY = focal / (focal + this.z + this.cZ);

    this.xPos = vpx + (this.cX + this.x) * scaleX;
    this.yPos = vpy + (this.cY + this.y) * scaleY;
};

// Init graphics stuff
var squares = [],
    focal = canvas.width / 2,
    vpx = canvas.width / 2,
    vpy = canvas.height / 2,
    barVals = [],
    sineVal = 0;


function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    squares.sort(function (a, b) {
        return b.dist - a.dist;
    });
    for (var i = 0, len = squares.length; i < len; i++) {
        squares[i].update();
        squares[i].render();
    }

    ctxBars.clearRect(0, 0, canvasBars.width, canvasBars.height);

    ctxBars.beginPath();
    var y = canvasBars.height / 6;
    ctxBars.moveTo(0, y);

    for (i = 0; i < canvasBars.width; i++) {
        var ran = (Math.random() * 20) - 10;
        if (Math.random() > 0.98) {
            ran = (Math.random() * 50) - 25
        }
        ctxBars.lineTo(i, y + ran);
    }

    ctxBars.stroke();

    for (i = 0; i < canvasBars.width; i += 20) {
        if (!barVals[i]) {
            barVals[i] = {
                val: Math.random() * (canvasBars.height / 2),
                freq: 0.1,
                sineVal: Math.random() * 100
            };
        }

        barVals[i].sineVal += barVals[i].freq;
        barVals[i].val += Math.sin(barVals[i].sineVal * Math.PI / 2) * 5;
        ctxBars.fillRect(i + 5, canvasBars.height, 15, -barVals[i].val);
    }

    requestAnimationFrame(render);
}

setTimeout(function () {
    canvas.width = (window.innerWidth / 3) * 2;
    canvas.height = window.innerHeight / 3;

    canvasBars.width = window.innerWidth / 3;
    canvasBars.height = canvas.height;
    focal = canvas.width / 2;
    vpx = canvas.width / 2;
    vpy = canvas.height / 2;

    for (var i = 0; i < 15; i++) {
        squares.push(new Square(-300 + (i * 200)));
    }

    // Get the primary color from CSS custom property
    var primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    ctx.strokeStyle = ctxBars.strokeStyle = ctxBars.fillStyle = primaryColor;

    render();
}, 200);

window.addEventListener('resize', function () {
    canvas.width = (window.innerWidth / 3) * 2;
    canvas.height = window.innerHeight / 3;

    canvasBars.width = window.innerWidth / 3;
    canvasBars.height = canvas.height;
    focal = canvas.width / 2;
    vpx = canvas.width / 2;
    vpy = canvas.height / 2;
    
    // Get the primary color from CSS custom property
    var primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    ctx.strokeStyle = ctxBars.strokeStyle = ctxBars.fillStyle = primaryColor;
});


// Main Menu animations
const atomJoin = document.getElementById('atomJoin');
const atomHost = document.getElementById('atomHost');
const atomQuickplay = document.getElementById('atomQuickplay');
const rootConnectorLeft = document.getElementById('rootLeftConnectorEffector');
const rootConnectorRight = document.getElementById('rootRightConnectorEffector');
const rootConnectorTop = document.getElementById('rootTopConnectorEffector');

atomJoin.addEventListener('mouseenter', () => {
    rootConnectorLeft.style.filter = 'saturate(500%) brightness(80%) hue-rotate(0deg)';
    rootConnectorLeft.style.animation = 'rgb-strobe 0.15s linear infinite';
});

atomJoin.addEventListener('mouseleave', () => {
    rootConnectorLeft.style.filter = '';
    rootConnectorLeft.style.animation = '';
});

atomHost.addEventListener('mouseenter', () => {
    rootConnectorTop.style.filter = 'saturate(500%) brightness(80%) hue-rotate(0deg)';
    rootConnectorTop.style.animation = 'rgb-strobe 0.15s linear infinite';
});

atomHost.addEventListener('mouseleave', () => {
    rootConnectorTop.style.filter = '';
    rootConnectorTop.style.animation = '';
});

atomQuickplay.addEventListener('mouseenter', () => {
    rootConnectorRight.style.filter = 'saturate(500%) brightness(80%) hue-rotate(0deg)';
    rootConnectorRight.style.animation = 'rgb-strobe 0.15s linear infinite';
});

atomQuickplay.addEventListener('mouseleave', () => {
    rootConnectorRight.style.filter = '';
    rootConnectorRight.style.animation = '';
});