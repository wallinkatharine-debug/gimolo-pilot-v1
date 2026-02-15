/* Gimolo Pilot v1 — polished core loop + filters + civic toggle + dot world + vibe + sound (no build tools) */
/* Sources of truth:
   - Core loop: Spin → Activity → In-Progress → Done → Back to Spin (UX spec)  */
/* eslint-disable no-console */

const STORAGE_KEY = "gimolo_pilot_v1_state";

/** ---------------------------
 *  DATA LOADING (MVP-friendly)
 *  ---------------------------
 *  For pilot build simplicity, we support:
 *  - activities.json (core) optional
 *  - civic_activities.json (civic) optional
 *  If missing, we fall back to placeholder activities.
 */

async function tryFetchJson(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function placeholderCoreActivities() {
  const arr = [];
  for (let i = 1; i <= 370; i++) {
    arr.push({
      id: "core_" + i,
      mode: "core",
      title: "Activity " + i,
      desc: "This is description for activity " + i,
      minutes: 8,
      tier: 1,
      planning: "Immediate",
      energy: "Any",
      identity: ["Helper", "Curious", "Builder", "Explorer"][i % 4],
      pac: 2, mdr: 3, imy: "Medium", co: "Low",
      scope: 1,
      tags: ["play"]
    });
  }
  return arr;
}

function placeholderCivicActivities() {
  const arr = [];
  for (let i = 1; i <= 50; i++) {
    arr.push({
      id: "civic_" + i,
      mode: "civic",
      title: "Community Action " + i,
      desc: "A small, doable community action.",
      minutes: 8,
      tier: 1,
      planning: "Immediate",
      energy: "Any",
      identity: ["Helper", "Curious", "Builder", "Explorer"][i % 4],
      pac: 2, mdr: 4, imy: "Medium", co: "Low",
      scope: 1,
      tags: ["community"]
    });
  }
  return arr;
}

let CORE = [];
let CIVIC = [];

async function loadLibraries() {
  const core = await tryFetchJson("activities.json");
  const civic = await tryFetchJson("civic_activities.json");
  const vibeCopy = await tryFetchJson("vibe_copy.json");

  CORE = Array.isArray(core) && core.length ? core : placeholderCoreActivities();
  CIVIC = Array.isArray(civic) && civic.length ? civic : placeholderCivicActivities();

  VIBE_COPY = (vibeCopy && typeof vibeCopy === "object") ? vibeCopy : VIBE_COPY;
}

/** ---------------------------
 *  STATE
 *  --------------------------- */

const defaultState = {
  soundOn: true,
  communityOnly: false, // toggle ON = civic-only
  voice: "supportive", // supportive | grumpy | neutral
  filters: {
    time: 8,           // minutes (display only; used as upper bound)
    tier: 1,
    planning: "Immediate",
    energy: "Any",
  },
  vibeNext: null,      // "keep" | "switch" | "surprise" | null
  current: null,       // activity object
  history: [],         // recent completed list
  dots: [],            // for dot world
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed, filters: { ...defaultState.filters, ...(parsed.filters || {}) } };
  } catch (_) {
    return structuredClone(defaultState);
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/** ---------------------------
 *  DOM
 *  --------------------------- */

const screens = {
  spin: document.getElementById("spinScreen"),
  activity: document.getElementById("activityScreen"),
  progress: document.getElementById("progressScreen"),
  done: document.getElementById("doneScreen"),
  profile: document.getElementById("profileScreen"),
};

const wheel = document.getElementById("wheel");
const matchesEl = document.getElementById("matches");

const voiceSupportiveBtn = document.getElementById("voiceSupportive");
const voiceGrumpyBtn = document.getElementById("voiceGrumpy");
const voiceNeutralBtn = document.getElementById("voiceNeutral");

const activityTitle = document.getElementById("activityTitle");
const activityDesc = document.getElementById("activityDesc");
const activityBadge = document.getElementById("activityBadge");
const activityMicro = document.getElementById("activityMicro");

const progressTitle = document.getElementById("progressTitle");
const progressFill = document.getElementById("progressFill");

const doneMicro = document.getElementById("doneMicro");
const doneTitle = document.getElementById("doneTitle");
const doneDesc = document.getElementById("doneDesc");

const dotField = document.getElementById("dotField");
const profileStats = document.getElementById("profileStats");
const recentList = document.getElementById("recentList");

const soundBtn = document.getElementById("soundBtn");
const civicBtn = document.getElementById("civicBtn");
const profileBtn = document.getElementById("profileBtn");

const timeLabel = document.getElementById("timeLabel");
const tierLabel = document.getElementById("tierLabel");
const planLabel = document.getElementById("planLabel");
const energyLabel = document.getElementById("energyLabel");

const sheetBackdrop = document.getElementById("sheetBackdrop");
const sheet = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheetTitle");
const sheetBody = document.getElementById("sheetBody");

/** ---------------------------
 *  NAV / SCREEN ROUTING
 *  --------------------------- */

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function safeText(s) {
  return String(s ?? "");
}

/** ---------------------------
 *  SOUND (simple, no assets)
 *  --------------------------- */

function beep(type = "click") {
  if (!state.soundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);

    const now = ctx.currentTime;
    const freq = type === "success" ? 740 : type === "spin" ? 520 : 420;
    o.frequency.setValueAtTime(freq, now);
    o.type = "sine";

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (type === "success" ? 0.18 : 0.10));

    o.start(now);
    o.stop(now + (type === "success" ? 0.20 : 0.12));

    setTimeout(() => ctx.close(), 260);
  } catch (_) {}
}

