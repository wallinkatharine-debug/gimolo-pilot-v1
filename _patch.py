from pathlib import Path
import re

script_path=Path('/mnt/data/gimolo_v5/script.js')
css_path=Path('/mnt/data/gimolo_v5/styles.css')
script=script_path.read_text()
css=css_path.read_text()

if 'let wheelRotation' not in script:
    script=script.replace('const state = {','let wheelRotation = 0;\n\nconst state = {',1)

insert_point=script.find('function spinToNext()')
if insert_point!=-1 and 'async function spinSuspense' not in script:
    suspense_snippet="""
function wait(ms){ return new Promise(res=>setTimeout(res, ms)); }

function spinCopy(){
  const base = [
    \"Okay—here we go…\",
    \"Shuffling sparks…\",
    \"Rolling something small and good…\",
    \"One second… choosing your next move…\",
    \"Tiny move incoming…\"
  ];
  const supportive = [
    \"You’ve got this. Let’s pick a good one…\",
    \"Okay—gentle momentum time…\",
    \"Proud of you already. Spinning…\"
  ];
  const grumpy = [
    \"Fine. I’m spinning. Happy now?\",
    \"Hold on. I’m picking. Don’t rush me.\",
    \"Alright, alright… suspense achieved.\"
  ];
  const classic = [\"Let’s see what today brings…\",\"Spinning…\",\"Choosing…\"];
  const pool = state.tone===\"supportive\" ? base+supportive : state.tone===\"grumpy\" ? base+grumpy : base+classic;
  return rand(pool);
}

function whoosh(){
  if(!state.soundOn) return;
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type=\"sine\";
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

  const btn=$(\"spinBtn\");
  btn.disabled=true;
  btn.classList.add(\"isSpinning\");

  $(\"microLine\").textContent = spinCopy();

  const extra = 1080 + Math.floor(Math.random()*900);
  wheelRotation = (wheelRotation + extra) % 360000;

  whoosh();
  const p=centerOf(btn);
  sparkleBurst(p.x,p.y,\"spark\");

  btn.style.transition = \"transform 1.35s cubic-bezier(.16,.8,.12,1), filter 1.35s ease\";
  btn.style.transform = `rotate(${wheelRotation}deg) scale(1.02)`;

  await wait(520);
  if(state.soundOn) beep(\"tick\");
  await wait(900);

  btn.classList.remove(\"isSpinning\");
  btn.disabled=false;
  state.isSpinning=false;

  sparkleBurst(p.x,p.y,\"burst\");
  microHaptic();

  const a=chooseActivity();
  renderActivity(a);
  if(navigate){
    setScreen(\"screenActivity\");
  }
  updateMicro();
}
"""
    script = script[:insert_point] + suspense_snippet + "\n" + script[insert_point:]

# fix spinCopy pool concat (js) - replace base+supportive etc with concat
script = script.replace('const pool = state.tone===\"supportive\" ? base+supportive : state.tone===\"grumpy\" ? base+grumpy : base+classic;',
                        'const pool = state.tone===\"supportive\" ? base.concat(supportive) : state.tone===\"grumpy\" ? base.concat(grumpy) : base.concat(classic);')

# replace handlers
script = re.sub(r'\$\("spinBtn"\)\.addEventListener\("click",\(\)=>\{[\s\S]*?\}\);',
                '$("spinBtn").addEventListener("click",async ()=>{\n    beep("click"); microHaptic();\n    await spinSuspense(true);\n  });', script, count=1)
script = re.sub(r'\$\("spinAgainBtn"\)\.addEventListener\("click",\(\)=>\{[\s\S]*?\}\);',
                '$("spinAgainBtn").addEventListener("click",async ()=>{\n    beep("click"); microHaptic();\n    await spinSuspense(false);\n  });', script, count=1)

script = re.sub(r'\$\("keepBtn"\)\.addEventListener\("click",\(\)=>\{[\s\S]*?\}\);',
                '$("keepBtn").addEventListener("click", async ()=>{\n    beep("click"); microHaptic(); toast("Keeping this energy.");\n    setScreen("screenSpin");\n    await wait(220);\n    await spinSuspense(true);\n  });', script, count=1)
script = re.sub(r'\$\("switchBtn"\)\.addEventListener\("click",\(\)=>\{[\s\S]*?\}\);',
                '$("switchBtn").addEventListener("click", async ()=>{\n    beep("click"); microHaptic();\n    state.tone = state.tone==="classic" ? "supportive" : state.tone==="supportive" ? "grumpy" : "classic";\n    setTone(state.tone);\n    toast("Switching the vibe.");\n    setScreen("screenSpin");\n    await wait(220);\n    await spinSuspense(true);\n  });', script, count=1)
script = re.sub(r'\$\("surpriseBtn"\)\.addEventListener\("click",\(\)=>\{[\s\S]*?\}\);',
                '$("surpriseBtn").addEventListener("click", async ()=>{\n    beep("click"); microHaptic(); toast("Surprise mode.");\n    state.filters.time = rand(["5","10","+10"]);\n    state.filters.effort = rand(["light","medium","high"]);\n    state.filters.location = rand(["indoor","outdoor","either"]);\n    applyFilters();\n    setScreen("screenSpin");\n    await wait(220);\n    await spinSuspense(true);\n  });', script, count=1)

# sparkle canvas
if 'function initSparkles' not in script:
    ins=script.rfind('init();')
    sparkle_snippet="""
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
"""
    script = script[:ins] + sparkle_snippet + "\n" + script[ins:]

# init async + call
script = script.replace('function init(){','async function init(){',1)
if 'initSparkles();' not in script:
    script = script.replace('applyFilters();','applyFilters();\n  initSparkles();',1)

# CSS wheel glow
if '.wheel.isSpinning' not in css:
    m=re.search(r'\.wheel\{[\s\S]*?\}\n', css)
    wheel_extra="""
.wheel.isSpinning{\n  filter: saturate(1.35) brightness(1.08);\n}\n\n.wheel.isSpinning::after{\n  content:"";\n  position:absolute; inset:-10px;\n  border-radius:999px;\n  background: radial-gradient(circle, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%);\n  mix-blend-mode: screen;\n  opacity:0.55;\n  animation: wheelPulse 0.55s ease-in-out infinite;\n  pointer-events:none;\n}\n\n@keyframes wheelPulse{\n  0%,100%{ transform: scale(1.00); opacity:0.35; }\n  50%{ transform: scale(1.03); opacity:0.65; }\n}\n"""
    css = css[:m.end()] + wheel_extra + css[m.end():]

script_path.write_text(script)
css_path.write_text(css)
print('patched')
