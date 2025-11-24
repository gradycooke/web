const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const volumeTrack = document.getElementById('volumeTrack');
const volumeFill = document.getElementById('volumeFill');
const volumeThumb = document.getElementById('volumeThumb');

// --- Sound ---
const BASE_LASER_VOLUME = 0.3;
const BASE_GAMEOVER_VOLUME = 0.5;
const HIGH_SCORE_KEY = 'dont-touch-the-lasers-high-score';
let masterVolume = 1;
let isAdjustingVolume = false;
const laserSound = new Audio('laser-104024.ogg'); 
const gameOverSound = new Audio('game-over-arcade-6435.ogg');
let highScore = loadHighScore();

let player = {
  x: canvas.width / 2 - 20,
  y: canvas.height / 2 - 20,
  width: 40,
  height: 40,
  speed: 12
};

let difficultySpiked = false;
let titleHue = 0;
let lastScreen = "start"; // can be "start" or "gameover"
let lasers = [];
let score = 0;
let frame = 0;
let gameOver = false;
let started = false;
let controlMode = null; // "keyboard" or "mouse"
let animationFrameId = null;
let keys = {};
let mousePos = { x: player.x, y: player.y };

const MAX_GAME_FRAMES = 60 * 60 * 5;
let minSpeed = 2;
let maxSpeed = 5;
let hue = 180;

let showSensitivityMenu = false;
let pendingSpeed = player.speed; // stores the speed while adjusting
let minSensitivity = 4;  // you can change this lower bound
let maxSensitivity = 25; // and this upper bound

function loadHighScore() {
  try {
    const stored = localStorage.getItem(HIGH_SCORE_KEY);
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (e) {
    return 0;
  }
}

function persistHighScore(value) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch (e) {
    // ignore storage failures (e.g., private mode)
  }
}

function updateHighScoreIfNeeded() {
  if (score > highScore) {
    highScore = score;
    persistHighScore(highScore);
  }
}

function updateVolumeUI() {
  if (!volumeTrack || !volumeFill || !volumeThumb) return;
  const percent = Math.max(0, Math.min(100, masterVolume * 100));
  volumeFill.style.width = `${percent}%`;
  volumeThumb.style.left = `${percent}%`;
}

function applyMasterVolume() {
  laserSound.volume = BASE_LASER_VOLUME * masterVolume;
  gameOverSound.volume = BASE_GAMEOVER_VOLUME * masterVolume;
}

function setMasterVolume(value) {
  masterVolume = Math.max(0, Math.min(1, value));
  applyMasterVolume();
  updateVolumeUI();
}

function setVolumeFromEvent(e) {
  if (!volumeTrack) return;
  const rect = volumeTrack.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  setMasterVolume(ratio);
}

function startFromMenu(mode) {
  controlMode = mode;
  cancelAnimationFrame(animationFrameId); // stop the start-screen RAF loop
  started = true;
  loop();
}

// --- CONTROLS ---
document.addEventListener('keydown', e => {
  // --- Sensitivity Adjustment Menu Controls ---
  if (showSensitivityMenu) {
    if (e.code === 'ArrowUp' && pendingSpeed < maxSensitivity) pendingSpeed++;
    if (e.code === 'ArrowDown' && pendingSpeed > minSensitivity) pendingSpeed--;

    // Re-render immediately so the number updates visually
    update();

    if (e.code === 'Enter') {
      player.speed = pendingSpeed;
      showSensitivityMenu = false;

      // Return to the correct screen
      if (lastScreen === "gameover") {
        gameOver = true;
        started = true;
      } else {
        gameOver = false;
        started = false;
      }

      update(); // render appropriate screen
    }
    return;
  }

  // --- Enter to Open Sensitivity Menu ---
  if ((e.code === 'Enter') && (!started || gameOver)) {
    showSensitivityMenu = true;
    pendingSpeed = player.speed;
    lastScreen = gameOver ? "gameover" : "start"; // track where we came from
    update();
    return;
  }


  // --- Normal Controls ---
  if (!started || gameOver) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      controlMode = 'keyboard';
      restartGame(true);
      return;
    }
  }

  if (controlMode === 'keyboard' && !gameOver) keys[e.code] = true;
});

document.addEventListener('keyup', e => {
  if (controlMode === 'keyboard') keys[e.code] = false;
});

