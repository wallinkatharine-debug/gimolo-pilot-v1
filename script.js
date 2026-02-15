/* Gimolo Pilot — Premium Mockup Build (static GitHub Pages)
   File expectations (repo root):
   - index.html
   - styles.css
   - script.js
   - activities_combined_normalized.json
   - vibe_copy.json
   - logo.png / favicon.png
*/

const state = {
  tone: "classic",
  soundOn: true,
  filters: {
    communityOnly: false,
    time: null,       // "5" | "10" | "+10" | null
    soloOnly: false,
    effort: null,     // "light" | "med" | "high" | null
    location: null    // "indoor" | "outdoor" | "either" | null
  },
  activities: [],
  filtered: [],
  current: null,
  nextSteer: null
};

const LS = {
  tone: "gimolo_tone",
  sound: "gimolo_sound",
  filters: "gimolo_filters",
  dots: "gimolo_dots"
};

const $ = (id) => document.getElementById(id);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const safeParse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

let vibeCopy = null;
let audioCtx = null;

function setScreen(id){
  ["screenSpin","screenActivity","screenProgress","screenDone"].forEach(s=>{
    $(s).classList.toggle("screen--active", s === id);
  });
}

function persist(){
  localStorage.setItem(LS.tone, state.tone);
  localStorage.setItem(LS.sound, String(state.soundOn));
  localStorage.setItem(LS.filters, JSON.stringify(state.filters));
}

function loadPersisted(){
  const t = localStorage.getItem(LS.tone);
  if(t) state.tone = t;

  const s = localStorage.getItem(LS.sound);
  if(s !== null) state.soundOn = (s === "true");

  const f = localStorage.getItem(LS.filters);
  if(f) state.filters = { ...state.filters, ...safeParse(f, {}) };
}

function beep(kind="click"){
  if(!state.soundOn) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    const now = audioCtx.currentTime;
    o.frequency.setValueAtTime(kind === "done" ? 740 : 520, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now + 0.16);
  }catch(e){ /* ignore */ }
}