/** ---------------------------
 *  FILTERS / SHEET UI
 *  --------------------------- */

function openSheet(title, options, currentValue, onSelect) {
  sheetTitle.textContent = title;
  sheetBody.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option" + (opt.value === currentValue ? " selected" : "");
    btn.textContent = opt.label;
    btn.onclick = () => {
      Array.from(sheetBody.querySelectorAll(".option")).forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      onSelect(opt.value);
    };
    sheetBody.appendChild(btn);
  });

  sheet.hidden = false;
  sheetBackdrop.hidden = false;
  sheetBackdrop.onclick = closeSheet;
}

function closeSheet() {
  sheet.hidden = true;
  sheetBackdrop.hidden = true;
  sheetBackdrop.onclick = null;
}

document.getElementById("sheetDoneBtn").onclick = () => {
  closeSheet();
  refreshMatches();
  saveState();
};

document.getElementById("filterTime").onclick = () => {
  openSheet("Time available", [
    { label: "5 min", value: 5 },
    { label: "8 min", value: 8 },
    { label: "12 min", value: 12 },
    { label: "20 min", value: 20 },
  ], state.filters.time, (v) => {
    state.filters.time = v;
    renderFilterLabels();
  });
};

document.getElementById("filterTier").onclick = () => {
  openSheet("Effort tier", [
    { label: "Tier 1", value: 1 },
    { label: "Tier 2", value: 2 },
    { label: "Tier 3", value: 3 },
    { label: "Tier 4", value: 4 },
  ], state.filters.tier, (v) => {
    state.filters.tier = v;
    renderFilterLabels();
  });
};

document.getElementById("filterPlanning").onclick = () => {
  openSheet("Planning", [
    { label: "Immediate", value: "Immediate" },
    { label: "Requires Prep", value: "Requires Preparation" },
    { label: "Scheduled", value: "Scheduled" },
  ], state.filters.planning, (v) => {
    state.filters.planning = v;
    renderFilterLabels();
  });
};

document.getElementById("filterEnergy").onclick = () => {
  openSheet("Energy", [
    { label: "Any", value: "Any" },
    { label: "Chill", value: "Chill" },
    { label: "Moderate", value: "Moderate" },
    { label: "Active", value: "Active" },
  ], state.filters.energy, (v) => {
    state.filters.energy = v;
    renderFilterLabels();
  });
};


function renderVoiceButtons() {
  const v = currentVoice();
  if (!voiceSupportiveBtn || !voiceGrumpyBtn || !voiceNeutralBtn) return;

  [voiceSupportiveBtn, voiceGrumpyBtn, voiceNeutralBtn].forEach(b => b.classList.remove("selected"));
  if (v === "supportive") voiceSupportiveBtn.classList.add("selected");
  if (v === "grumpy") voiceGrumpyBtn.classList.add("selected");
  if (v === "neutral") voiceNeutralBtn.classList.add("selected");
}
function renderFilterLabels() {
  timeLabel.textContent = state.filters.time + " min";
  tierLabel.textContent = "Tier " + state.filters.tier;
  planLabel.textContent = state.filters.planning === "Requires Preparation" ? "Prep" : state.filters.planning;
  energyLabel.textContent = state.filters.energy;
}

