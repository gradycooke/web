const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const GRAVITY = 0.8;
const JUMP_FORCE = -18; // tuned to reach about half the screen
const GROUND_Y = canvas.height - 50;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 50;
const DUCK_HEIGHT = 30;
const PLAYER_SPEED = 5;
const FAST_FALL_VELOCITY = 14; // downward boost when pulling down mid-air
const STAR_COUNT = 50;
const MAX_JUMPS = 2;
const SCORE_PER_MS = 1000 / (5 * 60 * 1000); // ~1000 points over 5 minutes
// Colorblind-friendly obstacle palette
const BLOCK_COLORS = ['#E69F00', '#D55E00', '#F0E442', '#CC79A7', '#9B5DE5', '#d0d0d0'];
const SHAPES = ['rect', 'trapezoid', 'slant', 'step', 'triangle', 'pentagon', 'diamond'];
let COLLISIONS_ENABLED = true; // set to false to disable collision detection
const AIR_LANES = [GROUND_Y - 180, GROUND_Y - 260]; // top positions for air lanes
const EXTRA_GAP_AFTER_OVERHEAD = 40; // breathing room after a duck obstacle
const MIN_GAP_SPEED_FACTOR = 12; // scales gap with speed when necessary
// Difficulty ramp settings
const DIFFICULTY_RAMP_MS = 10 * 60 * 1000; // 10 minutes to max difficulty
const BASE_OBSTACLE_SPEED = 6;
const MAX_OBSTACLE_SPEED = 13;
const BASE_SPAWN_CHANCE = 0.02;
const MAX_SPAWN_CHANCE = 0.045;
const BASE_MIN_GAP = 180;
const MIN_GAP_AT_MAX = 110;
const SHOOTING_STAR_MIN_INTERVAL = 20000;
const SHOOTING_STAR_MAX_INTERVAL = 30000;
const SHOOTING_STAR_SIZE = { width: 26, height: 10 };
const SHOOTING_STAR_SPEED = { min: 10, max: 14 };
const SHOOTING_STAR_TAIL = 55;
const FLOAT_TEXT_LIFETIME = 800;
const FLOAT_TEXT_RISE_PER_MS = 0.05; // px per ms
const HIGH_SCORE_KEY = 'late_night_scroll_high_score';

// Game State
let keys = {};
let obstacles = [];
let shootingStars = [];
let floatTexts = [];
let score = 0;
let highScore = 0;
let gameOver = false;
let animationId = null; // track the current animation frame to prevent double loops
let lastTimestamp = null;
let elapsedMs = 0; // used for smooth difficulty ramp
let started = false; // controls start screen
let shootingStarTimer = 0;
let nextShootingStarMs = randomRange(SHOOTING_STAR_MIN_INTERVAL, SHOOTING_STAR_MAX_INTERVAL);
highScore = loadHighScore();
const sfx = {
  bonk: new Audio('game-over-39-199830.ogg'),
  jump: new Audio('swing-whoosh-110410.ogg'),
  star: new Audio('90s-game-ui-10-185103.ogg')
};
const music = new Audio('soul-soothing-night-194581.ogg');

const DEFAULT_VOLUME = 1;
const volumeSlider = document.getElementById('volumeSlider');
const SFX_BOOST = {
  bonk: 0.5,
  jump: 1.5, // give jumps extra punch without reducing others
  star: 0.5
};

function setVolume(v) {
  const level = Math.min(Math.max(v, 0), 1);
  Object.entries(sfx).forEach(([name, a]) => {
    if (a) a.volume = Math.min(1, level * (SFX_BOOST[name] || 1));
  });
  if (music) music.volume = level;
}

setVolume(DEFAULT_VOLUME);
if (volumeSlider) {
  volumeSlider.value = DEFAULT_VOLUME;
  volumeSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    setVolume(Number.isFinite(v) ? v : DEFAULT_VOLUME);
  });
  volumeSlider.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); // keep arrow keys exclusive to gameplay
    }
  });
}
music.loop = true;
music.addEventListener('ended', () => {
  music.currentTime = 0;
  music.play().catch(() => {});
});

// Prevent a huge delta after tab is hidden (visibility pause) by resetting timestamp on return
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    lastTimestamp = null;
  }
});

