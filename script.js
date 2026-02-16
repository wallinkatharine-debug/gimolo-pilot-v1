let wheelRotation = 0;

const state = {
  tone: "supportive",
  soundOn: true,
  filters: { communityOnly:false, time:null, soloOnly:false, effort:null, location:null },
  activities: [],
  filtered: [],
  current: null,
  steer: null,
};

const LS = {
  tone: "gimolo_tone",
  sound: "gimolo_sound",
  filters: "gimolo_filters",
  dots: "gimolo_dots"
};

const $ = (id)=>document.getElementById(id);

function toast(msg,ms=1400){
  const el=$("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("toast--show");
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>el.classList.remove("toast--show"), ms);
}
const safeParse = (s,fallback)=>{ try{return JSON.parse(s)}catch{return fallback} };
const rand = (arr)=>arr[Math.floor(Math.random()*arr.length)];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

let vibe = null;
let audioCtx = null;

function beep(kind="click"){
  if(!state.soundOn) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    const now=audioCtx.currentTime;
    o.type="sine";
    o.frequency.setValueAtTime(kind==="done"?720:560, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.12);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now+0.14);
  }catch(e){}
}


function sparkleBurst(x,y,kind="spark"){
  const layer = document.getElementById("fxLayer");
  if(!layer) return;
  const n = kind==="done" ? 10 : 6;
  const glyphs = kind==="done" ? ["✨","🌟","💫","🎉"] : ["✨","🌟","💫"];
  for(let i=0;i<n;i++){
    const el=document.createElement("div");
    el.className="fxSpark";
    el.textContent=glyphs[i%glyphs.length];
    el.style.left = (x + (Math.random()*26-13)) + "px";
    el.style.top  = (y + (Math.random()*18-9)) + "px";
    el.style.fontSize = (14 + Math.random()*10) + "px";
    el.style.animationDelay = (Math.random()*0.08) + "s";
    layer.appendChild(el);
    el.addEventListener("animationend", ()=>el.remove());
  }
}

function centerOf(el){
  const r=el.getBoundingClientRect();
  return {x:r.left + r.width/2, y:r.top + r.height/2};
}

function microHaptic(){
  try{ if(navigator.vibrate) navigator.vibrate(8); }catch(e){}
}

function loadPersisted(){
  const t=localStorage.getItem(LS.tone); if(t) state.tone=t;
  const s=localStorage.getItem(LS.sound); if(s) state.soundOn=(s==="true");
  const f=localStorage.getItem(LS.filters); if(f) state.filters={...state.filters, ...safeParse(f,{})};
}
function persist(){
  localStorage.setItem(LS.tone, state.tone);
  localStorage.setItem(LS.sound, String(state.soundOn));
  localStorage.setItem(LS.filters, JSON.stringify(state.filters));
}

function setScreen(id){
  ["screenSpin","screenActivity","screenProgress","screenDone","screenProfile"].forEach(s=>{
    $(s).classList.toggle("screen--active", s===id);
  });
}

function setTone(t){
  const prev=state.tone;
  state.tone=t;
  persist();
  if(prev!==t){
    const label = t==="classic" ? "Classic" : (t==="supportive" ? "Supportive" : "Grumpy");
    toast(`Tone: ${label}`);
  }
  document.querySelectorAll(".face").forEach(btn=>{
    const active = btn.dataset.tone===t;
    btn.classList.toggle("face--active", active);
    btn.setAttribute("aria-selected", active?"true":"false");
  });
  updateMicro();
}

function updateMicro(){
  if(!vibe) return;
  $("microLine").textContent = rand(vibe.microLines[state.tone] || vibe.microLines.classic);
}

function updateMatches(){
  const n=state.filtered.length;
  $("matchesLine").textContent = `Matches: ${n}`;
  $("matchesSmall").textContent = `Matches: ${n}`;
}

function applyFilters(){
  const f=state.filters;
  state.filtered = state.activities.filter(a=>{
    if(f.communityOnly && !a.is_civic) return false;
    if(f.time && a.time_bucket!==f.time) return false;
    if(f.soloOnly && !a.supports_solo) return false;
    if(f.effort && a.effort!==f.effort) return false;
    if(f.location && a.location!==f.location && a.location!=="either") return false;
    return true;
  });

  // soft fallback: if location is too restrictive, relax it
  if(state.filtered.length===0 && f.location){
    state.filtered = state.activities.filter(a=>{
      if(f.communityOnly && !a.is_civic) return false;
      if(f.time && a.time_bucket!==f.time) return false;
      if(f.soloOnly && !a.supports_solo) return false;
      if(f.effort && a.effort!==f.effort) return false;
      return true;
    });
  }
  updateMatches();
}


