const QUERY_TYPES = ["type1", "type2", "type3", "type4"];

let data = null;
let currentUser = null;
let currentType = "type1";
let annotations = JSON.parse(localStorage.getItem("annotations") || "[]");

let userSelect;
let prevUserBtn, nextUserBtn;
let queryBox, eventBox, trajBox, sessionBox;
let saveBtn, downloadBtn;
let expandedFillers = new Set();
let selectedSessionIndex = null;

async function init() {
  userSelect = document.getElementById("userSelect");
  prevUserBtn = document.getElementById("prevUserBtn");
  nextUserBtn = document.getElementById("nextUserBtn");
  queryBox = document.getElementById("queryPanel");
  eventBox = document.getElementById("eventsList");
  trajBox = document.getElementById("trajectoryList");
  sessionBox = document.getElementById("sessionsList");
  saveBtn = document.getElementById("saveBtn");
  downloadBtn = document.getElementById("downloadBtn");

  const scrollBtn = document.getElementById("scrollTopBtn");
  window.addEventListener("scroll", () => {
    scrollBtn.classList.toggle("show", window.scrollY > 200);
  });
  scrollBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  document.getElementById("sessionSearch")?.addEventListener("input", renderSessions);
  document.getElementById("toggleFiller")?.addEventListener("change", renderSessions);

  userSelect?.addEventListener("change", () => {
    selectUser(Number(userSelect.value));
  });
  prevUserBtn?.addEventListener("click", () => shiftUser(-1));
  nextUserBtn?.addEventListener("click", () => shiftUser(1));

  saveBtn?.addEventListener("click", saveAnnotation);
  downloadBtn?.addEventListener("click", downloadAnnotations);

  try {
    const res = await fetch("./data.json");
    const raw = await res.json();
    data = raw.records ?? raw;

    userSelect.innerHTML = "";
    data.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i} — ${d.persona}`;
      userSelect.appendChild(opt);
    });

    currentUser = data[0];
    syncUserNav();
    render();
  } catch (e) {
    console.error("INIT ERROR:", e);
  }
}

function render() {
  if (!currentUser) return;
  renderQueries();
  renderEvents();
  renderTrajectory();
  renderSessions();
  renderTypeSpecific();
  loadAnnotation();
}

// ── Query panel ────────────────────────────────────────────────────────────

function renderQueries() {
  queryBox.innerHTML = QUERY_TYPES.map(type => {
    const qObj = getQuery(type);
    if (!qObj) return "";

    return `
      <div class="query-card${type === currentType ? " active" : ""}" data-query-type="${type}">
        <div class="query-card-header">
          <div class="query-card-title">${type}</div>
          <button class="query-card-button" data-query-type="${type}">Show evidence</button>
        </div>
        <div class="query-text">${esc(qObj.text ?? "")}</div>
        ${buildQueryMeta(type, qObj)}
      </div>`;
  }).join("");

  bindTypeSwitchers();
}

function buildQueryMeta(type, qObj) {
  let meta = "";

  if (type === "type1") {
    meta += `
      <div class="query-meta">
        <div><b>Topic:</b> ${esc(currentUser.topic ?? "—")}</div>
      </div>
      <div class="query-meta">
        <div><b>Events</b></div>
        <ol class="meta-list">
          ${(currentUser.events ?? []).map(e => `<li>${esc(e.text)}</li>`).join("")}
        </ol>
      </div>`;
  }

  if (type === "type2") {
    const indices = qObj.evidenceEventIndices ?? [];
    const events = qObj.evidenceEvents ?? [];
    meta += `
      <div class="query-meta">
        <div><b>Evidence events</b></div>
        <ol class="meta-list">
          ${events.map((e, i) => `<li><span class="item-index">#${indices[i]}</span> ${esc(e)}</li>`).join("")}
        </ol>
      </div>`;
  }

  if (type === "type3") {
    meta += `
      <div class="query-meta">
        <div><b>Axes</b></div>
        <ul class="meta-list">
          ${(currentUser.axes ?? []).map(a => `<li>${esc(a)}</li>`).join("")}
        </ul>
      </div>
      <div class="query-meta">
        <div><b>Trajectory</b></div>
        <ol class="meta-list">
          ${(currentUser.trajectory ?? []).map(t => `<li>${esc(t.text)}</li>`).join("")}
        </ol>
      </div>`;
  }

  if (type === "type4") {
    const indices = qObj.evidenceTrajectoryIndices ?? [];
    const trajectory = qObj.evidenceTrajectory ?? [];
    meta += `
      <div class="query-meta">
        <div><b>Evidence trajectory</b></div>
        <ol class="meta-list">
          ${trajectory.map((t, i) => `<li><span class="item-index">#${indices[i]}</span> ${esc(t)}</li>`).join("")}
        </ol>
      </div>`;
  }

  const responses = qObj.responses ?? {};
  meta += `
    <div class="query-meta response-section">
      <div class="response-label">Personalized response</div>
      <div class="response-block">${esc(responses.personalized ?? "—")}</div>
      <div class="response-label" style="margin-top:8px;">General response</div>
      <div class="response-block">${esc(responses.general ?? "—")}</div>
    </div>`;

  return meta;
}

function bindTypeSwitchers() {
  document.querySelectorAll("[data-query-type]").forEach(el => {
    el.addEventListener("click", () => {
      const nextType = el.dataset.queryType;
      if (!nextType || nextType === currentType) return;
      currentType = nextType;
      selectedSessionIndex = null;
      render();
    });
  });
}

// ── Evidence side panel ────────────────────────────────────────────────────

function renderEvents() {
  eventBox.innerHTML = "";
  if (!["type1", "type2"].includes(currentType)) return;

  const qObj = getQuery(currentType);
  const evidenceSet = new Set(qObj?.evidenceEventIndices ?? []);

  (currentUser.events ?? []).forEach((e, i) => {
    const isEvid = evidenceSet.has(i);
    const div = document.createElement("div");
    div.className = `list-item clickable${isEvid ? " evidence-highlight" : ""}`;
    div.dataset.sessionIndex = e.sessionIndex;
    div.innerHTML = `<span class="item-index">#${i}</span> ${esc(e.text)}`;
    div.addEventListener("click", () => {
      const idx = Number(div.dataset.sessionIndex);
      selectedSessionIndex = selectedSessionIndex === idx ? null : idx;
      renderSessions();
    });
    eventBox.appendChild(div);
  });
}

