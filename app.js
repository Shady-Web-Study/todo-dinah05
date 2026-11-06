/**
 * DAIN'S TO-DO
 * - Enter로 할 일을 추가하고, 완료 버튼으로 해낸 일 목록으로 이동합니다.
 * - todos 배열을 단일 데이터 원본으로 사용합니다.
 * - 데이터 변경 후 localStorage에 저장하고 render()로 화면을 갱신합니다.
 */

const STORAGE_KEY = "dains-todo-list";
const BRAND_COLORS = ["#2C6FFF", "#7B37FF", "#C800FF", "#9A3AB5", "#35DF79"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// DOM 참조
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const errorText = document.getElementById("todo-error");
const pendingList = document.getElementById("pending-list");
const doneList = document.getElementById("done-list");
const pendingCount = document.getElementById("pending-count");
const doneCount = document.getElementById("done-count");

// 상태
let todos = loadTodos();
let justAddedId = null; // 방금 추가한 항목 (등장 애니메이션용)
let justDoneId = null; // 방금 완료한 항목 (취소선 애니메이션용)
const busyIds = new Set(); // 애니메이션 중인 항목 (연속 클릭 방지)

// 저장소
function loadTodos() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!Array.isArray(saved)) return [];

    // 저장 데이터의 형태가 잘못된 항목은 제외합니다.
    return saved.filter((todo) =>
      todo &&
      typeof todo.id === "string" &&
      typeof todo.text === "string" &&
      typeof todo.done === "boolean"
    );
  } catch {
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // 저장할 수 없는 환경에서는 현재 페이지가 열려 있는 동안만 동작합니다.
  }
}

// 입력 검증과 오류 표시
function validateTodo(text) {
  if (!text) return "할 일을 입력해주세요.";

  const isDuplicate = todos.some((todo) => !todo.done && todo.text === text);
  if (isDuplicate) return "이미 해야 할 일에 있는 항목이에요.";

  return "";
}

function showError(message) {
  errorText.textContent = message;
  input.setAttribute("aria-invalid", String(Boolean(message)));

  // 클래스를 뺐다가 다시 넣어야 같은 오류가 연속으로 나도 흔들림 애니메이션이 다시 실행됩니다.
  input.classList.remove("is-invalid");
  if (message) {
    void input.offsetWidth;
    input.classList.add("is-invalid");
  }
}

// 애니메이션
function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, reduceMotion ? 0 : duration);
  });
}

/** 항목 높이를 0으로 접으며 사라지게 합니다. */
function collapse(item) {
  if (reduceMotion) return Promise.resolve();

  const height = item.offsetHeight;
  item.style.overflow = "hidden";

  return item.animate(
    [
      { height: `${height}px`, opacity: 1, transform: "scale(1)" },
      { height: "0px", opacity: 0, transform: "scale(0.96)", marginBottom: "-10px" },
    ],
    { duration: 280, easing: "ease-in", fill: "forwards" }
  ).finished.catch(() => {
    // 애니메이션이 취소되어도 데이터 처리는 계속할 수 있게 합니다.
  });
}

/** (x, y) 위치에서 브랜드 색 조각을 터뜨립니다. */
function burst(x, y) {
  if (reduceMotion) return;

  const shapes = ["is-dot", "is-ring", "is-bar"];

  for (let i = 0; i < 18; i += 1) {
    const piece = document.createElement("span");
    const color = BRAND_COLORS[i % BRAND_COLORS.length];
    const shape = shapes[i % shapes.length];

    piece.className = `confetti ${shape}`;
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;

    if (shape === "is-ring") {
      piece.style.borderColor = color;
    } else {
      piece.style.background = color;
    }

    document.body.append(piece);

    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const distance = 40 + Math.random() * 50;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 20;
    const spin = Math.random() * 360 - 180;

    piece.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.4)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin}deg) scale(1)`,
          opacity: 1,
          offset: 0.6,
        },
        {
          transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 40}px)) rotate(${spin * 1.5}deg) scale(0.8)`,
          opacity: 0,
        },
      ],
      { duration: 800 + Math.random() * 300, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }
    ).finished
      .catch(() => {})
      .finally(() => piece.remove()); // 끝나든 취소되든 조각은 지웁니다.
  }
}

// 핵심 동작
function addTodo(rawText) {
  const text = rawText.trim();
  const error = validateTodo(text);

  if (error) {
    showError(error);
    return false;
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  todos.push({ id, text, done: false });
  justAddedId = id;

  showError("");
  update();
  return true;
}

/** 축하 효과 → 카드 접기 → 해낸 일로 이동 */
async function completeTodo(id, item) {
  if (busyIds.has(id)) return;
  busyIds.add(id);

  try {
    item.classList.add("is-completing");

    const button = item.querySelector(".complete-btn").getBoundingClientRect();
    burst(button.left + button.width / 2, button.top + button.height / 2);

    await wait(450);
    await collapse(item);

    todos = todos.map((todo) => (todo.id === id ? { ...todo, done: true } : todo));
    justDoneId = id;
    update();
  } finally {
    busyIds.delete(id);
  }
}

async function deleteTodo(id, item) {
  if (busyIds.has(id)) return;
  busyIds.add(id);

  try {
    await collapse(item);
    todos = todos.filter((todo) => todo.id !== id);
    update();
  } finally {
    busyIds.delete(id);
  }
}

// 요소 생성
function createButton(label, action, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createTodoItem(todo) {
  const item = document.createElement("li");
  item.className = "todo-item";
  item.classList.toggle("is-new", todo.id === justAddedId);
  item.classList.toggle("is-just-done", todo.id === justDoneId);
  item.dataset.id = todo.id;

  const text = document.createElement("span");
  text.className = "todo-text";

  if (todo.done) {
    const strike = document.createElement("span");
    strike.className = "strike";
    strike.textContent = todo.text; // innerHTML 대신 textContent → 스크립트 삽입 방지
    text.append(strike);

    item.append(text, createButton("삭제", "delete", "del-btn"));
  } else {
    const completeButton = createButton("완료", "complete", "complete-btn");
    text.textContent = todo.text;
    item.append(text, completeButton, createButton("삭제", "delete", "del-btn"));
  }

  return item;
}

// 렌더링
function render() {
  pendingList.replaceChildren();
  doneList.replaceChildren();

  todos.forEach((todo) => {
    const targetList = todo.done ? doneList : pendingList;
    targetList.append(createTodoItem(todo));
  });

  const pending = todos.filter((todo) => !todo.done).length;
  const done = todos.length - pending;

  pendingCount.textContent = pending;
  doneCount.textContent = done;

  // 애니메이션 상태는 이번 렌더링에서만 사용합니다.
  justAddedId = null;
  justDoneId = null;
}

function update() {
  saveTodos();
  render();
}

// 이벤트 처리
// 입력창에서 Enter를 누르면 form이 제출됩니다.
form.addEventListener("submit", (event) => {
  event.preventDefault(); // 페이지 새로고침 방지

  if (addTodo(input.value)) {
    input.value = "";
  }
});

input.addEventListener("input", () => {
  if (errorText.textContent) showError("");
});

// 이벤트 위임: 목록마다 리스너 하나로 모든 버튼을 처리합니다.
function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = button.closest(".todo-item");
  const { id } = item.dataset;

  if (button.dataset.action === "complete") {
    completeTodo(id, item);
  } else if (button.dataset.action === "delete") {
    deleteTodo(id, item);
  }
}

pendingList.addEventListener("click", handleListClick);
doneList.addEventListener("click", handleListClick);

// 첫 화면 그리기
render();