function wait(ms){ return new Promise(res=>setTimeout(res, ms)); }

function spinCopy(){
  const base = [
    "Okay—here we go…",
    "Shuffling sparks…",
    "Rolling something small and good…",
    "One second… choosing your next move…",
    "Tiny move incoming…"
  ];
  const supportive = [
    "You’ve got this. Let’s pick a good one…",
    "Okay—gentle momentum time…",
    "Proud of you already. Spinning…"
  ];
  const grumpy = [
    "Fine. I’m spinning. Happy now?",
    "Hold on. I’m picking. Don’t rush me.",
    "Alright, alright… suspense achieved."
  ];
  const classic = ["Let’s see what today brings…","Spinning…","Choosing…"];
  const pool = state.tone==="supportive" ? base.concat(supportive) : state.tone==="grumpy" ? base.concat(grumpy) : base.concat(classic);
  return rand(pool);
}

function whoosh(){
  if(!state.soundOn) return;
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type="sine";
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(740, now+0.18);
    o.frequency.exponentialRampToValueAtTime(220, now+0.9);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now+0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.95);
    o.connect(g); g.connect(ctx.destination);
    o.start(now); o.stop(now+1.0);
    setTimeout(()=>ctx.close&&ctx.close(), 1200);
  }catch(e){}
}

async function spinSuspense(navigate=true){
  if(state.isSpinning) return;
  state.isSpinning=true;

  const btn=$("spinBtn");
  btn.disabled=true;
  btn.classList.add("isSpinning");

  $("microLine").textContent = spinCopy();

  const extra = 1080 + Math.floor(Math.random()*900);
  wheelRotation = (wheelRotation + extra) % 360000;

  whoosh();
  const p=centerOf(btn);
  sparkleBurst(p.x,p.y,"spark");

  btn.style.transition = "transform 1.35s cubic-bezier(.16,.8,.12,1), filter 1.35s ease";
  btn.style.transform = `rotate(${wheelRotation}deg) scale(1.02)`;

  await wait(520);
  if(state.soundOn) beep("tick");
  await wait(900);

  btn.classList.remove("isSpinning");
  btn.disabled=false;
  state.isSpinning=false;

  sparkleBurst(p.x,p.y,"burst");
  microHaptic();

  const a=chooseActivity();
  renderActivity(a);
  if(navigate){
    setScreen("screenActivity");
  }
  updateMicro();
}

function spinToNext(){
  const a=chooseActivity();
  renderActivity(a);
  setScreen("screenActivity");
  updateMicro();
}

function chooseActivity(){
  let pool = state.filtered.length ? state.filtered : state.activities;

  if(state.steer==="surprise"){
    // true surprise: ignore filters for one pick
    pool = state.activities;
  }

  if(state.steer==="switch"){
    const order=["classic","supportive","grumpy"];
    setTone(order[(order.indexOf(state.tone)+1)%order.length]);
  }else if(state.steer==="surprise"){
    setTone(rand(["classic","supportive","grumpy"]));
  }
  state.steer=null;

  return rand(pool);
}

function renderActivity(a){
  state.current=a;
  $("sparkLine").textContent = rand(vibe.sparkHeaders[state.tone] || vibe.sparkHeaders.classic);
  $("activityTitle").textContent = a.title;
  $("activityDesc").textContent = a.description;

  const pills=[];
  if(a.time_bucket==="5") pills.push("⏱ 0–5 min");
  else if(a.time_bucket==="10") pills.push("⏱ 10 min");
  else pills.push("⏱ +10 min");

  pills.push(a.effort==="light" ? "⚡ Light lift" : a.effort==="med" ? "⚡ Medium" : "⚡ High");
  pills.push(a.location ? `📍 ${cap(a.location)}` : "📍 Either");
  pills.push(a.supports_solo ? "👤 Solo" : "👥 Group");

  const row=$("pillRow"); row.innerHTML="";
  pills.forEach(p=>{
    const el=document.createElement("div");
    el.className="pill";
    el.textContent=p;
    row.appendChild(el);
  });

  $("startBtn").textContent = vibe.ctaStart[state.tone] || "Start →";
}