/** ---------------------------
 *  CIVIC TOGGLE (Community Only)
 *  --------------------------- */

function applyTopButtons() {
  soundBtn.setAttribute("aria-pressed", String(!!state.soundOn));
  soundBtn.querySelector(".chipIcon").textContent = state.soundOn ? "🔊" : "🔇";
  civicBtn.setAttribute("aria-pressed", String(!!state.communityOnly));
  civicBtn.classList.toggle("selected", !!state.communityOnly);
  civicBtn.querySelector(".chipText").textContent = state.communityOnly ? "Civic" : "Civic";
}

soundBtn.onclick = () => {
  state.soundOn = !state.soundOn;
  applyTopButtons();

  // Voice (Supportive / Grumpy / Classic)
  if (voiceSupportiveBtn) voiceSupportiveBtn.onclick = () => { state.voice = "supportive"; renderVoiceButtons(); refreshMatches(); beep("click"); saveState(); };
  if (voiceGrumpyBtn) voiceGrumpyBtn.onclick = () => { state.voice = "grumpy"; renderVoiceButtons(); refreshMatches(); beep("click"); saveState(); };
  if (voiceNeutralBtn) voiceNeutralBtn.onclick = () => { state.voice = "neutral"; renderVoiceButtons(); refreshMatches(); beep("click"); saveState(); };
  renderVoiceButtons();

  beep("click");
  saveState();
};

civicBtn.onclick = () => {
  state.communityOnly = !state.communityOnly;
  applyTopButtons();
  refreshMatches();
  beep("click");
  saveState();
};

profileBtn.onclick = () => {
  renderProfile();
  showScreen("profile");
  beep("click");
};

document.getElementById("closeProfileBtn").onclick = () => {
  showScreen("spin");
  beep("click");
};

document.getElementById("resetBtn").onclick = () => {
  if (!confirm("Reset demo data?")) return;
  state = structuredClone(defaultState);
  applyTopButtons();
  renderFilterLabels();
  renderDotWorld();
  refreshMatches();
  showScreen("spin");
  saveState();
};

/** ---------------------------
 *  ENGINE (MVP implementation)
 *  --------------------------- */

function poolForCurrentMode() {
  // Toggle ON = civic-only
  if (state.communityOnly) return CIVIC.slice();

  // Toggle OFF = mixed pool with light civic weighting (10–12% during ignition)
  // For simplicity in MVP static build: we mix at selection-time using weighted choice.
  return null;
}

function passesFilters(a) {
  if (!a) return false;

  // time is an upper bound if minutes present
  const minutes = Number(a.minutes ?? 8);
  if (minutes > state.filters.time) return false;

  const tier = Number(a.tier ?? 1);
  if (tier > state.filters.tier) return false;

  const planning = a.planning ?? "Immediate";
  if (state.filters.planning && planning !== state.filters.planning) return false;

  const energy = a.energy ?? "Any";
  if (state.filters.energy !== "Any" && energy !== state.filters.energy) return false;

  return true;
}

function eligibleCore() {
  return CORE.filter(passesFilters);
}
function eligibleCivic() {
  return CIVIC.filter(passesFilters);
}

function computeMatches() {
  const core = eligibleCore().length;
  const civic = eligibleCivic().length;
  const total = state.communityOnly ? civic : core + civic; // displayed total universe for selection
  return { total, core, civic };
}

function refreshMatches() {
  const m = computeMatches();
  const tier = state.filters.tier;
  // Scope is placeholder in this static build; kept for UI continuity
  const label = voiceCopy().matches_label || "Matches";
  matchesEl.textContent = `${label}: ${m.total} • Tier: ${tier} • Scope: 1`;
}

