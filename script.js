/*
Customer Mood Challenge - game layout version
IMPORTANT:
Keep your current Google Apps Script / Google Sheet setup.
Replace the URL below with your deployed /exec URL.
*/

const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxouurLrJeDCf__fDMdnIay7xwBgcQI0dKz7Ld3o-vE-WGvJuub_bE3iyH-UHQOWew1kg/exec";


if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}


/* =================================================
   IPHONE KEYBOARD / VIEWPORT FIX
================================================= */

/*
  記住遊戲第一次開啟時嘅正常高度。
  iPhone keyboard 彈出後，唔俾個 game 跟住縮細。
*/
let appBaseHeight = window.innerHeight;


/* 將正常高度傳俾 CSS */
function setAppHeight() {

  document.documentElement.style.setProperty(
    "--app-height",
    `${appBaseHeight}px`
  );

}


/*
  將 Safari 畫面強制回復最頂
*/
function forceViewportTop() {

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  window.scrollTo(0, 0);

}


/*
  等 iPhone keyboard 真正收起先轉頁
*/
function waitForKeyboardClose() {

  return new Promise(resolve => {

    /*
      冇 visualViewport 都照樣可以用
    */
    if (!window.visualViewport) {

      setTimeout(() => {

        forceViewportTop();
        resolve();

      }, 300);

      return;
    }


    let stableCount = 0;

    let lastHeight =
      window.visualViewport.height;


    const checkViewport = () => {

      const currentHeight =
        window.visualViewport.height;


      /*
        Keyboard 收起之後，
        visual viewport 應該會接近原本正常高度
      */
      const closeEnough =
        currentHeight >=
        appBaseHeight * 0.85;


      /*
        連續幾次高度冇再變，
        代表 Safari 已經完成 resize
      */
      if (
        Math.abs(
          currentHeight -
          lastHeight
        ) < 2
      ) {

        stableCount++;

      } else {

        stableCount = 0;

      }


      lastHeight =
        currentHeight;


      if (
        closeEnough &&
        stableCount >= 2
      ) {

        forceViewportTop();

        resolve();

        return;

      }


      setTimeout(
        checkViewport,
        60
      );

    };


    /*
      最多等一陣，避免 Safari 卡住
    */
    setTimeout(() => {

      forceViewportTop();
      resolve();

    }, 700);


    requestAnimationFrame(
      checkViewport
    );

  });

}


/*
  首次載入固定正常遊戲高度
*/
setAppHeight();


/*
  如果轉橫屏 / 直屏，
  keyboard 冇開先重新記錄高度
*/
window.addEventListener(
  "orientationchange",
  () => {

    setTimeout(() => {

      const activeElement =
        document.activeElement;


      const keyboardOpen =
        activeElement &&
        (
          activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA"
        );


      if (!keyboardOpen) {

        appBaseHeight =
          window.innerHeight;

        setAppHeight();

        forceViewportTop();

      }

    }, 400);

  }
);


/* =================================================
   GAME SETTINGS
================================================= */

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


const $ = id =>
  document.getElementById(id);


const screens = {
  landing: $("screenLanding"),
  rules: $("screenRules"),
  loading: $("screenLoading"),
  game: $("screenGame"),
  result: $("screenResult")
};


/* =================================================
   SCREEN CONTROL
================================================= */

function showScreen(name) {

  Object.values(screens).forEach(screen => {

    screen.classList.remove("active");

  });


  screens[name].classList.add("active");


  /*
    每次換 screen 都固定返 viewport
  */
  forceViewportTop();

}


/* =================================================
   HELPERS
================================================= */

function formatTime(seconds) {

  const m =
    String(
      Math.floor(seconds / 60)
    ).padStart(2, "0");


  const s =
    String(
      seconds % 60
    ).padStart(2, "0");


  return `${m}:${s}`;

}


function customerImage(mood) {

  if (mood >= 95) {
    return "images/customer-delighted.png";
  }

  if (mood >= 80) {
    return "images/customer-happy.png";
  }

  if (mood >= 60) {
    return "images/customer-neutral.png";
  }

  if (mood >= 30) {
    return "images/customer-unhappy.png";
  }

  return "images/customer-angry.png";

}


function normalizeMood(value) {

  return Math.max(
    0,
    Math.min(100, value)
  );

}


/* =================================================
   MOOD UI
================================================= */