function cap(s){ return (s||"").slice(0,1).toUpperCase() + (s||"").slice(1); }

function startActivity(){
  beep("click");
  $("progressName").textContent = state.current.title;
  $("progressLine").textContent =
    state.tone==="supportive" ? "See? Tiny counts. Take the easy win." :
    state.tone==="grumpy" ? "Okay. Do it. Then we can both rest." :
    "Nice. Do the move.";

  const t = Number(state.current.time_min || 0);
  const show = t>=5;
  $("timerWrap").style.display = show ? "block" : "none";
  if(show){
    $("barFill").style.width="0%";
    $("barHint").textContent = `Aim for about ${t} min (no pressure).`;
    // lightweight “progress feel” animation
    setTimeout(()=>{ $("barFill").style.width="55%"; }, 180);
    setTimeout(()=>{ $("barFill").style.width="80%"; }, 900);
  }
  setScreen("screenProgress");
}

function doneActivity(){
  beep("done"); microHaptic(); const p=centerOf($("doneBtn")); sparkleBurst(p.x,p.y,"done");
  addDot({civic: !!state.current.is_civic});
  $("doneTitle").textContent = rand(vibe.doneTitle[state.tone] || vibe.doneTitle.classic);
  $("doneSub").textContent = rand(vibe.doneSubtitle[state.tone] || vibe.doneSubtitle.classic);
  setScreen("screenDone");
}

function getDots(){ return safeParse(localStorage.getItem(LS.dots)||"[]",[]); }
function setDots(arr){ localStorage.setItem(LS.dots, JSON.stringify(arr.slice(-140))); }

function addDot({civic=false}={}){
  const dots=getDots();
  dots.push({t:Date.now(), civic});
  setDots(dots);
  renderDots();
  if(document.getElementById("screenProfile").classList.contains("screen--active")) renderProfile();
}

