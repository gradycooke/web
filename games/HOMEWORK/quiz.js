(() => {
  const startScreen = document.getElementById('startScreen');
  const questionScreen = document.getElementById('questionScreen');
  const winScreen = document.getElementById('winScreen');
  const loseScreen = document.getElementById('loseScreen');
  const startButton = document.getElementById('startButton');
  const submitAnswer = document.getElementById('submitAnswer');
  const playAgainWin = document.getElementById('playAgainWin');
  const playAgainLose = document.getElementById('playAgainLose');
  const restartButton = document.getElementById('restartButton');
  const timerDisplay = document.getElementById('timerDisplay');
  const livesDisplay = document.getElementById('livesDisplay');
  const flowerField = document.getElementById('flowerField');
  const numberField = document.getElementById('numberField');
  const shapeField = document.getElementById('shapeField');
  const colorLegend = document.getElementById('colorLegend');
  const memoryDisplay = document.getElementById('memoryDisplay');
  const primeField = document.getElementById('primeField');
  const arrowStage = document.getElementById('arrowStage');
  const arrowNext = document.getElementById('arrowNext');
  const arrowProgress = document.getElementById('arrowProgress');
  const angleField = document.getElementById('angleField');
  const cipherStatus = document.getElementById('cipherStatus');
  const recallOverlay = document.getElementById('recallOverlay');
  const hanoiField = document.getElementById('hanoiField');
  const answerInput = document.getElementById('answerInput');
  const statusMessage = document.getElementById('statusMessage');
  const loseReason = document.getElementById('loseReason');
  const bestTimeDisplay = document.getElementById('bestTime');
  const promptText = document.getElementById('promptText');

  const stageOrder = ['flowers', 'sum', 'memory', 'colors', 'prime', 'arrows', 'angle', 'cipher', 'recall', 'hanoi'];
  const stageEnabled = {
    flowers: true,
    sum: true,
    memory: true,
    colors: true,
    prime: true,
    arrows: true,
    angle: true,
    cipher: true,
    recall: true,
    hanoi: true
  };

  const screens = [startScreen, questionScreen, winScreen, loseScreen];

  let lives = 5;
  let timeElapsed = 0;
  let timerId = null;
  let correctAnswer = 0;
  const BEST_TIME_KEY = 'homework-best-time';
  let bestTime = null;
  let stage = 'flowers'; // 'flowers' -> 'sum' -> 'memory' -> 'colors' -> 'prime' -> 'arrows'
  let memoryNumbers = [];
  let memoryTimeoutId = null;
  let colorMap = [];
  let primeAnswer = null;
  let arrowSequence = [];
  let arrowIndex = 0;
  let arrowCounts = {};
  let awaitingArrowOrder = false;
  let angleTarget = null;
  let cipherShift = 0;
  let cipherRaw = '';
  let cipherTarget = 'RAINBOW';
  let firstFlowerCount = null;
  let hanoiState = { pegs: [[], [], []], sumTimer: null, sumTimeLeft: 10, sumA: 0, sumB: 0, diskCount: 4 };
  const hanoiDrag = { active: false, fromPeg: null, size: null, ghost: null };
  const musicTracks = ['embrace-364091.ogg', 'good-night-lofi-cozy-chill-music-160166.ogg', 'groovy-vibe-427121.ogg'];
  const victoryTrack = '11l-victory_sound_with_t-1749487402950-357606.ogg';
  const loseTrack = 'game-over-2-sound-effect-230463.ogg';
  let musicAudio = null;
  let currentTrack = null;
  const unlockMusic = () => {
    startMusic();
    document.removeEventListener('pointerdown', unlockMusic);
    document.removeEventListener('keydown', unlockMusic);
  };
  const volumeSlider = document.getElementById('volumeSlider');

  const loadBestTime = () => {
    try {
      const stored = localStorage.getItem(BEST_TIME_KEY);
      const parsed = Number(stored);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch (e) {
      return null;
    }
  };

  const persistBestTime = (value) => {
    try {
      localStorage.setItem(BEST_TIME_KEY, String(value));
    } catch (e) {
      // ignore storage errors
    }
  };

  const nextEnabledStage = (currentStage) => {
    if (currentStage === null) {
      return stageOrder.find((s) => stageEnabled[s]) || null;
    }
    const idx = stageOrder.indexOf(currentStage);
    for (let i = idx + 1; i < stageOrder.length; i += 1) {
      if (stageEnabled[stageOrder[i]]) return stageOrder[i];
    }
    return null;
  };

  const hideAllStages = () => {
    flowerField.style.display = 'none';
    numberField.classList.remove('active');
    shapeField.classList.remove('active');
    colorLegend.classList.remove('active');
    primeField.classList.remove('active');
    arrowStage.classList.remove('active');
    angleField.classList.remove('active');
    recallOverlay.style.display = 'none';
    memoryDisplay.classList.remove('active');
    hanoiField.classList.remove('active');
    hanoiField.innerHTML = '';
    if (hanoiState.sumTimer) {
      clearInterval(hanoiState.sumTimer);
      hanoiState.sumTimer = null;
    }
    if (hanoiDrag.ghost) {
      hanoiDrag.ghost.remove();
      hanoiDrag.ghost = null;
    }
    hanoiDrag.active = false;
    hanoiDrag.fromPeg = null;
    hanoiDrag.size = null;
  };

  const pickNextTrack = () => {
    if (!musicTracks.length) return null;
    const available = musicTracks.filter((track) => track !== currentTrack);
    const pool = available.length ? available : musicTracks;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  };

  const handleMusicEnded = () => {
    const next = pickNextTrack();
    if (!next) return;
    if (musicAudio) {
      musicAudio.removeEventListener('ended', handleMusicEnded);
    }
    musicAudio = new Audio(next);
    if (volumeSlider) {
      musicAudio.volume = Number(volumeSlider.value || 1);
    }
    musicAudio.addEventListener('ended', handleMusicEnded);
    currentTrack = next;
    musicAudio.play().catch(() => {});
  };

  const startMusic = () => {
    if (musicAudio && !musicAudio.paused && !musicAudio.ended) return;
    handleMusicEnded();
  };

  const stopMusic = () => {
    if (!musicAudio) return;
    musicAudio.removeEventListener('ended', handleMusicEnded);
    musicAudio.pause();
    musicAudio.currentTime = 0;
    musicAudio = null;
  };

  const playSfx = (src) => {
    const audio = new Audio(src);
    if (volumeSlider) {
      audio.volume = Number(volumeSlider.value || 1);
    }
    audio.play().catch(() => {});
  };

  const setScreen = (screenEl) => {
    screens.forEach((el) => el.classList.remove('active'));
    screenEl.classList.add('active');
  };

  const formatSeconds = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimer = () => {
    timerDisplay.textContent = formatSeconds(timeElapsed);
  };

  const renderLives = () => {
    livesDisplay.textContent = Array.from({ length: lives }, () => '\u2665').join(' ');
  };

  const startTimer = () => {
    clearInterval(timerId);
    timerId = setInterval(() => {
      timeElapsed += 1;
      formatTimer();
    }, 1000);
  };

  const generateField = () => {
    flowerField.innerHTML = '';
    numberField.innerHTML = '';
    shapeField.innerHTML = '';
    colorLegend.innerHTML = '';
    primeField.innerHTML = '';
    arrowStage.classList.remove('active');
    memoryDisplay.innerHTML = '';

    const count = 13 + Math.floor(Math.random() * 11);
    correctAnswer = count;
    if (firstFlowerCount === null) {
      firstFlowerCount = count;
    }

    const gradients = [
      'radial-gradient(circle at 30% 30%, #ffffff 5%, #d6f7ff 15%, #7fd8ff 32%, #00a7f0 55%, #006bb3 75%, #004c80 100%)', // blue
      'radial-gradient(circle at 30% 30%, #ffffff 5%, #fff2d6 15%, #ffd66b 32%, #ffad1f 55%, #c76f00 75%, #7a3d00 100%)', // yellow-orange
      'radial-gradient(circle at 30% 30%, #ffffff 5%, #e5ffe8 15%, #9effc1 32%, #35f28f 55%, #0fa15b 75%, #0b6a3d 100%)', // green
      'radial-gradient(circle at 30% 30%, #ffffff 5%, #f6e5ff 15%, #d2a3ff 32%, #a45cff 55%, #6e2ed6 75%, #44198f 100%)', // purple
      'radial-gradient(circle at 30% 30%, #ffffff 5%, #ffe6f2 15%, #ff9fcf 32%, #ff5fb2 55%, #c92e79 75%, #7a184a 100%)', // pink
      'radial-gradient(circle at 30% 30%, #ffffff 5%, #e3fff6 15%, #9fffe2 32%, #34e6b7 55%, #00ad88 75%, #006556 100%)' // teal
    ];

    const positions = [];
    const minGap = 7; // percent units between centers to avoid overlap
    const maxAttempts = 300;

    for (let i = 0; i < count; i += 1) {
      let attempts = 0;
      let x = 0;
      let y = 0;
      let valid = false;

      while (attempts < maxAttempts && !valid) {
        x = Math.random() * 88 + 6;
        y = Math.random() * 78 + 12;
        valid = positions.every(([px, py]) => {
          const dx = px - x;
          const dy = py - y;
          return Math.hypot(dx, dy) >= minGap;
        });
        attempts += 1;
      }

      positions.push([x, y]);

      const flower = document.createElement('div');
      flower.className = 'flower';

      const scale = 0.85 + Math.random() * 0.35;
      const rotation = (Math.random() * 8 - 4).toFixed(2);
      const gradient = gradients[Math.floor(Math.random() * gradients.length)];

      flower.style.left = `${x}%`;
      flower.style.top = `${y}%`;
      flower.style.setProperty('--rot', `${rotation}deg`);
      flower.style.setProperty('--scale', scale.toFixed(2));
      flower.style.background = gradient;
      flower.style.boxShadow = '0 0 0 2px #fefefe, 0 0 10px rgba(255, 255, 255, 0.35), 0 0 18px rgba(80, 255, 200, 0.35)';
      flower.style.filter = 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.6))';

      flowerField.appendChild(flower);
    }
  };

  const generateNumbers = () => {
    numberField.innerHTML = '';
    shapeField.innerHTML = '';
    colorLegend.innerHTML = '';
    primeField.innerHTML = '';
    arrowStage.classList.remove('active');
    memoryDisplay.innerHTML = '';
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 numbers
    const numbers = Array.from({ length: count }, () => 10 + Math.floor(Math.random() * 90));
    correctAnswer = numbers.reduce((sum, n) => sum + n, 0);

    const positions = [];
    const minGap = 12;
    const maxAttempts = 300;

    numbers.forEach((num) => {
      let attempts = 0;
      let x = 0;
      let y = 0;
      let valid = false;

      while (attempts < maxAttempts && !valid) {
        x = Math.random() * 60 + 20; // keep away from edges to allow drift
        y = Math.random() * 58 + 22;
        valid = positions.every(([px, py]) => Math.hypot(px - x, py - y) >= minGap);
        attempts += 1;
      }

      positions.push([x, y]);

      const token = document.createElement('div');
      token.className = 'number-token';
      token.textContent = num;

      const dx = (Math.random() * 60 - 30).toFixed(0); // px drift
      const dy = (Math.random() * 40 - 20).toFixed(0); // px drift
      const duration = 7 + Math.random() * 6;

      token.style.left = `${x}%`;
      token.style.top = `${y}%`;
      token.style.setProperty('--dx', `${dx}px`);
      token.style.setProperty('--dy', `${dy}px`);
      token.style.setProperty('--numDuration', `${duration}s`);

      numberField.appendChild(token);
    });
  };

  const resetState = () => {
    lives = 5;
    timeElapsed = 0;
    statusMessage.textContent = '';
    statusMessage.style.textAlign = 'center';
    answerInput.value = '';
    answerInput.disabled = false;
    memoryNumbers = [];
    clearTimeout(memoryTimeoutId);
    primeAnswer = null;
    arrowSequence = [];
    arrowIndex = 0;
    arrowCounts = {};
    awaitingArrowOrder = false;
    angleTarget = null;
    cipherShift = 0;
    cipherRaw = '';
    firstFlowerCount = null;
    renderLives();
    formatTimer();
  };

  const goToStage = (targetStage) => {
    stage = targetStage;
    hideAllStages();
    answerInput.disabled = false;
    statusMessage.textContent = '';
    cipherStatus.textContent = '';
    cipherStatus.style.display = 'none';
    promptText.style.fontSize = '';
    promptText.style.textAlign = '';
    statusMessage.style.textAlign = 'center';
    questionScreen.classList.remove('colors-mode');

    if (stage === 'flowers') {
      promptText.textContent = 'Count the flowers in the field.';
      answerInput.max = '99';
      answerInput.placeholder = 'How many flowers?';
      answerInput.setAttribute('aria-label', 'Enter the number of flowers');
      flowerField.style.display = 'block';
      generateField();
      answerInput.focus();
      return;
    }

    if (stage === 'sum') {
      promptText.textContent = 'Add the numbers.';
      answerInput.value = '';
      answerInput.max = '999';
      answerInput.placeholder = 'Total';
      answerInput.setAttribute('aria-label', 'Enter the total');
      numberField.classList.add('active');
      generateNumbers();
      answerInput.focus();
      return;
    }

    if (stage === 'memory') {
      promptText.textContent = 'Memorize the numbers.';
      answerInput.value = '';
      answerInput.placeholder = '...';
      answerInput.setAttribute('aria-label', 'Memorize then enter numbers');
      showMemoryNumbers();
      return;
    }

    if (stage === 'colors') {
      promptText.textContent = 'Use the legend to sum the colored shapes.';
      promptText.style.textAlign = 'left';
      questionScreen.classList.add('colors-mode');
      answerInput.value = '';
      answerInput.placeholder = 'Total';
      answerInput.setAttribute('aria-label', 'Enter the total from the colored shapes');
      answerInput.max = '9999';
      answerInput.disabled = false;
      generateColorPuzzle();
      shapeField.classList.add('active');
      answerInput.focus();
      return;
    }

    if (stage === 'prime') {
      promptText.textContent = 'Enter the prime number.';
      answerInput.value = '';
      answerInput.placeholder = 'Prime number';
      answerInput.disabled = false;
      answerInput.setAttribute('aria-label', 'Enter the prime number shown');
      answerInput.max = '999';
      generatePrimePuzzle();
      primeField.classList.add('active');
      answerInput.focus();
      return;
    }

    if (stage === 'arrows') {
      promptText.textContent = 'Press the arrows shown.';
      statusMessage.textContent = '';
      answerInput.value = '';
      answerInput.placeholder = 'Order arrows later';
      answerInput.setAttribute('aria-label', 'Order arrows later');
      answerInput.disabled = true;
      generateArrowSequence();
      arrowStage.classList.add('active');
      updateArrowUI();
      return;
    }

    if (stage === 'angle') {
      promptText.textContent = 'Enter the angle shown (+/- 5 degrees).';
      answerInput.value = '';
      answerInput.placeholder = 'Angle in degrees';
      answerInput.setAttribute('aria-label', 'Enter the angle shown');
      answerInput.max = '180';
      answerInput.disabled = false;
      generateAnglePuzzle();
      angleField.classList.add('active');
      answerInput.focus();
      return;
    }

    if (stage === 'cipher') {
      const words = ['RAINBOW', 'MANDELA', 'GIRAFFE', 'PACIFIC', 'HISTORY'];
      cipherTarget = words[Math.floor(Math.random() * words.length)];
      const shiftOptions = [...Array(5)].map((_, i) => i + 1).concat([...Array(5)].map((_, i) => -(i + 1)));
      cipherShift = shiftOptions[Math.floor(Math.random() * shiftOptions.length)];
      promptText.textContent = `Type ${cipherTarget}.`;
      promptText.style.fontSize = '18px';
      answerInput.value = '';
      answerInput.placeholder = 'Type ciphered letters';
      answerInput.setAttribute('aria-label', `Type the ciphered letters for ${cipherTarget}`);
      answerInput.disabled = false;
      cipherRaw = '';
      const shiftText = `Cipher shift: ${cipherShift > 0 ? '+' : ''}${cipherShift}`;
      cipherStatus.textContent = shiftText;
      cipherStatus.style.display = 'flex';
      statusMessage.textContent = '';
      answerInput.focus();
      return;
    }

    if (stage === 'recall') {
      promptText.textContent = '';
      promptText.style.fontSize = '';
      if (firstFlowerCount === null) {
        statusMessage.textContent = 'No flower count recorded yet.';
        answerInput.disabled = true;
        return;
      }
      statusMessage.textContent = '';
      recallOverlay.textContent = 'Enter the flower count from the first problem.';
      recallOverlay.style.display = 'flex';
      answerInput.value = '';
      answerInput.placeholder = 'Flower count';
      answerInput.setAttribute('aria-label', 'Enter the first flower count');
      answerInput.max = '999';
      answerInput.disabled = false;
      correctAnswer = firstFlowerCount;
      answerInput.focus();
      return;
    }

    if (stage === 'hanoi') {
      promptText.innerHTML = 'Solve Tower of Hanoi<br>and sum the numbers in time.';
      promptText.style.fontSize = '';
      statusMessage.textContent = 'Keep solving sums within 10s while moving disks.';
      statusMessage.style.textAlign = 'left';
      answerInput.disabled = false;
      answerInput.placeholder = 'Sum';
      answerInput.setAttribute('aria-label', 'Answer the current sum');
      answerInput.value = '';
      setupHanoi();
      hanoiField.classList.add('active');
      answerInput.focus();
    }
  };

  const advanceFrom = (currentStage) => {
    const next = nextEnabledStage(currentStage);
    if (!next) {
      endGame(true);
      return;
    }
    goToStage(next);
  };

  const startGame = () => {
    resetState();
    startMusic();
    const firstStage = nextEnabledStage(null);
    if (!firstStage) {
      statusMessage.textContent = 'No stages enabled.';
      return;
    }
    goToStage(firstStage);
    setScreen(questionScreen);
    startTimer();
    setTimeout(() => {
      if (!answerInput.disabled) {
        answerInput.focus();
      }
    }, 0);
  };

  const showMemoryNumbers = () => {
    memoryNumbers = Array.from({ length: 3 }, () => 100 + Math.floor(Math.random() * 900));
    correctAnswer = memoryNumbers.join(' ');

    memoryDisplay.innerHTML = memoryNumbers
      .map((num) => `<div class="memory-number">${num}</div>`)
      .join('');

    memoryDisplay.classList.add('active');
    numberField.classList.remove('active');
    flowerField.style.display = 'none';
    answerInput.disabled = true;
    statusMessage.textContent = 'Memorize these numbers!';
    statusMessage.style.textAlign = 'center';

    memoryTimeoutId = setTimeout(() => {
      memoryDisplay.classList.remove('active');
      memoryDisplay.innerHTML = '';
      statusMessage.textContent = 'Enter the three numbers (separate with spaces).';
      statusMessage.style.textAlign = 'left';
      answerInput.placeholder = '123 456 789';
      answerInput.setAttribute('aria-label', 'Enter the three numbers you saw');
      answerInput.disabled = false;
      answerInput.focus();
    }, 3600);
  };

  const generateColorPuzzle = () => {
    shapeField.innerHTML = '';
    colorLegend.innerHTML = '';
    // High-contrast, color-blind-friendly palette
    const colors = [
      { name: 'Blue', value: '#0072B2' },
      { name: 'Orange', value: '#E69F00' },
      { name: 'Green', value: '#009E73' },
      { name: 'Black', value: '#000000' },
      { name: 'White', value: '#FFFFFF' }
    ];

    const numbers = Array.from({ length: 9 }, (_, i) => i + 1);
    numbers.sort(() => Math.random() - 0.5);
    colorMap = colors.map((c, idx) => ({ ...c, num: numbers[idx] }));

    // Legend
    colorLegend.classList.add('active');
    colorLegend.innerHTML = colorMap
      .map(
        (c) =>
          `<div class="legend-item"><span class="legend-dot" style="background:${c.value}"></span>${c.name} = ${c.num}</div>`
      )
      .join('');

    // Shapes
    const positions = [];
    const count = 10;
    const minGap = 6;
    const maxAttempts = 300;
    let total = 0;

    for (let i = 0; i < count; i += 1) {
      const color = colorMap[Math.floor(Math.random() * colorMap.length)];
      total += color.num;

      let attempts = 0;
      let x = 0;
      let y = 0;
      let valid = false;
      while (attempts < maxAttempts && !valid) {
        x = Math.random() * 88 + 6;
        y = Math.random() * 78 + 12;
        const clearOfLegend = y > 38 || x >= 32;
        valid =
          clearOfLegend && positions.every(([px, py]) => Math.hypot(px - x, py - y) >= minGap);
        attempts += 1;
      }
      positions.push([x, y]);

      const shape = document.createElement('div');
      shape.className = 'shape-token';
      shape.style.background = color.value;
      shape.style.left = `${x}%`;
      shape.style.top = `${y}%`;
      shape.style.setProperty('--shapeDur', `${10 + Math.random() * 6}s`);

      shapeField.appendChild(shape);
    }

    correctAnswer = total;
  };

  const isPrime = (n) => {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    const limit = Math.floor(Math.sqrt(n));
    for (let i = 3; i <= limit; i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  };

  const generatePrimePuzzle = () => {
    primeField.innerHTML = '';
    const positions = [];
    const minGap = 12;
    const maxAttempts = 300;
    const count = 10;

    // Pick one prime between 2 and 999
    const candidates = [];
    for (let i = 2; i < 1000; i += 1) {
      if (isPrime(i)) candidates.push(i);
    }
    primeAnswer = candidates[Math.floor(Math.random() * candidates.length)];

    const tokens = [primeAnswer];
    while (tokens.length < count) {
      const val = 2 + Math.floor(Math.random() * 998);
      if (!isPrime(val)) {
        tokens.push(val);
      }
    }

    tokens.sort(() => Math.random() - 0.5);

    tokens.forEach((val) => {
      let attempts = 0;
      let x = 0;
      let y = 0;
      let valid = false;

      while (attempts < maxAttempts && !valid) {
        x = Math.random() * 88 + 6;
        y = Math.random() * 78 + 12;
        valid = positions.every(([px, py]) => Math.hypot(px - x, py - y) >= minGap);
        attempts += 1;
      }
      positions.push([x, y]);

      const token = document.createElement('div');
      token.className = 'prime-token';
      token.textContent = val;
      token.style.left = `${x}%`;
      token.style.top = `${y}%`;

      primeField.appendChild(token);
    });

    statusMessage.textContent = '';
  };

  const generateArrowCounts = () => {
    // Only distinct positive integers summing to 10 across 4 arrows is 1,2,3,4
    const base = [1, 2, 3, 4];
    return base.sort(() => Math.random() - 0.5);
  };

  const generateArrowSequence = () => {
    arrowSequence = [];
    arrowIndex = 0;
    awaitingArrowOrder = false;
    const countsArray = generateArrowCounts();
    const arrows = ['up', 'down', 'left', 'right'];
    arrowCounts = {};
    arrows.forEach((dir, idx) => {
      const count = countsArray[idx];
      arrowCounts[dir] = count;
      for (let i = 0; i < count; i += 1) {
        arrowSequence.push(dir);
      }
    });
    arrowSequence.sort(() => Math.random() - 0.5);
    updateArrowUI();
  };

  const updateArrowUI = () => {
    if (!arrowSequence.length) return;
    const dir = arrowSequence[arrowIndex];
    const symbols = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' };
    arrowNext.textContent = symbols[dir] || 'UP';
    const displayIndex = Math.min(arrowIndex + 1, arrowSequence.length);
    arrowProgress.textContent = `${displayIndex} / ${arrowSequence.length}`;
  };

  const startArrowOrderEntry = () => {
    awaitingArrowOrder = true;
    arrowStage.classList.remove('active');
    promptText.textContent = '';
    promptText.style.fontSize = '';
    statusMessage.textContent = 'Type like: up,left,right,down';
    arrowNext.textContent = 'Order arrows by frequency (least to greatest).';
    arrowProgress.textContent = '';
    arrowStage.classList.add('active');
    answerInput.disabled = false;
    answerInput.value = '';
    answerInput.placeholder = 'up,left,right,down';
    answerInput.setAttribute('aria-label', 'Enter arrows least to greatest');
    answerInput.focus();
  };

  const validateArrowOrder = (value) => {
    const clean = value.toLowerCase().trim();
    const parts = clean.split(/[\s,]+/).filter(Boolean);
    if (parts.length !== 4) {
      statusMessage.textContent = 'Enter all four arrows (e.g., up,left,right,down).';
      return false;
    }
    const validSet = new Set(['up', 'down', 'left', 'right']);
    const allValid = parts.every((p) => validSet.has(p));
    if (!allValid || new Set(parts).size !== 4) {
      statusMessage.textContent = 'Use each arrow once: up, down, left, right.';
      return false;
    }
    const expectedOrder = Object.entries(arrowCounts)
      .sort((a, b) => a[1] - b[1])
      .map(([dir]) => dir);
    const correct = expectedOrder.every((dir, idx) => dir === parts[idx]);
    if (!correct) {
      statusMessage.textContent = 'Wrong order. New arrows coming up!';
      return false;
    }
    return true;
  };

  const renderHanoi = () => {
    hanoiField.innerHTML = '';
    const sumDisplay = document.createElement('div');
    sumDisplay.className = 'hanoi-sum';
    sumDisplay.textContent = `${hanoiState.sumA} + ${hanoiState.sumB} (${hanoiState.sumTimeLeft}s)`;
    hanoiField.appendChild(sumDisplay);

    const pegsContainer = document.createElement('div');
    pegsContainer.className = 'hanoi-pegs';
    hanoiState.pegs.forEach((peg, pegIndex) => {
      const pegEl = document.createElement('div');
      pegEl.className = 'hanoi-peg';
      pegEl.dataset.peg = pegIndex;
      pegEl.style.minHeight = '100%';
      const stack = [...peg].reverse();
      stack.forEach((size, idx) => {
        const disk = document.createElement('div');
        disk.className = 'hanoi-disk';
        disk.dataset.peg = pegIndex;
        disk.dataset.size = size;
        disk.style.width = `${56 + size * 20}px`;
        disk.style.background = `linear-gradient(90deg, rgba(126,255,161,0.7), rgba(77,225,255,0.8))`;
        pegEl.appendChild(disk);
      });
      pegsContainer.appendChild(pegEl);
    });
    hanoiField.appendChild(pegsContainer);
  };

  const startHanoiSumTimer = (options = { newSum: false, clearInput: true }) => {
    if (hanoiState.sumTimer) {
      clearInterval(hanoiState.sumTimer);
      hanoiState.sumTimer = null;
    }
    if (options.newSum) {
      hanoiState.sumA = 1 + Math.floor(Math.random() * 19);
      hanoiState.sumB = 1 + Math.floor(Math.random() * 19);
    }
    hanoiState.sumTimeLeft = 10;
    if (options.clearInput) {
      answerInput.value = '';
    }
    hanoiState.sumTimer = setInterval(() => {
      hanoiState.sumTimeLeft -= 1;
      if (hanoiState.sumTimeLeft <= 0) {
        clearInterval(hanoiState.sumTimer);
      hanoiState.sumTimer = null;
      lives -= 1;
      renderLives();
      statusMessage.textContent = 'Sum timed out! New sum.';
      if (lives <= 0) {
        endGame(false);
        return;
      }
      startHanoiSumTimer({ newSum: true, clearInput: true });
      renderHanoi();
    } else {
      renderHanoi();
    }
    }, 1000);
  };

  const setupHanoi = () => {
    const disks = hanoiState.diskCount;
    hanoiState.pegs = [[], [], []];
    for (let i = disks; i >= 1; i -= 1) {
      hanoiState.pegs[0].push(i);
    }
    startHanoiSumTimer({ newSum: true, clearInput: true });
    renderHanoi();
  };

  const getPegFromX = (clientX) => {
    const container = hanoiField.querySelector('.hanoi-pegs');
    const rect = (container || hanoiField).getBoundingClientRect();
    const clampedX = Math.min(Math.max(clientX, rect.left), rect.right);
    const relativeX = clampedX - rect.left;
    const columnWidth = rect.width / hanoiState.pegs.length;
    return Math.max(0, Math.min(hanoiState.pegs.length - 1, Math.floor(relativeX / columnWidth)));
  };

  const endHanoiDrag = (clientX) => {
    if (!hanoiDrag.active) return;
    const targetPeg = getPegFromX(clientX);
    const fromPeg = hanoiDrag.fromPeg;
    const moving = hanoiDrag.size;
    const targetTop = hanoiState.pegs[targetPeg][hanoiState.pegs[targetPeg].length - 1];
    if (targetTop !== undefined && targetTop < moving) {
      statusMessage.innerHTML =
        'Cannot place larger disk on smaller.<span style="display:block; margin-top:6px;">Try another peg.</span>';
      hanoiDrag.active = false;
    } else {
      hanoiState.pegs[fromPeg].pop();
      hanoiState.pegs[targetPeg].push(moving);
      statusMessage.textContent = '';
      hanoiDrag.active = false;
      renderHanoi();
      if (hanoiState.pegs[1].length === hanoiState.diskCount || hanoiState.pegs[2].length === hanoiState.diskCount) {
        if (hanoiState.sumTimer) {
          clearInterval(hanoiState.sumTimer);
          hanoiState.sumTimer = null;
        }
        advanceFrom('hanoi');
      }
    }
    if (hanoiDrag.ghost) {
      hanoiDrag.ghost.remove();
      hanoiDrag.ghost = null;
    }
    hanoiDrag.fromPeg = null;
    hanoiDrag.size = null;
  };

  const updateHanoiGhost = (clientX, clientY) => {
    if (!hanoiDrag.ghost) return;
    hanoiDrag.ghost.style.left = `${clientX}px`;
    hanoiDrag.ghost.style.top = `${clientY}px`;
  };

  const handleHanoiMouseDown = (event) => {
    if (stage !== 'hanoi') return;
    const diskEl = event.target.closest('.hanoi-disk');
    if (!diskEl) return;
    const pegIndex = Number(diskEl.dataset.peg);
    const diskSize = Number(diskEl.dataset.size);
    const topSize = hanoiState.pegs[pegIndex][hanoiState.pegs[pegIndex].length - 1];
    if (diskSize !== topSize) return; // only allow dragging the top disk
    event.preventDefault();
    hanoiDrag.active = true;
    hanoiDrag.fromPeg = pegIndex;
    hanoiDrag.size = diskSize;
    const ghost = diskEl.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.9';
    ghost.style.transform = 'translate(-50%, -50%)';
    ghost.style.zIndex = '999';
    ghost.classList.add('hanoi-ghost');
    document.body.appendChild(ghost);
    hanoiDrag.ghost = ghost;
    updateHanoiGhost(event.clientX, event.clientY);
    statusMessage.textContent = 'Drag to a peg.';
  };

  const handleHanoiMouseMove = (event) => {
    if (stage !== 'hanoi' || !hanoiDrag.active) return;
    updateHanoiGhost(event.clientX, event.clientY);
  };

  const handleHanoiMouseUp = (event) => {
    if (stage !== 'hanoi' || !hanoiDrag.active) return;
    endHanoiDrag(event.clientX);
  };

  const shiftLetter = (ch, shift) => {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return ch;
    const idx = code - 65;
    const shifted = (idx + shift + 26) % 26;
    return String.fromCharCode(65 + shifted);
  };

  const updateCipherDisplay = () => {
    const shifted = cipherRaw
      .split('')
      .map((ch) => shiftLetter(ch, cipherShift))
      .join('');
    answerInput.value = shifted;
  };

  const generateAnglePuzzle = () => {
    angleField.innerHTML = '';
    angleTarget = 1 + Math.floor(Math.random() * 180);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'angle-canvas');
    svg.setAttribute('viewBox', '0 0 160 160');

    const centerX = 80;
    const centerY = 110;
    const radius = 70;

    const lineBase = document.createElementNS(svgNS, 'line');
    lineBase.setAttribute('x1', centerX);
    lineBase.setAttribute('y1', centerY);
    lineBase.setAttribute('x2', centerX + radius);
    lineBase.setAttribute('y2', centerY);
    lineBase.setAttribute('stroke', '#e9ffe3');
    lineBase.setAttribute('stroke-width', '2.6');
    lineBase.setAttribute('stroke-linecap', 'round');
    svg.appendChild(lineBase);

    const rad = (angleTarget * Math.PI) / 180;
    const x2 = centerX + radius * Math.cos(rad);
    const y2 = centerY - radius * Math.sin(rad);

    const lineRay = document.createElementNS(svgNS, 'line');
    lineRay.setAttribute('x1', centerX);
    lineRay.setAttribute('y1', centerY);
    lineRay.setAttribute('x2', x2.toFixed(2));
    lineRay.setAttribute('y2', y2.toFixed(2));
    lineRay.setAttribute('stroke', '#7effa1');
    lineRay.setAttribute('stroke-width', '3');
    lineRay.setAttribute('stroke-linecap', 'round');
    svg.appendChild(lineRay);

    const arc = document.createElementNS(svgNS, 'path');
    const arcRadius = 36;
    const arcX = centerX + arcRadius * Math.cos(0);
    const arcY = centerY - arcRadius * Math.sin(0);
    const arcX2 = centerX + arcRadius * Math.cos(rad);
    const arcY2 = centerY - arcRadius * Math.sin(rad);
    const largeArc = angleTarget > 180 ? 1 : 0;
    const d = `M ${arcX.toFixed(2)} ${arcY.toFixed(2)} A ${arcRadius} ${arcRadius} 0 ${largeArc} 0 ${arcX2.toFixed(2)} ${arcY2.toFixed(2)}`;
    arc.setAttribute('d', d);
    arc.setAttribute('stroke', '#4de1ff');
    arc.setAttribute('stroke-width', '2.4');
    arc.setAttribute('fill', 'none');
    svg.appendChild(arc);

    angleField.appendChild(svg);
  };

  const updateBestTimeDisplay = () => {
    bestTimeDisplay.textContent =
      bestTime === null ? '' : `Best Time: ${formatSeconds(bestTime)}`;
  };

  const endGame = (win) => {
    clearInterval(timerId);
    timerId = null;

    if (win) {
      if (bestTime === null || timeElapsed < bestTime) {
        bestTime = timeElapsed;
        persistBestTime(bestTime);
      }
      updateBestTimeDisplay();
      stopMusic();
      playSfx(victoryTrack);
      setScreen(winScreen);
    } else {
      stopMusic();
      playSfx(loseTrack);
      loseReason.textContent = '';
      setScreen(loseScreen);
    }
  };

  const handleAnswer = () => {
    const value = answerInput.value.trim();
    if (stage === 'arrows' && !awaitingArrowOrder) {
      statusMessage.textContent = 'Press the arrows shown first.';
      return;
    }
    if (stage === 'cipher' && !cipherRaw.length) {
      statusMessage.textContent = 'Type the ciphered letters.';
      return;
    }
    if (!value.length && stage !== 'cipher' && stage !== 'hanoi') {
      statusMessage.textContent =
        stage === 'arrows' ? 'Enter the arrow order.' : 'Enter a number first.';
      return;
    }

    if (stage === 'hanoi') {
      const guess = parseInt(value.trim(), 10);
      if (!Number.isInteger(guess)) {
        statusMessage.textContent = 'Whole numbers only.';
        return;
      }
      const expected = hanoiState.sumA + hanoiState.sumB;
      if (guess === expected) {
        clearInterval(hanoiState.sumTimer);
        hanoiState.sumTimer = null;
        hanoiState.sumA = 1 + Math.floor(Math.random() * 19);
        hanoiState.sumB = 1 + Math.floor(Math.random() * 19);
        startHanoiSumTimer();
        statusMessage.textContent = '';
        answerInput.value = '';
        renderHanoi();
        return; // ✅ add this
      } else {
        statusMessage.textContent = 'Wrong sum. Try again.';
        return; // ✅ and this too
      }
    }

    if (stage === 'memory') {
      const parts = value.split(/\s+/);
      if (parts.length !== 3) {
        statusMessage.textContent = 'Enter all three numbers separated by spaces.';
        return;
      }
      const allThreeDigits = parts.every((p) => /^\d{3}$/.test(p));
      if (!allThreeDigits) {
        statusMessage.textContent = 'Use three-digit numbers like 123 456 789.';
        return;
      }
      const match = parts.every((p, idx) => p === memoryNumbers[idx].toString());
      if (match) {
        advanceFrom('memory');
        return;
      }
    } else if (stage === 'arrows' && awaitingArrowOrder) {
      const ok = validateArrowOrder(value);
      if (ok) {
        advanceFrom('arrows');
      } else {
        lives -= 1;
        renderLives();
        if (lives <= 0) {
          endGame(false);
          return;
        }
        awaitingArrowOrder = false;
        generateArrowSequence();
        arrowStage.classList.add('active');
        promptText.textContent = 'Press the arrows shown.';
        statusMessage.textContent = 'Follow the prompts (0/20).';
        answerInput.value = '';
        answerInput.disabled = true;
      }
      return;
    } else if (stage === 'cipher') {
      const target = cipherTarget;
      const actual = cipherRaw.toUpperCase();
      if (actual === target) {
        advanceFrom('cipher');
        return;
      }
    } else {
      const guess = Number(value);
      const maxAllowed =
        stage === 'flowers' ? 99 : stage === 'prime' ? 999 : 999;
      if (!Number.isInteger(guess)) {
        statusMessage.textContent = 'Whole numbers only.';
        return;
      }
      if (guess > maxAllowed) {
        statusMessage.textContent = `Numbers up to ${maxAllowed} only.`;
        return;
      }

      if (guess === correctAnswer && stage !== 'prime') {
        if (stage === 'flowers' || stage === 'sum' || stage === 'colors' || stage === 'recall') {
          advanceFrom(stage);
          return;
        }
        if (stage === 'angle') {
          advanceFrom('angle');
          return;
        }
      }

      if (stage === 'prime') {
        if (guess === primeAnswer) {
          advanceFrom('prime');
          return;
        }
      }

      if (stage === 'angle') {
        const diff = Math.abs(guess - angleTarget);
        if (diff <= 5) {
          advanceFrom('angle');
          return;
        }
      }
    }

    lives -= 1;
    renderLives();
    statusMessage.textContent =
      stage === 'memory'
        ? 'Not quite. New numbers coming up!'
        : stage === 'colors'
          ? 'Nope. Try the sum again!'
          : stage === 'prime'
            ? 'Wrong. New numbers incoming!'
            : stage === 'arrows'
              ? awaitingArrowOrder
                ? 'Wrong order. New arrows coming up!'
                : 'Keep pressing the prompted arrows.'
              : stage === 'angle'
                ? 'Off by more than 5 degrees. New angle coming up!'
                : stage === 'cipher'
                  ? 'Not RAINBOW. Try again!'
                  : stage === 'recall'
                    ? ''
                    : stage === 'hanoi'
                      ? 'Sum missed. New sum started.'
                      : 'Nope. Count again!';
    answerInput.value = '';

    if (stage === 'memory') {
      showMemoryNumbers();
    } else if (stage === 'colors') {
      generateColorPuzzle();
    } else if (stage === 'prime') {
      generatePrimePuzzle();
      answerInput.focus();
    } else if (stage === 'arrows') {
      generateArrowSequence();
      arrowStage.classList.add('active');
      answerInput.disabled = !awaitingArrowOrder;
      updateArrowUI();
    } else if (stage === 'cipher') {
      cipherRaw = '';
      updateCipherDisplay();
      answerInput.disabled = false;
      answerInput.focus();
    } else if (stage === 'recall') {
      // Nothing to regenerate; just refocus
      answerInput.disabled = false;
      answerInput.focus();
    } else if (stage === 'angle') {
      generateAnglePuzzle();
      angleField.classList.add('active');
      answerInput.disabled = false;
      answerInput.focus();
    } else {
      answerInput.focus();
    }

    if (lives <= 0) {
      endGame(false);
    }
  };

  // Event wiring
  startButton.addEventListener('click', startGame);
  submitAnswer.addEventListener('click', handleAnswer);
  playAgainWin.addEventListener('click', startGame);
  playAgainLose.addEventListener('click', startGame);
  restartButton.addEventListener('click', startGame);
  hanoiField.addEventListener('mousedown', handleHanoiMouseDown);
  window.addEventListener('mousemove', handleHanoiMouseMove);
  window.addEventListener('mouseup', handleHanoiMouseUp);

  answerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleAnswer();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (stage === 'hanoi' && !answerInput.disabled && event.key !== 'Tab') {
      answerInput.focus();
    }
    if (event.key === 'Enter' && stage === 'hanoi' && !answerInput.disabled) {
      if (event.target === answerInput) {
        // The input already triggers handleAnswer on Enter; avoid double submission.
        return;
      }
      event.preventDefault();
      handleAnswer();
      return;
    }

    if (stage === 'arrows' && !awaitingArrowOrder) {
      const keyMap = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right'
      };
      const dir = keyMap[event.key];
      if (!dir) return;
      event.preventDefault();
      const expected = arrowSequence[arrowIndex];
      if (dir === expected) {
        arrowIndex += 1;
        if (arrowIndex >= arrowSequence.length) {
          arrowProgress.textContent = `${arrowSequence.length} / ${arrowSequence.length}`;
          startArrowOrderEntry();
          return;
        }
        statusMessage.textContent = '';
        updateArrowUI();
      } else {
        lives -= 1;
        renderLives();
        statusMessage.textContent = 'Wrong key. New arrows coming up!';
        if (lives <= 0) {
        endGame(false);
        return;
      }
        awaitingArrowOrder = false;
        generateArrowSequence();
        arrowStage.classList.add('active');
        updateArrowUI();
      }
    } else if (stage === 'cipher') {
      if (event.key === 'Backspace') {
        event.preventDefault();
        cipherRaw = cipherRaw.slice(0, -1);
        updateCipherDisplay();
        return;
      }
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        const nextIndex = cipherRaw.length;
      const target = cipherTarget;
      const expectedShifted = shiftLetter(target[nextIndex], cipherShift);
        const typed = event.key.toUpperCase();
        if (typed === expectedShifted) {
          cipherRaw += target[nextIndex];
          updateCipherDisplay();
          if (cipherRaw.length === target.length) {
            advanceFrom('cipher');
          }
        } else {
          lives -= 1;
          renderLives();
          statusMessage.textContent = 'Wrong letter. Cipher reset!';
          if (lives <= 0) {
          endGame(false);
          return;
        }
          goToStage('cipher');
        }
      }
      // Enter handled by input listener
    }
  });

  // Initialize HUD for the start screen
  renderLives();
  formatTimer();
  bestTime = loadBestTime();
  updateBestTimeDisplay();
  startMusic();
  document.addEventListener('pointerdown', unlockMusic);
  document.addEventListener('keydown', unlockMusic);

  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      const vol = Number(volumeSlider.value || 1);
      if (musicAudio) {
        musicAudio.volume = vol;
      }
    });
  }
})();