function updateMoodUI() {

  state.mood =
    normalizeMood(state.mood);


  $("moodText").textContent =
    `${state.mood}%`;


  $("customerFace").src =
    customerImage(state.mood);


  $("moodEmoji").src =
    customerImage(state.mood);


  const gauge =
    document.querySelector(
      ".mood-gauge"
    );


  if (gauge) {

    gauge.style.background =
      `conic-gradient(
        #ffcc22 0 ${state.mood}%,
        #e8e8e8 ${state.mood}% 100%
      )`;

  }

}


/* =================================================
   QUESTION PROGRESS
================================================= */

function buildStepDots() {

  const area =
    $("stepDots");


  area.innerHTML = "";


  for (
    let i = 0;
    i < SETTINGS.totalQuestions;
    i++
  ) {

    const dot =
      document.createElement("div");


    dot.className =
      "step-dot";


    dot.textContent =
      i + 1;


    if (
      i < state.currentIndex
    ) {

      dot.classList.add(
        "done"
      );

    }


    if (
      i === state.currentIndex
    ) {

      dot.classList.add(
        "active"
      );

    }


    area.appendChild(dot);

  }

}


/* =================================================
   STAFF ID VALIDATION
================================================= */

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


  $("goRulesBtn").disabled =
    true;


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


/* =================================================
   FETCH QUESTIONS
================================================= */

async function fetchQuestions() {

  if (
    !GAS_WEB_APP_URL ||
    GAS_WEB_APP_URL.includes(
      "PASTE_YOUR"
    )
  ) {

    throw new Error(
      "未設定 Google Apps Script Web App URL。"
    );

  }


  const response =
    await fetch(
      `${GAS_WEB_APP_URL}?action=questions&t=${Date.now()}`
    );


  if (!response.ok) {

    throw new Error(
      "Load failed"
    );

  }


  const data =
    await response.json();


  if (!data.ok) {

    throw new Error(
      data.message ||
      "讀取題目失敗。"
    );

  }


  if (
    !Array.isArray(
      data.questions
    ) ||
    data.questions.length <
    SETTINGS.totalQuestions
  ) {

    throw new Error(
      `Questions sheet 至少需要 ${SETTINGS.totalQuestions} 條啟用題目。`
    );

  }


  state.questions =
    data.questions.slice(
      0,
      SETTINGS.totalQuestions
    );

}


/* =================================================
   TIMER
================================================= */

function startTimer() {

  state.startTime =
    Date.now();


  state.elapsedSeconds =
    0;


  $("timerText").textContent =
    "00:00";


  state.timerId =
    setInterval(() => {

      state.elapsedSeconds =
        Math.floor(
          (
            Date.now() -
            state.startTime
          ) / 1000
        );


      $("timerText").textContent =
        formatTime(
          state.elapsedSeconds
        );

    }, 250);

}


function stopTimer() {

  if (state.timerId) {

    clearInterval(
      state.timerId
    );


    state.timerId =
      null;

  }


  if (state.startTime) {

    state.elapsedSeconds =
      Math.floor(
        (
          Date.now() -
          state.startTime
        ) / 1000
      );

  }

}


/* =================================================
   RESET GAME
================================================= */

function resetGameState() {

  stopTimer();


  state.currentIndex = 0;

  state.mood =
    SETTINGS.startingMood;

  state.startTime =
    null;

  state.elapsedSeconds =
    0;

  state.productBest =
    0;

  state.serviceBest =
    0;

  state.answers =
    [];

  state.locked =
    false;


  /*
    如果 feedback popup 開住，
    reset 時收返埋
  */
  if ($("feedbackModal")) {

    $("feedbackModal")
      .classList
      .add("hidden");


    $("feedbackModal")
      .setAttribute(
        "aria-hidden",
        "true"
      );

  }


  updateMoodUI();

}


/* =================================================
   RENDER QUESTION
================================================= */

function renderQuestion() {

  state.locked =
    false;


  const q =
    state.questions[
      state.currentIndex
    ];


  const number =
    state.currentIndex + 1;


  $("questionCounter").textContent =
    `${number} / ${SETTINGS.totalQuestions}`;


  $("questionType").textContent =
    q.type;


  $("questionText").textContent =
    q.question;


  buildStepDots();


  /*
    每條新題目開始時，
    popup 必須收埋
  */
  $("feedbackModal")
    .classList
    .add("hidden");


  $("feedbackModal")
    .setAttribute(
      "aria-hidden",
      "true"
    );


  const answerList =
    $("answerList");


  answerList.innerHTML =
    "";


  q.answers.forEach(
    (answer, index) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "answer-btn";


      const letter =
        String.fromCharCode(
          65 + index
        );


      button.innerHTML = `
        <span class="answer-letter">
          ${letter}
        </span>

        <span>
          ${escapeHtml(answer.text)}
        </span>
      `;


      button.addEventListener(
        "click",
        () => {

          selectAnswer(
            q,
            answer,
            index,
            button
          );

        }
      );


      answerList.appendChild(
        button
      );

    }
  );

}