function pickFrom(list) {
  if (!list.length) return null;

  // Avoid immediate repetition: don't pick anything in last 6 surfaced/completed
  const recentIds = new Set(state.history.slice(0, 6).map(h => h.id));
  const filtered = list.filter(a => !recentIds.has(a.id));
  const base = filtered.length ? filtered : list;

  // Vibe preference affects NEXT SPIN only (presentation-only bias)
  if (state.vibeNext === "keep" && state.current) {
    const targetEnergy = state.current.energy ?? "Any";
    const biased = base.filter(a => (a.energy ?? "Any") === targetEnergy);
    if (biased.length) return biased[Math.floor(Math.random() * biased.length)];
  }
  if (state.vibeNext === "switch" && state.current) {
    const targetEnergy = state.current.energy ?? "Any";
    const biased = base.filter(a => (a.energy ?? "Any") !== targetEnergy);
    if (biased.length) return biased[Math.floor(Math.random() * biased.length)];
  }

  return base[Math.floor(Math.random() * base.length)];
}

function spinSelectActivity() {
  const core = eligibleCore();
  const civic = eligibleCivic();

  // Selection rules:
  // - Community-only: civic only
  // - Mixed: core dominant, civic lightly weighted (10–12%) IF civic exists
  if (state.communityOnly) {
    return pickFrom(civic);
  }

  const hasCivic = civic.length > 0;
  const civicWeight = hasCivic ? 0.11 : 0;

  const roll = Math.random();
  if (hasCivic && roll < civicWeight) return pickFrom(civic);
  return pickFrom(core.length ? core : civic); // fallback
}

/** ---------------------------
 *  VIBE (presentation-only)
 *  --------------------------- */

let VIBE_COPY = {
  supportive: {
    label: "Supportive Best Friend",
    spin_helper: "Pick your filters and I’ll find something that fits your energy.",
    adjust_cta: "Adjust choice",
    matches_label: "Matches",
    activity_intro: "Okay—this is a good one.",
    start_primary: "Start →",
    spin_secondary: "Spin again",
    in_progress_title: "In Progress",
    in_progress_helper: "You’re doing great. One small step at a time.",
    done_title: "Done!",
    done_helper: "That counts. Proud of you.",
    back_to_spin: "Back to Spin",
    profile_title: "Profile",
    profile_empty: "Your dots will show up here as you complete activities."
  },
  grumpy: {
    label: "Grumpy Best Friend",
    spin_helper: "Choose filters if you’re going to be picky.",
    adjust_cta: "Adjust choice",
    matches_label: "Matches",
    activity_intro: "Alright. Here you go.",
    start_primary: "Fine. Start →",
    spin_secondary: "Spin again",
    in_progress_title: "In Progress",
    in_progress_helper: "Yes, you’re still doing it. Keep going.",
    done_title: "Done. Finally.",
    done_helper: "Okay. That actually counts. Nice.",
    back_to_spin: "Back to Spin",
    profile_title: "Profile",
    profile_empty: "No dots yet. Go do one thing."
  },
  neutral: {
    label: "Classic",
    spin_helper: "Adjust filters to change your matches.",
    adjust_cta: "Adjust choice",
    matches_label: "Matches",
    activity_intro: "Selected activity",
    start_primary: "Start →",
    spin_secondary: "Spin again",
    in_progress_title: "In Progress",
    in_progress_helper: "In progress.",
    done_title: "Completed",
    done_helper: "Activity recorded.",
    back_to_spin: "Back to Spin",
    profile_title: "Profile",
    profile_empty: "Complete activities to build your dot history."
  }
};

const microcopy = {
  reveal: [
    "Here’s a quick one.",
    "Low effort. High payoff.",
    "Tiny action. Real momentum.",
    "Let’s make a moment.",
    "A small spark counts.",
  ],
  done: [
    "Nice. That counts.",
    "Momentum created.",
    "Dot earned. Keep going.",
    "Small win, big signal.",
    "Good. You showed up.",
  ],
  badgeFor(a){
    if (!a) return "Play";
    if (a.mode === "civic") return "Community";
    if ((a.tags || []).includes("creative")) return "Create";
    if ((a.tags || []).includes("connection")) return "Connect";
    return "Play";
  }
};

function currentVoice() {
  const v = state.voice || "supportive";
  return (v === "supportive" || v === "grumpy" || v === "neutral") ? v : "supportive";
}

function voiceCopy() {
  const v = currentVoice();
  return (VIBE_COPY && VIBE_COPY[v]) ? VIBE_COPY[v] : (VIBE_COPY.supportive || {});
}

