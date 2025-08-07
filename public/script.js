document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const comboEl = document.getElementById('combo');
  const questionTextEl = document.getElementById('question-text');
  const resultDisplayEl = document.getElementById('result-display');
  const recognizedTextEl = document.getElementById('recognized-text');
  const interimTextEl = document.getElementById('interim-text');
  const stopButton = document.getElementById('stop-button');
  const micStatusEl = document.getElementById('mic-status');
  const micPermissionButton = document.getElementById('mic-permission-button');
  const gameOverModal = document.getElementById('game-over-modal');
  const finalScoreEl = document.getElementById('final-score');
  const maxComboEl = document.getElementById('max-combo');
  const correctCountEl = document.getElementById('correct-count');
  const missCountEl = document.getElementById('miss-count');
  const restartButton = document.getElementById('restart-button');
  const soundToggleButton = document.getElementById('sound-toggle');
  const difficultySelectorEl = document.getElementById('difficulty-selector');
  const gameContainerEl = document.querySelector('.game-container');
  const difficultyButtons = document.querySelectorAll('.difficulty-btn');

  // --- Audio ---
  let isMuted = false;
  const sounds = {
    start: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision18.mp3'),
    correct: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision22.mp3'),
    incorrect: new Audio('https://soundeffect-lab.info/sound/button/mp3/beep4.mp3')
  };

  function playSound(sound) {
    if (!isMuted) {
      sounds[sound].currentTime = 0;
      sounds[sound].play().catch(e => console.error("Error playing sound:", e));
    }
  }

  // --- Game State & Mic Permission ---
  let gameActive = false;
  let currentDifficulty = 'normal';
  // ... other game state variables
  let score = 0, time = 60, combo = 0, maxCombo = 0, correctCount = 0, missCount = 0, timerInterval = null, currentQuestion = '';

  const isMicGranted = () => localStorage.getItem('micGranted') === 'true';
  const setMicGranted = () => localStorage.setItem('micGranted', 'true');

  // --- Speech Recognition Setup ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;

  if (!SpeechRecognition) {
    micStatusEl.innerHTML = '<p>お使いのブラウザは音声認識に対応していません。</p>';
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = true;
  recognition.continuous = false;

  // --- Initialization ---
  function initialize() {
    if (isMicGranted()) {
      showDifficultySelector();
    } else {
      micStatusEl.style.display = 'block';
    }
  }

  function showDifficultySelector() {
    micStatusEl.style.display = 'none';
    difficultySelectorEl.style.display = 'block';
    gameContainerEl.style.display = 'none';
  }

  // --- Event Listeners ---
  micPermissionButton.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicGranted();
      showDifficultySelector();
    } catch (err) {
      micStatusEl.innerHTML = '<p>❌ マイクの許可が必要です。ブラウザの設定を確認してください。</p>';
      console.error('Microphone permission denied:', err);
    }
  });

  difficultyButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentDifficulty = button.dataset.difficulty;
      difficultyButtons.forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');

      difficultySelectorEl.style.display = 'none';
      gameContainerEl.style.display = 'flex';
      startGame();
    });
  });

  stopButton.addEventListener('click', stopGame);

  restartButton.addEventListener('click', () => {
    gameOverModal.style.display = 'none';
    showDifficultySelector();
  });

  soundToggleButton.addEventListener('click', () => {
    isMuted = !isMuted;
    soundToggleButton.textContent = isMuted ? '🔇' : '🔊';
  });

  // --- Speech Recognition Handlers ---
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    interimTextEl.textContent = interimTranscript;
    if (finalTranscript) {
      recognizedTextEl.textContent = finalTranscript;
      checkAnswer(finalTranscript);
    }
  };

  recognition.onend = () => {
    if (gameActive) {
      recognition.start();
    }
  };

  recognition.onerror = (event) => console.error('Speech recognition error', event.error);


  // --- Game Logic ---
  function startGame() {
    gameActive = true;
    stopButton.style.display = 'inline-block';
    resetGame();

    timerInterval = setInterval(() => {
      time--;
      timerEl.textContent = time;
      if (time <= 0) {
        stopGame();
      }
    }, 1000);

    try {
      recognition.start();
    } catch(e) {
      console.error("Recognition could not be started: ", e);
    }

    playSound('start');
    nextQuestion();
  }

  function stopGame() {
    gameActive = false;
    stopButton.style.display = 'none';
    if (timerInterval) clearInterval(timerInterval);
    recognition.stop();

    gameOverModal.style.display = 'flex';
    finalScoreEl.textContent = score;
    maxComboEl.textContent = maxCombo;
    correctCountEl.textContent = correctCount;
    missCountEl.textContent = missCount;
  }

  function resetGame() {
    score = 0;
    time = 60;
    combo = 0;
    maxCombo = 0;
    correctCount = 0;
    missCount = 0;

    scoreEl.textContent = score;
    timerEl.textContent = time;
    comboEl.textContent = combo;
    recognizedTextEl.textContent = '...';
    interimTextEl.textContent = '';
  }

  function nextQuestion() {
    const questionPool = questions[currentDifficulty] || questions['normal'];
    currentQuestion = questionPool[Math.floor(Math.random() * questionPool.length)];
    questionTextEl.textContent = currentQuestion;
  }

  function normalizeText(text) {
    const hiragana = text.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
    return hiragana.replace(/[、。！？\s,.?!]/g, '');
  }

  function checkAnswer(answer) {
    if (!gameActive) return;
    const normalizedAnswer = normalizeText(answer);
    const normalizedQuestion = normalizeText(currentQuestion);

    if (normalizedAnswer === normalizedQuestion) {
      score += 100 + (combo * 10);
      combo++;
      correctCount++;
      if (combo > maxCombo) maxCombo = combo;
      resultDisplayEl.textContent = '正解！';
      resultDisplayEl.className = 'result-display correct';
      playSound('correct');
    } else {
      combo = 0;
      missCount++;
      resultDisplayEl.textContent = '残念！';
      resultDisplayEl.className = 'result-display incorrect';
      playSound('incorrect');
    }

    scoreEl.textContent = score;
    comboEl.textContent = combo;

    setTimeout(() => {
      resultDisplayEl.textContent = '';
      resultDisplayEl.className = 'result-display';
    }, 1000);

    setTimeout(nextQuestion, 200);
  }

  // --- Start the app ---
  initialize();
});