/* =================================================
   SELECT ANSWER
================================================= */

function selectAnswer(
  question,
  answer,
  answerIndex,
  button
) {

  if (state.locked) {
    return;
  }


  state.locked =
    true;


  /*
    揀咗答案之後，
    所有答案 disable
  */
  document
    .querySelectorAll(
      ".answer-btn"
    )
    .forEach(btn => {

      btn.disabled =
        true;

    });


  button.classList.add(
    "selected"
  );


  const moodBefore =
    state.mood;


  /*
    更新 mood
  */
  state.mood +=
    Number(
      answer.score || 0
    );


  updateMoodUI();


  /*
    記錄 best answer
  */
  if (answer.isBest) {

    if (
      String(
        question.type
      ).toLowerCase() ===
      "product"
    ) {

      state.productBest++;

    }


    if (
      String(
        question.type
      ).toLowerCase() ===
      "service"
    ) {

      state.serviceBest++;

    }

  }


  /*
    保存答案紀錄
  */
  state.answers.push({

    questionId:
      question.id,

    type:
      question.type,

    selectedOption:
      String.fromCharCode(
        65 + answerIndex
      ),

    selectedText:
      answer.text,

    score:
      Number(
        answer.score || 0
      ),

    isBest:
      Boolean(
        answer.isBest
      ),

    reaction:
      answer.reaction || "",

    moodBefore:
      moodBefore,

    moodAfter:
      state.mood

  });


  /*
    判斷 Mood ↑ ↓ —
  */
  let moodMessage =
    "Customer Mood —";


  if (
    Number(answer.score) > 0
  ) {

    moodMessage =
      "Customer Mood ↑";

  }


  if (
    Number(answer.score) < 0
  ) {

    moodMessage =
      "Customer Mood ↓";

  }


  /*
    POPUP 內容
    Reaction 來自 Google Sheet
  */
  $("feedbackMoodTitle")
    .textContent =
      moodMessage;


  $("feedbackReaction")
    .textContent =
      answer.reaction || "";


  /*
    Popup 客人圖片
    會跟答完之後嘅 mood
  */
  $("feedbackMoodImage").src =
    customerImage(
      state.mood
    );


  /*
    彈出 popup
  */
  $("feedbackModal")
    .classList
    .remove("hidden");


  $("feedbackModal")
    .setAttribute(
      "aria-hidden",
      "false"
    );

}


/* =================================================
   RESULT CALCULATION
================================================= */

function calculateResult() {

  const speedBonus =
    state.elapsedSeconds <=
    SETTINGS.fullSpeedBonusSeconds

      ? SETTINGS
          .fullSpeedBonusPoints

      : 0;


  const finalMood =
    normalizeMood(
      state.mood +
      speedBonus
    );


  return {

    finalMood,

    speedBonus,

    qualified:
      finalMood === 100

  };

}


/* =================================================
   FINISH GAME
================================================= */

async function finishGame() {

  stopTimer();


  const result =
    calculateResult();


  $("finalMood").textContent =
    `${result.finalMood}%`;


  $("completionTime").textContent =
    formatTime(
      state.elapsedSeconds
    );


  $("speedBonus").textContent =
    `+${result.speedBonus}`;


  $("productScore").textContent =
    `${state.productBest} / 7`;


  $("serviceScore").textContent =
    `${state.serviceBest} / 3`;


  $("resultFace").src =
    customerImage(
      result.finalMood
    );


  $("resultCustomer").src =
    customerImage(
      result.finalMood
    );


  /*
    RESULT COPY
  */

  if (
    result.finalMood === 100
  ) {

    $("resultTitle").textContent =
      "客戶非常滿意！";


    $("resultMessage").textContent =
      "你為顧客提供了專業又貼心嘅服務。";


    $("rewardBox").innerHTML =
      '<span class="trophy">🏆</span><div><strong>Happy Customer Award</strong><small>恭喜你！已符合獎賞資格 🎉</small></div>';


  } else if (
    result.finalMood >= 80
  ) {

    $("resultTitle").textContent =
      "客戶很滿意！";


    $("resultMessage").textContent =
      "你今次整體表現良好，成功為顧客提供正面嘅服務體驗。";


    $("rewardBox").innerHTML =
      '<span class="trophy">⭐</span><div><strong>Good Customer Experience</strong><small>你已展現良好產品知識及服務技巧。</small></div>';


  } else if (
    result.finalMood >= 60
  ) {

    $("resultTitle").textContent =
      "客戶滿意";


    $("resultMessage").textContent =
      "你已處理顧客基本需要，部分回應仍有改善空間。";


    $("rewardBox").innerHTML =
      '<span class="trophy">💡</span><div><strong>Customer Experience Review</strong><small>可重溫相關產品知識及服務技巧。</small></div>';


  } else {

    $("resultTitle").textContent =
      "客戶有點失望";


    $("resultMessage").textContent =
      "今次顧客體驗未如理想，部分回應仍有改善空間。";


    $("rewardBox").innerHTML =
      '<span class="trophy">📘</span><div><strong>Learning Opportunity</strong><small>可重溫相關產品知識及服務技巧，掌握更合適的處理方式。</small></div>';

  }


  forceViewportTop();


  showScreen(
    "result"
  );


  await submitResult(
    result
  );

}


