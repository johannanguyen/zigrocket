import { useEffect, useRef, useState } from "react";
import { AdMob, AdMobRewardItem, RewardAdPluginEvents } from "@capacitor-community/admob";

// ─────────────────────────────────────────────────────────────────────────────
// AD CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const AD_REWARDED_ID = "ca-app-pub-9841742295978516/5946233570"; // ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX

async function initAdMob() {
  try {
    await AdMob.initialize({ requestTrackingAuthorization: true });
  } catch(e) { console.warn("AdMob init:", e); }
}

async function prepareRewarded() {
  try {
    await AdMob.prepareRewardVideoAd({
      adId: AD_REWARDED_ID,
      isTesting: false,
    });
    return true;
  } catch(e) { console.warn("AdMob prepare:", e); return false; }
}

async function showRewarded() {
  try {
    await AdMob.showRewardVideoAd();
    return true;
  } catch(e) { console.warn("AdMob show:", e); return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPRITE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const OBSTACLE_SPRITES = [
  { key: "alien",         src: "/assets/alien1.png",        w: 52, h: 44 },
  { key: "asteroid1",    src: "/assets/asteroid1.png",     w: 46, h: 40 },
  { key: "asteroid2",    src: "/assets/asteroid2.png",     w: 50, h: 44 },
  { key: "asteroid3",    src: "/assets/asteroid3.png",     w: 44, h: 38 },
  { key: "asteroid4",    src: "/assets/asteroid4.png",     w: 46, h: 40 },
  { key: "barrel1",      src: "/assets/barrel1.png",       w: 36, h: 44 },
  { key: "barrel2",      src: "/assets/barrel2.png",       w: 36, h: 44 },
  { key: "cloud",        src: "/assets/cloud1.png",        w: 56, h: 44 },
  { key: "comet1",       src: "/assets/comet1.png",        w: 52, h: 44 },
  { key: "comet2",       src: "/assets/comet2.png",        w: 52, h: 44 },
  { key: "crystal1",     src: "/assets/crystal1.png",      w: 30, h: 44 },
  { key: "crystal2",     src: "/assets/crystal2.png",      w: 34, h: 50 },
  { key: "crystal3",     src: "/assets/crystal3.png",      w: 30, h: 44 },
  { key: "debris1",      src: "/assets/debris1.png",       w: 52, h: 36 },
  { key: "debris2",      src: "/assets/debris2.png",       w: 52, h: 40 },
  { key: "debris3",      src: "/assets/debris3.png",       w: 44, h: 34 },
  { key: "debris4",      src: "/assets/debris4.png",       w: 48, h: 36 },
  { key: "shootingstar1",src: "/assets/shootingstar1.png", w: 60, h: 32 },
  { key: "shootingstar2",src: "/assets/shootingstar2.png", w: 60, h: 32 },
];

function preloadImages(onDone) {
  const result = {};
  const all = [
    { key: "rocket", src: "/assets/rocketship.png" },
    ...OBSTACLE_SPRITES.map(o => ({ key: o.key, src: o.src })),
  ];
  let remaining = all.length;
  for (const { key, src } of all) {
    const img = new Image();
    img.onload  = () => { result[key] = img; if (--remaining === 0) onDone(result); };
    img.onerror = () => {                     if (--remaining === 0) onDone(result); };
    img.src = src;
  }
}

function makeStars(W, H) {
  return Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() * 2.5 + 0.5,
    speed: Math.random() * 0.7 + 0.3,
    opacity: Math.random() * 0.5 + 0.5,
    twinkleOffset: Math.random() * Math.PI * 2,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ZigRocket() {
  const canvasRef = useRef(null);

  // dims tracked in a ref so the game loop always sees current values
  const dimsRef = useRef({ W: window.innerWidth, H: window.innerHeight });
  const [dims, setDims] = useState({ W: window.innerWidth, H: window.innerHeight });

  const [screen,       setScreen]       = useState("loading");
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLevel, setDisplayLevel] = useState(1);
  const [displayHigh,  setDisplayHigh]  = useState(0);
  const [showLevelUp,  setShowLevelUp]  = useState(false);
  const [levelUpMsg,   setLevelUpMsg]   = useState("");
  const [adLoaded,     setAdLoaded]     = useState(false);
  const [countdown,    setCountdown]    = useState(5);
  const [adPlaying,    setAdPlaying]    = useState(false);
  const countdownRef  = useRef(null);
  const rewardEarned  = useRef(false);

  const G      = useRef(null);
  const rafRef = useRef(null);
  const imgs   = useRef({});
  const gamesPlayed   = useRef(0);
  const AD_EVERY_N    = 2;

  // ── resize handler ────────────────────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      const dpr = window.devicePixelRatio || 1;
      const W = window.innerWidth, H = window.innerHeight;
      dimsRef.current = { W, H, dpr };
      setDims({ W, H });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + "px";
        canvas.style.height = H + "px";
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── AdMob ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    initAdMob().then(() => prepareRewarded().then(ok => setAdLoaded(ok)));

    const subRewarded = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewardEarned.current = true;
    });
    const subClosed = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      setAdPlaying(false);
      // iOS takes over audio session during ads — force recreate the context
      setTimeout(() => {
        try {
          if (audioCtx.current) {
            audioCtx.current.close();
            audioCtx.current = null;
          }
          audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
          audioCtx.current.resume();
        } catch(e) { console.warn("Audio resume failed:", e); }
      }, 500);
      if (rewardEarned.current) {
        rewardEarned.current = false;
        doRevive();
      } else {
        setScreen("gameover");
      }
      prepareRewarded().then(ok => setAdLoaded(ok));
    });
    const subFailed = AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (err) => {
      console.warn("AdMob failed to load:", err);
      setAdLoaded(false);
    });
    const subLoaded = AdMob.addListener(RewardAdPluginEvents.Loaded, () => setAdLoaded(true));

    return () => {
      subRewarded.then(s => s.remove());
      subClosed.then(s => s.remove());
      subFailed.then(s => s.remove());
      subLoaded.then(s => s.remove());
    };
  }, []);

  // ── Web Audio ─────────────────────────────────────────────────────────────
  const audioCtx = useRef(null);
  function getAudio() {
    if (!audioCtx.current)
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.current.state === "suspended") audioCtx.current.resume();
    return audioCtx.current;
  }
  function soundDodge() {
    try {
      const ac = getAudio(), osc = ac.createOscillator(), g = ac.createGain();
      osc.connect(g); g.connect(ac.destination); osc.type = "sine";
      const t = ac.currentTime;
      osc.frequency.setValueAtTime(520, t); osc.frequency.linearRampToValueAtTime(780, t+.08);
      g.gain.setValueAtTime(.18,t); g.gain.exponentialRampToValueAtTime(.001,t+.12);
      osc.start(t); osc.stop(t+.12);
    } catch {}
  }
  function soundLevelUp() {
    try {
      const ac = getAudio(), now = ac.currentTime;
      for (const [freq,t,dur] of [[523,0,.12],[659,.1,.12],[784,.2,.20],[1047,.32,.28]]) {
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.connect(g); g.connect(ac.destination); osc.type = "triangle";
        osc.frequency.setValueAtTime(freq,now+t);
        g.gain.setValueAtTime(.22,now+t); g.gain.exponentialRampToValueAtTime(.001,now+t+dur);
        osc.start(now+t); osc.stop(now+t+dur);
      }
    } catch {}
  }
  function soundExplosion() {
    try {
      const ac = getAudio(), now = ac.currentTime;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.connect(g); g.connect(ac.destination); osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120,now); osc.frequency.exponentialRampToValueAtTime(30,now+.4);
      g.gain.setValueAtTime(.5,now); g.gain.exponentialRampToValueAtTime(.001,now+.4);
      osc.start(now); osc.stop(now+.4);
      const buf = ac.createBuffer(1,ac.sampleRate*.3,ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*.6;
      const src = ac.createBufferSource(); src.buffer = buf;
      const ng = ac.createGain(); src.connect(ng); ng.connect(ac.destination);
      ng.gain.setValueAtTime(.4,now); ng.gain.exponentialRampToValueAtTime(.001,now+.3);
      src.start(now); src.stop(now+.3);
    } catch {}
  }
  function soundLaunch() {
    try {
      const ac = getAudio(), now = ac.currentTime;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.connect(g); g.connect(ac.destination); osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200,now); osc.frequency.linearRampToValueAtTime(600,now+.15);
      g.gain.setValueAtTime(.2,now); g.gain.exponentialRampToValueAtTime(.001,now+.2);
      osc.start(now); osc.stop(now+.2);
    } catch {}
  }

  // ── preload ───────────────────────────────────────────────────────────────
  useEffect(() => {
          const dpr = window.devicePixelRatio || 1;
      const W = window.innerWidth, H = window.innerHeight;
      dimsRef.current = { W, H, dpr };
      setDims({ W, H });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + "px";
        canvas.style.height = H + "px";
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
      }
      preloadImages(loaded => {
      imgs.current = loaded;
      const { W, H } = dimsRef.current;
      G.current = { stars: makeStars(W, H), highScore: parseInt(localStorage.getItem("zigrocket_hs") ?? "0", 10) };
      setDisplayHigh(G.current.highScore);
        setScreen("menu");
      });
    }, []);

  // ── game init ─────────────────────────────────────────────────────────────
  function initGame() {
    const { W, H } = dimsRef.current;
    const RW = W * 0.1, RH = RW * (321/213); // rocket sized relative to screen
    G.current = {
      rocket: { x: W/2 - RW/2, y: H - RH - H*0.1 },
      RW, RH,
      obstacles: [],
      stars: makeStars(W, H),
      keys: {}, touch: null,
      score: 0, level: 1,
      rocketSpeed: W * 0.012,
      spawnTimer: 0, obstacleId: 0,
      highScore: G.current?.highScore ?? 0,
      running: true, exploding: false,
      explosionFrame: 0, explosionX: 0, explosionY: 0,
    };
  }

  // ── draw helpers ──────────────────────────────────────────────────────────
  function drawBackground(ctx, W, H) {
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#0a0015"); bg.addColorStop(.3,"#0d0530");
    bg.addColorStop(.6,"#0a0a2e"); bg.addColorStop(.85,"#110038");
    bg.addColorStop(1,"#1a0050");
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    const t = Date.now()/8000;
    for (const [nx,ny,nr,nc] of [
      [W*.12,H*.15,W*.30,"rgba(100,60,220,0.35)"],
      [W*.83,H*.31,W*.25,"rgba(40,80,200,0.28)"],
      [W*.50,H*.55,W*.32,"rgba(120,40,200,0.30)"],
      [W*.17,H*.80,W*.22,"rgba(80,20,180,0.25)"],
      [W*.79,H*.87,W*.20,"rgba(60,100,220,0.25)"],
      [W*.40,H*.25,W*.18,"rgba(180,80,255,0.20)"],
    ]) {
      const gr = ctx.createRadialGradient(
        nx+Math.sin(t+nx)*12, ny+Math.cos(t+ny*.01)*10, 0, nx, ny, nr
      );
      gr.addColorStop(0,nc); gr.addColorStop(1,"transparent");
      ctx.fillStyle = gr; ctx.fillRect(0,0,W,H);
    }
  }

  function drawStars(ctx, stars) {
    const now = Date.now()/1000;
    for (const s of stars) {
      const tw = .4 + .6*Math.sin(now*2.5+s.twinkleOffset);
      ctx.beginPath(); ctx.arc(s.x,s.y,s.size,0,Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${(s.opacity*tw).toFixed(2)})`; ctx.fill();
    }
  }

  // ── game loop ─────────────────────────────────────────────────────────────
  function startLoop() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function loop() {
      const g = G.current;
      if (!g) return;
      const { W, H } = dimsRef.current;
      const { RW, RH } = g;
      // scale obstacle sprites relative to screen width
      const scale = W / 480;

      if (g.running && !g.exploding) {
        const spd = g.rocketSpeed;
        if (g.keys["ArrowLeft"]  || g.keys["a"]) g.rocket.x -= spd;
        if (g.keys["ArrowRight"] || g.keys["d"]) g.rocket.x += spd;
        if (g.keys["ArrowUp"]    || g.keys["w"]) g.rocket.y -= spd;
        if (g.keys["ArrowDown"]  || g.keys["s"]) g.rocket.y += spd;
        if (g.touch) {
          g.rocket.x = g.touch.rocketStartX + (g.touch.currentX - g.touch.startX);
          g.rocket.y = g.touch.rocketStartY + (g.touch.currentY - g.touch.startY);
        }
        g.rocket.x = Math.max(0, Math.min(W-RW, g.rocket.x));
        g.rocket.y = Math.max(0, Math.min(H-RH, g.rocket.y));

        for (const s of g.stars) {
          s.y += s.speed;
          if (s.y > H) { s.y = -4; s.x = Math.random()*W; }
        }

        g.spawnTimer++;
        const spawnRate = Math.max(12, 52 - g.level*6);
        if (g.spawnTimer >= spawnRate) {
          g.spawnTimer = 0;
          const sp = OBSTACLE_SPRITES[Math.floor(Math.random()*OBSTACLE_SPRITES.length)];
          const ow = sp.w*scale, oh = sp.h*scale;
          g.obstacles.push({
            id: g.obstacleId++, key: sp.key, w: ow, h: oh,
            x: Math.random()*(W-ow-20)+10, y: -oh-10,
            speed: (2+Math.random()*2+g.level*.9)*scale,
            rot: 0,
            rotSpeed: sp.key.startsWith("asteroid")
              ? (Math.random()-.5)*.06 : (Math.random()-.5)*.02,
          });
        }

        const survived = [];
        let scored = 0;
        for (const o of g.obstacles) {
          o.y += o.speed; o.rot += o.rotSpeed;
          if (o.y > H+o.h) { scored++; soundDodge(); continue; }
          const rx = g.rocket.x+RW/2, ry = g.rocket.y+RH/2;
          const ox = o.x+o.w/2,       oy = o.y+o.h/2;
          if (Math.hypot(rx-ox,ry-oy) < RW*.38+o.w*.35) {
            g.exploding = true; soundExplosion();
            g.explosionFrame = 0; g.explosionX = g.rocket.x; g.explosionY = g.rocket.y;
            continue;
          }
          survived.push(o);
        }
        g.obstacles = survived;

        if (scored > 0) {
          g.score += scored;
          setDisplayScore(g.score);
          const newLevel = Math.floor(g.score/10)+1; // level up every 10 dodges
          if (newLevel > g.level) {
            g.level = newLevel; g.rocketSpeed = W*.012+(newLevel-1)*W*.0015;
            setDisplayLevel(newLevel);
            setLevelUpMsg(`⭐ LEVEL ${newLevel}! ⭐`);
            setShowLevelUp(true); soundLevelUp();
            setTimeout(()=>setShowLevelUp(false),1500);
          }
        }
      }

      if (g.exploding) {
        g.explosionFrame++;
        if (g.explosionFrame > 16) {
          g.running = false; g.exploding = false;
          if (g.score > g.highScore) {
            g.highScore = g.score; localStorage.setItem("zigrocket_hs", g.highScore);
          }
          setDisplayHigh(g.highScore);
          setCountdown(5);
          setScreen("continue");
          return;
        }
      }

      // ── draw ──────────────────────────────────────────────────────────────
      drawBackground(ctx, W, H);
      drawStars(ctx, g.stars);

      for (const o of g.obstacles) {
        const img = imgs.current[o.key];
        ctx.save();
        ctx.translate(o.x+o.w/2, o.y+o.h/2); ctx.rotate(o.rot);
        if (img) ctx.drawImage(img,-o.w/2,-o.h/2,o.w,o.h);
        else { ctx.fillStyle="rgba(255,100,100,0.6)"; ctx.fillRect(-o.w/2,-o.h/2,o.w,o.h); }
        ctx.restore();
      }

      if (!g.exploding) {
        const rImg = imgs.current["rocket"];
        ctx.save();
        ctx.translate(g.rocket.x+RW/2, g.rocket.y+RH/2);
        if (rImg) ctx.drawImage(rImg,-RW/2,-RH/2,RW,RH);
        else {
          ctx.font=`${RW*.7}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.rotate(-Math.PI/2); ctx.fillText("🚀",0,0);
        }
        ctx.restore();
      }

      if (g.exploding) {
        const ef = g.explosionFrame, alpha = Math.max(0,1-ef*.06);
        const sz = RW*1.2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(g.explosionX+RW/2, g.explosionY+RH/2);
        ctx.scale(.4+ef*.1,.4+ef*.1);
        for (let i=0;i<10;i++) {
          const angle=(i/10)*Math.PI*2, len=sz*.4+(i%3)*sz*.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle)*sz*.12,Math.sin(angle)*sz*.12);
          ctx.lineTo(Math.cos(angle)*len,Math.sin(angle)*len);
          ctx.strokeStyle=["#ff9f0a","#ff3b30","#ffe033","#ff6eb4","#a78bfa"][i%5];
          ctx.lineWidth=3; ctx.lineCap="round"; ctx.stroke();
        }
        const glow=ctx.createRadialGradient(0,0,0,0,0,sz*.4+ef*sz*.04);
        glow.addColorStop(0,"rgba(255,224,51,0.9)"); glow.addColorStop(1,"rgba(255,59,48,0)");
        ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,sz*.4+ef*sz*.04,0,Math.PI*2); ctx.fill();
        ctx.font=`${sz*.5}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.globalAlpha=alpha; ctx.fillText("💥",0,0);
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  // ── idle background loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (screen==="playing"||screen==="loading") return;
    const { W, H } = dimsRef.current;
    if (!G.current) G.current = { stars: makeStars(W,H), highScore: parseInt(localStorage.getItem("zigrocket_hs")??"0",10) };
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    function bgLoop() {
      const { W, H } = dimsRef.current;
      for (const s of G.current.stars) {
        s.y += s.speed*.4;
        if (s.y>H) { s.y=-4; s.x=Math.random()*W; }
      }
      drawBackground(ctx,W,H); drawStars(ctx,G.current.stars);
      rafRef.current = requestAnimationFrame(bgLoop);
    }
    rafRef.current = requestAnimationFrame(bgLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  // ── keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = e => {
      if (G.current) G.current.keys[e.key]=true;
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
    };
    const up = e => { if (G.current) G.current.keys[e.key]=false; };
    window.addEventListener("keydown",down); window.addEventListener("keyup",up);
    return () => { window.removeEventListener("keydown",down); window.removeEventListener("keyup",up); };
  }, []);

  // ── touch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function pos(touch) {
      return { x: touch.clientX, y: touch.clientY };
    }
    function onStart(e) {
      e.preventDefault();
      const g = G.current; if (!g?.running) return;
      const p = pos(e.touches[0]);
      g.touch = { id:e.touches[0].identifier, startX:p.x, startY:p.y, currentX:p.x, currentY:p.y, rocketStartX:g.rocket.x, rocketStartY:g.rocket.y };
    }
    function onMove(e) {
      e.preventDefault();
      const g = G.current; if (!g?.touch) return;
      for (const t of e.changedTouches) {
        if (t.identifier===g.touch.id) { const p=pos(t); g.touch.currentX=p.x; g.touch.currentY=p.y; }
      }
    }
    function onEnd(e) {
      e.preventDefault();
      const g = G.current; if (!g) return;
      for (const t of e.changedTouches) {
        if (g.touch&&t.identifier===g.touch.id) g.touch=null;
      }
    }
    canvas.addEventListener("touchstart",  onStart,{passive:false});
    canvas.addEventListener("touchmove",   onMove, {passive:false});
    canvas.addEventListener("touchend",    onEnd,  {passive:false});
    canvas.addEventListener("touchcancel", onEnd,  {passive:false});
    return () => {
      canvas.removeEventListener("touchstart",  onStart);
      canvas.removeEventListener("touchmove",   onMove);
      canvas.removeEventListener("touchend",    onEnd);
      canvas.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  // ── start ─────────────────────────────────────────────────────────────────
  // ── revive helper ─────────────────────────────────────────────────────────
  function doRevive() {
    const g = G.current;
    const { W, H } = dimsRef.current;
    g.rocket = { x: W/2 - g.RW/2, y: H - g.RH - H*0.1 };
    g.obstacles = [];
    g.running = true;
    g.exploding = false;
    setScreen("playing");
    soundLaunch();
    setTimeout(startLoop, 30);
  }

  // ── continue countdown — auto-plays ad at 0 ───────────────────────────────
  useEffect(() => {
    if (screen !== "continue") {
      clearInterval(countdownRef.current);
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          // auto-play the rewarded ad
          if (adLoaded) {
            setAdPlaying(true);
            rewardEarned.current = false;
            showRewarded(); // result handled in RewardAdPluginEvents listeners
          } else {
            setScreen("gameover"); // no ad available, go straight to game over
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [screen, adLoaded]);

  function handleStart() {
    cancelAnimationFrame(rafRef.current);
    initGame();
    setDisplayScore(0); setDisplayLevel(1); setShowLevelUp(false);
    setScreen("playing");
    soundLaunch(); setTimeout(startLoop,30);
  }

  function handleEndGame() {
    clearInterval(countdownRef.current);
    setScreen("gameover");
  }

  const { W, H } = dims;
  const hudSize = Math.max(12, W * 0.03);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width:"100vw", height:"100vh", overflow:"hidden",
      background:"#0a0015", fontFamily:"'Trebuchet MS', cursive",
      position:"relative", touchAction:"none",
    }}>
      <canvas ref={canvasRef} width={W} height={H} style={{
        position:"absolute", inset:0, width:"100%", height:"100%", display:"block",
        touchAction:"none",
      }} />

      {/* HUD */}
      {screen==="playing" && (
        <div style={{
          position:"absolute", top:"8%", left:"3%", right:"3%",
          display:"flex", justifyContent:"space-between", alignItems:"flex-start",
          pointerEvents:"none",
        }}>
          <Pill size={hudSize}>⭐ {displayScore}</Pill>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <Pill size={hudSize}>LVL {displayLevel}</Pill>
            <div style={{
              background:"rgba(0,0,0,0.45)", backdropFilter:"blur(8px)",
              border:"1px solid rgba(253,230,138,0.25)", borderRadius:20,
              padding:`4px ${hudSize*.8}px`, fontSize:hudSize*.85,
              fontWeight:700, color:"#fde68a", opacity:.75, whiteSpace:"nowrap",
            }}>🏆 {displayHigh}</div>
          </div>
        </div>
      )}

      {/* Level up */}
      {showLevelUp && (
        <div style={{
          position:"absolute", top:"18%", left:"50%", transform:"translateX(-50%)",
          background:"linear-gradient(135deg,#fde68a,#fca5a5,#c4b5fd)",
          padding:`${hudSize*.6}px ${hudSize*1.8}px`, borderRadius:50,
          fontSize:hudSize*1.4, fontWeight:900, color:"#1a1a2e",
          boxShadow:"0 0 28px #fde68a88", whiteSpace:"nowrap",
          animation:"popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)", pointerEvents:"none",
        }}>{levelUpMsg}</div>
      )}

      {/* Title */}
      {(screen==="menu"||screen==="gameover") && (
        <div style={{
          position:"absolute", top:"3%", left:0, right:0, textAlign:"center",
          fontSize:W*.055, fontWeight:900, letterSpacing:3,
          background:"linear-gradient(135deg,#ff6eb4,#a78bfa,#60a5fa)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          filter:"drop-shadow(0 0 18px #a78bfa88)",
        }}>🚀 ZIGROCKET 🚀</div>
      )}

      {/* Menu */}
      {screen==="menu" && (
        <Overlay>
          <img src="/assets/rocketship.png" alt="rocket" style={{
            width:W*.22, height:W*.22, objectFit:"contain", marginBottom:W*.04,
            filter:"drop-shadow(0 0 18px #ff6eb4aa) drop-shadow(0 0 36px #a78bfa66)",
            animation:"rocketBob 2s ease-in-out infinite",
          }} />
          <div style={{fontSize:W*.055,fontWeight:900,color:"#fde68a",marginBottom:W*.015}}>ZIGROCKET</div>
          <div style={{fontSize:W*.03,color:"#c4b5fd",marginBottom:W*.07,opacity:.85}}>dodge obstacles · survive space</div>
          <Btn onClick={handleStart} size={W}>🚀 LAUNCH!</Btn>
        </Overlay>
      )}

      {/* Continue? */}
      {screen==="continue" && (
        <Overlay>
          <div style={{fontSize:W*.12,marginBottom:W*.01}}>💥</div>
          <div style={{fontSize:W*.055,fontWeight:900,color:"#fca5a5",marginBottom:W*.01}}>YOU GOT HIT!</div>
          <div style={{fontSize:W*.035,color:"#fde68a",fontWeight:700,marginBottom:W*.04}}>
            Score: {displayScore}
          </div>

          {/* Countdown ring */}
          <div style={{
            position:"relative", width:W*.18, height:W*.18,
            marginBottom:W*.04, display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width={W*.18} height={W*.18} style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
              <circle cx={W*.09} cy={W*.09} r={W*.08}
                fill="none" stroke="rgba(167,139,250,0.2)" strokeWidth={W*.012} />
              <circle cx={W*.09} cy={W*.09} r={W*.08}
                fill="none" stroke="#a78bfa" strokeWidth={W*.012}
                strokeDasharray={2*Math.PI*W*.08}
                strokeDashoffset={2*Math.PI*W*.08*(1-countdown/5)}
                strokeLinecap="round"
                style={{transition:"stroke-dashoffset 0.9s linear"}}
              />
            </svg>
            <div style={{fontSize:W*.07,fontWeight:900,color:"#fde68a"}}>{countdown}</div>
          </div>

          <div style={{
            background:"rgba(255,255,255,0.06)", borderRadius:16,
            padding:`${W*.03}px ${W*.07}px`, marginBottom:W*.04, textAlign:"center",
          }}>
            <div style={{fontSize:W*.028,color:"#c4b5fd",marginBottom:W*.01}}>
              Watch a short ad to continue!
            </div>
            <div style={{fontSize:W*.022,color:"rgba(255,255,255,0.4)"}}>
              {adLoaded ? "Ad plays when timer ends" : "No ad available"}
            </div>
          </div>

          <button onClick={handleEndGame} style={{
            background:"transparent", border:"1px solid rgba(255,255,255,0.2)",
            borderRadius:50, padding:`${W*.015}px ${W*.05}px`,
            fontSize:W*.028, color:"rgba(255,255,255,0.5)", cursor:"pointer",
          }}>
            End Game
          </button>
        </Overlay>
      )}

      {/* Game over */}
      {screen==="gameover" && (
        <Overlay>
          <div style={{fontSize:W*.12,marginBottom:W*.01}}>💥</div>
          <div style={{fontSize:W*.055,fontWeight:900,color:"#fca5a5",marginBottom:W*.015}}>YOU GOT HIT!</div>
          <div style={{
            background:"rgba(255,255,255,0.06)", borderRadius:16,
            padding:`${W*.035}px ${W*.09}px`, marginBottom:W*.05, textAlign:"center",
          }}>
            <div style={{fontSize:W*.03,color:"#c4b5fd",marginBottom:W*.008}}>SCORE</div>
            <div style={{fontSize:W*.11,fontWeight:900,color:"#fde68a"}}>{displayScore}</div>
            {displayScore>0&&displayScore>=displayHigh
              ? <div style={{fontSize:W*.028,color:"#6ee7b7",marginTop:W*.01}}>✨ new high score!</div>
              : <div style={{fontSize:W*.028,color:"#64748b",marginTop:W*.01}}>best: {displayHigh}</div>
            }
          </div>
          <Btn onClick={handleStart} size={W}>🔄 TRY AGAIN</Btn>
        </Overlay>
      )}

      {/* Loading */}
      {screen==="loading" && (
        <Overlay>
          <div style={{fontSize:W*.07,color:"#c4b5fd"}}>🚀 loading…</div>
        </Overlay>
      )}

      <style>{`
        @keyframes popIn {
          from { transform:translateX(-50%) scale(0.3); opacity:0; }
          to   { transform:translateX(-50%) scale(1);   opacity:1; }
        }
        @keyframes rocketBob {
          0%,100% { transform:translateY(0px);   }
          50%     { transform:translateY(-12px); }
        }
        * { box-sizing:border-box; }
        body { margin:0; overflow:hidden; }
      `}</style>
    </div>
  );
}

function Pill({ children, size=14 }) {
  return (
    <div style={{
      background:"rgba(0,0,0,0.55)", backdropFilter:"blur(8px)",
      border:"1px solid rgba(167,139,250,0.3)", borderRadius:20,
      padding:`5px ${size}px`, fontSize:size, fontWeight:800, color:"#fde68a",
    }}>{children}</div>
  );
}

function Overlay({ children }) {
  return (
    <div style={{
      position:"absolute", inset:0, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:"rgba(5,1,15,0.82)", backdropFilter:"blur(6px)",
    }}>{children}</div>
  );
}

function Btn({ onClick, children, size=480 }) {
  return (
    <button onClick={onClick} style={{
      background:"linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)",
      border:"none", borderRadius:50, padding:`${size*.025}px ${size*.07}px`,
      fontSize:size*.035, fontWeight:900, color:"white", cursor:"pointer",
      letterSpacing:1.5, boxShadow:"0 0 28px #7c3aed77", transition:"transform 0.12s",
    }}
      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.06)"}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
    >{children}</button>
  );
}