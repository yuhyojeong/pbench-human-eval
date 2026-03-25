let data = null;
let currentUser = null;
let currentType = "type1";
let annotations = JSON.parse(localStorage.getItem("annotations") || "[]");

// DOM refs
let userSelect, typeSelect;
let queryBox, eventBox, trajBox, sessionBox;
let saveBtn, downloadBtn;
let implicitSlider, confidenceInput, rationaleInput;
let expandedFillers = new Set();

async function init() {
  console.log("init start");

  // DOM query
  userSelect = document.getElementById("userSelect");
  typeSelect = document.getElementById("queryTypeSelect");

  queryBox = document.getElementById("queryPanel");
  eventBox = document.getElementById("eventsList");
  trajBox = document.getElementById("trajectoryList");
  sessionBox = document.getElementById("sessionsList");

  saveBtn = document.getElementById("saveBtn");
  downloadBtn = document.getElementById("downloadBtn");

  implicitSlider = document.getElementById("implicitness");
  confidenceInput = document.getElementById("confidence");
  rationaleInput = document.getElementById("rationale");

  console.log({
    userSelect,
    typeSelect,
    saveBtn,
    downloadBtn
  });

  const scrollBtn = document.getElementById("scrollTopBtn");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) {
      scrollBtn.classList.add("show");
    } else {
      scrollBtn.classList.remove("show");
    }
  });

  scrollBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  const searchInput = document.getElementById("sessionSearch");

    searchInput?.addEventListener("input", () => {
    renderSessions();
    });

  ["toggleEvents", "toggleTrajectory", "toggleFiller", "expandFillerTurns"]
  .forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      renderSessions();
    });
  });

  ["chkEvent", "chkTraj", "chkFiller"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      renderSessions();
    });
  });

  // event binding
  userSelect?.addEventListener("change", () => {
    currentUser = data[userSelect.value];
    render();
  });

  typeSelect?.addEventListener("change", () => {
    currentType = typeSelect.value;
    render();
  });

  saveBtn?.addEventListener("click", saveAnnotation);
  downloadBtn?.addEventListener("click", downloadAnnotations);

  try {
    const res = await fetch("./data.json");
    const raw = await res.json();
    data = raw.records ?? raw;

    const types = ["type1", "type2", "type3", "type4"];
    typeSelect.innerHTML = "";
    types.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      typeSelect.appendChild(opt);
    });

    userSelect.innerHTML = "";
    data.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i} - ${d.persona}`;
      userSelect.appendChild(opt);
    });

    currentUser = data[0];
    render();
  } catch (e) {
    console.error("INIT ERROR:", e);
  }
}

function renderTypeSpecific() {
  const box = document.getElementById("typeSpecific");
  if (!box) return;

  box.innerHTML = "";

  if (currentType === "type1") {
    box.innerHTML = `
      <label>Refers to past event?
        <select id="t1_ref"><option>yes</option><option>no</option></select>
      </label><br>

      <label>Event knowledge required?
        <select id="t1_need"><option>yes</option><option>no</option></select>
      </label>
    `;
  }

  if (currentType === "type2") {
    box.innerHTML = `
      <label>Looks unrelated to trajectory?
        <select id="t2_unrelated"><option>yes</option><option>no</option></select>
      </label><br>

      <label>Trajectory tracking required?
        <select id="t2_need"><option>yes</option><option>no</option></select>
      </label>
    `;
  }

  if (currentType === "type3") {
    box.innerHTML = `
      <label>Misremembering?
        <select id="t3_mis"><option>yes</option><option>no</option></select>
      </label><br>

      <label>Target does NOT exist?
        <select id="t3_nonexist"><option>yes</option><option>no</option></select>
      </label>
    `;
  }

  if (currentType === "type4") {
    box.innerHTML = `
      <label>Mixing multiple events?
        <select id="t4_mix"><option>yes</option><option>no</option></select>
      </label>
    `;
  }

  if (currentType === "filler") {
    box.innerHTML = `
      <label>Unrelated to events?
        <select id="filler_unrelated"><option>yes</option><option>no</option></select>
      </label>
    `;
  }
}

function render() {
  if (!currentUser) return;
  renderQuery();
  renderEvents();
  renderTrajectory();
  renderSessions();
  renderTypeSpecific(); // 🔥 추가
  loadAnnotation();
}

function renderQuery() {
  const qObj = currentUser.queries?.find(q => q.type === currentType);
  if (!qObj) {
    queryBox.innerHTML = "";
    return;
  }

  let extra = "";

  // 🔹 type3
  if (currentType === "type3") {
    const m = qObj.mismatch || {};

    extra += `
      <div class="query-meta">
        <div><b>referenceEventIndex:</b> ${qObj.referenceEventIndex ?? "-"}</div>

        <div><b>rewrittenEvent:</b></div>
        <div class="meta-block">${qObj.rewrittenEvent ?? "-"}</div>

        <div><b>mismatch:</b></div>
        <div class="meta-block">
          <div>cue: "${m.inputCue ?? "-"}" → "${m.outputCue ?? "-"}"</div>
          <div>item: "${m.inputItem ?? "-"}" → "${m.outputItem ?? "-"}"</div>
        </div>
      </div>
    `;
  }

  // 🔹 type4
  if (currentType === "type4") {
    const indices = qObj.mixedEventIndices ?? [];

    extra += `
      <div class="query-meta">
        <div><b>mixedEventIndices:</b> ${indices.join(", ") || "-"}</div>
      </div>
    `;
  }

  // 🔥 NEW: topic + axes (항상 표시)
  extra += `
    <div class="query-meta">
      <div><b>Topic:</b> ${currentUser.topic ?? "-"}</div>
      <div><b>Axes:</b> ${(currentUser.axes ?? []).join(", ")}</div>
    </div>
  `;

  queryBox.innerHTML = `
    <div class="query-text">
      ${qObj.text ?? ""}
    </div>
    ${extra}
  `;
}

function scrollToSession(type, idx) {
  const sessions = normalizeSessions(currentUser);

  // 해당 type 중 idx번째 찾기
  let count = -1;
  let targetIndex = -1;

  sessions.forEach((s, i) => {
    if (s.kind === type) {
      count++;
      if (count === idx) {
        targetIndex = i;
      }
    }
  });

  if (targetIndex === -1) return;

  const el = document.getElementById(`session-${targetIndex}`);
  if (!el) return;

  el.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  // 🔥 하이라이트 효과
  el.classList.add("highlight");
  setTimeout(() => el.classList.remove("highlight"), 1500);
}

function renderEvents() {
  eventBox.innerHTML = "";

  currentUser.events?.forEach((e, i) => {
    eventBox.innerHTML += `
      <div class="list-item clickable" data-event-index="${i}">
        ${e}
      </div>
    `;
  });

  // 🔥 클릭 이벤트 바인딩
  document.querySelectorAll(".list-item.clickable").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.eventIndex);
      scrollToSession("event", idx);
    });
  });
}

function renderTrajectory() {
  trajBox.innerHTML = "";

  currentUser.trajectory?.forEach((t, i) => {
    trajBox.innerHTML += `
      <div class="list-item clickable" data-traj-index="${i}">
        ${t}
      </div>
    `;
  });

  document.querySelectorAll(".list-item.clickable").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.trajIndex);
      scrollToSession("trajectory", idx);
    });
  });
}

function getSessionFilter() {
  return {
    event: document.getElementById("chkEvent")?.checked,
    traj: document.getElementById("chkTraj")?.checked,
    filler: document.getElementById("chkFiller")?.checked
  };
}

function extractSessionText(session) {
  if (session.text) return session.text;
  if (session.title) return session.title;

  const turns =
    session.event_turns ||
    session.trajectory_turns ||
    session.filler_turns ||
    session.turns ||
    [];

  return turns.map(t => `${t.role}: ${t.content}`).join("<br>");
}

function renderSessions() {
  sessionBox.innerHTML = "";

  const sessions = normalizeSessions(currentUser);

  const showEvents = document.getElementById("toggleEvents")?.checked;
  const showTraj = document.getElementById("toggleTrajectory")?.checked;
  const showFiller = document.getElementById("toggleFiller")?.checked;
  const expandFiller = document.getElementById("expandFillerTurns")?.checked;

  const query = document.getElementById("sessionSearch")?.value?.toLowerCase() || "";

  const filtered = sessions.filter(s => {
    const type = s.kind || s.type;

    // 🔹 type filter
    if (type === "event" && !showEvents) return false;
    if (type === "trajectory" && !showTraj) return false;
    if (type === "filler" && !showFiller) return false;

    // 🔹 search filter
    if (!query) return true;

    const text = JSON.stringify(s).toLowerCase(); // 🔥 전체 내용 검색

    return text.includes(query);
  });

  filtered.forEach((s, i) => {
    const type = s.kind || s.type;
    const isFiller = type === "filler";

    let content = "";

    const turns =
      s.event_turns ||
      s.trajectory_turns ||
      s.filler_turns ||
      s.turns ||
      [];

    const sessionId = `session-${i}`;
    const isExpanded = expandedFillers.has(sessionId);

    if (isFiller && !isExpanded) {
      content = `
        <div class="filler-summary" data-id="${sessionId}">
          <div class="summary-only">${highlight(s.topic ?? "filler session", query)}</div>
          <button class="expand-btn" data-id="${sessionId}">Expand</button>
        </div>
      `;
    } else {
      content = `
        <div class="filler-expanded">
          ${turns.map(t => `
            <div class="turn">
              <div class="role">${t.role}:</div>
              <div class="content">${highlight(t.content, query)}</div>
            </div>
          `).join("")}
          <button class="collapse-btn" data-id="${sessionId}">Collapse</button>
        </div>
      `;
    }

    sessionBox.innerHTML += `
      <div id="${sessionId}" class="session-card ${isFiller ? "filler" : "evidence"}">
        <div class="session-meta">
          <span class="session-title">Session ${i}</span>
          <span class="session-subtitle">${type}</span>
        </div>
        <div class="session-body">${content}</div>
      </div>
    `;
  });

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

function highlight(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(regex, `<mark>$1</mark>`);
}

function getChecked(className) {
  return Array.from(document.querySelectorAll(`.${className}:checked`)).map(el => el.value);
}

function getTypeSpecificValues() {
  if (currentType === "type1") {
    return {
      ref: document.getElementById("t1_ref")?.value,
      need: document.getElementById("t1_need")?.value
    };
  }

  if (currentType === "type2") {
    return {
      unrelated: document.getElementById("t2_unrelated")?.value,
      need: document.getElementById("t2_need")?.value
    };
  }

  if (currentType === "type3") {
    return {
      mis: document.getElementById("t3_mis")?.value,
      nonexist: document.getElementById("t3_nonexist")?.value
    };
  }

  if (currentType === "type4") {
    return {
      mix: document.getElementById("t4_mix")?.value
    };
  }

  if (currentType === "filler") {
    return {
      unrelated: document.getElementById("filler_unrelated")?.value
    };
  }

  return {};
}

function saveAnnotation() {
  const record = {
    user_index: Number(userSelect.value),
    user_id: currentUser.user_id,
    query_type: currentType,
    query: currentUser.queries?.find(q => q.type === currentType)?.text,

    persona: currentUser.persona,
    topic: currentUser.topic,
    axes: currentUser.axes,

    implicitness: document.getElementById("implicitness")?.value,
    multihop: document.getElementById("multihop")?.value,
    type_specific: getTypeSpecificValues(),
    comment: document.getElementById("comment")?.value,

    timestamp: new Date().toISOString()
  };

  annotations = annotations.filter(
    a =>
      !(
        a.user_index === record.user_index &&
        a.query_type === record.query_type
      )
  );

  annotations.push(record);

  localStorage.setItem("annotations", JSON.stringify(annotations));

  console.log("Saved:", record); // 🔥 디버깅용
  alert("Saved!");
}

function loadAnnotation() {
  const ann = annotations.find(
    a =>
      a.user_index === Number(userSelect.value) &&
      a.query_type === currentType
  );

  if (!ann) return;

  document.getElementById("implicitness").value = ann.implicitness ?? "yes";
  document.getElementById("multihop").value = ann.multihop ?? "no";
  document.getElementById("comment").value = ann.comment ?? "";

  const ts = ann.type_specific || {};

  for (const key in ts) {
    const el = document.getElementById(`${currentType}_${key}`);
    if (el) el.value = ts[key];
  }
}

function downloadAnnotations() {
  const blob = new Blob([JSON.stringify(annotations, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "annotations.json";
  a.click();
}

function normalizeSessions(user) {
  return [
    ...(user.eventSessions ?? []).map(s => ({ ...s, kind: "event" })),
    ...(user.trajectorySessions ?? []).map(s => ({ ...s, kind: "trajectory" })),
    ...(user.fillerSessions ?? []).map(s => ({ ...s, kind: "filler" }))
  ];
}

init();