function startMusic() {
  if (!music.paused) return;
  music.currentTime = 0;
  music.play().catch(() => {});
}

function stopMusic() {
  music.pause();
  music.currentTime = 0;
}

// One-time generated backdrop elements
const stars = Array.from({ length: STAR_COUNT }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * (GROUND_Y - 60),
  r: Math.random() * 1.5 + 0.5,
  phase: Math.random() * Math.PI * 2,
  speed: 0.0015 + Math.random() * 0.0015
}));
const moon = {
  x: canvas.width - 120,
  y: 80,
  r: 35
};

// Player
let player = {
  x: 100,
  y: GROUND_Y - PLAYER_HEIGHT,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
  vy: 0,
  onGround: true,
  ducking: false,
  jumpCount: 0
};

// Input handlers
window.addEventListener('keydown', e => {
  if (gameOver) {
    restartGame();
    return;
  }

  if (!started) {
    startRun();
  }

  // Trigger jump only on fresh keydown (prevents holding from spamming jumps)
  if (started && e.key === 'ArrowUp' && !keys['ArrowUp']) {
    attemptJump();
  }

  keys[e.key] = true;

  // Restart game if game over
  if (gameOver) restartGame();
});
window.addEventListener('keyup', e => {
  keys[e.key] = false;
});