function activityVariant(a) {
  const v = currentVoice();
  if (a && a.vibes && a.vibes[v]) return a.vibes[v];
  // fallbacks
  return {
    title: a?.title || "Activity",
    desc: a?.desc || "",
    cta_start: voiceCopy().start_primary || "Start →",
    cta_spin_again: voiceCopy().spin_secondary || "Spin again",
    in_progress_line: voiceCopy().in_progress_helper || "In progress.",
  };
}

function applyVibeToActivity(a) {
  activityBadge.textContent = microcopy.badgeFor(a);
  activityMicro.textContent = voiceCopy().activity_intro || microcopy.reveal[Math.floor(Math.random()*microcopy.reveal.length)];
}

function applyVibeToDone() {
  doneMicro.textContent = voiceCopy().done_helper || microcopy.done[Math.floor(Math.random()*microcopy.done.length)];
}
/** ---------------------------
 *  DOT WORLD
 *  --------------------------- */

const identityColors = {
  Helper: "#43e97b",
  Curious: "#49b6ff",
  Builder: "#ffb44a",
  Explorer: "#b06bff",
};

function addDotForActivity(a) {
  const color = identityColors[a.identity] || "#49b6ff";
  const isHalo = a.mode === "civic"; // civic dots get subtle halo on completion
  const dot = {
    color,
    halo: isHalo,
    ts: Date.now(),
    id: a.id,
  };
  state.dots.unshift(dot);
  // keep about 75 dots
  state.dots = state.dots.slice(0, 75);
}

function renderDotWorld() {
  dotField.innerHTML = "";
  const dots = state.dots.slice(0, 75).reverse(); // oldest first for layering
  const w = dotField.clientWidth || 680;
  const h = dotField.clientHeight || 84;

  dots.forEach((d, idx) => {
    const el = document.createElement("div");
    el.className = "dot" + (idx >= dots.length - 5 ? " recent" : "") + (d.halo ? " halo" : "");
    el.style.background = d.color;

    // organic placement, stable-ish based on id hash
    const seed = hashString(d.id) + idx * 17;
    const x = (seed % 1000) / 1000;
    const y = (hashString(d.id + "y") % 1000) / 1000;
    el.style.left = Math.floor(x * (w - 12)) + "px";
    el.style.top = Math.floor(y * (h - 12)) + "px";

    dotField.appendChild(el);
  });
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i), h |= 0;
  return Math.abs(h);
}

window.addEventListener("resize", () => renderDotWorld());

/** ---------------------------
 *  CORE LOOP EVENTS
 *  --------------------------- */

wheel.onclick = async () => {
  wheel.classList.remove("spin");
  // trigger reflow so animation restarts reliably
  // eslint-disable-next-line no-unused-expressions
  wheel.offsetHeight;
  wheel.classList.add("spin");

  beep("spin");

  // selection after a short anticipation
  setTimeout(() => {
    const next = spinSelectActivity();
    if (!next) {
      alert("No activities match your filters. Try relaxing time/tier.");
      return;
    }
    state.current = next;

    const variant = activityVariant(next);
    activityTitle.textContent = safeText(variant.title);
    activityDesc.textContent = safeText(variant.desc);
    document.getElementById("startBtn").textContent = variant.cta_start || (voiceCopy().start_primary || "Start →");
    document.getElementById("spinAgainBtn").textContent = variant.cta_spin_again || (voiceCopy().spin_secondary || "Spin again");
    applyVibeToActivity(next);

    // Reset vibe after it's applied once (spec: affects next spin only)
    state.vibeNext = null;
    clearVibePills();

    showScreen("activity");
    saveState();
  }, 520);
};

document.getElementById("spinAgainBtn").onclick = () => {
  showScreen("spin");
  beep("click");
};

document.getElementById("adjustBtn").onclick = () => {
  // Quick shortcut: open time sheet first (compact, not giant)
  document.getElementById("filterTime").click();
  beep("click");
};

