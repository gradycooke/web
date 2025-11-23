// ✅ Guaranteed single initialization (fixes reload speed bug)
let initialized = false;
let animationFrameId = null;

function safeStart() {
  if (initialized) return; // stop duplicate inits
  initialized = true;
  cancelAnimationFrame(animationFrameId);
  resetGameState();
  update();
}

window.addEventListener('load', safeStart);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    initialized = false; // allow re-init after back/forward cache
    cancelAnimationFrame(animationFrameId);
    safeStart();
  }
});

const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');

// --- Sounds ---
const laserSound = new Audio('laser-104024.ogg'); 
laserSound.volume = 0.3;
const gameOverSound = new Audio('game-over-arcade-6435.ogg');
gameOverSound.volume = 0.5;

// --- Player ---
let player = {
  x: canvas.width / 2 - 20,
  y: canvas.height / 2 - 20,
  width: 40,
  height: 40,
  speed: 12
};

// --- Globals ---
let animationFrameId = null;
let titleHue = 0;
let lastScreen = "start";
let lasers = [];
let score = 0;
let frame = 0;
let gameOver = false;
let started = false;
let controlMode = null;
let animationFrameId = null;
let keys = {};
let mousePos = { x: player.x, y: player.y };

const MAX_GAME_FRAMES = 60 * 60 * 5;
let minSpeed = 2;
let maxSpeed = 5;
let hue = 180;

let showSensitivityMenu = false;
let pendingSpeed = player.speed;
let minSensitivity = 4;
let maxSensitivity = 20;

// --- Helper: Full Reset ---
function resetGameState() {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null; // 🧠 prevents ghost loops entirely
  lasers = [];
  frame = 0;
  score = 0;
  window.nextLaserSpawn = 0;
  minSpeed = 2;
  maxSpeed = 5;
  hue = 180;
  started = false;
  gameOver = false;
  showSensitivityMenu = false;
  titleHue = 0;
}

// --- CONTROLS ---
document.addEventListener('keydown', e => {
  if (showSensitivityMenu) {
    if (e.code === 'ArrowUp' && pendingSpeed < maxSensitivity) pendingSpeed++;
    if (e.code === 'ArrowDown' && pendingSpeed > minSensitivity) pendingSpeed--;
    ();
    if (e.code === 'Enter') {
      player.speed = pendingSpeed;
      showSensitivityMenu = false;
      if (lastScreen === "gameover") {
        gameOver = true;
        started = true;
      } else {
        gameOver = false;
        started = false;
      }
      ();
    }
    return;
  }

  if ((e.code === 'Enter') && (!started || gameOver)) {
    showSensitivityMenu = true;
    pendingSpeed = player.speed;
    lastScreen = gameOver ? "gameover" : "start";
    ();
    return;
  }

  if (gameOver && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    controlMode = 'keyboard';
    restartGame(true);
    return;
  }

  if (!started && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    controlMode = 'keyboard';
    started = true;
    loop();
    return;
  }

  if (controlMode === 'keyboard' && !gameOver) keys[e.code] = true;
});

document.addEventListener('keyup', e => {
  if (controlMode === 'keyboard') keys[e.code] = false;
});

canvas.addEventListener('mousedown', () => {
  if (gameOver) {
    controlMode = 'mouse';
    restartGame(true);
    return;
  }
  if (!started) {
    controlMode = 'mouse';
    started = true;
    loop();
  }
});

canvas.addEventListener('mousemove', e => {
  if (controlMode !== 'mouse' || gameOver) return;
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left - player.width / 2;
  mousePos.y = e.clientY - rect.top - player.height / 2;
});

// --- RESTART ---
function restartGame(startImmediately = false) {
  cancelAnimationFrame(animationFrameId);
  lasers = [];
  score = 0;
  frame = 0;
  gameOver = false;
  minSpeed = 2;
  maxSpeed = 5;
  hue = 180;
  window.nextLaserSpawn = 0;
  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height / 2 - player.height / 2;
  mousePos.x = player.x;
  mousePos.y = player.y;
  started = !!startImmediately;
  if (startImmediately) loop();
  else ();
}

// --- LASERS ---
function spawnLaser() {
  const dirs = ['top', 'bottom', 'left', 'right'];
  const dir = dirs[Math.floor(Math.random() * dirs.length)];
  const speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
  const lenVar = Math.random() * 60 - 30;
  let width = dir === 'top' || dir === 'bottom' ? 80 + lenVar : 8;
  let height = dir === 'top' || dir === 'bottom' ? 8 : 80 + lenVar;

  let x, y;
  if (dir === 'top') { x = Math.random() * (canvas.width - width); y = -10; }
  else if (dir === 'bottom') { x = Math.random() * (canvas.width - width); y = canvas.height + 10; }
  else if (dir === 'left') { x = -10; y = Math.random() * (canvas.height - height); }
  else { x = canvas.width + 10; y = Math.random() * (canvas.height - height); }

  const sound = laserSound.cloneNode();
  const size = dir === 'top' || dir === 'bottom' ? width : height;
  const normalized = Math.max(0, Math.min(1, (size - 50) / 100));
  sound.playbackRate = 0.8 + normalized * 0.8;
  sound.volume = 0.3;
  sound.play().catch(() => {});

  lasers.push({
    dir, x, y, width, height,
    speed: (dir === 'top' || dir === 'left') ? speed : -speed
  });
}