// Game loop
function gameLoop(timestamp) {
  if (gameOver) {
    animationId = null;
    showGameOver();
    return;
  }

  if (!started) {
    draw();
    showStartScreen();
    animationId = requestAnimationFrame(gameLoop);
    return;
  }

  if (lastTimestamp === null) lastTimestamp = timestamp;
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  update(delta);
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

// Update logic
function update(deltaMs) {
  // Difficulty scaling (smooth ramp to cap)
  elapsedMs += deltaMs;
  const diffFactor = Math.min(elapsedMs / DIFFICULTY_RAMP_MS, 1);
  const obstacleSpeed = BASE_OBSTACLE_SPEED + (MAX_OBSTACLE_SPEED - BASE_OBSTACLE_SPEED) * diffFactor;
  const spawnChance = BASE_SPAWN_CHANCE + (MAX_SPAWN_CHANCE - BASE_SPAWN_CHANCE) * diffFactor;
  const baseGap = BASE_MIN_GAP - (BASE_MIN_GAP - MIN_GAP_AT_MAX) * diffFactor;
  const speedGap = obstacleSpeed * MIN_GAP_SPEED_FACTOR;
  const minGap = Math.max(MIN_GAP_AT_MAX, baseGap, speedGap);
  const requiredGapAfterOverhead = minGap + EXTRA_GAP_AFTER_OVERHEAD;

  // 1. Handle duck/stand only while on ground so we don't snap mid-air
  if (player.onGround) {
    if (keys['ArrowDown']) {
      player.ducking = true;
      player.height = DUCK_HEIGHT;
      player.y = GROUND_Y - DUCK_HEIGHT;
    } else {
      player.ducking = false;
      player.height = PLAYER_HEIGHT;
      player.y = GROUND_Y - PLAYER_HEIGHT;
    }
  }

  // 2. Move left/right
  if (keys['ArrowLeft']) {
    player.x -= PLAYER_SPEED;
  }
  if (keys['ArrowRight']) {
    player.x += PLAYER_SPEED;
  }

  // 2c. Keep player inside screen bounds
  const maxX = canvas.width - player.width;
  if (player.x < 0) player.x = 0;
  if (player.x > maxX) player.x = maxX;

  // 2b. Fast-fall: pull down mid-air
  if (keys['ArrowDown'] && !player.onGround) {
    player.vy = Math.max(player.vy, FAST_FALL_VELOCITY);
  }

  // 3. Apply gravity
  player.vy += GRAVITY;
  player.y += player.vy;

  // 4. Check for ground collision
  if (player.y + player.height >= GROUND_Y) {
    player.y = GROUND_Y - player.height;
    player.vy = 0;
    player.onGround = true;
    player.jumpCount = 0;
  } else {
    player.onGround = false;
  }

  // 4b. Time-based scoring
  score += deltaMs * SCORE_PER_MS;
  updateHighScore();

  // Shooting stars: spawn + move + collect
  shootingStarTimer += deltaMs;
  if (shootingStarTimer >= nextShootingStarMs) {
    spawnShootingStar();
    shootingStarTimer = 0;
    nextShootingStarMs = randomRange(SHOOTING_STAR_MIN_INTERVAL, SHOOTING_STAR_MAX_INTERVAL);
  }
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const star = shootingStars[i];
    star.x += star.vx;
    star.y += star.vy;

    const outOfView =
      star.x < -SHOOTING_STAR_TAIL - star.width ||
      star.x > canvas.width + SHOOTING_STAR_TAIL + star.width ||
      star.y < -60 ||
      star.y > canvas.height + 60;

    if (outOfView) {
      shootingStars.splice(i, 1);
      continue;
    }

    if (!gameOver && aabbIntersect(player, star)) {
      playSound(sfx.star);
      score += 20;
      updateHighScore();
      addFloatText('+20', player.x + player.width * 0.5, player.y);
      shootingStars.splice(i, 1);
      continue;
    }
  }

  updateFloatTexts(deltaMs);

  // 5. Move obstacles and detect collisions
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= obstacleSpeed;

    if (obstacles[i].x + obstacles[i].width < 0) {
      obstacles.splice(i, 1);
      continue; // skip collision check for removed obstacle
    }

    if (COLLISIONS_ENABLED && !gameOver && checkCollision(player, obstacles[i])) {
      playSound(sfx.bonk);
      gameOver = true;
      stopMusic();
    }
  }

  // 6. Add new obstacles (ground or airborne)
  if (Math.random() < spawnChance) {
    const last = obstacles[obstacles.length - 1];
    const gapNeeded = last && last.variant === 'overhead' ? requiredGapAfterOverhead : minGap;
    if (last && last.x > canvas.width - gapNeeded) {
      // keep spacing so patterns stay fair
    } else {
      const airBias = Math.min(Math.max((score - 1000) / 1000, 0), 1); // more air after ~1000
      const airWeight = 0.22 + 0.18 * airBias; // 0.22 -> 0.4
      const overheadWeight = 0.13;
      const tallWeight = 0.3;
      const smallWeight = 1 - (airWeight + overheadWeight + tallWeight);

      const roll = Math.random();
      const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
      if (roll < smallWeight) {
        // small ground block
        obstacles.push({
          ...createObstacleDims(false),
          color,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          variant: 'ground'
        });
      } else if (roll < smallWeight + tallWeight) {
        // taller ground block (still capped)
        obstacles.push({
          ...createObstacleDims(false),
          color,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          variant: 'ground'
        });
      } else if (roll < smallWeight + tallWeight + overheadWeight) {
        // overhead crouch-required block (bottom just below standing head)
        obstacles.push({
          ...createOverheadObstacle(),
          color,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          variant: 'overhead'
        });
      } else {
        // airborne block (lane-based)
        obstacles.push({
          ...createAirObstacle(),
          color,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          variant: 'air'
        });
      }
    }
  }
}

// Draw everything
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#0b1030');
  sky.addColorStop(0.5, '#141f46');
  sky.addColorStop(1, '#1d325c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  for (const s of stars) {
    const pulse = 0.7 + 0.3 * Math.sin(s.phase + elapsedMs * s.speed);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * pulse})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon (simple crescent with overlay)
  ctx.fillStyle = '#dcdde1';
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(moon.x - 12, moon.y - 4, moon.r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Ground (dirt base with grass top)
  const groundHeight = canvas.height - GROUND_Y;
  ctx.fillStyle = '#5a3b1a'; // dirt
  ctx.fillRect(0, GROUND_Y, canvas.width, groundHeight);
  ctx.fillStyle = '#0f5c22'; // darker grass for contrast
  ctx.fillRect(0, GROUND_Y, canvas.width, Math.min(14, groundHeight));

  // Player
  ctx.fillStyle = '#00e15d'; // vivid green distinct from obstacle palette
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Obstacles
  for (let ob of obstacles) {
    drawObstacle(ob);
  }

  // Shooting stars (bonuses)
  for (const star of shootingStars) {
    drawShootingStar(star);
  }

  // Floating texts
  drawFloatTexts();

  // Score
  ctx.fillStyle = 'white';
  ctx.font = '20px monospace';
  ctx.fillText(`Score: ${Math.floor(score)}`, 10, 30);
}

