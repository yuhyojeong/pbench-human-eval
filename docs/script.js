const QUERY_TYPES = ["type1", "type2", "type3", "type4"];

let data = null;
let currentUser = null;
let currentType = "type1";
let annotations = JSON.parse(localStorage.getItem("annotations") || "[]");

let userSelect;
let prevUserBtn, nextUserBtn;
let prevQueryBtn, nextQueryBtn, queryTypeLabel;
let saveStatus;
let queryBox, eventBox, trajBox, sessionBox;
let saveBtn, submitBtn;
let expandedFillers = new Set();
let selectedSessionIndex = null;

async function init() {
  userSelect = document.getElementById("userSelect");
  prevUserBtn = document.getElementById("prevUserBtn");
  nextUserBtn = document.getElementById("nextUserBtn");
  prevQueryBtn = document.getElementById("prevQueryBtn");
  nextQueryBtn = document.getElementById("nextQueryBtn");
  queryTypeLabel = document.getElementById("queryTypeLabel");
  saveStatus = document.getElementById("saveStatus");
  queryBox = document.getElementById("queryPanel");
  eventBox = document.getElementById("eventsList");
  trajBox = document.getElementById("trajectoryList");
  sessionBox = document.getElementById("sessionsList");
  saveBtn = document.getElementById("saveBtn");
  submitBtn = document.getElementById("submitBtn");

  const scrollBtn = document.getElementById("scrollTopBtn");
  window.addEventListener("scroll", () => {
    scrollBtn.classList.toggle("show", window.scrollY > 200);
  });
  scrollBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  document.getElementById("toggleFiller")?.addEventListener("change", renderSessions);

  userSelect?.addEventListener("change", () => {
    selectUser(Number(userSelect.value), { autosave: true });
  });
  prevUserBtn?.addEventListener("click", () => shiftUser(-1));
  nextUserBtn?.addEventListener("click", () => shiftUser(1));
  prevQueryBtn?.addEventListener("click", () => shiftQuery(-1));
  nextQueryBtn?.addEventListener("click", () => shiftQuery(1));

  saveBtn?.addEventListener("click", persistCurrentAnnotation);
  submitBtn?.addEventListener("click", submitAnnotations);

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
  renderQuery();
  renderEvents();
  renderTrajectory();
  renderSessions();
  renderTypeSpecific();
  loadAnnotation();
  syncQueryNav();
}

// ── Query panel ────────────────────────────────────────────────────────────

function renderQuery() {
  const qObj = getQuery(currentType);
  if (!qObj) {
    queryBox.innerHTML = "";
    return;
  }

  if (queryTypeLabel) {
    queryTypeLabel.textContent = currentType;
  }

  queryBox.innerHTML = `
    <div class="query-text">${esc(qObj.text ?? "")}</div>
    ${buildQueryMeta(currentType, qObj)}`;
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
  if (selectedSessionIndex !== null) {
    const session = sessions[selectedSessionIndex];
    if (session) renderOneSession(session, selectedSessionIndex);
    return;
  }

  if (showFiller) {
    sessions.forEach((session, idx) => {
      if (session.type === "filler") renderOneSession(session, idx);
    });
  }
}

