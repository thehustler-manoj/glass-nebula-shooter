import { useEffect, useRef, useState, useCallback } from "react";

type Screen = "start" | "playing" | "paused" | "gameover";
type PowerType = "shield" | "rapid" | "double";

interface Vec { x: number; y: number }
interface Bullet extends Vec { vx: number; vy: number; life: number }
interface Enemy extends Vec { vx: number; vy: number; hp: number; r: number; type: number; hue: number }
interface Particle extends Vec { vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Star extends Vec { z: number; s: number }
interface PowerUp extends Vec { vy: number; type: PowerType; life: number }

const COLORS = {
  bullet: "#7df9ff",
  ship: "#8ab4ff",
  neonBlue: "#00e5ff",
  neonPurple: "#b14cff",
  neonPink: "#ff5cf0",
  danger: "#ff4d6d",
  gold: "#ffd166",
  shield: "#7df9ff",
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [hud, setHud] = useState({ score: 0, hi: 0, health: 100, shield: 0, rapid: 0, double: 0, wave: 1 });
  const screenRef = useRef<Screen>("start");
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // game state stored in refs so animation loop doesn't re-render
  const stateRef = useRef({
    w: 0, h: 0, dpr: 1,
    ship: { x: 0, y: 0, r: 18, vx: 0, vy: 0 },
    bullets: [] as Bullet[],
    enemyBullets: [] as Bullet[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    stars: [] as Star[],
    powerups: [] as PowerUp[],
    keys: {} as Record<string, boolean>,
    touch: { active: false, x: 0, y: 0, fire: false },
    lastShot: 0,
    lastSpawn: 0,
    spawnInterval: 900,
    score: 0,
    hi: 0,
    health: 100,
    shield: 0,
    rapid: 0,
    double: 0,
    wave: 1,
    waveKills: 0,
    t: 0,
    shake: 0,
  });

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.bullets = []; s.enemyBullets = []; s.enemies = []; s.particles = []; s.powerups = [];
    s.ship.x = s.w / 2; s.ship.y = s.h - 80;
    s.ship.vx = 0; s.ship.vy = 0;
    s.score = 0; s.health = 100; s.shield = 0; s.rapid = 0; s.double = 0;
    s.wave = 1; s.waveKills = 0; s.spawnInterval = 900; s.shake = 0;
    setHud(h => ({ ...h, score: 0, health: 100, shield: 0, rapid: 0, double: 0, wave: 1 }));
  }, []);

