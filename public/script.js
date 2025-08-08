// ラーメン屋テーマ用の演出 + 既存ゲーム補助
(() => {
  // === DOM取得 ===
  const questionTextEl = document.getElementById('question-text');
  const orderNumEl = document.getElementById('order-number');
  const bowlEl = document.getElementById('ramen-bowl');
  const resultDisplayEl = document.getElementById('result-display');
  const recognizedTextEl = document.getElementById('recognized-text');
  const interimTextEl = document.getElementById('interim-text');
  const startBtn = document.getElementById('start-button');
  const stopBtn = document.getElementById('stop-button');
  const soundToggle = document.getElementById('sound-toggle');
  const micBtn = document.getElementById('mic-permission-button');
  const micStatus = document.getElementById('mic-status');
  const difficultySelector = document.getElementById('difficulty-selector');
  const gameContainer = document.querySelector('.game-container');
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const comboEl = document.getElementById('combo');
  const bgmEl = document.getElementById('bgm');
  const tenseBgmEl = document.getElementById('tense-bgm');

  // BGM状態
  let isMuted = false;
  function resetBgm() {
    [bgmEl, tenseBgmEl].forEach(a => { if (!a) return; a.pause(); a.currentTime = 0; a.muted = isMuted; });
  }
  resetBgm();

  soundToggle?.addEventListener('click', () => {
    isMuted = !isMuted;
    soundToggle.textContent = isMuted ? '🔇' : '🔊';
    [bgmEl, tenseBgmEl].forEach(a => { if (!a) return; a.muted = isMuted; });
  });

  // ゲーム状態
  let currentDifficulty = 'normal';
  let orderIndex = 1;
  let currentQuestion = '';
  let score = 0;
  let combo = 0;
  let timeLeft = 60;
  let timerId = null;

  // 質問（注文）プール（questions.js があればそちらを使う）
  const fallbackQuestions = {
    easy: ["しょうゆ", "しお", "みそ", "バター", "のり"],
    normal: ["味玉しょうゆ", "チャーシューみそ", "ねぎしお", "メンマしょうゆ", "のりバター"],
    hard: ["特製味玉しょうゆ", "チャーシューダブルみそ", "全部のせしお", "焦がしにんにくしょうゆ", "背脂こってりみそ"]
  };
  // global questions から読む（未定義ならフォールバック）
  const orders = (typeof questions !== 'undefined') ? questions : fallbackQuestions;

  // BGM: 開始で再生、停止で止める
  function playBgmSafe() {
    try {
      bgmEl.loop = true; bgmEl.muted = isMuted; bgmEl.currentTime = 0;
      const p = bgmEl.play();
      if (p && p.then) p.catch(()=>{});
    } catch {}
  }

  function stopBgm() { resetBgm(); }

  // UI 更新
  function updateHud() {
    scoreEl.textContent = String(score);
    comboEl.textContent = String(combo);
    timerEl.textContent = String(timeLeft);
  }

  // 次の注文へ
  function nextQuestion() {
    const pool = orders[currentDifficulty] || orders.normal || fallbackQuestions.normal;
    let newQ = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) {
      // 直前の注文と被りにくく
      let guard = 0;
      while (newQ === currentQuestion && guard++ < 10) {
        newQ = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    currentQuestion = newQ;
    questionTextEl.textContent = currentQuestion;
    orderNumEl.textContent = String(orderIndex++);

    // 前回の認識テキストを消す
    recognizedTextEl.textContent = "";
    interimTextEl.textContent = "";
  }

  // 提供アニメーション
  function serveSuccess() {
    bowlEl.classList.remove('serve');
    // 少しリフローしてから付与
    void bowlEl.offsetWidth;
    bowlEl.classList.add('serve');
    setTimeout(() => {
      // 皿を元の位置へ戻す
      bowlEl.classList.remove('serve');
    }, 900);
  }
  function serveFail() {
    // 演出：軽く揺らすだけ（result-displayにshakeあり）
    bowlEl.style.transform = 'rotate(-8deg)';
    setTimeout(()=> bowlEl.style.transform = '', 250);
  }

  // 判定のフック：result-display の class 変化を監視して演出
  const observer = new MutationObserver(() => {
    if (resultDisplayEl.classList.contains('correct')) {
      serveSuccess();
      // 正解ならスコアなど軽く進める（このファイル単体でも動くように）
      score += 10; combo += 1;
      nextQuestion();
    } else if (resultDisplayEl.classList.contains('incorrect')) {
      serveFail();
      combo = 0;
    }
    updateHud();
  });
  observer.observe(resultDisplayEl, { attributes: true, attributeFilter: ['class'] });

  // ざっくりとした開始/停止（既存実装があればそちら優先）
  startBtn?.addEventListener('click', () => {
    micStatus.style.display = 'none';
    difficultySelector.style.display = 'none';
    gameContainer.style.display = 'flex';
    score = 0; combo = 0; timeLeft = 60; updateHud();
    nextQuestion();
    playBgmSafe();
    stopBtn.style.display = 'inline-block';
    startBtn.style.display = 'none';
    // 簡易タイマー
    clearInterval(timerId);
    timerId = setInterval(() => {
      timeLeft -= 1; updateHud();
      if (timeLeft <= 0) {
        clearInterval(timerId);
        stopBgm();
        resultDisplayEl.textContent = "時間切れ！";
        resultDisplayEl.classList.remove('correct', 'incorrect');
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
      }
    }, 1000);
  });

  stopBtn?.addEventListener('click', () => {
    clearInterval(timerId);
    stopBgm();
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
  });

  // 難易度選択ボタン（存在すれば）
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentDifficulty = btn.dataset.difficulty || 'normal';
    });
  });

  // マイク許可は見かけだけ（本番は既存の音声認識処理に委譲）
  micBtn?.addEventListener('click', () => {
    micStatus.style.display = 'none';
    difficultySelector.style.display = 'block';
  });

  // グローバルに一部公開（既存コードから呼び出せるように）
  window.__ramen = {
    nextQuestion,
    serveSuccess,
    serveFail,
    setResult: (ok)=>{
      // 既存の判定の代替：okに応じてクラス付与
      resultDisplayEl.classList.remove('correct','incorrect');
      if (ok) { resultDisplayEl.classList.add('correct'); resultDisplayEl.textContent = "提供成功！"; }
      else { resultDisplayEl.classList.add('incorrect'); resultDisplayEl.textContent = "注文ミス…"; }
    }
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  const micStatus = document.getElementById("mic-status");
  const diff = document.getElementById("difficulty-selector");
  const game = document.querySelector(".game-container");
  const startBtn = document.getElementById("start-button");
  const stopBtn  = document.getElementById("stop-button");
  const scoreEl  = document.getElementById("score");
  const timerEl  = document.getElementById("timer");
  const comboEl  = document.getElementById("combo");
  const questionTextEl   = document.getElementById("question-text");
  const recognizedTextEl = document.getElementById("recognized-text");
  const interimTextEl    = document.getElementById("interim-text");
  const orderNumEl       = document.getElementById("order-number");
  const bgmEl = document.getElementById("bgm");

  let currentDifficulty = "normal";
  let currentQuestion = "";
  let orderNo = 1, score = 0, combo = 0, timeLeft = 60, timer = null;

  // 質問プール（questions.js があればそれを使う）
  const orders = (typeof questions !== "undefined") ? questions : {
    easy:["しょうゆ","しお","みそ","のり","ねぎ","メンマ","バター"],
    normal:["味玉しょうゆ","チャーシューみそ","ねぎしお","メンマしょうゆ","のりバター","こってりみそ","あっさりしょうゆ"],
    hard:["特製味玉しょうゆ","チャーシューダブルみそ","全部のせしお","焦がしにんにくしょうゆ","背脂こってりみそ","バターコーンみそ"]
  };

  function updateHUD(){ scoreEl.textContent=score; comboEl.textContent=combo; timerEl.textContent=timeLeft; }
  function nextQuestion(){
    const pool = orders[currentDifficulty] || orders.normal;
    currentQuestion = pool[Math.floor(Math.random()*pool.length)];
    questionTextEl.textContent = currentQuestion;
    orderNumEl.textContent = String(orderNo++);
    recognizedTextEl.textContent = "";
    interimTextEl.textContent = "";
  }

  function startGame(){
    micStatus.style.display = "none";
    diff.style.display = "none";
    game.style.display = "flex";
    score=0; combo=0; timeLeft=60; orderNo=1; updateHUD();
    nextQuestion();
    try { bgmEl.currentTime=0; bgmEl.play().catch(()=>{}); } catch(e){}
    startBtn.style.display = "none";
    stopBtn.style.display  = "inline-block";
    clearInterval(timer);
    timer = setInterval(()=>{
      timeLeft--; updateHUD();
      if(timeLeft<=0){
        clearInterval(timer);
        try{bgmEl.pause();}catch(e){}
        startBtn.style.display="inline-block";
        stopBtn.style.display="none";
      }
    },1000);
  }

  // ✅ 難易度ボタンにイベントを紐づけ
  document.querySelectorAll(".difficulty-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".difficulty-btn").forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
      currentDifficulty = btn.dataset.difficulty || "normal";
      startGame();                   // ← クリックで即開始
    });
  });

  // 任意で開始/停止ボタンも動かす
  startBtn?.addEventListener("click", startGame);
  stopBtn?.addEventListener("click", ()=>{
    clearInterval(timer);
    try{bgmEl.pause();}catch(e){}
    startBtn.style.display="inline-block";
    stopBtn.style.display="none";
  });
});