// Collision detection
function checkCollision(a, b) {
  // Treat player as rectangle polygon
  const playerPoly = rectToPoly(a.x, a.y, a.width, a.height);
  const obstaclePolys = getObstaclePolygons(b);
  for (const poly of obstaclePolys) {
    if (polygonsIntersect(playerPoly, poly)) return true;
  }
  return false;
}

// Game Over screen
function showGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  ctx.font = '40px sans-serif';
  const baseY = canvas.height / 2;
  ctx.fillText('GAME OVER', canvas.width / 2 - 120, baseY);
  ctx.font = '20px monospace';
  ctx.fillText(`Final Score: ${Math.floor(score)}`, canvas.width / 2 - 80, baseY + 40);
  let restartY = baseY + 70;
  if (highScore > 0) {
    ctx.textAlign = 'center';
    ctx.fillText(`High Score: ${Math.floor(highScore)}`, canvas.width / 2, baseY + 70);
    ctx.textAlign = 'start';
    restartY = baseY + 100;
  }
  ctx.font = '16px monospace';
  ctx.fillText('Press any key to restart', canvas.width / 2 - 100, restartY);
}

// Start screen overlay
function showStartScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#4b1d6c';
  ctx.font = '60px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LATE NIGHT SCROLL', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '18px monospace';
  ctx.fillStyle = 'white';
  ctx.fillText('Press any key to start', canvas.width / 2, canvas.height / 2 + 30);
  if (highScore > 0) {
    ctx.fillText(`High Score: ${Math.floor(highScore)}`, canvas.width / 2, canvas.height / 2 + 60);
  }
  ctx.font = '12px monospace';
  ctx.fillStyle = '#d0d0d0';
  ctx.textBaseline = 'middle';
  ctx.fillText('@ MNNA 2025 | Not For Redistribution', canvas.width / 2, canvas.height - 16);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'start';
}

// Restart game state
function restartGame() {
  // Prevent stacking multiple loops if restart is triggered more than once
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  player.x = 100;
  player.y = GROUND_Y - PLAYER_HEIGHT;
  player.vy = 0;
  player.height = PLAYER_HEIGHT;
  player.ducking = false;
  player.onGround = true;
  player.jumpCount = 0;

  obstacles = [];
  score = 0;
  lastTimestamp = null;
  elapsedMs = 0;
  shootingStars = [];
  floatTexts = [];
  shootingStarTimer = 0;
  nextShootingStarMs = randomRange(SHOOTING_STAR_MIN_INTERVAL, SHOOTING_STAR_MAX_INTERVAL);
  gameOver = false;
  started = true;
  startMusic();

  requestAnimationFrame(gameLoop);
}

// Attempt a jump (ground or double-jump)
function attemptJump() {
  if (player.jumpCount < MAX_JUMPS) {
    // Stand up before jumping without snapping to ground
    if (player.ducking || player.height !== PLAYER_HEIGHT) {
      const bottom = player.y + player.height;
      player.ducking = false;
      player.height = PLAYER_HEIGHT;
      player.y = bottom - player.height;
    }
    player.vy = JUMP_FORCE;
    player.onGround = false;
    player.jumpCount += 1;
    playSound(sfx.jump);
  }
}

function startRun() {
  started = true;
  lastTimestamp = null;
  startMusic();
}

function playSound(audio) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// Obstacle helpers
function createObstacleDims(isAir) {
  const height = 30 + Math.random() * 80; // 30-110
  const width = 30 + Math.random() * 40;  // 30-70
  const y = GROUND_Y - height;
  return { x: canvas.width, y, width, height };
}

function createAirObstacle() {
  const height = 25 + Math.random() * 25; // 25-50
  const width = 30 + Math.random() * 30;  // 30-60
  const laneTop = AIR_LANES[Math.floor(Math.random() * AIR_LANES.length)];
  const y = Math.max(20, laneTop);
  return { x: canvas.width, y, width, height };
}

