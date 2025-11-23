const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_HEIGHT = 600;
const TILE_SIZE = 20;
const MAX_TILES = (canvas.width / TILE_SIZE) * (GAME_HEIGHT / TILE_SIZE);

const eatSound = new Audio('chime-sound-7143.ogg');
const gameOverSound = new Audio('negative_beeps-6008.ogg');
const winSound = new Audio('short-crowd-cheer-6713.ogg');
const bgImage = new Image();
bgImage.src = "starry_background.jpg";

let snake, food, direction, directionChanged, paused;
let speed = 10;
let difficultyLabel = "Easy";
let gameLoop;
let gameOver = false;
let youWin = false;
let currentScreen = 'start';

function startGame(difficulty) {
  speed = difficulty;
  difficultyLabel = speed === 10 ? "Easy" : speed === 20 ? "Medium" : speed === 30 ? "Hard" : "Custom";

  currentScreen = 'game';
  paused = false;
  gameOver = false;
  youWin = false;
  resetGame();
  gameLoop = setInterval(update, 1000 / speed);
}

function resetGame() {
  snake = [{ x: 200, y: 200 }];
  direction = 'RIGHT';
  directionChanged = false;
  spawnFood();
}

function handleGlobalKeys(e) {
  if (currentScreen === 'start') {
    if (e.key === '1') startGame(10);
    if (e.key === '2') startGame(20);
    if (e.key === '3') startGame(30);
    return;
  }

  if (e.key === 'Backspace') {
    clearInterval(gameLoop);
    currentScreen = 'start';
  } else if (e.key === 'Enter') {
    if (currentScreen === 'gameover') {
      startGame(speed);
    } else {
      paused = !paused;
      if (paused) clearInterval(gameLoop);
      else gameLoop = setInterval(update, 1000 / speed);
    }
  }
}

function changeDirection(e) {
  if (directionChanged || gameOver || currentScreen !== 'game') return;

  if (e.key === 'ArrowUp' && direction !== 'DOWN') direction = 'UP';
  else if (e.key === 'ArrowDown' && direction !== 'UP') direction = 'DOWN';
  else if (e.key === 'ArrowLeft' && direction !== 'RIGHT') direction = 'LEFT';
  else if (e.key === 'ArrowRight' && direction !== 'LEFT') direction = 'RIGHT';
  else return;

  directionChanged = true;
}

document.addEventListener('keydown', handleGlobalKeys);
document.addEventListener('keydown', changeDirection);

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
  if (paused || gameOver || youWin || currentScreen !== 'game') return;

  const head = { ...snake[0] };
  if (direction === 'UP') head.y -= TILE_SIZE;
  if (direction === 'DOWN') head.y += TILE_SIZE;
  if (direction === 'LEFT') head.x -= TILE_SIZE;
  if (direction === 'RIGHT') head.x += TILE_SIZE;
  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    eatSound.play();
    if (snake.length >= 2) return winGame();
    spawnFood();
  } else {
    snake.pop();
  }

  if (
    head.x < 0 || head.y < 0 ||
    head.x >= canvas.width || head.y >= GAME_HEIGHT ||
    snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y)
  ) {
    return loseGame();
  }

  draw();
  directionChanged = false;
}

function loseGame() {
  clearInterval(gameLoop);
  gameOver = true;
  currentScreen = 'gameover';
  gameOverSound.currentTime = 0;
  gameOverSound.play();
}

function winGame() {
  clearInterval(gameLoop);
  youWin = true;
  currentScreen = 'gameover';
  winSound.play();
}

function draw() {
  if (currentScreen === 'start') {
    drawStartScreen();
  } else {
    // Draw game normally
    ctx.drawImage(bgImage, 0, 0, canvas.width, GAME_HEIGHT);

    // Food
    ctx.fillStyle = 'red';
    ctx.fillRect(food.x, food.y, TILE_SIZE, TILE_SIZE);

    // Snake
    ctx.fillStyle = 'lime';
    for (const segment of snake) {
      ctx.fillRect(segment.x, segment.y, TILE_SIZE, TILE_SIZE);
    }

    // Score bar
    ctx.fillStyle = 'black';
    ctx.fillRect(0, GAME_HEIGHT, canvas.width, canvas.height - GAME_HEIGHT);

    // Score
    ctx.fillStyle = 'white';
    ctx.font = '20px Century Gothic';
    ctx.textAlign = 'start';
    ctx.fillText(`Score: ${snake.length}`, 10, GAME_HEIGHT + 25);

    // Instructions
    ctx.fillStyle = '#ccc';
    ctx.font = '12px Century Gothic';
    const instructions = 'BACKSPACE = Change Difficulty | ENTER = Pause';
    const instructionsWidth = ctx.measureText(instructions).width;
    ctx.fillText(instructions, canvas.width - instructionsWidth - 10, GAME_HEIGHT + 18);

    // Footer
    const footer = '@ MNNA 2025 | Not For Redistribution';
    ctx.font = '10px Century Gothic';
    const footerWidth = ctx.measureText(footer).width;
    ctx.fillText(footer, canvas.width - footerWidth - 10, GAME_HEIGHT + 35);

    if (currentScreen === 'gameover') {
      drawGameOverOverlay();
    }
  }

  requestAnimationFrame(draw);
}

function drawStartScreen() {
  // Draw background image using fixed game height
  ctx.drawImage(bgImage, 0, 0, canvas.width, GAME_HEIGHT);

  // Subtle float offset
  const floatY = Math.sin(Date.now() / 600) * 25;

  // Title text (two lines) with black outline and subtle float
  ctx.font = '70px Century Gothic';
  ctx.textAlign = 'center';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'white';

  const titleLine1Y = canvas.height / 2 - 130 + floatY;
  const titleLine2Y = canvas.height / 2 - 50 + floatY;

  ctx.strokeText('Silly Outer Space', canvas.width / 2, titleLine1Y);
  ctx.fillText('Silly Outer Space', canvas.width / 2, titleLine1Y);

  ctx.strokeText('Worm Game', canvas.width / 2, titleLine2Y);
  ctx.fillText('Worm Game', canvas.width / 2, titleLine2Y);

  // Difficulty options (no float, no outline)
  ctx.font = '30px Century Gothic';
  ctx.fillStyle = 'white';
  ctx.fillText('Press 1 for EASY', canvas.width / 2, canvas.height / 2 + 70);
  ctx.fillText('Press 2 for MEDIUM', canvas.width / 2, canvas.height / 2 + 120);
  ctx.fillText('Press 3 for HARD', canvas.width / 2, canvas.height / 2 + 170);
}


function drawGameOverOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '80px Century Gothic';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'black';
  
  // Change fill color based on win or lose
  ctx.fillStyle = gameOver ? 'red' : 'lime';
  
  ctx.fillText(gameOver ? 'GAME OVER' : 'YOU WIN!', canvas.width / 2, canvas.height / 2 - 100);
  
  ctx.font = '35px Century Gothic';
  ctx.fillText(`Score: ${snake.length}`, canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillText(`Difficulty: ${difficultyLabel}`, canvas.width / 2, canvas.height / 2 + 35);

  ctx.font = '20px Century Gothic';
  ctx.fillText('Press ENTER to Restart', canvas.width / 2, canvas.height / 2 + 150);
  ctx.fillText('Press BACKSPACE to Change Difficulty', canvas.width / 2, canvas.height / 2 + 180);
}


bgImage.onload = () => {
  // Start loop only after image is ready
  requestAnimationFrame(draw);
};




