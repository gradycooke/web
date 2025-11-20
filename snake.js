const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_HEIGHT = 600;
const TILE_SIZE = 20;
const MAX_TILES = (canvas.width / TILE_SIZE) * (GAME_HEIGHT / TILE_SIZE);

const eatSound = new Audio('chime-sound-7143.ogg');
const gameOverSound = new Audio('negative_beeps-6008.ogg');
const winSound = new Audio('short-crowd-cheer-6713.ogg');

let bgReady = false;
const bgImage = new Image();
bgImage.src = "starry_background.jpg";
bgImage.onload = () => {
  bgReady = true;
  document.getElementById('menu').style.display = 'block';
};

let difficultyLabel = "Easy";
let snake = [{ x: 200, y: 200 }];
let direction = 'RIGHT';
let food = { x: 300, y: 300 };
let gameLoop;
let speed = 5;
let directionChanged = false;
let paused = false;
let gameOver = false;
let youWin = false;

document.addEventListener('keydown', handleGlobalKeys);
document.addEventListener('keydown', changeDirection);

function handleGlobalKeys(e) {
  const menuVisible = document.getElementById('menu').style.display !== 'none';
  const gameOverVisible = document.getElementById('gameOverScreen').style.display !== 'none';

  if (menuVisible) {
    if (e.key === '1') startGame(10);
    else if (e.key === '2') startGame(20);
    else if (e.key === '3') startGame(30);
    return;
  }

  if (e.key === 'Backspace') {
    clearInterval(gameLoop);
    document.getElementById('menu').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
    gameOver = false;
    youWin = false;
  } else if (e.key === 'Enter' || e.key === ' ') {
    if (gameOverVisible) {
      startGame(speed);
    } else {
      paused = !paused;
      if (paused) clearInterval(gameLoop);
      else gameLoop = setInterval(update, 1000 / speed);
    }
  }
}

function startGame(selectedSpeed) {
  speed = selectedSpeed;
  paused = false;
  gameOver = false;
  youWin = false;

  if (speed === 10) difficultyLabel = "Easy";
  else if (speed === 20) difficultyLabel = "Medium";
  else if (speed === 30) difficultyLabel = "Hard";
  else difficultyLabel = "Custom";

  document.getElementById('menu').style.display = 'none';
  document.getElementById('gameOverScreen').style.display = 'none';

  resetGame();
  gameLoop = setInterval(update, 1000 / speed);
}

function resetGame() {
  snake = [{ x: 200, y: 200 }];
  direction = 'RIGHT';
  spawnFood();
}

function changeDirection(e) {
  if (directionChanged || gameOver || document.getElementById('menu').style.display !== 'none') return;

  const key = e.key;
  if (key === 'ArrowUp' && direction !== 'DOWN') {
    direction = 'UP';
    directionChanged = true;
  } else if (key === 'ArrowDown' && direction !== 'UP') {
    direction = 'DOWN';
    directionChanged = true;
  } else if (key === 'ArrowLeft' && direction !== 'RIGHT') {
    direction = 'LEFT';
    directionChanged = true;
  } else if (key === 'ArrowRight' && direction !== 'LEFT') {
    direction = 'RIGHT';
    directionChanged = true;
  }
}

function spawnFood() {
  let valid = false;
  while (!valid) {
    const x = Math.floor(Math.random() * (canvas.width / TILE_SIZE)) * TILE_SIZE;
    const y = Math.floor(Math.random() * (GAME_HEIGHT / TILE_SIZE)) * TILE_SIZE;

    const onSnake = snake.some(segment => segment.x === x && segment.y === y);
    if (!onSnake) {
      food = { x, y };
      valid = true;
    }
  }
}

function update() {
  if (paused || gameOver || youWin) return;

  const head = { ...snake[0] };
  if (direction === 'UP') head.y -= TILE_SIZE;
  if (direction === 'DOWN') head.y += TILE_SIZE;
  if (direction === 'LEFT') head.x -= TILE_SIZE;
  if (direction === 'RIGHT') head.x += TILE_SIZE;
  snake.unshift(head);

  // Check win condition BEFORE collision
  if (head.x === food.x && head.y === food.y) {
    eatSound.currentTime = 0;
    eatSound.play();
    if (snake.length >= MAX_TILES) {
        winGame();
        return;
    }
    spawnFood();
  } else {
    snake.pop();
  }

  // Check for wall or self collision
  if (
    head.x < 0 || head.y < 0 ||
    head.x >= canvas.width || head.y >= GAME_HEIGHT ||
    snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y)
  ) {
    loseGame();
    return;
  }

  draw();
  directionChanged = false;
}

function loseGame() {
  clearInterval(gameLoop);
  gameOver = true;
  gameOverSound.play();
  showGameOverScreen("GAME OVER", snake.length);
}

function winGame() {
  clearInterval(gameLoop);
  youWin = true;
  winSound.play();
  showGameOverScreen("YOU WIN!", snake.length);
}

function showGameOverScreen(title, score) {
  document.getElementById('gameOverScreen').style.display = 'block';
  document.getElementById('gameOverTitle').textContent = title;
  document.getElementById('finalScore').textContent = `Score: ${score}`;
  document.getElementById('finalDifficulty').textContent = `Difficulty: ${difficultyLabel}`;
}

function draw() {
  // ✅ Only draw background if image is fully loaded
  if (bgReady) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, GAME_HEIGHT);
  } else {
    // Fallback: clear canvas if background isn't ready
    ctx.clearRect(0, 0, canvas.width, GAME_HEIGHT);
  }

  ctx.fillStyle = 'red';
  ctx.fillRect(food.x, food.y, TILE_SIZE, TILE_SIZE);

  ctx.fillStyle = 'lime';
  for (const segment of snake) {
    ctx.fillRect(segment.x, segment.y, TILE_SIZE, TILE_SIZE);
  }

  // Score Bar background
  ctx.fillStyle = 'black';
  ctx.fillRect(0, GAME_HEIGHT, canvas.width, canvas.height - GAME_HEIGHT);

  // Score text
  ctx.fillStyle = 'white';
  ctx.font = '20px Century Gothic';
  ctx.textAlign = 'start';
  ctx.fillText(`Score: ${snake.length}`, 10, GAME_HEIGHT + 25);

  // Controls instructions
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Century Gothic';
  const instructions = 'BACKSPACE = Change Difficulty | ENTER = Restart | SPACE = Pause';
  const instructionsWidth = ctx.measureText(instructions).width;
  ctx.fillText(instructions, canvas.width - instructionsWidth - 10, GAME_HEIGHT + 18);

  // Copyright footer
  const footer = '@ MNNA 2025 | Not For Redistribution';
  ctx.font = '10px Century Gothic';
  const footerWidth = ctx.measureText(footer).width;
  ctx.fillText(footer, canvas.width - footerWidth - 10, GAME_HEIGHT + 35);
}

bgImage.onload = () => {
  document.getElementById('menu').style.display = 'block';
  
  document.addEventListener('keydown', handleGlobalKeys);
  document.addEventListener('keydown', changeDirection);
};