function renderDots(){
  const dots=getDots();
  const countEl=$("dotsCount");
  const box=$("dotWorld");
  if(!countEl || !box) return;
  countEl.textContent = `Total dots: ${dots.length}`;
  box.innerHTML="";

  const W=box.clientWidth || 360;
  const H=box.clientHeight || 78;
  const colors=["#ff5ea8","#ffb84d","#ffe95c","#78ff9e","#4af1ff","#6c78ff","#c25cff"];

  const last = dots.slice(-90);
  last.forEach((d,i)=>{
    const el=document.createElement("div");
    const size = 10 + (i%6)*2;
    const ang = i*0.42;
    const r = 12 + i*2.1;
    const x = W*0.52 + Math.cos(ang)*r;
    const y = H*0.55 + Math.sin(ang)*(r*0.34);
    el.className = "dot" + (d.civic ? " civic" : "");
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${clamp(x, 6, W-6)}px`;
    el.style.top = `${clamp(y, 8, H-8)}px`;
    el.style.background = colors[i%colors.length];
    box.appendChild(el);
  });
}

function computeStreak(dots){
  // streak over last 7 days counting days with at least one dot
  const byDay=new Set();
  dots.forEach(d=>{
    const dt=new Date(d.t);
    const key=dt.getFullYear()+"-"+dt.getMonth()+"-"+dt.getDate();
    byDay.add(key);
  });
  let streak=0;
  for(let i=0;i<7;i++){
    const dt=new Date(); dt.setDate(dt.getDate()-i);
    const key=dt.getFullYear()+"-"+dt.getMonth()+"-"+dt.getDate();
    if(byDay.has(key)) streak++;
    else break;
  }
  return streak;
}

function renderProfile(){
  const dots=getDots();
  const civicCount=dots.filter(d=>d.civic).length;
  $("statDots").textContent = dots.length;
  $("statCivic").textContent = civicCount;
  $("statStreak").textContent = computeStreak(dots);

  const list=$("recentDots");
  list.innerHTML="";
  const recent=dots.slice(-8).reverse();
  if(recent.length===0){
    const empty=document.createElement("div");
    empty.className="muted";
    empty.textContent="No dots yet. Spin once — you’ll get your first spark.";
    list.appendChild(empty);
  }else{
    recent.forEach(d=>{
      const row=document.createElement("div");
      row.className="recentItem";
      const left=document.createElement("div");
      left.textContent = new Date(d.t).toLocaleString([], {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
      const badge=document.createElement("div");
      badge.className="badge" + (d.civic ? " civic" : "");
      badge.textContent = d.civic ? "Community" : "Personal";
      row.appendChild(left); row.appendChild(badge);
      list.appendChild(row);
    });
  }

  // mini sound toggle mirrors top toggle
  $("soundMini").setAttribute("aria-pressed", state.soundOn ? "true":"false");
  document.querySelectorAll(".tonePill").forEach(b=>{
    b.classList.toggle("active", b.dataset.tone===state.tone);
  });
}

function openProfile(){
  renderProfile();
  setScreen("screenProfile");
}



function openSheet(){
  $("backdrop").hidden=false;
  $("sheet").classList.add("open");
  $("sheet").setAttribute("aria-hidden","false");
}
function closeSheet(){
  $("backdrop").hidden=true;
  $("sheet").classList.remove("open");
  $("sheet").setAttribute("aria-hidden","true");
}

function refreshSegUI(){
  document.querySelectorAll(".segBtn").forEach(btn=>{
    const t=btn.dataset.time, e=btn.dataset.effort, l=btn.dataset.loc;
    let active=false;
    if(t!==undefined) active=(state.filters.time===t);
    if(e!==undefined) active=(state.filters.effort===e);
    if(l!==undefined) active=(state.filters.location===l);
    btn.classList.toggle("active", active);
  });
  $("communityOnly").checked=!!state.filters.communityOnly;
  $("soloOnly").checked=!!state.filters.soloOnly;
}

function wireSheet(){
  $("communityOnly").addEventListener("change",(e)=>{state.filters.communityOnly=e.target.checked; persist(); applyFilters();
  initSparkles();});
  $("soloOnly").addEventListener("change",(e)=>{state.filters.soloOnly=e.target.checked; persist(); applyFilters();});

  document.querySelectorAll(".segBtn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const t=btn.dataset.time, e=btn.dataset.effort, l=btn.dataset.loc;
      if(t!==undefined) state.filters.time = (state.filters.time===t)?null:t;
      if(e!==undefined) state.filters.effort = (state.filters.effort===e)?null:e;
      if(l!==undefined) state.filters.location = (state.filters.location===l)?null:l;
      refreshSegUI(); persist(); applyFilters();
    });
  });

  refreshSegUI();
  $("applyBtn").addEventListener("click",()=>{beep("click"); closeSheet();});
  $("closeSheetBtn").addEventListener("click",()=>{beep("click"); closeSheet();});
  $("backdrop").addEventListener("click", closeSheet);
}

function wireNav(){
  ["navFilters","navFilters2","navFilters3","navFilters4","navFilters5"].forEach(id=> $(id).addEventListener("click",()=>{beep("click"); openSheet();}));
  ["navSpin","navSpin2","navSpin3","navSpin4","navSpin5"].forEach(id=> $(id).addEventListener("click",()=>{beep("click"); setScreen("screenSpin"); updateMicro();}));
  ["navProfile","navProfile2","navProfile3","navProfile4","navProfile5","profileBtn"].forEach(id=> $(id).addEventListener("click",()=>{beep("click"); openProfile();}));
}

function wireMain(){
  const sb=$("soundBtn");
  sb.setAttribute("aria-pressed", state.soundOn ? "true":"false");
  sb.addEventListener("click",()=>{
    state.soundOn=!state.soundOn;
    sb.setAttribute("aria-pressed", state.soundOn ? "true":"false");
    persist(); beep("click");
  });

  document.querySelectorAll(".face").forEach(btn=>{
    btn.addEventListener("click",()=>{ beep("click"); microHaptic(); const p=centerOf(btn); sparkleBurst(p.x,p.y,"spark"); setTone(btn.dataset.tone); });
  });

  $("spinBtn").addEventListener("click",async ()=>{
    beep("click"); microHaptic();
    await spinSuspense(true);
  });

  $("spinAgainBtn").addEventListener("click",async ()=>{
    beep("click"); microHaptic();
    await spinSuspense(false);
  });

  $("backBtn").addEventListener("click",()=>{beep("click"); setScreen("screenSpin"); updateMicro();});
  $("startBtn").addEventListener("click",(e)=>{const p=centerOf(e.currentTarget); sparkleBurst(p.x,p.y,"spark"); microHaptic(); startActivity();});

  $("doneBtn").addEventListener("click", doneActivity);
  $("progressBackBtn").addEventListener("click",()=>{beep("click"); setScreen("screenSpin"); updateMicro();});

  $("doneSpinBtn").addEventListener("click",()=>{beep("click"); setScreen("screenSpin"); updateMicro();});

  $("profileBackBtn").addEventListener("click",()=>{beep("click"); setScreen("screenSpin"); updateMicro();});

  $("keepBtn").addEventListener("click", async ()=>{
    beep("click"); microHaptic(); toast("Keeping this energy.");
    setScreen("screenSpin");
    await wait(220);
    await spinSuspense(true);
  });
  $("switchBtn").addEventListener("click", async ()=>{
    beep("click"); microHaptic();
    state.tone = state.tone==="classic" ? "supportive" : state.tone==="supportive" ? "grumpy" : "classic";
    setTone(state.tone);
    toast("Switching the vibe.");
    setScreen("screenSpin");
    await wait(220);
    await spinSuspense(true);
  });
  $("surpriseBtn").addEventListener("click", async ()=>{
    beep("click"); microHaptic(); toast("Surprise mode.");
    state.filters.time = rand(["5","10","+10"]);
    state.filters.effort = rand(["light","medium","high"]);
    state.filters.location = rand(["indoor","outdoor","either"]);
    applyFilters();
    setScreen("screenSpin");
    await wait(220);
    await spinSuspense(true);
  });

const sm=$("soundMini");
sm.addEventListener("click",()=>{
  state.soundOn=!state.soundOn;
  sm.setAttribute("aria-pressed", state.soundOn ? "true":"false");
  sb.setAttribute("aria-pressed", state.soundOn ? "true":"false");
  persist(); beep("click"); microHaptic();
});

document.querySelectorAll(".tonePill").forEach(b=>{
  b.addEventListener("click",()=>{
    beep("click"); microHaptic();
    setTone(b.dataset.tone);
    renderProfile();
  });
});

}

async function init(){
  loadPersisted();
  vibe = await (await fetch("vibe_copy.json", {cache:"no-store"})).json();
  state.activities = await (await fetch("activities_combined_normalized.json", {cache:"no-store"})).json();

  // normalize a few keys if you swap in a different generator later
  state.activities = state.activities.map(a=>({
    ...a,
    time_bucket: String(a.time_bucket),
    effort: a.effort || "light",
    location: a.location || "either",
    supports_solo: ("supports_solo" in a) ? !!a.supports_solo : true,
    is_civic: ("is_civic" in a) ? !!a.is_civic : false
  }));

  setTone(state.tone);
  applyFilters();
  renderDots();

  wireSheet();
  wireNav();
  wireMain();
}

function initSparkles(){
  const c = document.getElementById("sparkles");
  if(!c) return;
  const ctx = c.getContext("2d");
  let w=0,h=0;
  function resize(){
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const count = 80;
  const stars = Array.from({length:count}, ()=>({
    x: Math.random()*w,
    y: Math.random()*h,
    r: 0.6 + Math.random()*1.8,
    a: 0.10 + Math.random()*0.35,
    s: 0.10 + Math.random()*0.35,
    tw: 0.004 + Math.random()*0.01
  }));

  let t=0;
  function frame(){
    t+=1;
    ctx.clearRect(0,0,w,h);

    for(const st of stars){
      st.y += st.s;
      if(st.y > h+10){ st.y=-10; st.x=Math.random()*w; }
      const tw = Math.sin((t*st.tw) + st.x*0.01) * 0.08;
      const alpha = Math.max(0, st.a + tw);

      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();

      if(alpha>0.33){
        ctx.strokeStyle = `rgba(255,255,255,${alpha*0.7})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(st.x-st.r*2.2, st.y);
        ctx.lineTo(st.x+st.r*2.2, st.y);
        ctx.moveTo(st.x, st.y-st.r*2.2);
        ctx.lineTo(st.x, st.y+st.r*2.2);
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init();
