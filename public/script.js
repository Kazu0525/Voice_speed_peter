// 音声入力ゲームのメインプログラム - BGM強化版
document.addEventListener('DOMContentLoaded', () => {
  
  // DOM要素を取得
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const comboEl = document.getElementById('combo');
  const questionTextEl = document.getElementById('question-text');
  const resultDisplayEl = document.getElementById('result-display');
  const recognizedTextEl = document.getElementById('recognized-text');
  const interimTextEl = document.getElementById('interim-text');
  
  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const micPermissionButton = document.getElementById('mic-permission-button');
  const restartButton = document.getElementById('restart-button');
  const soundToggleButton = document.getElementById('sound-toggle');
  
  const micStatusEl = document.getElementById('mic-status');
  const gameOverModal = document.getElementById('game-over-modal');
  const difficultySelectorEl = document.getElementById('difficulty-selector');
  const gameContainerEl = document.querySelector('.game-container');
  
  const finalScoreEl = document.getElementById('final-score');
  const maxComboEl = document.getElementById('max-combo');
  const correctCountEl = document.getElementById('correct-count');
  const missCountEl = document.getElementById('miss-count');
  
  const difficultyButtons = document.querySelectorAll('.difficulty-btn');
  
  // BGM音声要素
  const bgmEl = document.getElementById('bgm');
  const tenseBgmEl = document.getElementById('tense-bgm'); // 追加：緊張感のあるBGM
  
  // ===========================================
  // 改良された音声関連の設定
  // ===========================================
  
  let isMuted = false;
  let audioUnlocked = false;
  
  // 効果音とBGMの設定
  const sounds = {
    start: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision18.mp3'),
    correct: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision22.mp3'),
    incorrect: new Audio('https://soundeffect-lab.info/sound/button/mp3/beep4.mp3'),
    // 追加効果音
    comboSound: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision1.mp3'),
    timeWarning: new Audio('https://soundeffect-lab.info/sound/button/mp3/beep7.mp3')
  };
  
  // BGMの設定を改良
  function setupBGM() {
    // メインBGMの設定
    bgmEl.volume = 0.3;
    bgmEl.loop = true;
    
    // 緊張感のあるBGM（時間が少なくなった時用）
    if (tenseBgmEl) {
      tenseBgmEl.volume = 0.4;
      tenseBgmEl.loop = true;
    }
    
    // BGMのフェードイン・フェードアウト機能
    bgmEl.addEventListener('loadeddata', () => {
      console.log('BGM loaded successfully');
    });
    
    bgmEl.addEventListener('error', (e) => {
      console.warn('BGM loading failed:', e);
    });
  }
  
  // BGMフェード機能
  function fadeAudio(audio, targetVolume, duration = 1000) {
    const startVolume = audio.volume;
    const volumeStep = (targetVolume - startVolume) / (duration / 50);
    
    const fade = setInterval(() => {
      const newVolume = audio.volume + volumeStep;
      
      if ((volumeStep > 0 && newVolume >= targetVolume) || 
          (volumeStep < 0 && newVolume <= targetVolume)) {
        audio.volume = targetVolume;
        clearInterval(fade);
        
        if (targetVolume === 0) {
          audio.pause();
        }
      } else {
        audio.volume = newVolume;
      }
    }, 50);
  }
  
  // 改良されたBGM再生機能
  function playBGM(intense = false) {
    if (isMuted || !audioUnlocked) return;
    
    try {
      // 現在のBGMをフェードアウト
      if (!bgmEl.paused) {
        fadeAudio(bgmEl, 0, 500);
      }
      if (tenseBgmEl && !tenseBgmEl.paused) {
        fadeAudio(tenseBgmEl, 0, 500);
      }
      
      // 新しいBGMを再生
      setTimeout(() => {
        const targetBGM = intense ? (tenseBgmEl || bgmEl) : bgmEl;
        targetBGM.currentTime = 0;
        targetBGM.volume = 0;
        targetBGM.play().then(() => {
          fadeAudio(targetBGM, intense ? 0.4 : 0.3, 1000);
        }).catch(e => console.error("BGM play failed:", e));
      }, 500);
      
    } catch (e) {
      console.error("BGM control error:", e);
    }
  }
  
  function unlockAudio() {
    if (audioUnlocked) return;
    
    const allSounds = [bgmEl, tenseBgmEl, ...Object.values(sounds)].filter(Boolean);
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
  
  // ゲーム状態の変数
  let gameActive = false;
  let currentDifficulty = 'normal';
  let score = 0;
  let time = 60;
  let combo = 0;
  let maxCombo = 0;
  let correctCount = 0;
  let missCount = 0;
  let timerInterval = null;
  let currentQuestion = '';
  let timeWarningPlayed = false; // 時間警告音を一度だけ再生するフラグ
  
  // マイク許可の管理
  const isMicGranted = () => localStorage.getItem('micGranted') === 'true';
  const setMicGranted = () => localStorage.setItem('micGranted', 'true');
  
  // 音声認識の設定
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
  
  // 初期化関数
  function initialize() {
    setupBGM(); // BGMセットアップを追加
    
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
    gameOverModal.style.display = 'none';
    
    // 選択画面でも軽やかなBGMを再生
    playBGM(false);
  }
  
  // イベントリスナー
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
      
      startButton.style.display = 'inline-block';
      stopButton.style.display = 'none';
      
      resetGame();
      nextQuestion();
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
    
    // BGMのミュート制御
    bgmEl.muted = isMuted;
    if (tenseBgmEl) tenseBgmEl.muted = isMuted;
    
    if (isMuted) {
      bgmEl.pause();
      if (tenseBgmEl) tenseBgmEl.pause();
    } else if (gameActive) {
      // ゲーム中なら適切なBGMを再生
      playBGM(time <= 15);
    }
  });
  
  // 音声認識のイベントハンドラー
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
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
  };
  
  // 改良されたゲームロジック
  function startGame() {
    gameActive = true;
    timeWarningPlayed = false;
    
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-block';
    
    // ゲーム開始時は通常のBGM
    playBGM(false);
    
    timerInterval = setInterval(() => {
      time--;
      timerEl.textContent = time;
      
      // タイマーの色を変更して緊張感を演出
      if (time <= 10) {
        timerEl.style.color = '#ef4444'; // 赤色
        timerEl.style.animation = 'pulse 1s infinite';
        
        // 緊張感のあるBGMに切り替え
        if (time <= 15 && !timeWarningPlayed) {
          playBGM(true); // 緊張感のあるBGM
          playSound('timeWarning'); // 警告音
          timeWarningPlayed = true;
        }
      } else if (time <= 20) {
        timerEl.style.color = '#f59e0b'; // オレンジ色
      }
      
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
    
    // BGMをフェードアウト
    if (!bgmEl.paused) fadeAudio(bgmEl, 0, 1000);
    if (tenseBgmEl && !tenseBgmEl.paused) fadeAudio(tenseBgmEl, 0, 1000);
    
    // タイマーのスタイルをリセット
    timerEl.style.color = '';
    timerEl.style.animation = '';
    
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
    timeWarningPlayed = false;
    
    scoreEl.textContent = score;
    timerEl.textContent = time;
    comboEl.textContent = combo;
    recognizedTextEl.textContent = '...';
    interimTextEl.textContent = '';
    
    // タイマーのスタイルをリセット
    timerEl.style.color = '';
    timerEl.style.animation = '';
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
    let normalized = text;
    
    if (typeof wanakana !== 'undefined') {
      normalized = wanakana.toHiragana(text);
    }
    
    return normalized.replace(/[、。！？\\s,.?!]/g, '');
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
      
      // コンボボーナス効果音
      if (combo >= 5) {
        playSound('comboSound');
      }
      
      resultDisplayEl.textContent = combo >= 5 ? `正解！ ${combo}コンボ！` : '正解！';
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
  
  initialize();
});