function createOverheadObstacle() {
  const height = 18 + Math.random() * 14; // 18-32
  const width = 40 + Math.random() * 30; // 40-70
  const bottom = GROUND_Y - PLAYER_HEIGHT + 6; // just below standing head
  const y = Math.max(10, bottom - height);
  return { x: canvas.width, y, width, height };
}

function drawObstacle(ob) {
  const color = ob.color || '#777c86';
  const shape = ob.shape || 'rect';
  ctx.fillStyle = color;

  if (shape === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(ob.x, ob.y + ob.height);
    ctx.lineTo(ob.x + ob.width, ob.y + ob.height);
    ctx.lineTo(ob.x + ob.width * 0.5, ob.y);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'diamond') {
    const midX = ob.x + ob.width * 0.5;
    const midY = ob.y + ob.height * 0.5;
    ctx.beginPath();
    ctx.moveTo(midX, ob.y); // top
    ctx.lineTo(ob.x + ob.width, midY); // right
    ctx.lineTo(midX, ob.y + ob.height); // bottom
    ctx.lineTo(ob.x, midY); // left
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'pentagon') {
    const midX = ob.x + ob.width * 0.5;
    const topY = ob.y;
    const baseY = ob.y + ob.height;
    const upperY = ob.y + ob.height * 0.35;
    const midY = ob.y + ob.height * 0.65;
    ctx.beginPath();
    ctx.moveTo(midX, topY); // top
    ctx.lineTo(ob.x + ob.width, upperY); // upper right
    ctx.lineTo(ob.x + ob.width * 0.8, baseY); // lower right
    ctx.lineTo(ob.x + ob.width * 0.2, baseY); // lower left
    ctx.lineTo(ob.x, upperY); // upper left
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'trapezoid') {
    const topWidth = ob.width * 0.7;
    const inset = (ob.width - topWidth) / 2;
    ctx.beginPath();
    ctx.moveTo(ob.x, ob.y + ob.height);
    ctx.lineTo(ob.x + ob.width, ob.y + ob.height);
    ctx.lineTo(ob.x + ob.width - inset, ob.y);
    ctx.lineTo(ob.x + inset, ob.y);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'slant') {
    const slant = Math.min(12, ob.width * 0.4);
    ctx.beginPath();
    ctx.moveTo(ob.x + slant, ob.y + ob.height);
    ctx.lineTo(ob.x + ob.width, ob.y + ob.height);
    ctx.lineTo(ob.x + ob.width - slant, ob.y);
    ctx.lineTo(ob.x, ob.y);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'step') {
    const stepHeight = ob.height * 0.45;
    ctx.fillRect(ob.x, ob.y + ob.height - stepHeight, ob.width, stepHeight);
    ctx.fillRect(ob.x, ob.y, ob.width * 0.6, ob.height - stepHeight);
    return;
  }

  ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
}

