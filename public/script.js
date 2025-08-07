// 音声入力ゲームのメインプログラム
// HTMLページが完全に読み込まれてから実行される
document.addEventListener('DOMContentLoaded', () => {
  
  // ===========================================
  // 1. DOM要素を取得（HTMLの各要素を変数に格納）
  // ===========================================
  
  // ゲーム画面の要素
  const scoreEl = document.getElementById('score');              // スコア表示
  const timerEl = document.getElementById('timer');              // 制限時間表示
  const comboEl = document.getElementById('combo');              // コンボ数表示
  const questionTextEl = document.getElementById('question-text'); // 問題文表示
  const resultDisplayEl = document.getElementById('result-display'); // 正解/不正解表示
  const recognizedTextEl = document.getElementById('recognized-text'); // 認識された音声のテキスト
  const interimTextEl = document.getElementById('interim-text');  // 音声認識中の暫定テキスト
  
  // ボタン要素
  const startButton = document.getElementById('start-button');    // ゲーム開始ボタン
  const stopButton = document.getElementById('stop-button');      // ゲーム終了ボタン
  const micPermissionButton = document.getElementById('mic-permission-button'); // マイク許可ボタン
  const restartButton = document.getElementById('restart-button'); // リスタートボタン
  const soundToggleButton = document.getElementById('sound-toggle'); // 音声ON/OFF切り替えボタン
  
  // 画面表示要素
  const micStatusEl = document.getElementById('mic-status');      // マイク許可状態表示
  const gameOverModal = document.getElementById('game-over-modal'); // ゲーム終了時のモーダル
  const difficultySelectorEl = document.getElementById('difficulty-selector'); // 難易度選択画面
  const gameContainerEl = document.querySelector('.game-container'); // ゲーム画面全体
  
  // ゲーム結果表示要素
  const finalScoreEl = document.getElementById('final-score');    // 最終スコア
  const maxComboEl = document.getElementById('max-combo');        // 最大コンボ数
  const correctCountEl = document.getElementById('correct-count'); // 正解数
  const missCountEl = document.getElementById('miss-count');      // 不正解数
  
  // 難易度選択ボタン（複数）
  const difficultyButtons = document.querySelectorAll('.difficulty-btn');
  
  // BGM音声要素
  const bgmEl = document.getElementById('bgm');
  
  // ===========================================
  // 2. 音声関連の設定
  // ===========================================
  
  let isMuted = false;        // 音声のON/OFF状態
  let audioUnlocked = false;  // ブラウザの音声再生が許可されているか
  
  // 効果音の設定（外部の音声ファイルを使用）
  const sounds = {
    start: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision18.mp3'),     // ゲーム開始音
    correct: new Audio('https://soundeffect-lab.info/sound/button/mp3/decision22.mp3'),   // 正解音
    incorrect: new Audio('https://soundeffect-lab.info/sound/button/mp3/beep4.mp3')       // 不正解音
  };
  
  // ブラウザの音声再生制限を解除する関数
  // 最近のブラウザはユーザーの操作なしに音声を再生できないため
  function unlockAudio() {
    if (audioUnlocked) return; // 既に解除済みなら何もしない
    
    const allSounds = [bgmEl, ...Object.values(sounds)]; // 全ての音声要素を配列にまとめる
    allSounds.forEach(sound => {
      sound.play().catch(() => {}); // 音声を再生（エラーは無視）
      sound.pause();                // すぐに停止
      sound.currentTime = 0;        // 再生位置をリセット
    });
    audioUnlocked = true;
    console.log("Audio context unlocked."); // デバッグ用メッセージ
  }
  
  // 効果音を再生する関数
  function playSound(sound) {
    if (!isMuted && audioUnlocked) { // ミュートじゃなく、音声が解除されていれば
      sounds[sound].currentTime = 0; // 再生位置をリセット
      sounds[sound].play().catch(e => console.error("Error playing sound:", e)); // 音声再生
    }
  }
  
  // ===========================================
  // 3. ゲーム状態の変数定義
  // ===========================================
  
  let gameActive = false;           // ゲームが実行中かどうか
  let currentDifficulty = 'normal'; // 現在の難易度（easy, normal, hard）
  let score = 0;                    // 現在のスコア
  let time = 60;                    // 残り時間（秒）
  let combo = 0;                    // 現在のコンボ数
  let maxCombo = 0;                 // 最大コンボ数
  let correctCount = 0;             // 正解数
  let missCount = 0;                // 不正解数
  let timerInterval = null;         // タイマーのインターバルID
  let currentQuestion = '';         // 現在の問題文
  
  // ===========================================
  // 4. マイク許可の管理
  // ===========================================
  
  // ローカルストレージからマイク許可状態を取得
  const isMicGranted = () => localStorage.getItem('micGranted') === 'true';
  // ローカルストレージにマイク許可状態を保存
  const setMicGranted = () => localStorage.setItem('micGranted', 'true');
  
  // ===========================================
  // 5. 音声認識の設定
  // ===========================================
  
  // ブラウザの音声認識APIを取得（Chrome/Edge用とSafari用）
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;
  
  // 音声認識がサポートされていない場合の処理
  if (!SpeechRecognition) {
    micStatusEl.innerHTML = '<p>お使いのブラウザは音声認識に対応していません。</p>';
    return; // プログラムを終了
  }
  
  // 音声認識の初期設定
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';           // 日本語に設定
  recognition.interimResults = true;    // 音声認識中の暫定結果も取得
  recognition.continuous = false;       // 連続認識はしない
  
  // ===========================================
  // 6. 初期化関数
  // ===========================================
  
  function initialize() {
    // マイクの許可が既に得られているかチェック
    if (isMicGranted()) {
      showDifficultySelector(); // 難易度選択画面を表示
    } else {
      micStatusEl.style.display = 'block'; // マイク許可画面を表示
    }
    bgmEl.volume = 0.3; // BGMの音量を30%に設定
  }
  
  // 難易度選択画面を表示する関数
  function showDifficultySelector() {
    micStatusEl.style.display = 'none';           // マイク許可画面を非表示
    difficultySelectorEl.style.display = 'block'; // 難易度選択画面を表示
    gameContainerEl.style.display = 'none';       // ゲーム画面を非表示
    gameOverModal.style.display = 'none';         // ゲーム終了モーダルを非表示
  }
  
  // ===========================================
  // 7. イベントリスナー（ユーザーの操作を監視）
  // ===========================================
  
  // マイク許可ボタンがクリックされた時の処理
  micPermissionButton.addEventListener('click', async () => {
    unlockAudio(); // 音声再生を解除
    try {
      // マイクの許可を要求
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // ストリームを停止（許可確認のためだけなので）
      stream.getTracks().forEach(track => track.stop());
      setMicGranted(); // 許可状態を保存
      showDifficultySelector(); // 難易度選択画面へ
    } catch (err) {
      // マイク許可が拒否された場合のエラー表示
      micStatusEl.innerHTML = '<p>❌ マイクの許可が必要です。ブラウザの設定を確認してください。</p>';
      console.error('Microphone permission denied:', err);
    }
  });
  
  // 難易度選択ボタンがクリックされた時の処理
  difficultyButtons.forEach(button => {
    button.addEventListener('click', () => {
      unlockAudio(); // 音声再生を解除
      currentDifficulty = button.dataset.difficulty; // クリックされたボタンの難易度を取得
      
      // 全てのボタンからselectedクラスを削除
      difficultyButtons.forEach(btn => btn.classList.remove('selected'));
      // クリックされたボタンにselectedクラスを追加
      button.classList.add('selected');
      
      // 画面切り替え
      difficultySelectorEl.style.display = 'none';   // 難易度選択画面を非表示
      gameContainerEl.style.display = 'flex';        // ゲーム画面を表示
      
      // ボタン表示切り替え
      startButton.style.display = 'inline-block';    // 開始ボタンを表示
      stopButton.style.display = 'none';             // 停止ボタンを非表示
      
      resetGame();    // ゲーム状態をリセット
      nextQuestion(); // 最初の問題を表示
    });
  });
  
  // ゲーム開始ボタンがクリックされた時
  startButton.addEventListener('click', startGame);
  
  // ゲーム停止ボタンがクリックされた時
  stopButton.addEventListener('click', stopGame);
  
  // リスタートボタンがクリックされた時
  restartButton.addEventListener('click', () => {
    showDifficultySelector(); // 難易度選択画面に戻る
  });
  
  // 音声ON/OFF切り替えボタンがクリックされた時
  soundToggleButton.addEventListener('click', () => {
    isMuted = !isMuted; // ミュート状態を切り替え
    soundToggleButton.textContent = isMuted ? '🔇' : '🔊'; // ボタンのアイコンを変更
    bgmEl.muted = isMuted; // BGMのミュート状態も切り替え
  });
  
  // ===========================================
  // 8. 音声認識のイベントハンドラー
  // ===========================================
  
  // 音声認識結果を受け取った時の処理
  recognition.onresult = (event) => {
    let interimTranscript = '';  // 暫定的な認識結果
    let finalTranscript = '';    // 確定した認識結果
    
    // 認識結果を処理
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        // 確定した結果
        finalTranscript += event.results[i][0].transcript;
      } else {
        // 暫定的な結果
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    // 画面に表示
    interimTextEl.textContent = interimTranscript;
    if (finalTranscript) {
      recognizedTextEl.textContent = finalTranscript;
      checkAnswer(finalTranscript); // 答えをチェック
    }
  };
  
  // 音声認識が終了した時の処理
  recognition.onend = () => {
    if (gameActive) {
      recognition.start(); // ゲーム中なら音声認識を再開
    }
  };
  
  // 音声認識でエラーが発生した時の処理
  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
  };
  
  // ===========================================
  // 9. ゲームロジック
  // ===========================================
  
  // ゲームを開始する関数
  function startGame() {
    gameActive = true; // ゲーム状態をアクティブに
    
    // ボタン表示切り替え
    startButton.style.display = 'none';         // 開始ボタンを非表示
    stopButton.style.display = 'inline-block';  // 停止ボタンを表示
    
    // BGM再生
    if (!isMuted) {
      bgmEl.currentTime = 0; // BGMを最初から再生
      bgmEl.play().catch(e => console.error("BGM play failed:", e));
    }
    
    // 1秒ごとにタイマーを減らす
    timerInterval = setInterval(() => {
      time--;                    // 時間を1秒減らす
      timerEl.textContent = time; // 画面に表示
      if (time <= 0) {
        stopGame(); // 時間が0になったらゲーム終了
      }
    }, 1000);
    
    // 音声認識を開始
    try {
      recognition.start();
    } catch(e) {
      console.error("Recognition could not be started: ", e);
    }
    
    playSound('start'); // ゲーム開始音を再生
  }
  
  // ゲームを停止する関数
  function stopGame() {
    gameActive = false; // ゲーム状態を非アクティブに
    
    // ボタン表示切り替え
    stopButton.style.display = 'none';          // 停止ボタンを非表示
    startButton.style.display = 'inline-block'; // 開始ボタンを表示
    
    // タイマーとBGMを停止
    if (timerInterval) clearInterval(timerInterval);
    recognition.stop(); // 音声認識を停止
    bgmEl.pause();      // BGMを停止
    
    // ゲーム終了モーダルを表示
    gameOverModal.style.display = 'flex';
    finalScoreEl.textContent = score;        // 最終スコアを表示
    maxComboEl.textContent = maxCombo;       // 最大コンボを表示
    correctCountEl.textContent = correctCount; // 正解数を表示
    missCountEl.textContent = missCount;     // 不正解数を表示
  }
  
  // ゲーム状態をリセットする関数
  function resetGame() {
    score = 0;
    time = 60;
    combo = 0;
    maxCombo = 0;
    correctCount = 0;
    missCount = 0;
    
    // 画面表示も更新
    scoreEl.textContent = score;
    timerEl.textContent = time;
    comboEl.textContent = combo;
    recognizedTextEl.textContent = '...';
    interimTextEl.textContent = '';
  }
  
  // 次の問題を表示する関数
  function nextQuestion() {
    // 難易度に応じた問題プールを取得
    const questionPool = questions[currentDifficulty] || questions['normal'];
    
    if (questionPool.length === 1) {
      // 問題が1つしかない場合
      currentQuestion = questionPool[0];
    } else {
      // 複数の問題がある場合、前の問題と違う問題を選ぶ
      let newQuestion;
      do {
        newQuestion = questionPool[Math.floor(Math.random() * questionPool.length)];
      } while (newQuestion === currentQuestion);
      currentQuestion = newQuestion;
    }
    
    questionTextEl.textContent = currentQuestion; // 問題を画面に表示
  }
  
  // テキストを正規化する関数（ひらがなに統一、句読点を削除）
  function normalizeText(text) {
    // wanakanaライブラリを使ってカタカナや漢字をひらがなに変換
    // 注意：このコードではwanakanaライブラリが必要だが、実際のHTMLでは読み込まれていない可能性がある
    let normalized = text;
    
    // wanakanaが利用可能な場合のみ使用
    if (typeof wanakana !== 'undefined') {
      normalized = wanakana.toHiragana(text);
    }
    
    // 句読点とスペースを削除
    return normalized.replace(/[、。！？\\s,.?!]/g, '');
  }
  
  // 答えをチェックする関数
  function checkAnswer(answer) {
    if (!gameActive) return; // ゲームが非アクティブなら何もしない
    
    // 答えと問題を正規化して比較
    const normalizedAnswer = normalizeText(answer);
    const normalizedQuestion = normalizeText(currentQuestion);
    
    if (normalizedAnswer === normalizedQuestion) {
      // 正解の場合
      score += 100 + (combo * 10);  // スコア加算（コンボボーナス付き）
      combo++;                      // コンボ数を増加
      correctCount++;               // 正解数を増加
      if (combo > maxCombo) maxCombo = combo; // 最大コンボ更新
      
      // 正解表示
      resultDisplayEl.textContent = '正解！';
      resultDisplayEl.className = 'result-display correct';
      playSound('correct'); // 正解音を再生
    } else {
      // 不正解の場合
      combo = 0;          // コンボをリセット
      missCount++;        // 不正解数を増加
      
      // 不正解表示
      resultDisplayEl.textContent = '残念！';
      resultDisplayEl.className = 'result-display incorrect';
      playSound('incorrect'); // 不正解音を再生
    }
    
    // スコアとコンボ表示を更新
    scoreEl.textContent = score;
    comboEl.textContent = combo;
    
    // 1秒後に結果表示をクリア
    setTimeout(() => {
      resultDisplayEl.textContent = '';
      resultDisplayEl.className = 'result-display';
    }, 1000);
    
    // 0.2秒後に次の問題を表示
    setTimeout(nextQuestion, 200);
  }
  
  // ===========================================
  // 10. アプリケーション開始
  // ===========================================
  
  initialize(); // 初期化関数を実行してアプリを開始
});
