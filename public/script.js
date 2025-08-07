document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const comboEl = document.getElementById('combo');
  const questionTextEl = document.getElementById('question-text');
  const resultDisplayEl = document.getElementById('result-display');
  const recognizedTextEl = document.getElementById('recognized-text');
  const interimTextEl = document.getElementById('interim-text');
  const startButton = document.getElementById('start-button');
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
  const bgmEl = document.getElementById('bgm');

  // --- Audio ---
  let isMuted = false;
  let audioUnlocked = false;
  const sounds = {
    start: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision18.mp3'),
    correct: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision22.mp3'),
    incorrect: new Audio('https://soundeffect-lab.info/sound/button/mp3/beep4.mp3')
  };

  function unlockAudio() {
    if (audioUnlocked) return;
    const allSounds = [bgmEl, ...Object.values(sounds)];
    allSounds.forEach(sound => {
      sound.play().catch(() => {});
      sound.pause();
      sound.currentTime = 0;
    });
    audioUnlocked = true;
    console.log("Audio context unlocked.");
  }

  function playSound(sound) {
    if (!isMuted && audioUnlocked) {
      sounds[sound].currentTime = 0;
      sounds[sound].play().catch(e => console.error("Error playing sound:", e));
    }
  }

  // --- Game State & Mic Permission ---
  let gameActive = false;
  let currentDifficulty = 'normal';
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
    bgmEl.volume = 0.3;
  }

  function showDifficultySelector() {
    micStatusEl.style.display = 'none';
    difficultySelectorEl.style.display = 'block';
    gameContainerEl.style.display = 'none';
    gameOverModal.style.display = 'none';
  }

  // --- Event Listeners ---
  micPermissionButton.addEventListener('click', async () => {
    unlockAudio();
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
      unlockAudio();
      currentDifficulty = button.dataset.difficulty;
      difficultyButtons.forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');

      difficultySelectorEl.style.display = 'none';
      gameContainerEl.style.display = 'flex';

      // Show start button, hide stop button
      startButton.style.display = 'inline-block';
      stopButton.style.display = 'none';
      resetGame(); // Reset the game state and UI elements for the new round
      nextQuestion(); // Show the first question
    });
  });

  startButton.addEventListener('click', startGame);
  stopButton.addEventListener('click', stopGame);

  restartButton.addEventListener('click', () => {
    showDifficultySelector();
  });

  soundToggleButton.addEventListener('click', () => {
    isMuted = !isMuted;
    soundToggleButton.textContent = isMuted ? '🔇' : '🔊';
    bgmEl.muted = isMuted;
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
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-block';

    if (!isMuted) {
      bgmEl.currentTime = 0;
      bgmEl.play().catch(e => console.error("BGM play failed:", e));
    }

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
  }

  function stopGame() {
    gameActive = false;
    stopButton.style.display = 'none';
    startButton.style.display = 'inline-block';
    if (timerInterval) clearInterval(timerInterval);
    recognition.stop();
    bgmEl.pause();

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
    if (questionPool.length === 1) {
        currentQuestion = questionPool[0];
    } else {
        let newQuestion;
        do {
            newQuestion = questionPool[Math.floor(Math.random() * questionPool.length)];
        } while (newQuestion === currentQuestion);
        currentQuestion = newQuestion;
    }
    questionTextEl.textContent = currentQuestion;
  }

  function normalizeText(text) {
    // Use wanakana to convert Katakana and Kanji to Hiragana
    const hiragana = wanakana.toHiragana(text);
    // Remove punctuation and spaces
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