function renderOneSession(session, idx) {
  const isFiller = session.type === "filler";
  const sessionId = `session-${idx}`;
  const isExpanded = expandedFillers.has(sessionId);
  const turns = session.turns ?? [];

  const isCollapsedFiller = isFiller && !isExpanded;
  const topicLine = isFiller && session.topic
    ? `<div class="session-topic">${esc(session.topic)}</div>`
    : "";

  const body = isCollapsedFiller ? "" : `
    <div class="session-body">
      <div class="turns">
        ${turns.map(t => `
          <div class="turn">
            <div class="turn-role">${esc(t.role)}</div>
            <div class="turn-content">${esc(t.content)}</div>
          </div>`).join("")}
        ${isFiller ? `<button class="collapse-btn" data-id="${sessionId}">Collapse</button>` : ""}
      </div>
    </div>`;

  sessionBox.innerHTML += `
    <div id="${sessionId}" class="session-card${isCollapsedFiller ? " collapsed-filler" : ""}" data-kind="${session.type}">
      <div class="session-meta">
        <div>
          <span class="session-title">Session ${idx}</span>
          <div class="session-subtitle">${session.timestamp ?? ""} · ${session.type}</div>
          ${topicLine}
        </div>
        ${isCollapsedFiller ? `<button class="expand-btn" data-id="${sessionId}" type="button">Open</button>` : ""}
      </div>
      ${body}
    </div>`;

  setTimeout(() => {
    document.querySelectorAll(".collapsed-filler").forEach(card => {
      card.onclick = () => {
        expandedFillers.add(card.id);
        renderSessions();
      };
    });
    document.querySelectorAll(".expand-btn").forEach(btn => {
      btn.onclick = event => {
        event.stopPropagation();
        expandedFillers.add(btn.dataset.id);
        renderSessions();
      };
    });
    document.querySelectorAll(".collapse-btn").forEach(btn => {
      btn.onclick = event => {
        event.stopPropagation();
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
  box.innerHTML = buildTypeSpecificFields(currentType);
  bindAnnotationInputs();
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

function persistCurrentAnnotation() {
  const record = {
    user_index: Number(userSelect.value),
    user_id: currentUser.user_id,
    query_type: currentType,
    query: getQuery(currentType)?.text,
    persona: currentUser.persona,
    topic: currentUser.topic,
    axes: currentUser.axes,
    type_specific: getTypeSpecificValues(currentType),
    timestamp: new Date().toISOString(),
  };

  annotations = annotations.filter(
    a => !(a.user_index === record.user_index && a.query_type === record.query_type)
  );
  annotations.push(record);
  localStorage.setItem("annotations", JSON.stringify(annotations));
  setSaveStatus("Saved!", "saved");
}

function loadAnnotation() {
  const ann = annotations.find(
    a => a.user_index === Number(userSelect.value) && a.query_type === currentType
  );
  if (!ann) {
    setSaveStatus("Not saved yet.", "");
    return;
  }

  const ts = ann.type_specific || {};
  Object.keys(ts).forEach(key => {
    const el = document.getElementById(key);
    if (el) el.value = ts[key];
  });
  setSaveStatus("Saved!", "saved");
}

function submitAnnotations() {
  persistCurrentAnnotation();
  const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "annotations.json";
  a.click();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getQuery(type) {
  return currentUser.queries?.find(q => q.type === type);
}

function selectUser(index, options = {}) {
  if (options.autosave) {
    persistCurrentAnnotation();
  }
  const nextIndex = Math.max(0, Math.min(index, data.length - 1));
  userSelect.value = String(nextIndex);
  currentUser = data[nextIndex];
  currentType = "type1";
  selectedSessionIndex = null;
  syncUserNav();
  render();
}

function shiftUser(delta) {
  selectUser(Number(userSelect.value) + delta, { autosave: true });
}

function syncUserNav() {
  const index = Number(userSelect.value || 0);
  if (prevUserBtn) prevUserBtn.disabled = index <= 0;
  if (nextUserBtn) nextUserBtn.disabled = index >= data.length - 1;
}

function shiftQuery(delta) {
  persistCurrentAnnotation();
  const currentIndex = QUERY_TYPES.indexOf(currentType);
  const nextIndex = Math.max(0, Math.min(currentIndex + delta, QUERY_TYPES.length - 1));
  currentType = QUERY_TYPES[nextIndex];
  selectedSessionIndex = null;
  render();
}

function syncQueryNav() {
  const index = QUERY_TYPES.indexOf(currentType);
  if (prevQueryBtn) prevQueryBtn.disabled = index <= 0;
  if (nextQueryBtn) nextQueryBtn.disabled = index >= QUERY_TYPES.length - 1;
}

function bindAnnotationInputs() {
  document.querySelectorAll("#typeSpecific select").forEach(el => {
    el.addEventListener("change", () => {
      setSaveStatus("Unsaved changes.", "unsaved");
    });
  });
}

function setSaveStatus(message, state) {
  if (!saveStatus) return;
  saveStatus.textContent = message;
  saveStatus.classList.remove("saved", "unsaved");
  if (state) {
    saveStatus.classList.add(state);
  }
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

init();
