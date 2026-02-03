// ====== CONFIG ======
// غيّر هذا السطر فقط إذا تغيّر رابط السيرفر:
const SERVER_URL = "https://gamehub-server-okv5.onrender.com";

// ====== Helpers ======
const WEB_ORIGIN = location.origin;

function getParam(key) {
  const url = new URL(location.href);
  return url.searchParams.get(key);
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return alert(msg);
  t.textContent = String(msg || "OK");
  t.classList.add("show");
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove("show"), 1600);
}

function normalizeRoom(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function validateRoomCode(s) {
  const v = normalizeRoom(s);
  if (v.length < 3) return { ok: false, msg: "اكتب Room Code صحيح" };
  return { ok: true, value: v };
}

function validateName(s) {
  const v = String(s || "").trim().replace(/\s+/g, " ").slice(0, 20);
  if (v.length < 2) return { ok: false, msg: "اكتب اسم (حرفين على الأقل)" };
  return { ok: true, value: v };
}

function getOrCreateClientId() {
  let id = localStorage.getItem("gh_clientId");
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : "cid_" + Math.random().toString(16).slice(2);
    localStorage.setItem("gh_clientId", id);
  }
  return id;
}

const clientId = getOrCreateClientId();

function saveProfile(name) {
  localStorage.setItem("gh_name", String(name || ""));
}
function loadProfile() {
  return { name: localStorage.getItem("gh_name") || "" };
}

// ====== Socket.io Loader (بدون وسم script ثابت) ======
function ensureSocketIoLoaded() {
  if (window.io) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${SERVER_URL}/socket.io/socket.io.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("socket.io script failed to load: " + s.src));
    document.head.appendChild(s);
  });
}

async function createSocket() {
  await ensureSocketIoLoaded();
  return io(SERVER_URL, {
    transports: ["websocket", "polling"],
    auth: { clientId },
  });
}

function bindStatusLight(socket, el) {
  if (!el) return;

  const set = (cls, text) => {
    el.classList.remove("ok", "warn", "bad");
    el.classList.add(cls);
    const label = document.getElementById("statusText");
    if (label) label.textContent = text;
  };

  set("bad", "Disconnected");

  socket.on("connect", () => set("ok", "Connected"));
  socket.on("disconnect", () => set("bad", "Disconnected"));
  socket.on("connect_error", () => set("warn", "Connecting..."));
}

function setupReconnectOverlay(socket) {
  const ov = document.getElementById("overlay");
  if (!ov) return;

  const show = () => ov.classList.add("show");
  const hide = () => ov.classList.remove("show");

  socket.on("disconnect", show);
  socket.on("connect", hide);
}
