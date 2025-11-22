// Flappy Block Game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gameOverSrc = 'synthetic-unique-crash-ding-412501.ogg';

// Physics settings
const gravity = 0.5;
const lift = -8;

let player = {
    x: 80,
    y: canvas.height / 2,
    width: 60,
    height: 60,
    velocity: 0
};

let obstacles = [];
let frame = 0;
let score = 0;
let gameOver = false;
let started = false;
let animationFrameId;

// --- Sound Setup ---
const flapSrc = 'confirm-tap-394001.ogg';
const flapVolume = 0.2;

let flapInterval = null;

// Play new instance each time for repeated sounds
function playFlapSound() {
    const sound = new Audio(flapSrc);
    sound.volume = flapVolume;
    sound.play();
}

function playGameOverSound() {
    const sound = new Audio(gameOverSrc);
    sound.volume = 0.3;
    sound.currentTime = 0; // reset so it can play again immediately
    sound.play();
}


// --- Input Handling ---
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
        if (!started) {
            started = true;
            loop();
        } else if (!gameOver) {
            player.velocity = lift;
            playFlapSound();
            startFlapLoop();
        } else {
            restartGame();
        }
    }
});

document.addEventListener('keyup', function(e) {
    if (e.code === 'Space') {
        stopFlapLoop();
    }
});

function startFlapLoop() {
    if (flapInterval === null) {
        flapInterval = setInterval(() => {
            playFlapSound();
        }, 250); // adjust repeat speed (ms)
    }
}

function stopFlapLoop() {
    clearInterval(flapInterval);
    flapInterval = null;
}

// Create obstacle pairs
function createObstacle() {
    const gap = 160;
    const minTop = 50;
    const maxTop = canvas.height - gap - 150;
    const topHeight = Math.random() * (maxTop - minTop) + minTop;
    obstacles.push({
        x: canvas.width,
        topHeight: topHeight,
        bottomY: topHeight + gap,
        width: 60
    });
}

// Draw obstacles
function drawObstacles() {
    ctx.fillStyle = '#000'; // black obstacles
    obstacles.forEach(o => {
        ctx.fillRect(o.x, 0, o.width, o.topHeight);
        ctx.fillRect(o.x, o.bottomY, o.width, canvas.height - o.bottomY);
    });
}

// Move obstacles and track score
function updateObstacles() {
    obstacles.forEach(o => o.x -= 3);
    if (obstacles.length && obstacles[0].x + obstacles[0].width < 0) {
        obstacles.shift();
        score++;
    }
    if (frame % 100 === 0) createObstacle();
}

// Detect collisions
function detectCollision() {
    for (let o of obstacles) {
        if (
            player.x < o.x + o.width &&
            player.x + player.width > o.x &&
            (player.y < o.topHeight || player.y + player.height > o.bottomY)
        ) {
            if (!gameOver) playGameOverSound(); // play once per crash
            gameOver = true;
        }
    }
    if (player.y + player.height > canvas.height || player.y < 0) {
        if (!gameOver) playGameOverSound();
        gameOver = true;
    }
}

// Restart the game
function restartGame() {
    cancelAnimationFrame(animationFrameId);
    player.y = canvas.height / 2;
    player.velocity = 0;
    obstacles = [];
    score = 0;
    gameOver = false;
    frame = 0;
    loop();
}

// Draw the player block
function drawPlayer() {
    ctx.fillStyle = '#000'; // cyan block
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // black outline for visibility
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x, player.y, player.width, player.height);
}

// Background color shift
function getBackgroundColor(score) {
    const step = Math.min(Math.floor(score / 10), 50);
    const hue = (step * 7) % 360; // strong rainbow shift
    const saturation = 80 + Math.sin(step / 5) * 20;
    const lightness = 25 + Math.cos(step / 10) * 10;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Game loop
function update() {
    if (!started) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawStartScreen();
        return;
    }

    // Dynamic background color based on score
    ctx.fillStyle = getBackgroundColor(score);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameOver) {
        player.velocity += gravity;
        player.y += player.velocity;
        updateObstacles();
        detectCollision();
    }

    // Draw everything
    drawObstacles();
    drawPlayer();
    drawScore();

    if (gameOver) {
        drawGameOver();
        return;
    }

    frame++;
    animationFrameId = requestAnimationFrame(update);
}

// Start screen
function drawStartScreen() {
    ctx.fillStyle = 'white';
    ctx.font = '50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bloopy Blop', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '24px sans-serif';
    ctx.fillText('Press Space to Start', canvas.width / 2, canvas.height / 2 + 20);

    // --- Add smaller copyright text at bottom ---
    ctx.font = '12px sans-serif';  // smaller size
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('@ MNNA 2025 | Not For Redistribution', canvas.width / 2, canvas.height - 15);
}

// Game over screen
function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    ctx.font = '20px sans-serif';
    ctx.fillText('Press Space to Restart', canvas.width / 2, canvas.height / 2 + 40);
    ctx.textAlign = 'start';
}

// Score display
function drawScore() {
    ctx.fillStyle = 'white';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText('Score: ' + score, 10, 30);
}

// Start the game
function loop() {
    frame = 0;
    obstacles = [];
    score = 0;
    player.velocity = 0;
    animationFrameId = requestAnimationFrame(update);
}

// Initial render

update();