function renderTrajectory() {
  trajBox.innerHTML = "";
  if (!["type3", "type4"].includes(currentType)) return;

  const qObj = getQuery(currentType);
  const evidenceSet = new Set(qObj?.evidenceTrajectoryIndices ?? []);

  (currentUser.trajectory ?? []).forEach((t, i) => {
    const isEvid = evidenceSet.has(i);
    const div = document.createElement("div");
    div.className = `list-item clickable${isEvid ? " evidence-highlight" : ""}`;
    div.dataset.sessionIndex = t.sessionIndex;
    div.innerHTML = `<span class="item-index">#${i}</span> ${esc(t.text)}`;
    div.addEventListener("click", () => {
      const idx = Number(div.dataset.sessionIndex);
      selectedSessionIndex = selectedSessionIndex === idx ? null : idx;
      renderSessions();
    });
    trajBox.appendChild(div);
  });
}

// ── Sessions panel ─────────────────────────────────────────────────────────

function renderSessions() {
  sessionBox.innerHTML = "";
  const sessions = currentUser.sessions ?? [];
  const showFiller = document.getElementById("toggleFiller")?.checked;
  const query = document.getElementById("sessionSearch")?.value?.toLowerCase() || "";

  if (selectedSessionIndex !== null) {
    const session = sessions[selectedSessionIndex];
    if (session) renderOneSession(session, selectedSessionIndex, query);
    return;
  }

  if (showFiller) {
    sessions.forEach((session, idx) => {
      if (session.type === "filler") renderOneSession(session, idx, query);
    });
  }
}

function renderOneSession(session, idx, query = "") {
  const isFiller = session.type === "filler";
  const sessionId = `session-${idx}`;
  const isExpanded = expandedFillers.has(sessionId);
  const turns = session.turns ?? [];

  let content = "";

  if (isFiller && !isExpanded) {
    content = `
      <div class="filler-summary">
        <div class="summary-only">${highlight(session.timestamp ?? "filler session", query)}${session.topic ? ` · ${highlight(session.topic, query)}` : ""}</div>
        <button class="expand-btn" data-id="${sessionId}">Expand</button>
      </div>`;
  } else {
    content = `
      <div class="turns">
        ${turns.map(t => `
          <div class="turn">
            <div class="turn-role">${esc(t.role)}</div>
            <div class="turn-content">${highlight(esc(t.content), query)}</div>
          </div>`).join("")}
        ${isFiller ? `<button class="collapse-btn" data-id="${sessionId}">Collapse</button>` : ""}
      </div>`;
  }

  sessionBox.innerHTML += `
    <div id="${sessionId}" class="session-card" data-kind="${session.type}">
      <div class="session-meta">
        <div>
          <span class="session-title">Session ${idx}</span>
          <div class="session-subtitle">${session.type} · ${session.timestamp ?? ""}</div>
        </div>
      </div>
      <div class="session-body">${content}</div>
    </div>`;

  setTimeout(() => {
    document.querySelectorAll(".expand-btn").forEach(btn => {
      btn.onclick = () => {
        expandedFillers.add(btn.dataset.id);
        renderSessions();
      };
    });
    document.querySelectorAll(".collapse-btn").forEach(btn => {
      btn.onclick = () => {
        expandedFillers.delete(btn.dataset.id);
        renderSessions();
      };
    });
  }, 0);
}

