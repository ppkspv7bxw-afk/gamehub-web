const PRIMARY_SERVER_URL = "https://api.gamehub4u.com";
const BACKUP_SERVER_URL = "https://gamehub-server-okv5.onrender.com"; // احتياطي صامت

let SERVER_URL = PRIMARY_SERVER_URL;

const WEB_ORIGIN = location.origin;

function getParam(key) {
  return new URL(location.href).searchParams.get(key);
}

function setStatus(text, cls) {
  const label = document.getElementById("statusText");
  const light = document.getElementById("light");
  if (label) label.textContent = text;

  if (light) {
    light.classList.remove("ok", "warn", "bad");
    light.classList.add(cls);
  }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = String(msg || "OK");
  t.classList.add("show");
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove("show"), 1600);
}

function normalizeRoom(s) {
  return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
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
    id = crypto.randomUUID ? crypto.randomUUID() : "cid_" + Math.random().toString(16).slice(2);
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

function loadScriptWithTimeout(src, ms = 6000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const timer = setTimeout(() => {
      s.remove();
      reject(new Error("timeout"));
    }, ms);

    s.src = src;
    s.async = true;
    s.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load_error"));
    };

    document.head.appendChild(s);
  });
}

async function ensureSocketIoLoaded() {
  if (window.io) return true;

  // جرّب الأساسي
  setStatus("Connecting...", "warn");
  try {
    SERVER_URL = PRIMARY_SERVER_URL;
    await loadScriptWithTimeout(`${SERVER_URL}/socket.io/socket.io.js`, 6000);
    return true;
  } catch (_) {
    // جرّب الاحتياطي (صامت)
    try {
      SERVER_URL = BACKUP_SERVER_URL;
      await loadScriptWithTimeout(`${SERVER_URL}/socket.io/socket.io.js`, 6000);
      return true;
    } catch (_) {
      setStatus("Offline", "bad");
      throw new Error("socketio_failed");
    }
  }
}

function connectSocketWithTimeout(ms = 6000) {
  return new Promise((resolve, reject) => {
    let done = false;

    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      auth: { clientId },
    });

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { socket.close(); } catch {}
      reject(new Error("connect_timeout"));
    }, ms);

    socket.once("connect", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once("connect_error", () => {
      // نخلي التايمر يتصرف (عشان ما يعلق)
    });
  });
}

async function createSocket() {
  await ensureSocketIoLoaded();
  return await connectSocketWithTimeout(6000);
}

function bindStatusLight(socket) {
  setStatus("Disconnected", "bad");

  socket.on("connect", () => setStatus("Connected", "ok"));
  socket.on("disconnect", () => setStatus("Disconnected", "bad"));
  socket.on("connect_error", () => setStatus("Connecting...", "warn"));
}

function setupReconnectOverlay(socket) {
  const ov = document.getElementById("overlay");
  if (!ov) return;
  const show = () => ov.classList.add("show");
  const hide = () => ov.classList.remove("show");
  socket.on("disconnect", show);
  socket.on("connect", hide);
}
