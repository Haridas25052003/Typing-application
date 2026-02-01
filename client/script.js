let originalText = "";
let timeLeft = 60;
let timerStarted = false;
let timerInterval = null;

let finalCorrect = 0;
let finalWrong = 0;
let submitted = false;

/* ==============================
   FETCH TEXT FROM BACKEND
================================ */
fetch("http://localhost:8090/text")
  .then(res => res.text())
  .then(text => {
    originalText = text;
    renderText("");
  });

/* ==============================
   START TIMER
================================ */
function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").innerText = timeLeft;

    if (timeLeft === 0) {
      submitTest(); // auto-submit on timeout
    }
  }, 1000);
}

/* ==============================
   RENDER TEXT + COMPARE LOGIC
================================ */
function renderText(typedText) {
  const textBox = document.getElementById("text-box");
  textBox.innerHTML = "";

  let correct = 0;
  let wrong = 0;

  for (let i = 0; i < originalText.length; i++) {
    const span = document.createElement("span");

    if (typedText[i] == null) {
      span.textContent = originalText[i];
    } else if (typedText[i] === originalText[i]) {
      span.textContent = originalText[i];
      span.className = "correct";
      correct++;
    } else {
      span.textContent = originalText[i];
      span.className = "wrong";
      wrong++;
    }

    textBox.appendChild(span);
  }

  finalCorrect = correct;
  finalWrong = wrong;

  document.getElementById("result").innerText =
    `Correct: ${correct} | Wrong: ${wrong}`;
}

/* ==============================
   LISTEN TO USER TYPING
================================ */
document.getElementById("typing-area")
  .addEventListener("input", function () {

    if (!timerStarted) {
      timerStarted = true;
      startTimer();
    }

    renderText(this.value);
  });

/* ==============================
   SUBMIT BUTTON HANDLER
================================ */
document.getElementById("submit-btn")
  .addEventListener("click", submitTest);

/* ==============================
   FINAL RESULT + BACKEND POST
================================ */
function submitTest() {
  if (submitted) return; // prevent double submit
  submitted = true;

  clearInterval(timerInterval);
  document.getElementById("typing-area").disabled = true;

  const totalTyped = finalCorrect + finalWrong;
  const wpm = Math.round(finalCorrect / 5);
  const accuracy = totalTyped === 0
    ? 0
    : ((finalCorrect / totalTyped) * 100).toFixed(2);

  document.getElementById("final-result").innerText =
    `WPM: ${wpm} | Accuracy: ${accuracy}%`;

  sendResultToBackend(wpm, accuracy, finalWrong);
}

/* ==============================
   SEND DATA TO BACKEND
================================ */
function sendResultToBackend(wpm, accuracy, errors) {
  fetch("http://localhost:8090/result", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      wpm: wpm,
      accuracy: accuracy,
      errors: errors
    })
  })
    .then(res => res.text())
    .then(data => console.log("Backend response:", data))
    .catch(err => console.error("POST error:", err));
}