canvas.addEventListener('mousedown', () => {
  if (!started || gameOver) {
    controlMode = 'mouse';
    restartGame(true);
    return;
  }
});

canvas.addEventListener('mousemove', e => {
  if (controlMode !== 'mouse' || gameOver) return;
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left - player.width / 2;
  mousePos.y = e.clientY - rect.top - player.height / 2;
});

if (volumeTrack) {
  volumeTrack.addEventListener('mousedown', e => {
    isAdjustingVolume = true;
    setVolumeFromEvent(e);
    e.stopPropagation();
  });

  volumeTrack.addEventListener('mousemove', e => {
    if (!isAdjustingVolume) return;
    setVolumeFromEvent(e);
  });

  volumeTrack.addEventListener('click', e => {
    setVolumeFromEvent(e);
    e.stopPropagation();
  });
}

window.addEventListener('mouseup', () => {
  if (!isAdjustingVolume) return;
  isAdjustingVolume = false;
});

setMasterVolume(masterVolume);

// --- RESTART ---
function restartGame(startImmediately = false) {
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

  if (startImmediately) {
    cancelAnimationFrame(animationFrameId);
    started = true;
    loop();
  } else {
    started = false;
    update();
  }

}

// --- LASER CREATION ---
function spawnLaser() {
  const directions = ['top', 'bottom', 'left', 'right'];
  const dir = directions[Math.floor(Math.random() * directions.length)];
  const speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
  const lengthVariation = Math.random() * 60 - 30;

  let width, height;

  if (dir === 'top' || dir === 'bottom') {
    width = 80 + lengthVariation;
    height = 8;
  } else {
    width = 8;
    height = 80 + lengthVariation;
  }

  // --- Determine position ---
  let x, y;
  if (dir === 'top') {
    x = Math.random() * (canvas.width - width);
    y = -10;
  } else if (dir === 'bottom') {
    x = Math.random() * (canvas.width - width);
    y = canvas.height + 10;
  } else if (dir === 'left') {
    x = -10;
    y = Math.random() * (canvas.height - height);
  } else if (dir === 'right') {
    x = canvas.width + 10;
    y = Math.random() * (canvas.height - height);
  }

  // --- Dynamic laser sound ---
  const sound = laserSound.cloneNode(); // allows overlapping
  const size = dir === 'top' || dir === 'bottom' ? width : height;
  const normalized = Math.max(0, Math.min(1, (size - 50) / 100)); // normalize between 0–1
  sound.playbackRate = 0.8 + normalized * 0.8; // 0.8× to 1.6× pitch range
  sound.volume = BASE_LASER_VOLUME * masterVolume;
  sound.play().catch(() => {}); // prevents browser auto-play rejection errors

  // --- Push new laser ---
  lasers.push({
    dir,
    x,
    y,
    width,
    height,
    speed:
      dir === 'top'
        ? speed
        : dir === 'bottom'
        ? -speed
        : dir === 'left'
        ? speed
        : -speed
  });
}