function setTone(tone){
  state.tone = tone;
  persist();

  document.querySelectorAll(".face").forEach(btn=>{
    const active = btn.dataset.tone === tone;
    btn.classList.toggle("face--active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  updateMicroLine();
  updateSparkLine();
  updateStartCta();
}

function updateMicroLine(){
  if(!vibeCopy) return;
  const lines = vibeCopy.microLines[state.tone] || vibeCopy.microLines.classic;
  $("microLine").textContent = rand(lines);
}

function updateSparkLine(){
  if(!vibeCopy) return;
  const headers = vibeCopy.sparkHeaders[state.tone] || vibeCopy.sparkHeaders.classic;
  $("sparkLine").textContent = rand(headers);
}

function updateStartCta(){
  if(!vibeCopy) return;
  $("startBtn").textContent = vibeCopy.startCta[state.tone] || "Start →";
}

function updateMatches(){
  const n = state.filtered.length;
  $("matchesLine").textContent = `Matches: ${n}`;
  $("matchesSmall").textContent = `Matches: ${n}`;
}

function applyFilters(){
  const f = state.filters;

  state.filtered = state.activities.filter(a=>{
    if(f.communityOnly && !a.is_civic) return false;
    if(f.time && a.time_bucket !== f.time) return false;
    if(f.soloOnly && !a.supports_solo) return false;
    if(f.effort && a.effort !== f.effort) return false;

    if(f.location){
      // "either" matches everything
      if(a.location !== "either" && a.location !== f.location) return false;
    }
    return true;
  });

  // graceful fallback: if too strict location made it empty, relax location first
  if(state.filtered.length === 0 && f.location){
    state.filtered = state.activities.filter(a=>{
      if(f.communityOnly && !a.is_civic) return false;
      if(f.time && a.time_bucket !== f.time) return false;
      if(f.soloOnly && !a.supports_solo) return false;
      if(f.effort && a.effort !== f.effort) return false;
      return true;
    });
  }

  updateMatches();
}

function pickActivity(){
  // Steering choices from Done screen
  if(state.nextSteer === "switch"){
    const order = ["classic","supportive","grumpy"];
    const idx = order.indexOf(state.tone);
    setTone(order[(idx + 1) % order.length]);
  }else if(state.nextSteer === "surprise"){
    setTone(rand(["classic","supportive","grumpy"]));
  }
  state.nextSteer = null;

  const pool = state.filtered.length ? state.filtered : state.activities;
  if(!pool.length) return null;
  return rand(pool);
}

function renderActivity(a){
  if(!a) return;

  state.current = a;

  $("activityTitle").textContent = a.title || "Your next move";
  $("activityDesc").textContent = a.description || "";

  const pills = [];
  if(a.time_bucket === "5") pills.push("⏱ 5 min");
  else if(a.time_bucket === "10") pills.push("⏱ 10 min");
  else if(a.time_bucket === "+10") pills.push("⏱ +10");

  if(a.effort){
    const label = a.effort === "med" ? "Medium" : (a.effort[0].toUpperCase() + a.effort.slice(1));
    pills.push(`⚡ ${label}`);
  }

  if(a.location){
    const label = a.location[0].toUpperCase() + a.location.slice(1);
    pills.push(`📍 ${label}`);
  }

  pills.push(a.supports_solo ? "👤 Solo" : "👥 Together");
  if(a.is_civic) pills.push("🌱 Community");

  const row = $("metaPills");
  row.innerHTML = "";
  pills.forEach(p=>{
    const el = document.createElement("div");
    el.className = "pill";
    el.textContent = p;
    row.appendChild(el);
  });

  updateSparkLine();
  updateStartCta();
}

function startActivity(){
  beep("click");

  $("progressTitle").textContent = state.current?.title || "In progress";

  $("progressTone").textContent =
    state.tone === "supportive" ? "Tiny is still real. I’m with you." :
    state.tone === "grumpy" ? "Okay. Do it. Then we can both chill." :
    "Simple move. Real momentum.";

  const t = Number(state.current?.time_min || 0);
  const show = t >= 5;

  $("timerWrap").style.display = show ? "block" : "none";
  if(show){
    $("timerFill").style.width = "0%";
    $("timerHint").textContent = `Aim for about ${t} min (no pressure).`;
  }

  setScreen("screenProgress");
}

function completeActivity(){
  beep("done");

  addDot({ civic: !!state.current?.is_civic });

  const reactions = (vibeCopy?.doneReactions?.[state.tone]) || (vibeCopy?.doneReactions?.classic) || ["Nice."];
  $("doneTitle").textContent = rand(reactions);
  $("doneHint").textContent = state.current?.is_civic
    ? "Quiet community dot landed."
    : "Dot landed. Momentum built.";

  popConfetti();
  setScreen("screenDone");
}

function backToSpin(){
  setScreen("screenSpin");
  updateMicroLine();
}

/* Dot world */
function getDots(){ return safeParse(localStorage.getItem(LS.dots) || "[]", []); }
function setDots(d){ localStorage.setItem(LS.dots, JSON.stringify(d.slice(-120))); }

function addDot({ civic=false } = {}){
  const dots = getDots();
  dots.push({ t: Date.now(), civic: !!civic });
  setDots(dots);
  renderDots();
}

function renderDots(){
  const el = $("dotWorld");
  el.innerHTML = "";

  const dots = getDots();
  const n = Math.min(dots.length, 90);
  const slice = dots.slice(Math.max(0, dots.length - n));

  const W = el.clientWidth || 360;
  const H = el.clientHeight || 74;

  const colors = ["#ff5ea8","#ffb84d","#ffe95c","#78ff9e","#4af1ff","#6c78ff","#c25cff"];

  slice.forEach((d, i)=>{
    const dot = document.createElement("div");
    dot.className = "dot" + (d.civic ? " halo" : "");
    const size = 9 + (i % 6) * 2;
    const ang = i * 0.55;
    const r = 10 + i * 2.0;
    const cx = W*0.52 + Math.cos(ang)*r;
    const cy = H*0.55 + Math.sin(ang)*(r*0.32);

    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${Math.max(6, Math.min(W-6, cx))}px`;
    dot.style.top = `${Math.max(6, Math.min(H-6, cy))}px`;
    dot.style.background = colors[i % colors.length];
    el.appendChild(dot);
  });

  $("dotsHint").textContent = dots.length ? `Total dots: ${dots.length}` : "Complete a move to add a dot.";
}

/* Filters sheet */
function openSheet(){
  $("sheetBackdrop").hidden = false;
  $("filtersSheet").classList.add("open");
  $("filtersSheet").setAttribute("aria-hidden","false");
}
function closeSheet(){
  $("sheetBackdrop").hidden = true;
  $("filtersSheet").classList.remove("open");
  $("filtersSheet").setAttribute("aria-hidden","true");
}

function refreshSegmentedUI(){
  document.querySelectorAll(".segBtn").forEach(btn=>{
    const t = btn.dataset.time;
    const e = btn.dataset.effort;
    const l = btn.dataset.loc;

    let active = false;
    if(t !== undefined) active = (state.filters.time === t);
    if(e !== undefined) active = (state.filters.effort === e);
    if(l !== undefined) active = (state.filters.location === l);

    btn.classList.toggle("active", active);
  });

  $("communityOnly").checked = !!state.filters.communityOnly;
  $("soloOnly").checked = !!state.filters.soloOnly;
}

function initFiltersUI(){
  $("communityOnly").checked = !!state.filters.communityOnly;
  $("soloOnly").checked = !!state.filters.soloOnly;

  $("communityOnly").addEventListener("change", (e)=>{
    state.filters.communityOnly = e.target.checked;
    persist(); applyFilters();
  });

  $("soloOnly").addEventListener("change", (e)=>{
    state.filters.soloOnly = e.target.checked;
    persist(); applyFilters();
  });

  document.querySelectorAll(".segBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(btn.dataset.time !== undefined){
        const v = btn.dataset.time;
        state.filters.time = (state.filters.time === v) ? null : v;
      }
      if(btn.dataset.effort !== undefined){
        const v = btn.dataset.effort;
        state.filters.effort = (state.filters.effort === v) ? null : v;
      }
      if(btn.dataset.loc !== undefined){
        const v = btn.dataset.loc;
        state.filters.location = (state.filters.location === v) ? null : v;
      }
      refreshSegmentedUI();
      persist(); applyFilters();
      beep("click");
    });
  });

  $("applyFiltersBtn").addEventListener("click", ()=>{
    beep("click");
    closeSheet();
  });

  refreshSegmentedUI();
}

/* Confetti (simple) */
function popConfetti(){
  const box = $("confetti");
  if(!box) return;
  box.innerHTML = "";
  const colors = ["#ff5ea8","#ffb84d","#ffe95c","#78ff9e","#4af1ff","#6c78ff","#c25cff"];
  for(let i=0;i<18;i++){
    const s = document.createElement("span");
    s.style.position="absolute";
    s.style.left = (10 + Math.random()*80) + "%";
    s.style.top = "-10px";
    s.style.width = (6 + Math.random()*8) + "px";
    s.style.height = (6 + Math.random()*8) + "px";
    s.style.borderRadius="999px";
    s.style.background = colors[i % colors.length];
    s.style.opacity = "0.9";
    s.style.transform = `translateY(0px) rotate(${Math.random()*180}deg)`;
    s.style.transition = "transform 700ms ease, opacity 900ms ease";
    box.appendChild(s);
    requestAnimationFrame(()=>{
      s.style.transform = `translateY(${160 + Math.random()*140}px) rotate(${240+Math.random()*240}deg)`;
      s.style.opacity = "0";
    });
  }
  setTimeout(()=>{ box.innerHTML=""; }, 1000);
}

/* Sparkles background */
function buildSparkles(){
  const root = $("bgSparkles");
  if(!root) return;
  root.innerHTML = "";
  for(let i=0;i<22;i++){
    const s = document.createElement("div");
    s.style.position="absolute";
    s.style.left = (Math.random()*100) + "%";
    s.style.top = (Math.random()*100) + "%";
    s.style.width = (2 + Math.random()*3) + "px";
    s.style.height = (2 + Math.random()*3) + "px";
    s.style.borderRadius="999px";
    s.style.background="rgba(255,255,255,.85)";
    s.style.filter="blur(.3px)";
    s.style.opacity = (0.25 + Math.random()*0.5).toFixed(2);
    const dur = 2.5 + Math.random()*3.5;
    s.style.animation = `twinkle ${dur}s ease-in-out ${Math.random()*2}s infinite`;
    root.appendChild(s);
  }
  const style = document.createElement("style");
  style.textContent = `
    @keyframes twinkle{ 0%,100%{transform:scale(1); opacity:.25;} 50%{transform:scale(1.8); opacity:.7;} }
  `;
  document.head.appendChild(style);
}

/* Wire UI */
function wireUI(){
  const soundBtn = $("soundBtn");
  soundBtn.setAttribute("aria-pressed", state.soundOn ? "true" : "false");
  soundBtn.addEventListener("click", ()=>{
    state.soundOn = !state.soundOn;
    soundBtn.setAttribute("aria-pressed", state.soundOn ? "true" : "false");
    persist(); beep("click");
  });

  document.querySelectorAll(".face").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setTone(btn.dataset.tone);
      beep("click");
    });
  });

  $("spinButton").addEventListener("click", ()=>{
    beep("click");
    const a = pickActivity();
    renderActivity(a);
    setScreen("screenActivity");
  });

  $("spinAgainBtn").addEventListener("click", ()=>{
    beep("click");
    renderActivity(pickActivity());
  });

  $("backToSpinBtn").addEventListener("click", ()=>{ beep("click"); backToSpin(); });
  $("startBtn").addEventListener("click", startActivity);

  $("progressBackBtn").addEventListener("click", ()=>{ beep("click"); backToSpin(); });
  $("doneBtn").addEventListener("click", completeActivity);

  $("doneSpinBtn").addEventListener("click", ()=>{ beep("click"); backToSpin(); });
  $("doneCloseBtn").addEventListener("click", ()=>{ beep("click"); backToSpin(); });

  document.querySelectorAll(".chipBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.nextSteer = btn.dataset.next;
      beep("click");
    });
  });

  $("navFilters").addEventListener("click", ()=>{ beep("click"); openSheet(); });
  $("closeSheetBtn").addEventListener("click", ()=>{ beep("click"); closeSheet(); });
  $("sheetBackdrop").addEventListener("click", closeSheet);

  $("navProfile").addEventListener("click", ()=>{ beep("click"); alert("Profile placeholder (next)."); });
  $("profileBtn").addEventListener("click", ()=>{ beep("click"); alert("Profile placeholder (next)."); });
}

/* Init */
async function init(){
  loadPersisted();
  buildSparkles();

  // load vibe + activities
  vibeCopy = await (await fetch("vibe_copy.json", { cache: "no-store" })).json();
  state.activities = await (await fetch("activities_combined_normalized.json", { cache: "no-store" })).json();

  applyFilters();
  updateMicroLine();
  updateSparkLine();
  updateStartCta();
  wireUI();
  initFiltersUI();
  setTone(state.tone);
  renderDots();

  // responsive dot world after layout
  window.addEventListener("resize", ()=>{ renderDots(); });
}

init();