document.getElementById("startBtn").onclick = () => {
  if (!state.current) return;

  const variant = activityVariant(state.current);
  progressTitle.textContent = safeText(variant.title);
  showScreen("progress");
  beep("click");

  // simple progress animation for "life" (not a timer, just momentum)
  let width = 0;
  progressFill.style.width = "0%";
  const interval = setInterval(() => {
    width = Math.min(100, width + 2);
    progressFill.style.width = width + "%";
    document.querySelector(".progressBar")?.setAttribute("aria-valuenow", String(width));
    if (width >= 100) clearInterval(interval);
  }, 30);
};

document.getElementById("backBtn").onclick = () => {
  showScreen("spin");
  beep("click");
};

document.getElementById("doneBtn").onclick = () => {
  if (!state.current) return;

  // add to history + dot world
  const a = state.current;
  addDotForActivity(a);

  state.history.unshift({
    id: a.id,
    title: a.title,
    mode: a.mode,
    tier: a.tier,
    minutes: a.minutes,
    ts: Date.now(),
    color: identityColors[a.identity] || "#49b6ff",
  });
  state.history = state.history.slice(0, 30);

  // done screen copy
  applyVibeToDone();
  const vcopy = voiceCopy();
  const variant = activityVariant(state.current);
  doneTitle.textContent = vcopy.done_title || "Completed";
  doneDesc.textContent = variant.title ? `Recorded: ${variant.title}` : (vcopy.done_helper || "Activity recorded.");
  renderDotWorld();

  showScreen("done");
  beep("success");
  saveState();

  // Reset progress bar so it doesn't carry over
  progressFill.style.width = "0%";

  // IMPORTANT BUG FIX: filters persist and remain real after completion.
  // We recompute match counts here (and on every return to spin).
  refreshMatches();
};

document.getElementById("doneBackBtn").onclick = () => {
  showScreen("spin");
  beep("click");
  refreshMatches();
};

document.getElementById("doneSpinBtn").onclick = () => {
  showScreen("spin");
  beep("click");
  refreshMatches();
};

/** ---------------------------
 *  ADJUSTABLE RANDOMNESS (Completion steering)
 *  --------------------------- */

const keepEnergy = document.getElementById("keepEnergy");
const switchVibe = document.getElementById("switchVibe");
const surpriseMe = document.getElementById("surpriseMe");

function clearVibePills() {
  [keepEnergy, switchVibe, surpriseMe].forEach(b => b.classList.remove("selected"));
}
function setVibe(v) {
  state.vibeNext = v;
  clearVibePills();
  if (v === "keep") keepEnergy.classList.add("selected");
  if (v === "switch") switchVibe.classList.add("selected");
  if (v === "surprise") surpriseMe.classList.add("selected");
  saveState();
}

keepEnergy.onclick = () => { setVibe("keep"); beep("click"); };
switchVibe.onclick = () => { setVibe("switch"); beep("click"); };
surpriseMe.onclick = () => { setVibe("surprise"); beep("click"); };

/** ---------------------------
 *  PROFILE
 *  --------------------------- */

function renderProfile() {
  const completed = state.history.length;
  profileStats.textContent = `${completed} completed`;

  recentList.innerHTML = "";
  const items = state.history.slice(0, 8);
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "micro";
    empty.style.textAlign = "left";
    empty.textContent = voiceCopy().profile_empty || "Complete a few activities to see your dot history here.";
    recentList.appendChild(empty);
    return;
  }

  items.forEach(it => {
    const row = document.createElement("div");
    row.className = "recentItem";

    const dot = document.createElement("div");
    dot.className = "recentDot";
    dot.style.background = it.color;

    const text = document.createElement("div");
    const t = document.createElement("div");
    t.className = "recentText";
    t.textContent = it.title;

    const meta = document.createElement("div");
    meta.className = "recentMeta";
    meta.textContent = `${it.mode === "civic" ? "Community" : "Core"} • Tier ${it.tier ?? 1}`;

    text.appendChild(t);
    text.appendChild(meta);

    row.appendChild(dot);
    row.appendChild(text);

    recentList.appendChild(row);
  });
}

/** ---------------------------
 *  INIT
 *  --------------------------- */

(async function init() {
  await loadLibraries();

  applyTopButtons();
  renderFilterLabels();
  refreshMatches();

  // seed dot world from persisted state (or empty)
  renderDotWorld();

  // If user reloads mid-screen, keep it simple: always land on Spin for pilot stability
  showScreen("spin");
  saveState();
})();
