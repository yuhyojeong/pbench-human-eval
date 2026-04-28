let data = null;
let currentUser = null;
let currentType = "type1";
let annotations = JSON.parse(localStorage.getItem("annotations") || "[]");

let userSelect, typeSelect;
let queryBox, eventBox, trajBox, sessionBox;
let saveBtn, downloadBtn;
let expandedFillers = new Set();
let selectedSessionIndex = null;

async function init() {
  userSelect  = document.getElementById("userSelect");
  typeSelect  = document.getElementById("queryTypeSelect");
  queryBox    = document.getElementById("queryPanel");
  eventBox    = document.getElementById("eventsList");
  trajBox     = document.getElementById("trajectoryList");
  sessionBox  = document.getElementById("sessionsList");
  saveBtn     = document.getElementById("saveBtn");
  downloadBtn = document.getElementById("downloadBtn");

  const scrollBtn = document.getElementById("scrollTopBtn");
  window.addEventListener("scroll", () => {
    scrollBtn.classList.toggle("show", window.scrollY > 200);
  });
  scrollBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  document.getElementById("sessionSearch")?.addEventListener("input", renderSessions);
  document.getElementById("toggleFiller")?.addEventListener("change", renderSessions);

  userSelect?.addEventListener("change", () => {
    currentUser = data[userSelect.value];
    selectedSessionIndex = null;
    render();
  });

  typeSelect?.addEventListener("change", () => {
    currentType = typeSelect.value;
    selectedSessionIndex = null;
    render();
  });

  saveBtn?.addEventListener("click", saveAnnotation);
  downloadBtn?.addEventListener("click", downloadAnnotations);

  try {
    const res = await fetch("./data.json");
    const raw = await res.json();
    data = raw.records ?? raw;

    typeSelect.innerHTML = "";
    ["type1", "type2", "type3", "type4"].forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      typeSelect.appendChild(opt);
    });

    userSelect.innerHTML = "";
    data.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i} — ${d.persona}`;
      userSelect.appendChild(opt);
    });

    currentUser = data[0];
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
}

// ── Query panel ────────────────────────────────────────────────────────────

function renderQuery() {
  const qObj = currentUser.queries?.find(q => q.type === currentType);
  if (!qObj) { queryBox.innerHTML = ""; return; }

  let meta = "";

  if (currentType === "type1") {
    const events = currentUser.events ?? [];
    meta += `
      <div class="query-meta">
        <div><b>Topic:</b> ${esc(currentUser.topic ?? "—")}</div>
      </div>
      <div class="query-meta">
        <div><b>Events</b></div>
        <ol class="meta-list">
          ${events.map(e => `<li>${esc(e.text)}</li>`).join("")}
        </ol>
      </div>`;
  }

  if (currentType === "type2") {
    const indices = qObj.evidenceEventIndices ?? [];
    const evts    = qObj.evidenceEvents ?? [];
    meta += `
      <div class="query-meta">
        <div><b>Evidence events</b></div>
        <ol class="meta-list">
          ${evts.map((e, i) => `<li><span class="item-index">#${indices[i]}</span> ${esc(e)}</li>`).join("")}
        </ol>
      </div>`;
  }

  if (currentType === "type3") {
    const axes = currentUser.axes ?? [];
    const traj = currentUser.trajectory ?? [];
    meta += `
      <div class="query-meta">
        <div><b>Axes</b></div>
        <ul class="meta-list">
          ${axes.map(a => `<li>${esc(a)}</li>`).join("")}
        </ul>
      </div>
      <div class="query-meta">
        <div><b>Trajectory</b></div>
        <ol class="meta-list">
          ${traj.map(t => `<li>${esc(t.text)}</li>`).join("")}
        </ol>
      </div>`;
  }

  if (currentType === "type4") {
    const indices = qObj.evidenceTrajectoryIndices ?? [];
    const trjs    = qObj.evidenceTrajectory ?? [];
    meta += `
      <div class="query-meta">
        <div><b>Evidence trajectory</b></div>
        <ol class="meta-list">
          ${trjs.map((t, i) => `<li><span class="item-index">#${indices[i]}</span> ${esc(t)}</li>`).join("")}
        </ol>
      </div>`;
  }

  const r = qObj.responses ?? {};
  meta += `
    <div class="query-meta response-section">
      <div class="response-label">Personalized response</div>
      <div class="response-block">${esc(r.personalized ?? "—")}</div>
      <div class="response-label" style="margin-top:8px;">General response</div>
      <div class="response-block">${esc(r.general ?? "—")}</div>
    </div>`;

  queryBox.innerHTML = `<div class="query-text">${esc(qObj.text ?? "")}</div>${meta}`;
}

// ── Evidence side panel ────────────────────────────────────────────────────

function renderEvents() {
  eventBox.innerHTML = "";
  if (!["type1", "type2"].includes(currentType)) return;

  const qObj = currentUser.queries?.find(q => q.type === currentType);
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

  const qObj = currentUser.queries?.find(q => q.type === currentType);
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
  const sessions  = currentUser.sessions ?? [];
  const showFiller = document.getElementById("toggleFiller")?.checked;
  const query      = document.getElementById("sessionSearch")?.value?.toLowerCase() || "";

  if (selectedSessionIndex !== null) {
    const s = sessions[selectedSessionIndex];
    if (s) renderOneSession(s, selectedSessionIndex, query);
    return;
  }

  if (showFiller) {
    sessions.forEach((s, idx) => {
      if (s.type === "filler") renderOneSession(s, idx, query);
    });
  }
}

function renderOneSession(s, idx, query = "") {
  const isFiller   = s.type === "filler";
  const sessionId  = `session-${idx}`;
  const isExpanded = expandedFillers.has(sessionId);
  const turns      = s.turns ?? [];

  let content = "";

  if (isFiller && !isExpanded) {
    content = `
      <div class="filler-summary">
        <div class="summary-only">${highlight(s.timestamp ?? "filler session", query)}</div>
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
    <div id="${sessionId}" class="session-card" data-kind="${s.type}">
      <div class="session-meta">
        <div>
          <span class="session-title">Session ${idx}</span>
          <div class="session-subtitle">${s.type} · ${s.timestamp ?? ""}</div>
        </div>
      </div>
      <div class="session-body">${content}</div>
    </div>`;

  setTimeout(() => {
    document.querySelectorAll(".expand-btn").forEach(btn => {
      btn.onclick = () => { expandedFillers.add(btn.dataset.id); renderSessions(); };
    });
    document.querySelectorAll(".collapse-btn").forEach(btn => {
      btn.onclick = () => { expandedFillers.delete(btn.dataset.id); renderSessions(); };
    });
  }, 0);
}

// ── Annotation panel ───────────────────────────────────────────────────────

function renderTypeSpecific() {
  const box = document.getElementById("typeSpecific");
  if (!box) return;

  const yn = (id, label) => `
    <label class="annot-row">${label}
      <select id="${id}">
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>`;

  const map = {
    type1: [
      yn("t1_topic",    "Is the query grounded in the topic?"),
      yn("t1_newrec",   "Does the query require recommending something new based on past events for a personalized response?"),
      yn("t1_natural",  "Is the query natural and realistic?"),
    ],
    type2: [
      yn("t2_mixed",    "Is the evidence naturally and well mixed from multiple sessions?"),
      yn("t2_natural",  "Is the query natural and realistic?"),
    ],
    type3: [
      yn("t3_progress", "Does the query require understanding the user's progression along the axes for a personalized response?"),
      yn("t3_natural",  "Is the query natural and realistic?"),
    ],
    type4: [
      yn("t4_against",  "Does the user's decision go against their established trajectory?"),
      yn("t4_misalign", "Does the query naturally misalign with the evidence?"),
    ],
  };

  box.innerHTML = (map[currentType] ?? []).join("<br>");
}

function getTypeSpecificValues() {
  const ids = {
    type1: ["t1_topic", "t1_newrec", "t1_natural"],
    type2: ["t2_mixed", "t2_natural"],
    type3: ["t3_progress", "t3_natural"],
    type4: ["t4_against", "t4_misalign"],
  }[currentType] ?? [];

  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.value]));
}

// ── Save / load ────────────────────────────────────────────────────────────

function saveAnnotation() {
  const record = {
    user_index:    Number(userSelect.value),
    user_id:       currentUser.user_id,
    query_type:    currentType,
    query:         currentUser.queries?.find(q => q.type === currentType)?.text,
    persona:       currentUser.persona,
    topic:         currentUser.topic,
    axes:          currentUser.axes,
    type_specific: getTypeSpecificValues(),
    comment:       document.getElementById("comment")?.value,
    timestamp:     new Date().toISOString(),
  };

  annotations = annotations.filter(
    a => !(a.user_index === record.user_index && a.query_type === record.query_type)
  );
  annotations.push(record);
  localStorage.setItem("annotations", JSON.stringify(annotations));
  alert("Saved!");
}

function loadAnnotation() {
  const ann = annotations.find(
    a => a.user_index === Number(userSelect.value) && a.query_type === currentType
  );
  if (!ann) return;

  document.getElementById("comment").value = ann.comment ?? "";

  const ts = ann.type_specific || {};
  for (const key in ts) {
    const el = document.getElementById(key);
    if (el) el.value = ts[key];
  }
}

function downloadAnnotations() {
  const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "annotations.json";
  a.click();
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