function drawShootingStar(star) {
  const headX = star.x + star.width * 0.5;
  const headY = star.y + star.height * 0.5;
  const tailX = headX - Math.sign(star.vx || 1) * SHOOTING_STAR_TAIL;
  const tailY = headY - star.vy * 6;
  const grad = ctx.createLinearGradient(headX, headY, tailX, tailY);
  grad.addColorStop(0, '#ffd166');
  grad.addColorStop(0.4, 'rgba(255, 209, 102, 0.7)');
  grad.addColorStop(1, 'rgba(126, 208, 255, 0)');

  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(headX, headY);
  ctx.lineTo(tailX, tailY);
  ctx.stroke();

  ctx.fillStyle = '#ffe29f';
  ctx.shadowColor = '#ffe29f';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(headX, headY, star.width * 0.6, star.height * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFloatTexts() {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const ft = floatTexts[i];
    const alpha = Math.max(0, ft.life / FLOAT_TEXT_LIFETIME);
    ctx.save();
    ctx.fillStyle = `rgba(0, 225, 93, ${alpha})`;
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

// Collision helpers (polygon SAT, step handled as two rects)
function rectToPoly(x, y, w, h) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
}

function getObstaclePolygons(ob) {
  const { x, y, width: w, height: h, shape = 'rect' } = ob;
  if (shape === 'triangle') {
    return [[
      { x, y: y + h },
      { x: x + w, y: y + h },
      { x: x + w * 0.5, y }
    ]];
  }
  if (shape === 'diamond') {
    const midX = x + w * 0.5;
    const midY = y + h * 0.5;
    return [[
      { x: midX, y },
      { x: x + w, y: midY },
      { x: midX, y: y + h },
      { x, y: midY }
    ]];
  }
  if (shape === 'pentagon') {
    const midX = x + w * 0.5;
    const topY = y;
    const baseY = y + h;
    const upperY = y + h * 0.35;
    const midY = y + h * 0.65;
    return [[
      { x: midX, y: topY },
      { x: x + w, y: upperY },
      { x: x + w * 0.8, y: baseY },
      { x: x + w * 0.2, y: baseY },
      { x, y: upperY }
    ]];
  }
  if (shape === 'trapezoid') {
    const topWidth = w * 0.7;
    const inset = (w - topWidth) / 2;
    return [[
      { x, y: y + h },
      { x: x + w, y: y + h },
      { x: x + w - inset, y },
      { x: x + inset, y }
    ]];
  }
  if (shape === 'slant') {
    const slant = Math.min(12, w * 0.4);
    return [[
      { x: x + slant, y: y + h },
      { x: x + w, y: y + h },
      { x: x + w - slant, y },
      { x, y }
    ]];
  }
  if (shape === 'step') {
    const stepHeight = h * 0.45;
    const lower = rectToPoly(x, y + h - stepHeight, w, stepHeight);
    const upper = rectToPoly(x, y, w * 0.6, h - stepHeight);
    return [lower, upper];
  }
  // default rectangle
  return [rectToPoly(x, y, w, h)];
}

function polygonsIntersect(a, b) {
  // Separating Axis Theorem for convex polygons
  const axes = [...getAxes(a), ...getAxes(b)];
  for (const axis of axes) {
    const projA = projectPoly(a, axis);
    const projB = projectPoly(b, axis);
    if (projA.max < projB.min || projB.max < projA.min) return false;
  }
  return true;
}

function getAxes(poly) {
  const axes = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const normal = { x: -edge.y, y: edge.x };
    // normalize not needed for SAT projection overlap check
    axes.push(normal);
  }
  return axes;
}

function projectPoly(poly, axis) {
  let min = dot(poly[0], axis);
  let max = min;
  for (let i = 1; i < poly.length; i++) {
    const d = dot(poly[i], axis);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

function dot(p, a) {
  return p.x * a.x + p.y * a.y;
}

function addFloatText(text, x, y) {
  floatTexts.push({
    text,
    x,
    y,
    life: FLOAT_TEXT_LIFETIME
  });
}

function updateFloatTexts(deltaMs) {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const ft = floatTexts[i];
    ft.life -= deltaMs;
    ft.y -= FLOAT_TEXT_RISE_PER_MS * deltaMs;
    if (ft.life <= 0) {
      floatTexts.splice(i, 1);
    }
  }
}

function aabbIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function spawnShootingStar() {
  const fromLeft = Math.random() < 0.5;
  const y = randomRange(90, Math.max(120, GROUND_Y - 130)); // ensure reachable height
  const speed = randomRange(SHOOTING_STAR_SPEED.min, SHOOTING_STAR_SPEED.max);
  const drift = randomRange(-1.4, 1.4);
  const vx = fromLeft ? speed : -speed;
  const x = fromLeft
    ? -SHOOTING_STAR_SIZE.width - 12
    : canvas.width + SHOOTING_STAR_SIZE.width + 12;

  shootingStars.push({
    x,
    y,
    width: SHOOTING_STAR_SIZE.width,
    height: SHOOTING_STAR_SIZE.height,
    vx,
    vy: drift
  });
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    persistHighScore(highScore);
  }
}

function loadHighScore() {
  try {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    const parsed = saved ? parseFloat(saved) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (e) {
    return 0;
  }
}

function persistHighScore(value) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, Math.floor(value).toString());
  } catch (e) {
    // ignore storage failures (e.g., blocked cookies/storage)
  }
}

// Start game
startMusic();
requestAnimationFrame(gameLoop);