function drawPlayer() {
  ctx.fillStyle = 'white';
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawLasers() {
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  lasers.forEach(l => ctx.fillRect(l.x, l.y, l.width, l.height));
}

function updateLasers() {
  lasers.forEach(l => {
    if (l.dir === 'top' || l.dir === 'bottom') l.y += l.speed;
    else l.x += l.speed;
  });
  lasers = lasers.filter(l =>
    !(l.dir === 'top' && l.y > canvas.height + 20) &&
    !(l.dir === 'bottom' && l.y < -20) &&
    !(l.dir === 'left' && l.x > canvas.width + 20) &&
    !(l.dir === 'right' && l.x < -20)
  );
}

function checkCollisions() {
  for (let l of lasers) {
    if (
      player.x < l.x + l.width &&
      player.x + player.width > l.x &&
      player.y < l.y + l.height &&
      player.y + player.height > l.y
    ) {
      gameOver = true;
      cancelAnimationFrame(animationFrameId);
      const s = gameOverSound.cloneNode();
      s.play().catch(() => {});
    }
  }
}

function movePlayer() {
  if (controlMode === 'mouse') {
    player.x = mousePos.x;
    player.y = mousePos.y;
  } else if (controlMode === 'keyboard') {
    if (keys['ArrowUp']) player.y -= player.speed;
    if (keys['ArrowDown']) player.y += player.speed;
    if (keys['ArrowLeft']) player.x -= player.speed;
    if (keys['ArrowRight']) player.x += player.speed;
  }
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
}

function updateDifficulty() {
  if (frame < MAX_GAME_FRAMES) {
    const progress = frame / MAX_GAME_FRAMES;
    minSpeed = 2 + progress * 12;
    maxSpeed = 5 + progress * 15;
    hue = 180 + progress * 360;
  }
}

function applyGlow() {
  const glowColor = `hsl(${hue}, 100%, 50%)`;
  canvas.style.boxShadow = `0 0 40px 5px ${glowColor}`;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
}

// --- MAIN LOOP ---
function update() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(update);
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.shadowBlur = 0;

  if (showSensitivityMenu) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '25px "Press Start 2P"';
    ctx.fillText('ARROW KEY SENSITIVITY', canvas.width / 2, canvas.height / 2 - 80);
    ctx.font = '18px "Press Start 2P"';
    ctx.fillText(`Current Speed: ${pendingSpeed}`, canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillText('↑ / ↓ to adjust', canvas.width / 2, canvas.height / 2 + 20);
    ctx.font = '14px "Press Start 2P"';
    const returnText = lastScreen === "gameover"
      ? "Press ENTER to return to Game Over screen"
      : "Press ENTER to return to Start screen";
    ctx.fillText(returnText, canvas.width / 2, canvas.height / 2 + 70);
    return;
  }

  // Start screen
  if (!started && !gameOver) {
    titleHue = (titleHue + 1) % 360;
    const glowColor = `hsl(${titleHue}, 100%, 60%)`;
    canvas.style.boxShadow = `0 0 40px 5px ${glowColor}`;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.textAlign = 'center';
    const centerY = canvas.height / 2;
    ctx.fillStyle = `hsl(${titleHue}, 100%, 60%)`;
    ctx.font = '50px "Press Start 2P"';
    ctx.fillText("DON’T TOUCH", canvas.width / 2, centerY - 80);
    ctx.fillText("THE LASERS", canvas.width / 2, centerY - 10);
    ctx.font = '13px "Press Start 2P"';
    ctx.fillStyle = 'white';
    const y = centerY + 60;
    ctx.fillText('CLICK to play with mouse / touchpad', canvas.width / 2, y);
    ctx.fillText('Press an ARROW KEY to play with arrows', canvas.width / 2, y + 30);
    ctx.fillText('Press ENTER to adjust arrow key sensitivity', canvas.width / 2, y + 60);
    ctx.font = '12px sans-serif';
    ctx.fillText('@ MNNA 2025 | Not For Redistribution', canvas.width / 2, canvas.height - 15);
    animationFrameId = requestAnimationFrame(update);
    return;
  }

  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '50px "Press Start 2P"';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '20px "Press Start 2P"';
    ctx.fillText('SCORE: ' + score, canvas.width / 2, canvas.height / 2 + 10);
    ctx.font = '13px "Press Start 2P"';
    ctx.fillText('CLICK to play with mouse / touchpad', canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText('Press an ARROW KEY to play with arrows', canvas.width / 2, canvas.height / 2 + 90);
    ctx.fillText('Press ENTER to adjust arrow key sensitivity', canvas.width / 2, canvas.height / 2 + 120);
    return;
  }

  // Gameplay
  updateDifficulty();
  applyGlow();
  movePlayer();

  if (!window.nextLaserSpawn || frame >= window.nextLaserSpawn) {
    spawnLaser();
    const progress = Math.min(1, frame / MAX_GAME_FRAMES);
    const maxInterval = 70 - progress * 40;
    const minInterval = 5;
    window.nextLaserSpawn = frame + Math.floor(Math.random() * maxInterval) + minInterval;
  }

  updateLasers();
  checkCollisions();
  drawLasers();
  drawPlayer();

  score++;
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'white';
  ctx.font = '16px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE: ' + score, 10, 30);

  frame++;
  animationFrameId = requestAnimationFrame(update);
}

function loop() {
  animationFrameId = requestAnimationFrame(update);
}

// ✅ Font load fix
if (document.fonts) {
  document.fonts.load('32px "Press Start 2P"').then(() => {
    setTimeout(() => update(), 50);
  });
} else {
  window.onload = update;
}












