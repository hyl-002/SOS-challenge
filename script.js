/*
Customer Mood Challenge - game layout version
IMPORTANT:
Keep your current Google Apps Script / Google Sheet setup.
Replace the URL below with your deployed /exec URL.
*/

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxouurLrJeDCf__fDMdnIay7xwBgcQI0dKz7Ld3o-vE-WGvJuub_bE3iyH-UHQOWew1kg/exec";

const SETTINGS = {
  totalQuestions: 10,
  startingMood: 40,
  fullSpeedBonusSeconds: 150,
  fullSpeedBonusPoints: 10
};

let state = {
  staffId: "",
  questions: [],
  currentIndex: 0,
  mood: SETTINGS.startingMood,
  startTime: null,
  elapsedSeconds: 0,
  timerId: null,
  productBest: 0,
  serviceBest: 0,
  answers: [],
  locked: false
};

const $ = id => document.getElementById(id);

const screens = {
  landing: $("screenLanding"),
  rules: $("screenRules"),
  loading: $("screenLoading"),
  game: $("screenGame"),
  result: $("screenResult")
};

function showScreen(name) {
  Object.values(screens).forEach(el => el.classList.remove("active"));
  screens[name].classList.add("active");

  // Force mobile Safari back to the very top
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant"
    });
  });

  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 50);
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function customerFace(mood) {
  if (mood >= 95) return "🤩";
  if (mood >= 80) return "😄";
  if (mood >= 65) return "🙂";
  if (mood >= 45) return "😐";
  if (mood >= 25) return "🙁";
  return "😠";
}

function normalizeMood(value) {
  return Math.max(0, Math.min(100, value));
}

function updateMoodUI() {
  state.mood = normalizeMood(state.mood);

  $("moodText").textContent = `${state.mood}%`;
  $("moodEmoji").textContent = customerFace(state.mood);
  $("customerFace").textContent = customerFace(state.mood);

  const gauge = document.querySelector(".mood-gauge");
  if (gauge) {
    gauge.style.background =
      `conic-gradient(#ffcc22 0 ${state.mood}%, #e8e8e8 ${state.mood}% 100%)`;
  }
}

function buildStepDots() {
  const area = $("stepDots");
  area.innerHTML = "";

  for (let i = 0; i < SETTINGS.totalQuestions; i++) {
    const dot = document.createElement("div");
    dot.className = "step-dot";
    dot.textContent = i + 1;

    if (i < state.currentIndex) dot.classList.add("done");
    if (i === state.currentIndex) dot.classList.add("active");

    area.appendChild(dot);
  }
}

async function validateStaffId() {

  const value =
    $("staffId").value.trim();


  if (!value) {

    $("landingMessage").textContent =
      "請輸入 Staff ID。";

    return false;

  }


  $("landingMessage").textContent =
    "正在驗證 Staff ID…";


  $("goRulesBtn").disabled = true;


  try {

    const url =
      `${GAS_WEB_APP_URL}` +
      `?action=validateStaff` +
      `&staffId=${encodeURIComponent(value)}` +
      `&t=${Date.now()}`;


    const response =
      await fetch(url);


    if (!response.ok) {

      throw new Error(
        "Unable to validate Staff ID."
      );

    }


    const data =
      await response.json();


    if (!data.ok) {

      throw new Error(
        data.message ||
        "Validation failed."
      );

    }


    if (!data.valid) {

      $("landingMessage").textContent =
        data.message ||
        "Staff ID not found.";

      return false;

    }


    state.staffId =
      value;


    $("landingMessage").textContent =
      "✓ Staff ID verified";


    return true;


  } catch (error) {

    console.error(error);

    $("landingMessage").textContent =
      "暫時無法驗證 Staff ID，請稍後再試。";

    return false;


  } finally {

    $("goRulesBtn").disabled =
      false;

  }

}

async function fetchQuestions() {
  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("PASTE_YOUR")) {
    throw new Error("未設定 Google Apps Script Web App URL。");
  }

  const response = await fetch(
    `${GAS_WEB_APP_URL}?action=questions&t=${Date.now()}`
  );

  if (!response.ok) {
    throw new Error("Load failed");
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.message || "讀取題目失敗。");
  }

  if (!Array.isArray(data.questions) ||
      data.questions.length < SETTINGS.totalQuestions) {
    throw new Error(`Questions sheet 至少需要 ${SETTINGS.totalQuestions} 條啟用題目。`);
  }

  state.questions = data.questions.slice(0, SETTINGS.totalQuestions);
}

function startTimer() {
  state.startTime = Date.now();
  state.elapsedSeconds = 0;
  $("timerText").textContent = "00:00";

  state.timerId = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    $("timerText").textContent = formatTime(state.elapsedSeconds);
  }, 250);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  if (state.startTime) {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
  }
}

function resetGameState() {
  stopTimer();

  state.currentIndex = 0;
  state.mood = SETTINGS.startingMood;
  state.startTime = null;
  state.elapsedSeconds = 0;
  state.productBest = 0;
  state.serviceBest = 0;
  state.answers = [];
  state.locked = false;

  updateMoodUI();
}

function renderQuestion() {
  state.locked = false;

  const q = state.questions[state.currentIndex];
  const number = state.currentIndex + 1;

  $("questionCounter").textContent = `${number} / ${SETTINGS.totalQuestions}`;
  $("questionType").textContent = q.type;
  $("questionText").textContent = q.question;

  buildStepDots();

  $("feedbackBox").classList.add("hidden");
  $("feedbackBox").innerHTML = "";
  $("nextBtn").classList.add("hidden");

  const answerList = $("answerList");
  answerList.innerHTML = "";

  q.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-btn";

    const letter = String.fromCharCode(65 + index);

    button.innerHTML = `
      <span class="answer-letter">${letter}</span>
      <span>${escapeHtml(answer.text)}</span>
    `;

    button.addEventListener("click", () => {
      selectAnswer(q, answer, index, button);
    });

    answerList.appendChild(button);
  });
}