// ── Annotation panel ───────────────────────────────────────────────────────

function renderTypeSpecific() {
  const box = document.getElementById("typeSpecific");
  if (!box) return;

  box.innerHTML = QUERY_TYPES.map(type => {
    const qObj = getQuery(type);
    if (!qObj) return "";

    return `
      <div class="annot-card${type === currentType ? " active" : ""}" data-query-type="${type}">
        <div class="annot-card-header">
          <div class="annot-card-title">${type}</div>
          <button class="query-card-button" data-query-type="${type}">Show evidence</button>
        </div>
        ${buildTypeSpecificFields(type)}
      </div>`;
  }).join("");

  bindTypeSwitchers();
}

function buildTypeSpecificFields(type) {
  const yn = (id, label) => `
    <label class="annot-row">${label}
      <select id="${id}">
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>`;

  const fields = {
    type1: [
      yn("t1_topic", "Is the query grounded in the topic?"),
      yn("t1_newrec", "Does the query require recommending something new based on past events for a personalized response?"),
      yn("t1_natural", "Is the query natural and realistic?"),
      yn("t1_filler", "Are filler topics irrelevant to the event topic?"),
    ],
    type2: [
      yn("t2_mixed", "Is the evidence naturally and well mixed from multiple sessions?"),
      yn("t2_natural", "Is the query natural and realistic?"),
    ],
    type3: [
      yn("t3_progress", "Does the query require understanding the user's progression along the axes for a personalized response?"),
      yn("t3_natural", "Is the query natural and realistic?"),
      yn("t3_filler", "Are filler topics irrelevant to the trajectory axes?"),
    ],
    type4: [
      yn("t4_against", "Does the user's decision go against their established trajectory?"),
      yn("t4_natural", "Is the query natural and realistic?"),
      yn("t4_misalign", "Does the query misalign with the evidence?"),
    ],
  };

  return fields[type].join("<br>");
}

function getTypeSpecificValues(type) {
  const ids = {
    type1: ["t1_topic", "t1_newrec", "t1_natural", "t1_filler"],
    type2: ["t2_mixed", "t2_natural"],
    type3: ["t3_progress", "t3_natural", "t3_filler"],
    type4: ["t4_against", "t4_natural", "t4_misalign"],
  }[type] ?? [];

  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.value]));
}

// ── Save / load ────────────────────────────────────────────────────────────

function saveAnnotation() {
  const userIndex = Number(userSelect.value);
  const timestamp = new Date().toISOString();

  const records = QUERY_TYPES.map(type => {
    const qObj = getQuery(type);
    if (!qObj) return null;

    return {
      user_index: userIndex,
      user_id: currentUser.user_id,
      query_type: type,
      query: qObj.text,
      persona: currentUser.persona,
      topic: currentUser.topic,
      axes: currentUser.axes,
      type_specific: getTypeSpecificValues(type),
      timestamp,
    };
  }).filter(Boolean);

  annotations = annotations.filter(a => a.user_index !== userIndex);
  annotations.push(...records);
  localStorage.setItem("annotations", JSON.stringify(annotations));
  alert(`Saved ${records.length} annotations for user ${userIndex}.`);
}

function loadAnnotation() {
  QUERY_TYPES.forEach(type => {
    const ann = annotations.find(
      a => a.user_index === Number(userSelect.value) && a.query_type === type
    );
    if (!ann) return;

    const ts = ann.type_specific || {};
    Object.keys(ts).forEach(key => {
      const el = document.getElementById(key);
      if (el) el.value = ts[key];
    });
  });
}

function downloadAnnotations() {
  const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "annotations.json";
  a.click();
  annotations = [];
  localStorage.removeItem("annotations");
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getQuery(type) {
  return currentUser.queries?.find(q => q.type === type);
}

function selectUser(index) {
  const nextIndex = Math.max(0, Math.min(index, data.length - 1));
  userSelect.value = String(nextIndex);
  currentUser = data[nextIndex];
  currentType = "type1";
  selectedSessionIndex = null;
  syncUserNav();
  render();
}

function shiftUser(delta) {
  selectUser(Number(userSelect.value) + delta);
}

function syncUserNav() {
  const index = Number(userSelect.value || 0);
  if (prevUserBtn) prevUserBtn.disabled = index <= 0;
  if (nextUserBtn) nextUserBtn.disabled = index >= data.length - 1;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlight(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

init();
