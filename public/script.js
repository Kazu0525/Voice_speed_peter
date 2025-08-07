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

  // Game State
  let score = 0;
  let time = 60;
  let combo = 0;
  let maxCombo = 0;
  let correctCount = 0;
  let missCount = 0;
  let timerInterval = null;
  let gameActive = false;
  let currentQuestion = '';

  // Speech Recognition Setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;

  if (SpeechRecognition) {
    micStatusEl.style.display = 'block';
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = false; // Process one phrase at a time
  } else {
    micStatusEl.innerHTML = '<p>お使いのブラウザは音声認識に対応していません。</p>';
    startButton.disabled = true;
    return;
  }

  // --- Event Listeners ---
  micPermissionButton.addEventListener('click', requestMicPermission);
  startButton.addEventListener('click', startGame);
  stopButton.addEventListener('click', stopGame);
  restartButton.addEventListener('click', () => {
    gameOverModal.style.display = 'none';
    resetGame();
    startGame();
  });

  // --- Functions ---

  // Placeholder for microphone permission
  async function requestMicPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the tracks immediately since we only need the permission, not the stream itself.
      // The SpeechRecognition API handles the stream internally.
      stream.getTracks().forEach(track => track.stop());
      micStatusEl.innerHTML = '<p>✅ マイクの準備ができました</p>';
      micPermissionButton.style.display = 'none';
      startButton.disabled = false;
    } catch (err) {
      micStatusEl.innerHTML = '<p>❌ マイクの許可が必要です。ブラウザの設定を確認してください。</p>';
      console.error('Microphone permission denied:', err);
    }
  }

  // --- Speech Recognition Event Handlers ---
  recognition.onstart = () => {
    console.log('Voice recognition started.');
    // You could add a visual indicator here, e.g., a "listening..." status
  };

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

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    // Display a user-friendly error message
    interimTextEl.textContent = `エラー: ${event.error}`;
  };

  recognition.onend = () => {
    console.log('Voice recognition ended.');
    // If the game is still active, restart recognition immediately
    if (gameActive) {
      recognition.start();
    }
  };

  // --- Game Logic Functions ---

  function startGame() {
    gameActive = true;
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-block';

    // Reset scores and UI
    resetGame();

    // Start the countdown timer
    timerInterval = setInterval(() => {
      time--;
      timerEl.textContent = time;
      if (time <= 0) {
        stopGame();
      }
    }, 1000);

    // Start recognition
    try {
      recognition.start();
    } catch(e) {
      console.error("Recognition could not be started: ", e);
    }

    nextQuestion();
  }

  function nextQuestion() {
    currentQuestion = questions[Math.floor(Math.random() * questions.length)];
    questionTextEl.textContent = currentQuestion;
    recognizedTextEl.textContent = '...';
    interimTextEl.textContent = '';
  }

  function normalizeText(text) {
    // Remove punctuation and convert to hiragana
    const hiragana = text.replace(/[\u30a1-\u30f6]/g, (match) => {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
    return hiragana.replace(/[、。！？\s,.?!]/g, '');
  }

  function checkAnswer(answer) {
    if (!gameActive) return;

    const normalizedAnswer = normalizeText(answer);
    const normalizedQuestion = normalizeText(currentQuestion);

    if (normalizedAnswer === normalizedQuestion) {
      // Correct
      score += 100 + (combo * 10);
      combo++;
      correctCount++;
      if (combo > maxCombo) {
        maxCombo = combo;
      }
      resultDisplayEl.textContent = '正解！';
      resultDisplayEl.className = 'result-display correct';
    } else {
      // Incorrect
      combo = 0;
      missCount++;
      resultDisplayEl.textContent = '残念！';
      resultDisplayEl.className = 'result-display incorrect';
    }

    // Update UI
    scoreEl.textContent = score;
    comboEl.textContent = combo;

    // Clear the result message after a short delay
    setTimeout(() => {
      resultDisplayEl.textContent = '';
      resultDisplayEl.className = 'result-display';
    }, 1000);

    // Move to the next question
    setTimeout(nextQuestion, 200);
  }

  function stopGame() {
    gameActive = false;
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    recognition.stop();

    startButton.style.display = 'inline-block';
    stopButton.style.display = 'none';

    // In a future step, this will show the game over modal
    console.log('Game Stopped. Final score:', score);
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
    questionTextEl.textContent = 'ここに課題文が表示されます';
    recognizedTextEl.textContent = 'ここに認識されたテキストが表示されます...';
    interimTextEl.textContent = '';
  }

  // Initial UI state
  startButton.disabled = true;

});