  // resize
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      stateRef.current.w = rect.width;
      stateRef.current.h = rect.height;
      stateRef.current.dpr = dpr;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // init stars
      if (stateRef.current.stars.length === 0) {
        for (let i = 0; i < 160; i++) {
          stateRef.current.stars.push({
            x: Math.random() * rect.width,
            y: Math.random() * rect.height,
            z: Math.random(),
            s: Math.random() * 1.5 + 0.3,
          });
        }
      }
      // clamp ship
      const sh = stateRef.current.ship;
      if (sh.x === 0 && sh.y === 0) { sh.x = rect.width / 2; sh.y = rect.height - 80; }
      sh.x = Math.min(Math.max(sh.x, 20), rect.width - 20);
      sh.y = Math.min(Math.max(sh.y, 20), rect.height - 20);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // input
  useEffect(() => {
    const s = stateRef.current;
    const kd = (e: KeyboardEvent) => {
      s.keys[e.key.toLowerCase()] = true;
      if (e.key === " " || e.key === "ArrowUp") e.preventDefault();
      if (e.key.toLowerCase() === "p" || e.key === "Escape") {
        if (screenRef.current === "playing") setScreen("paused");
        else if (screenRef.current === "paused") setScreen("playing");
      }
    };
    const ku = (e: KeyboardEvent) => { s.keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  // touch
  useEffect(() => {
    const canvas = canvasRef.current!;
    const s = stateRef.current;
    const getPos = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    const start = (e: TouchEvent) => {
      e.preventDefault();
      if (screenRef.current !== "playing") return;
      const p = getPos(e);
      s.touch.active = true; s.touch.fire = true;
      s.touch.x = p.x; s.touch.y = p.y;
    };
    const move = (e: TouchEvent) => {
      e.preventDefault();
      if (!s.touch.active) return;
      const p = getPos(e);
      s.touch.x = p.x; s.touch.y = p.y;
    };
    const end = (e: TouchEvent) => {
      e.preventDefault();
      s.touch.active = false; s.touch.fire = false;
    };
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end, { passive: false });
    canvas.addEventListener("touchcancel", end, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
      canvas.removeEventListener("touchcancel", end);
    };
  }, []);

  // main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const spawnEnemy = () => {
      const s = stateRef.current;
      const type = Math.random() < 0.15 + Math.min(0.2, s.wave * 0.02) ? 1 : 0;
      const r = type === 1 ? 22 : 16;
      s.enemies.push({
        x: Math.random() * (s.w - r * 2) + r,
        y: -30,
        vx: (Math.random() - 0.5) * 40,
        vy: 60 + Math.random() * 30 + s.wave * 6,
        hp: type === 1 ? 3 : 1,
        r,
        type,
        hue: type === 1 ? 300 : 200,
      });
    };

    const explode = (x: number, y: number, hue: number, big = false) => {
      const s = stateRef.current;
      const n = big ? 34 : 18;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * (big ? 260 : 180) + 40;
        s.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.6 + Math.random() * 0.4,
          max: 1,
          color: `hsl(${hue + Math.random() * 40 - 20}, 100%, ${60 + Math.random() * 20}%)`,
          size: Math.random() * 3 + 1.5,
        });
      }
      if (big) s.shake = Math.max(s.shake, 12);
    };

    const trail = (x: number, y: number, color: string) => {
      stateRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 20,
        vy: 60 + Math.random() * 30,
        life: 0.3, max: 0.3,
        color, size: Math.random() * 2 + 1,
      });
    };

    const fire = () => {
      const s = stateRef.current;
      const cd = s.rapid > 0 ? 80 : 180;
      if (s.t - s.lastShot < cd) return;
      s.lastShot = s.t;
      if (s.double > 0) {
        s.bullets.push({ x: s.ship.x - 10, y: s.ship.y - 14, vx: 0, vy: -620, life: 2 });
        s.bullets.push({ x: s.ship.x + 10, y: s.ship.y - 14, vx: 0, vy: -620, life: 2 });
      } else {
        s.bullets.push({ x: s.ship.x, y: s.ship.y - 18, vx: 0, vy: -640, life: 2 });
      }
    };

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      s.t = now;
      const playing = screenRef.current === "playing";

      // update
      if (playing) {
        // ship controls
        const speed = 340;
        let dx = 0, dy = 0;
        if (s.keys["arrowleft"] || s.keys["a"]) dx -= 1;
        if (s.keys["arrowright"] || s.keys["d"]) dx += 1;
        if (s.keys["arrowup"] || s.keys["w"]) dy -= 1;
        if (s.keys["arrowdown"] || s.keys["s"]) dy += 1;
        if (s.touch.active) {
          const tdx = s.touch.x - s.ship.x;
          const tdy = s.touch.y - 60 - s.ship.y;
          const d = Math.hypot(tdx, tdy);
          if (d > 2) { dx = tdx / d; dy = tdy / d; }
        }
        const l = Math.hypot(dx, dy) || 1;
        s.ship.x += (dx / l) * speed * dt;
        s.ship.y += (dy / l) * speed * dt;
        s.ship.x = Math.min(Math.max(s.ship.x, 20), s.w - 20);
        s.ship.y = Math.min(Math.max(s.ship.y, 30), s.h - 30);

        // engine trail
        if (Math.random() < 0.8) trail(s.ship.x + (Math.random() - 0.5) * 8, s.ship.y + 14, "#5aa9ff");

        // fire
        if (s.keys[" "] || s.keys["space"] || s.touch.fire) fire();

        // spawn
        if (now - s.lastSpawn > s.spawnInterval) {
          s.lastSpawn = now;
          spawnEnemy();
        }
        // powerup drops occasionally
        if (Math.random() < 0.003) {
          const types: PowerType[] = ["shield", "rapid", "double"];
          s.powerups.push({
            x: Math.random() * (s.w - 40) + 20,
            y: -20,
            vy: 90,
            type: types[Math.floor(Math.random() * 3)],
            life: 15,
          });
        }

        // bullets
        for (const b of s.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
        s.bullets = s.bullets.filter(b => b.life > 0 && b.y > -20);

        // enemies
        for (const e of s.enemies) {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.x < e.r || e.x > s.w - e.r) e.vx *= -1;
        }

        // enemy bullets - reserved (not used but scaffolded)
        for (const b of s.enemyBullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
        s.enemyBullets = s.enemyBullets.filter(b => b.life > 0 && b.y < s.h + 20);

        // powerups
        for (const p of s.powerups) { p.y += p.vy * dt; p.life -= dt; }
        s.powerups = s.powerups.filter(p => p.y < s.h + 30 && p.life > 0);

        // collisions bullet-enemy
        for (const b of s.bullets) {
          for (const e of s.enemies) {
            const d = Math.hypot(b.x - e.x, b.y - e.y);
            if (d < e.r + 4) {
              e.hp -= 1;
              b.life = 0;
              explode(b.x, b.y, e.hue, false);
              if (e.hp <= 0) {
                explode(e.x, e.y, e.hue, true);
                s.score += e.type === 1 ? 30 : 10;
                e.hp = -999;
              }
              break;
            }
          }
        }
        s.enemies = s.enemies.filter(e => e.hp > -900 && e.y < s.h + 40);

        // collisions enemy-ship
        for (const e of s.enemies) {
          const d = Math.hypot(e.x - s.ship.x, e.y - s.ship.y);
          if (d < e.r + s.ship.r - 4) {
            explode(e.x, e.y, e.hue, true);
            e.hp = -999;
            if (s.shield > 0) {
              s.shield = 0;
            } else {
              s.health -= 20;
              s.shake = 16;
            }
          }
        }
        s.enemies = s.enemies.filter(e => e.hp > -900);

        // powerup pickup
        for (const p of s.powerups) {
          const d = Math.hypot(p.x - s.ship.x, p.y - s.ship.y);
          if (d < s.ship.r + 14) {
            p.life = 0;
            if (p.type === "shield") s.shield = 8;
            else if (p.type === "rapid") s.rapid = 8;
            else s.double = 8;
            for (let i = 0; i < 20; i++) {
              const a = Math.random() * Math.PI * 2;
              s.particles.push({
                x: s.ship.x, y: s.ship.y,
                vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
                life: 0.5, max: 0.5,
                color: p.type === "shield" ? "#7df9ff" : p.type === "rapid" ? "#ffd166" : "#b14cff",
                size: 2,
              });
            }
          }
        }
        s.powerups = s.powerups.filter(p => p.life > 0);

        // timers
        s.shield = Math.max(0, s.shield - dt);
        s.rapid = Math.max(0, s.rapid - dt);
        s.double = Math.max(0, s.double - dt);

        // wave progression by score
        const newWave = 1 + Math.floor(s.score / 200);
        if (newWave !== s.wave) {
          s.wave = newWave;
          s.spawnInterval = Math.max(280, 900 - s.wave * 60);
        }

        if (s.health <= 0) {
          s.health = 0;
          s.hi = Math.max(s.hi, s.score);
          setScreen("gameover");
        }

        // update hud (throttled every ~6 frames)
        if ((now | 0) % 4 === 0) {
          setHud({
            score: Math.floor(s.score),
            hi: s.hi,
            health: Math.round(s.health),
            shield: +s.shield.toFixed(1),
            rapid: +s.rapid.toFixed(1),
            double: +s.double.toFixed(1),
            wave: s.wave,
          });
        }
      }

      // particles always update (visual on all screens)
      for (const p of s.particles) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.96; p.vy *= 0.96;
        p.life -= dt;
      }
      s.particles = s.particles.filter(p => p.life > 0);

      // stars always
      const starSpeed = playing ? 60 : 20;
      for (const st of s.stars) {
        st.y += (0.3 + st.z * 1.5) * starSpeed * dt;
        if (st.y > s.h) { st.y = 0; st.x = Math.random() * s.w; }
      }

      // shake
      s.shake = Math.max(0, s.shake - dt * 40);

      // ==== DRAW ====
      ctx.clearRect(0, 0, s.w, s.h);
      // background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, s.h);
      grad.addColorStop(0, "#0a0620");
      grad.addColorStop(0.5, "#0d0930");
      grad.addColorStop(1, "#050318");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s.w, s.h);

      // nebula blobs
      const blob = (x: number, y: number, r: number, c: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      const tt = now * 0.0002;
      blob(s.w * (0.3 + Math.sin(tt) * 0.05), s.h * 0.3, 260, "rgba(120,60,255,0.18)");
      blob(s.w * (0.7 + Math.cos(tt) * 0.05), s.h * 0.7, 300, "rgba(0,180,255,0.15)");

      // shake transform
      const sx = (Math.random() - 0.5) * s.shake;
      const sy = (Math.random() - 0.5) * s.shake;
      ctx.save();
      ctx.translate(sx, sy);

      // stars
      for (const st of s.stars) {
        const a = 0.4 + st.z * 0.6;
        ctx.fillStyle = `rgba(${180 + st.z * 60}, ${200 + st.z * 40}, 255, ${a})`;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }

      // particles (additive)
      ctx.globalCompositeOperation = "lighter";
      for (const p of s.particles) {
        const a = Math.max(0, p.life / p.max);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // bullets
      for (const b of s.bullets) {
        ctx.fillStyle = COLORS.bullet;
        ctx.shadowColor = COLORS.bullet;
        ctx.shadowBlur = 14;
        ctx.fillRect(b.x - 2, b.y - 10, 4, 14);
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";

      // powerups
      for (const p of s.powerups) {
        const c = p.type === "shield" ? "#7df9ff" : p.type === "rapid" ? "#ffd166" : "#b14cff";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(now * 0.004);
        ctx.shadowColor = c; ctx.shadowBlur = 18;
        ctx.fillStyle = `${c}33`;
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x = Math.cos(a) * 14, y = Math.sin(a) * 14;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = c;
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.type === "shield" ? "S" : p.type === "rapid" ? "R" : "D", 0, 1);
        ctx.restore();
      }

      // enemies
      for (const e of s.enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        const c = e.type === 1 ? COLORS.neonPurple : COLORS.danger;
        ctx.shadowColor = c; ctx.shadowBlur = 18;
        ctx.fillStyle = c;
        ctx.beginPath();
        // diamond enemy
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r, 0);
        ctx.lineTo(0, e.r);
        ctx.lineTo(-e.r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ship
      if (screenRef.current !== "gameover") {
        ctx.save();
        ctx.translate(s.ship.x, s.ship.y);
        // shield
        if (s.shield > 0) {
          const pulse = 1 + Math.sin(now * 0.01) * 0.05;
          ctx.strokeStyle = "rgba(125,249,255,0.9)";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#7df9ff"; ctx.shadowBlur = 24;
          ctx.beginPath();
          ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        // body
        ctx.shadowColor = COLORS.neonBlue; ctx.shadowBlur = 18;
        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 20);
        bodyGrad.addColorStop(0, "#a9d0ff");
        bodyGrad.addColorStop(1, "#3d6cff");
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(14, 14);
        ctx.lineTo(6, 10);
        ctx.lineTo(-6, 10);
        ctx.lineTo(-14, 14);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // cockpit
        ctx.fillStyle = "#e8f4ff";
        ctx.beginPath();
        ctx.arc(0, -4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const start = () => { resetGame(); setScreen("playing"); };
  const resume = () => setScreen("playing");
  const restart = () => { resetGame(); setScreen("playing"); };
  const toStart = () => setScreen("start");

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050318] text-white select-none">
      <div ref={wrapRef} className="fixed inset-0">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />

        {/* HUD */}
        {(screen === "playing" || screen === "paused") && (
          <div className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-5">
            <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
              <GlassPanel className="px-3 py-2 sm:px-4 sm:py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Score</div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-cyan-100 tabular-nums">{hud.score.toString().padStart(6, "0")}</div>
                <div className="mt-1 text-[10px] text-fuchsia-300/70">Wave {hud.wave}</div>
              </GlassPanel>

              <GlassPanel className="min-w-[160px] px-3 py-2 sm:min-w-[220px] sm:px-4 sm:py-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">
                  <span>Hull</span>
                  <span className="font-mono text-cyan-100">{hud.health}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-150"
                    style={{
                      width: `${hud.health}%`,
                      background: hud.health > 50
                        ? "linear-gradient(90deg,#00e5ff,#7df9ff)"
                        : hud.health > 25
                          ? "linear-gradient(90deg,#ffd166,#ff8a3d)"
                          : "linear-gradient(90deg,#ff4d6d,#ff2b6b)",
                      boxShadow: "0 0 12px rgba(0,229,255,0.5)",
                    }}
                  />
                </div>
                <div className="mt-2 flex gap-1.5">
                  <PowerBadge label="S" active={hud.shield > 0} value={hud.shield} color="#7df9ff" />
                  <PowerBadge label="R" active={hud.rapid > 0} value={hud.rapid} color="#ffd166" />
                  <PowerBadge label="D" active={hud.double > 0} value={hud.double} color="#b14cff" />
                </div>
              </GlassPanel>

              <button
                onClick={() => setScreen(screen === "paused" ? "playing" : "paused")}
                className="pointer-events-auto rounded-2xl border border-white/15 bg-white/5 px-3 py-2 backdrop-blur-xl transition hover:bg-white/10"
                aria-label="Pause"
              >
                <span className="block h-4 w-4">
                  {screen === "paused" ? (
                    <svg viewBox="0 0 24 24" fill="none"><path d="M8 5l12 7-12 7V5z" fill="#7df9ff"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" fill="#7df9ff"/><rect x="14" y="5" width="4" height="14" fill="#7df9ff"/></svg>
                  )}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Start screen */}
        {screen === "start" && (
          <Overlay>
            <div className="text-center">
              <div className="mb-2 text-xs uppercase tracking-[0.4em] text-cyan-300/70">A Neon Space Shooter</div>
              <h1 className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-purple-400 bg-clip-text text-5xl sm:text-7xl font-black tracking-tight text-transparent drop-shadow-[0_0_30px_rgba(0,229,255,0.35)]">
                NEBULA STRIKE
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm text-white/70">
                Pilot a starfighter through infinite waves. Grab power-ups. Survive the void.
              </p>
              <button
                onClick={start}
                className="group relative mt-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-8 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-100 backdrop-blur-xl transition hover:bg-cyan-400/20"
                style={{ boxShadow: "0 0 30px rgba(0,229,255,0.35), inset 0 0 20px rgba(0,229,255,0.15)" }}
              >
                <span>Launch</span>
                <span aria-hidden>→</span>
              </button>
              <div className="mt-8 grid grid-cols-1 gap-2 text-xs text-white/50 sm:grid-cols-3">
                <Kbd>WASD / Arrows — Move</Kbd>
                <Kbd>Space — Fire</Kbd>
                <Kbd>P / Esc — Pause</Kbd>
              </div>
              <div className="mt-2 text-[11px] text-white/40">On mobile: touch and drag to fly & auto-fire</div>
            </div>
          </Overlay>
        )}

        {screen === "paused" && (
          <Overlay>
            <GlassPanel className="px-8 py-8 text-center">
              <div className="text-xs uppercase tracking-[0.4em] text-cyan-300/70">Paused</div>
              <h2 className="mt-2 text-3xl font-bold">Take a breath</h2>
              <div className="mt-6 flex flex-col gap-2">
                <NeonButton onClick={resume}>Resume</NeonButton>
                <NeonButton onClick={() => { resetGame(); setScreen("start"); }} variant="ghost">Quit to menu</NeonButton>
              </div>
            </GlassPanel>
          </Overlay>
        )}

        {screen === "gameover" && (
          <Overlay>
            <GlassPanel className="px-8 py-8 text-center">
              <div className="text-xs uppercase tracking-[0.4em] text-rose-300/80">Signal Lost</div>
              <h2 className="mt-2 bg-gradient-to-r from-rose-300 to-fuchsia-400 bg-clip-text text-4xl font-black text-transparent">
                GAME OVER
              </h2>
              <div className="mt-4 text-sm text-white/70">Final score</div>
              <div className="font-mono text-4xl font-bold text-cyan-200 tabular-nums">{hud.score.toString().padStart(6, "0")}</div>
              <div className="mt-1 text-[11px] text-white/50">Best {stateRef.current.hi.toString().padStart(6, "0")} · Wave {hud.wave}</div>
              <div className="mt-6 flex flex-col gap-2">
                <NeonButton onClick={restart}>Restart</NeonButton>
                <NeonButton onClick={toStart} variant="ghost">Main menu</NeonButton>
              </div>
            </GlassPanel>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050318]/40 backdrop-blur-[2px] p-4">
      <div className="animate-in fade-in zoom-in-95 duration-300">{children}</div>
    </div>
  );
}

function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-auto rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-xl ${className}`}
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}
    >
      {children}
    </div>
  );
}

function NeonButton({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "ghost" }) {
  const primary = "border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20";
  const ghost = "border-white/15 bg-white/5 text-white/80 hover:bg-white/10";
  const shadow = variant === "primary" ? "0 0 24px rgba(0,229,255,0.35), inset 0 0 16px rgba(0,229,255,0.15)" : "none";
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] backdrop-blur-xl transition ${variant === "primary" ? primary : ghost}`}
      style={{ boxShadow: shadow }}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-white/70 backdrop-blur">
      {children}
    </div>
  );
}

function PowerBadge({ label, active, value, color }: { label: string; active: boolean; value: number; color: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-between rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition"
      style={{
        borderColor: active ? color : "rgba(255,255,255,0.08)",
        color: active ? color : "rgba(255,255,255,0.3)",
        boxShadow: active ? `0 0 10px ${color}55` : "none",
        background: active ? `${color}14` : "transparent",
      }}
    >
      <span className="font-bold">{label}</span>
      <span>{active ? `${Math.ceil(value)}s` : "—"}</span>
    </div>
  );
}