function selectAnswer(question, answer, answerIndex, button) {
  if (state.locked) return;
  state.locked = true;

  document.querySelectorAll(".answer-btn").forEach(btn => {
    btn.disabled = true;
  });

  button.classList.add("selected");

  const moodBefore = state.mood;

  state.mood += Number(answer.score || 0);
  updateMoodUI();

  if (answer.isBest) {
    if (String(question.type).toLowerCase() === "product") {
      state.productBest++;
    }

    if (String(question.type).toLowerCase() === "service") {
      state.serviceBest++;
    }
  }

  state.answers.push({
    questionId: question.id,
    type: question.type,
    selectedOption: String.fromCharCode(65 + answerIndex),
    selectedText: answer.text,
    score: Number(answer.score || 0),
    isBest: Boolean(answer.isBest),
    moodBefore: moodBefore,
    moodAfter: state.mood
  });

  let moodMessage = "Customer Mood —";

  if (Number(answer.score) > 0) moodMessage = "Customer Mood ↑";
  if (Number(answer.score) < 0) moodMessage = "Customer Mood ↓";

  $("feedbackBox").innerHTML = `
    <strong>${moodMessage}</strong>
    <span>${escapeHtml(answer.reaction || "")}</span>
  `;

  $("feedbackBox").classList.remove("hidden");
  $("nextBtn").classList.remove("hidden");
}

function calculateResult() {
  const speedBonus =
    state.elapsedSeconds <= SETTINGS.fullSpeedBonusSeconds
      ? SETTINGS.fullSpeedBonusPoints
      : 0;

  const finalMood = normalizeMood(state.mood + speedBonus);

  return {
    finalMood,
    speedBonus,
    qualified: finalMood === 100
  };
}

async function finishGame() {
  stopTimer();

  const result = calculateResult();

  $("finalMood").textContent = `${result.finalMood}%`;
  $("completionTime").textContent = formatTime(state.elapsedSeconds);
  $("speedBonus").textContent = `+${result.speedBonus}`;
  $("productScore").textContent = `${state.productBest} / 7`;
  $("serviceScore").textContent = `${state.serviceBest} / 3`;
  $("resultFace").textContent = customerFace(result.finalMood);

  if (result.finalMood === 100) {
    $("resultTitle").textContent = "客戶非常滿意！";
    $("resultMessage").textContent = "你為顧客提供了專業又貼心嘅服務。";
    $("rewardBox").innerHTML =
      '<span class="trophy">🏆</span><div><strong>Happy Customer Award</strong><small>恭喜你！已符合獎賞資格 🎉</small></div>';
  } else if (result.finalMood >= 80) {
    $("resultTitle").textContent = "客戶很滿意！";
    $("resultMessage").textContent = "做得好！再改善少少就可以挑戰 100%。";
    $("rewardBox").innerHTML =
      '<span class="trophy">✨</span><div><strong>差少少就 Perfect！</strong><small>再挑戰一次，向 100% 出發。</small></div>';
  } else if (result.finalMood >= 60) {
    $("resultTitle").textContent = "客戶滿意";
    $("resultMessage").textContent = "基本需要已處理，但仲有提升空間。";
    $("rewardBox").innerHTML =
      '<span class="trophy">💡</span><div><strong>Keep Going!</strong><small>留意顧客反應，再試一次。</small></div>';
  } else {
    $("resultTitle").textContent = "客戶有點失望";
    $("resultMessage").textContent = "今次顧客體驗未如理想，再挑戰一次！";
    $("rewardBox").innerHTML =
      '<span class="trophy">🔁</span><div><strong>Try Again</strong><small>重新選擇更合適嘅回應。</small></div>';
  }

  showScreen("result");

  await submitResult(result);
}

async function submitResult(result) {
  $("submitStatus").textContent = "正在儲存成績…";

  const payload = {
    action: "submitResult",
    staffId: state.staffId,
    finalMood: result.finalMood,
    productScore: state.productBest,
    serviceScore: state.serviceBest,
    completionSeconds: state.elapsedSeconds,
    completionTime: formatTime(state.elapsedSeconds),
    speedBonus: result.speedBonus,
    qualified: result.qualified ? "Yes" : "No",
    answers: state.answers
  };

  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || "Save failed");
    }

    $("submitStatus").textContent = "成績已儲存 ✓";
  } catch (error) {
    console.error(error);
    $("submitStatus").textContent = "成績未能儲存，請通知活動負責人。";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("goRulesBtn").addEventListener(
  "click",
  async () => {

    const valid =
      await validateStaffId();

    if (valid) {

      showScreen("rules");

    }

  }
);
$("backBtn").addEventListener("click", () => {
  showScreen("landing");
});

$("startBtn").addEventListener("click", async () => {
  showScreen("loading");

  try {
    await fetchQuestions();
    resetGameState();
    showScreen("game");
    renderQuestion();
    startTimer();
  } catch (error) {
    console.error(error);
    showScreen("rules");
    alert(error.message);
  }
});

$("nextBtn").addEventListener("click", () => {
  if (state.currentIndex < SETTINGS.totalQuestions - 1) {
    state.currentIndex++;
    renderQuestion();
  } else {
    finishGame();
  }
});

$("retryBtn").addEventListener("click", () => {
  resetGameState();
  showScreen("rules");
});

$("restartBtn").addEventListener("click", () => {
  resetGameState();
  $("staffId").value = "";
  showScreen("landing");
});

showScreen("landing");
