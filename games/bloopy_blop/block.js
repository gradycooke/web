const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const volumeBar = document.getElementById('volumeBar');
const volumeFill = document.getElementById('volumeFill');

const gravity = 0.5;
const lift = -8;

const flapSound = 'confirm-tap-394001.ogg';
const gameOverSound = 'synthetic-unique-crash-ding-412501.ogg';
const HIGH_SCORE_KEY = 'bloopyBlopHighScore';

let player = { x: 80, y: canvas.height / 2, width: 60, height: 60, velocity: 0 };
let obstacles = [];
let score = 0;
let frame = 0;
let screen = 'start'; // 'start', 'game', 'gameover'
let flapInterval = null;
let animationFrameId = null;
let titleHue = 0;
let masterVolume = 1; // Shared audio volume (0-1) - start at max
let currentBgColor = '#000';
let highScore = 0;

function loadHighScore() {
  try {
    const stored = localStorage.getItem(HIGH_SCORE_KEY);
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed)) {
      highScore = parsed;
    }
  } catch (_) {
    highScore = 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch (_) {
    // Ignore storage errors.
  }
}

loadHighScore();

function setGlowColor(color) {
  const root = document.documentElement;
  currentBgColor = color;
  root.style.setProperty('--glow-color', color);
  const alphaColor = color.startsWith('hsl(')
    ? color.replace('hsl(', 'hsla(').replace(')', ', 0.45)')
    : color;
  root.style.setProperty('--glow-alpha-color', alphaColor);
}

function updateVolumeUI() {
  if (!volumeBar || !volumeFill) return;
  const percent = Math.round(masterVolume * 100);
  volumeFill.style.width = `${percent}%`;
  volumeBar.setAttribute('aria-valuenow', percent);
}

function setVolumeFromPointer(event) {
  if (!volumeBar) return;
  const rect = volumeBar.getBoundingClientRect();
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  masterVolume = ratio;
  updateVolumeUI();
}

function playFlapSound() {
  const s = new Audio(flapSound);
  s.volume = 0.2 * masterVolume;
  s.play().catch(() => {});
}

function playGameOverSound() {
  const s = new Audio(gameOverSound);
  s.volume = 0.3 * masterVolume;
  s.currentTime = 0;
  s.play().catch(() => {});
}

document.addEventListener('keydown', e => {
  if (e.code !== 'Space') return;

  if (screen === 'start') {
    startGame();
  } else if (screen === 'game') {
    player.velocity = lift;
    playFlapSound();
    startFlapLoop();
  } else if (screen === 'gameover') {
    startGame(); // ✅ Restart the game, don’t go to start screen
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space') stopFlapLoop();
});

// Volume slider interactions
let isDraggingVolume = false;
if (volumeBar) {
  const handlePointerDown = e => {
    isDraggingVolume = true;
    volumeBar.setPointerCapture(e.pointerId);
    setVolumeFromPointer(e);
  };

  const handlePointerMove = e => {
    if (!isDraggingVolume) return;
    setVolumeFromPointer(e);
  };

  const handlePointerUp = e => {
    if (!isDraggingVolume) return;
    isDraggingVolume = false;
    volumeBar.releasePointerCapture(e.pointerId);
  };

  volumeBar.addEventListener('pointerdown', handlePointerDown);
  volumeBar.addEventListener('pointermove', handlePointerMove);
  volumeBar.addEventListener('pointerup', handlePointerUp);
  volumeBar.addEventListener('pointercancel', handlePointerUp);

  // Preserve click-to-set for accessibility / keyboard emulation
  volumeBar.addEventListener('click', setVolumeFromPointer);
  updateVolumeUI();
}

function startFlapLoop() {
  if (!flapInterval) {
    flapInterval = setInterval(() => playFlapSound(), 250);
  }
}

function stopFlapLoop() {
  clearInterval(flapInterval);
  flapInterval = null;
}

function startGame() {
  screen = 'game';
  score = 0;
  frame = 0;
  player.y = canvas.height / 2;
  player.velocity = 0;
  obstacles = [];
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(update);
}

function createObstacle() {
  const gap = 160;
  const minTop = 50;
  const maxTop = canvas.height - gap - 150;
  const topHeight = Math.random() * (maxTop - minTop) + minTop;
  obstacles.push({
    x: canvas.width,
    topHeight,
    bottomY: topHeight + gap,
    width: 60
  });
}

function updateObstacles() {
  obstacles.forEach(o => o.x -= 3);
  if (obstacles.length && obstacles[0].x + obstacles[0].width < 0) {
    obstacles.shift();
    score++;
  }
  if (frame % 100 === 0) createObstacle();
}

function drawObstacles() {
  ctx.fillStyle = '#000';
  obstacles.forEach(o => {
    ctx.fillRect(o.x, 0, o.width, o.topHeight);
    ctx.fillRect(o.x, o.bottomY, o.width, canvas.height - o.bottomY);
  });
}

function detectCollision() {
  for (let o of obstacles) {
    if (
      player.x < o.x + o.width &&
      player.x + player.width > o.x &&
      (player.y < o.topHeight || player.y + player.height > o.bottomY)
    ) {
      endGame();
    }
  }

  if (player.y < 0 || player.y + player.height > canvas.height) {
    endGame();
  }
}

function endGame() {
  if (screen === 'game') {
    playGameOverSound();
    screen = 'gameover';
    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }
  }
}