// --- DRAW ---
function drawPlayer() {
  ctx.fillStyle = 'white';
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawLasers() {
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  lasers.forEach(l => ctx.fillRect(l.x, l.y, l.width, l.height));
}

// --- LASER UPDATES ---
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

// --- COLLISIONS ---
function checkCollisions() {
  let collided = false;
  for (let l of lasers) {
    if (
        player.x < l.x + l.width &&
        player.x + player.width > l.x &&
        player.y < l.y + l.height &&
        player.y + player.height > l.y
    ) {
        if (!gameOver) {
          gameOver = true;
          collided = true;
          cancelAnimationFrame(animationFrameId);
        }

        // --- Play Game Over Sound ---
        const sound = gameOverSound.cloneNode();
        sound.volume = BASE_GAMEOVER_VOLUME * masterVolume;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
  }
  return collided;
}

// --- PLAYER MOVEMENT ---
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

  if (player.x < 0) player.x = 0;
  if (player.y < 0) player.y = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
  if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
}

// --- DIFFICULTY ---
function updateDifficulty() {
  if (frame < MAX_GAME_FRAMES) {
    const progress = frame / MAX_GAME_FRAMES;
    minSpeed = 2 + progress * 12;
    maxSpeed = 5 + progress * 15;
    hue = 180 + progress * 360;
  }
}

// --- GLOW ---
function applyGlow() {
  const glowColor = `hsl(${hue}, 100%, 50%)`;
  canvas.style.boxShadow = `0 0 40px 5px ${glowColor}`;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
}

// --- MAIN LOOP ---
function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.shadowBlur = 0;
  

  // --- Sensitivity Adjustment Menu ---
  if (showSensitivityMenu) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
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

  // --- START SCREEN ---
  if (!started && !gameOver) {
    titleHue = (titleHue + 1) % 360; // cycles hue
    // Apply a matching glow around the canvas
    const glowColor = `hsl(${titleHue}, 100%, 60%)`;
    canvas.style.boxShadow = `0 0 40px 5px ${glowColor}`;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.textAlign = 'center';

    const centerY = canvas.height / 2;

    // Title (rainbow)
    ctx.fillStyle = `hsl(${titleHue}, 100%, 60%)`;
    ctx.font = '50px "Press Start 2P"';
    ctx.fillText("DON’T TOUCH", canvas.width / 2, centerY - 80);
    ctx.fillText("THE LASERS", canvas.width / 2, centerY - 10);

    // Instructions (white)
    ctx.font = '13px "Press Start 2P"';
    ctx.fillStyle = 'white';
    const instructionsStartY = centerY + 60;
    ctx.fillText('CLICK to play with mouse / touchpad', canvas.width / 2, instructionsStartY);
    ctx.fillText('Press an ARROW KEY to play with arrows', canvas.width / 2, instructionsStartY + 30);
    ctx.fillText('Press ENTER to adjust arrow key sensitivity', canvas.width / 2, instructionsStartY + 60);

    // Copyright
    ctx.font = '12px sans-serif';
    ctx.fillText('@ MNNA 2025 | Not For Redistribution', canvas.width / 2, canvas.height - 15);

    // 🔁 Keep looping to animate the hue
    animationFrameId = requestAnimationFrame(update);
    return;
  }

    // --- GAME OVER SCREEN ---
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';

    // Title
    ctx.font = '50px "Press Start 2P"';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);

    // Score
    ctx.font = '20px "Press Start 2P"';
    ctx.fillText('SCORE: ' + score, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('HIGH SCORE: ' + highScore, canvas.width / 2, canvas.height / 2 + 45);

    // Instructions (smaller)
    ctx.font = '13px "Press Start 2P"';
    const instructionsOffset = 40; // extra gap beneath high score
    ctx.fillText('CLICK to play with mouse / touchpad', canvas.width / 2, canvas.height / 2 + 60 + instructionsOffset);
    ctx.fillText('Press an ARROW KEY to play with arrows', canvas.width / 2, canvas.height / 2 + 90 + instructionsOffset);
    ctx.fillText('Press ENTER to adjust arrow key sensitivity', canvas.width / 2, canvas.height / 2 + 120 + instructionsOffset);
    return;
  }
  
  // --- Difficulty Spike at 25,000 ---
  if (!difficultySpiked && score >= 25000) {
    difficultySpiked = true;

    // Turn lasers and glow red
    hue = 0;

    // Dramatically increase difficulty
    minSpeed = 15;
    maxSpeed = 25;

    // Optionally, shorten spawn intervals more aggressively
    window.minLaserInterval = 2;
    window.maxLaserInterval = 20;
  }

  updateDifficulty();
  applyGlow();
  movePlayer();

  if (!window.nextLaserSpawn || frame >= window.nextLaserSpawn) {
    spawnLaser();

    // Gradually increase spawn rate over 5 minutes (MAX_GAME_FRAMES)
    const progress = Math.min(1, frame / MAX_GAME_FRAMES);

    // Start between 5–70 frames apart, end between 5–30 frames apart
    let minInterval = window.minLaserInterval ?? 5;
    let maxInterval = window.maxLaserInterval ?? (70 - progress * 40);

    window.nextLaserSpawn = frame + Math.floor(Math.random() * maxInterval) + minInterval;
  }

  updateLasers();
  const diedThisFrame = checkCollisions();
  drawLasers();
  drawPlayer();

  score++;
  if (diedThisFrame) updateHighScoreIfNeeded();
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

// ✅ Ensure the "Press Start 2P" font is fully loaded before drawing the first frame
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    setTimeout(() => update(), 50);
  });
} else {
  // Fallback for older browsers
  setTimeout(() => update(), 50);
}