/* =================================================
   SUBMIT RESULT
================================================= */

async function submitResult(
  result
) {

  $("submitStatus").textContent =
    "正在儲存成績…";


  const payload = {

    action:
      "submitResult",

    staffId:
      state.staffId,

    finalMood:
      result.finalMood,

    productScore:
      state.productBest,

    serviceScore:
      state.serviceBest,

    completionSeconds:
      state.elapsedSeconds,

    completionTime:
      formatTime(
        state.elapsedSeconds
      ),

    speedBonus:
      result.speedBonus,

    qualified:
      result.qualified
        ? "Yes"
        : "No",

    answers:
      state.answers

  };


  try {

    const response =
      await fetch(
        GAS_WEB_APP_URL,
        {

          method:
            "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body:
            JSON.stringify(
              payload
            )

        }
      );


    const data =
      await response.json();


    if (!data.ok) {

      throw new Error(
        data.message ||
        "Save failed"
      );

    }


    $("submitStatus").textContent =
      "成績已儲存 ✓";


  } catch (error) {

    console.error(
      error
    );


    $("submitStatus").textContent =
      "成績未能儲存，請通知活動負責人。";

  }

}


/* =================================================
   ESCAPE HTML
================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =================================================
   LANDING → RULES
================================================= */

$("goRulesBtn")
  .addEventListener(
    "click",
    async () => {

      const valid =
        await validateStaffId();


      if (!valid) {
        return;
      }


      /*
        1. 收 keyboard
      */
      $("staffId").blur();


      /*
        2. 等 viewport 回復
      */
      await waitForKeyboardClose();


      /*
        3. 固定高度
      */
      setAppHeight();


      /*
        4. 回最頂
      */
      forceViewportTop();


      /*
        5. 去 Rules
      */
      showScreen(
        "rules"
      );

    }
  );


/* =================================================
   BACK BUTTON
================================================= */

$("backBtn")
  .addEventListener(
    "click",
    () => {

      showScreen(
        "landing"
      );

    }
  );


/* =================================================
   START GAME
================================================= */

$("startBtn")
  .addEventListener(
    "click",
    async () => {

      forceViewportTop();


      showScreen(
        "loading"
      );


      try {

        await fetchQuestions();


        resetGameState();


        forceViewportTop();


        showScreen(
          "game"
        );


        renderQuestion();


        startTimer();


      } catch (error) {

        console.error(
          error
        );


        forceViewportTop();


        showScreen(
          "rules"
        );


        alert(
          error.message
        );

      }

    }
  );


/* =================================================
   FEEDBACK POPUP → NEXT QUESTION
================================================= */

$("modalNextBtn")
  .addEventListener(
    "click",
    () => {

      /*
        先收 popup
      */
      $("feedbackModal")
        .classList
        .add("hidden");


      $("feedbackModal")
        .setAttribute(
          "aria-hidden",
          "true"
        );


      /*
        下一題
      */
      if (
        state.currentIndex <
        SETTINGS.totalQuestions - 1
      ) {

        state.currentIndex++;


        renderQuestion();


      } else {

        /*
          最後一題
        */
        finishGame();

      }

    }
  );


/* =================================================
   RETURN HOME
================================================= */

$("restartBtn")
  .addEventListener(
    "click",
    () => {

      resetGameState();


      $("staffId").value =
        "";


      showScreen(
        "landing"
      );

    }
  );


/* =================================================
   INITIAL SCREEN
================================================= */

showScreen(
  "landing"
);