function drawPlayer() {
  ctx.fillStyle = '#000';
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.width, player.height);
}

function drawScore() {
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'start';
  ctx.fillText('Score: ' + score, 10, 30);
}

function getBackgroundColor(score) {
  const step = Math.floor(score / 5);
  const hue = (step * 7) % 360;
  const saturation = 80 + Math.sin(step / 5) * 20;
  const lightness = 25 + Math.cos(step / 10) * 10;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function drawStartScreen() {
  titleHue = (titleHue + 1) % 360;
  const startColor = `hsl(${titleHue}, 80%, 30%)`;
  ctx.fillStyle = startColor;
  setGlowColor(startColor);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.shadowColor = `hsl(${titleHue}, 100%, 70%)`;
  ctx.shadowBlur = 30;
  ctx.fillStyle = 'black';
  ctx.font = '80px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Bloopy Blop', canvas.width / 2, canvas.height / 2 - 100);
  ctx.shadowBlur = 0;

  const floatY = Math.sin(Date.now() / 500) * 10;
  ctx.fillRect(canvas.width / 2 - 30, canvas.height / 2 + floatY - 20, 60, 60);

  const opacity = 0.6 + 0.4 * Math.sin(Date.now() / 300);
  ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
  ctx.font = '24px sans-serif';
  ctx.fillText('Press SPACE to Start', canvas.width / 2, canvas.height / 2 + 100);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'black';
  ctx.fillText('@ MNNA 2025 | Not For Redistribution', canvas.width / 2, canvas.height - 15);
}

function drawGameOverScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  ctx.font = '52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);

  ctx.font = '20px sans-serif';
  ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 48);

  ctx.fillText('Press SPACE to Restart', canvas.width / 2, canvas.height / 2 + 95);
}

function update() {
  if (screen === 'start') {
    drawStartScreen();
    animationFrameId = requestAnimationFrame(update);
    return;
  }

  const bgColor = getBackgroundColor(score);
  ctx.fillStyle = bgColor;
  setGlowColor(bgColor);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (screen === 'game') {
    player.velocity += gravity;
    player.y += player.velocity;
    updateObstacles();
    detectCollision();
    frame++;
  }

  drawObstacles();
  drawPlayer();
  drawScore();

  if (screen === 'gameover') {
    drawGameOverScreen();
  }

  animationFrameId = requestAnimationFrame(update);
}

// 🔁 Initial render loop
animationFrameId = requestAnimationFrame(update);


