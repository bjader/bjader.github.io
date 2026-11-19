(() => {
  'use strict';

  const PALETTE = {
    bg: '#0E0F12',
    ink: '#EBE7DF',
    muted: '#82858B',
    accent: '#CFA86E',
    secondary: '#7EA8BE',
    isDark: true
  };

  const SCENES = ['doubleslit', 'bloch', 'teleport'];
  const STORAGE_KEY = 'bjader_last_scene';

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const rgbCache = new Map();
  function rgba(hex, a) {
    let rgb = rgbCache.get(hex);
    if (!rgb) {
      rgb = hexToRgb(hex);
      rgbCache.set(hex, rgb);
    }
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a))})`;
  }

  function pickScene() {
    try {
      const params = new URLSearchParams(window.location.search);
      const forced = params.get('scene');
      if (forced && SCENES.includes(forced)) return forced;
    } catch (_) {}

    let last = null;
    try {
      last = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (_) {}

    const pool = last && SCENES.includes(last)
      ? SCENES.filter(s => s !== last)
      : SCENES;
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    try {
      window.sessionStorage.setItem(STORAGE_KEY, chosen);
    } catch (_) {}
    return chosen;
  }

  /* =======================================================================
     SCENE 1: DOUBLE-SLIT OBSERVER (WHICH-WAY COLLAPSE)
     ======================================================================= */
  function createDoubleSlit() {
    const state = {
      observe: 0,
      hits: [],
      particles: [],
      emitAccum: 0,
      slitFlashes: [0, 0],
      histBins: new Float32Array(80)
    };

    function sampleWaveU() {
      for (let tries = 0; tries < 40; tries++) {
        const u = Math.random() * 2 - 1;
        const env = Math.exp(-(u * u) / 0.28);
        const fringe = Math.cos(u * Math.PI * 4.5);
        if (Math.random() < env * fringe * fringe) return u;
      }
      return 0;
    }

    function sampleParticleU(slitSign) {
      let g = 0;
      for (let i = 0; i < 4; i++) g += Math.random() - 0.5;
      return Math.max(-0.95, Math.min(0.95, slitSign * 0.24 + g * 0.42));
    }

    for (let i = 0; i < 130; i++) {
      state.hits.push({ u: sampleWaveU(), age: Math.random() * 1.45, mode: 'wave' });
    }

    function geom(w, h) {
      const boxW = Math.min(w, Math.max(320, h * 2.15, 760));
      const ox = (w - boxW) * 0.5;
      const boxH = Math.min(h, 460);
      const cy = h * 0.5;
      const srcX = ox + boxW * 0.08;
      const barrierX = ox + boxW * 0.42;
      const screenX = ox + boxW * 0.82;
      const slitSep = Math.min(boxH * 0.25, 74);
      const slitH = Math.max(10, slitSep * 0.24);
      return {
        ox, boxW, boxH, cy, srcX, barrierX, screenX,
        slitSep, slitH,
        s1Y: cy - slitSep * 0.5,
        s2Y: cy + slitSep * 0.5,
        topPad: cy - boxH * 0.42,
        botPad: cy + boxH * 0.42,
        screenSpan: boxH * 0.40
      };
    }

    return {
      onClick() {
        for (let i = 0; i < 5; i++) {
          const isObs = state.observe > 0.5;
          const slit = Math.random() < 0.5 ? -1 : 1;
          state.particles.push({
            prog: -i * 0.08,
            slit,
            targetU: isObs ? sampleParticleU(slit) : sampleWaveU(),
            mode: isObs ? 'particle' : 'wave'
          });
        }
      },
      render(ctx, w, h, t, dt, ptr, pal) {
        ctx.clearRect(0, 0, w, h);
        const g = geom(w, h);
        const px = ptr.nx * w;
        const py = ptr.ny * h;

        const isWatching = ptr.inside
          && Math.abs(px - g.barrierX) < Math.max(58, g.boxW * 0.14)
          && Math.abs(py - g.cy) < g.boxH * 0.38;

        state.observe += ((isWatching ? 1 : 0) - state.observe) * Math.min(1, dt * 8.5);

        state.emitAccum += dt * (isWatching ? 10 : 12);
        while (state.emitAccum >= 1) {
          state.emitAccum -= 1;
          const slit = Math.random() < 0.5 ? -1 : 1;
          const mode = state.observe > 0.45 ? 'particle' : 'wave';
          state.particles.push({
            prog: 0,
            slit,
            targetU: mode === 'particle' ? sampleParticleU(slit) : sampleWaveU(),
            mode
          });
        }

        // Source emitter
        ctx.beginPath();
        ctx.arc(g.srcX, g.cy, 3.0, 0, Math.PI * 2);
        ctx.fillStyle = rgba(pal.ink, 0.78);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(g.srcX, g.cy, 8.5 + Math.sin(t * 2.8) * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(pal.ink, 0.15);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Coherent wavefronts
        const waveVis = 1 - state.observe;
        if (waveVis > 0.03) {
          const wavelength = 24;
          const phase = (t * 46) % wavelength;

          ctx.save();
          ctx.beginPath();
          ctx.rect(g.srcX, g.topPad - 12, g.barrierX - g.srcX, g.botPad - g.topPad + 24);
          ctx.clip();
          const leftMax = g.barrierX - g.srcX + 40;
          for (let r = phase; r < leftMax; r += wavelength) {
            const fade = Math.max(0, 1 - r / (leftMax * 1.12));
            ctx.beginPath();
            ctx.arc(g.srcX, g.cy, r, -0.78, 0.78);
            ctx.strokeStyle = rgba(pal.ink, 0.16 * fade * waveVis);
            ctx.lineWidth = 1.0;
            ctx.stroke();
          }
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.rect(g.barrierX, g.topPad - 12, g.screenX - g.barrierX, g.botPad - g.topPad + 24);
          ctx.clip();
          const maxR = Math.hypot(g.screenX - g.barrierX, g.boxH * 0.55);
          for (let r = phase; r < maxR; r += wavelength) {
            const fade = Math.max(0, 1 - r / maxR);
            const alpha = 0.21 * fade * waveVis;
            ctx.beginPath();
            ctx.arc(g.barrierX, g.s1Y, r, -1.15, 1.15);
            ctx.strokeStyle = rgba(pal.ink, alpha);
            ctx.lineWidth = 1.0;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(g.barrierX, g.s2Y, r, -1.15, 1.15);
            ctx.strokeStyle = rgba(pal.accent, alpha * 0.96);
            ctx.lineWidth = 1.0;
            ctx.stroke();
          }
          ctx.restore();
        }

        // Travelling quanta
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.prog += dt * 1.18;
          if (p.prog < 0) continue;

          const slitY = p.slit < 0 ? g.s1Y : g.s2Y;
          const destY = g.cy + p.targetU * g.screenSpan;

          if (p.prog >= 1) {
            state.hits.push({ u: p.targetU, age: 0, mode: p.mode });
            if (state.hits.length > 280) state.hits.shift();
            state.particles.splice(i, 1);
            continue;
          }

          if (p.mode === 'particle' && Math.abs(p.prog - 0.44) < dt * 1.2) {
            state.slitFlashes[p.slit < 0 ? 0 : 1] = 1.0;
          }

          if (p.mode === 'particle') {
            let x, y;
            if (p.prog < 0.44) {
              const u = p.prog / 0.44;
              x = g.srcX + (g.barrierX - g.srcX) * u;
              y = g.cy + (slitY - g.cy) * u;
            } else {
              const u = (p.prog - 0.44) / 0.56;
              x = g.barrierX + (g.screenX - g.barrierX) * u;
              y = slitY + (destY - slitY) * u;
            }
            ctx.beginPath();
            ctx.moveTo(g.srcX, g.cy);
            ctx.lineTo(g.barrierX, slitY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = rgba(pal.accent, 0.14);
            ctx.lineWidth = 0.9;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = pal.accent;
            ctx.fill();
          } else if (p.prog > 0.88) {
            const a = (p.prog - 0.88) / 0.12;
            ctx.beginPath();
            ctx.arc(g.screenX, destY, 1.5 + (1 - a) * 3, 0, Math.PI * 2);
            ctx.fillStyle = rgba(pal.ink, a * 0.48);
            ctx.fill();
          }
        }

        // Double-slit barrier
        ctx.strokeStyle = rgba(pal.ink, 0.74);
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(g.barrierX, g.topPad);
        ctx.lineTo(g.barrierX, g.s1Y - g.slitH * 0.5);
        ctx.moveTo(g.barrierX, g.s1Y + g.slitH * 0.5);
        ctx.lineTo(g.barrierX, g.s2Y - g.slitH * 0.5);
        ctx.moveTo(g.barrierX, g.s2Y + g.slitH * 0.5);
        ctx.lineTo(g.barrierX, g.botPad);
        ctx.stroke();

        // Subtle which-way observer ring around slits
        state.slitFlashes[0] *= Math.exp(-dt * 7);
        state.slitFlashes[1] *= Math.exp(-dt * 7);
        if (state.observe > 0.04) {
          const watchedY = py < g.cy ? g.s1Y : g.s2Y;
          [g.s1Y, g.s2Y].forEach((sy, idx) => {
            const isPrimary = Math.abs(sy - watchedY) < 1;
            const r = (isPrimary ? 14 : 9.5) + state.slitFlashes[idx] * 5.5;
            ctx.beginPath();
            ctx.arc(g.barrierX, sy, r, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(pal.accent, state.observe * (isPrimary ? 0.58 : 0.24) + state.slitFlashes[idx] * 0.42);
            ctx.lineWidth = 1.05;
            ctx.setLineDash([2.5, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }

        // Detector screen + histogram profile
        ctx.beginPath();
        ctx.moveTo(g.screenX, g.topPad);
        ctx.lineTo(g.screenX, g.botPad);
        ctx.strokeStyle = rgba(pal.ink, 0.24);
        ctx.lineWidth = 1.0;
        ctx.stroke();

        const activeMode = state.observe > 0.45 ? 'particle' : 'wave';
        state.histBins.fill(0);

        for (let i = state.hits.length - 1; i >= 0; i--) {
          const hit = state.hits[i];
          const decayRate = hit.mode === activeMode ? 0.11 : 1.55;
          hit.age += dt * decayRate;
          if ((hit.age > 1.0 && hit.mode !== activeMode) || hit.age > 1.85) {
            state.hits.splice(i, 1);
            continue;
          }
          const alpha = Math.max(0, 1 - hit.age / 1.85);
          const hy = g.cy + hit.u * g.screenSpan;

          ctx.beginPath();
          ctx.arc(g.screenX + 2.5 + hit.age * 3, hy, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = hit.mode === 'particle'
            ? rgba(pal.accent, alpha * 0.76)
            : rgba(pal.ink, alpha * 0.65);
          ctx.fill();

          const bi = Math.round(((hit.u + 1) * 0.5) * (state.histBins.length - 1));
          for (let k = -2; k <= 2; k++) {
            const idx = bi + k;
            if (idx >= 0 && idx < state.histBins.length) {
              state.histBins[idx] += alpha * Math.exp(-k * k * 0.45);
            }
          }
        }

        let maxBin = 4.2;
        for (let i = 0; i < state.histBins.length; i++) {
          if (state.histBins[i] > maxBin) maxBin = state.histBins[i];
        }

        const graphW = Math.min(68, g.boxW * 0.13);
        ctx.beginPath();
        ctx.moveTo(g.screenX + 4, g.cy - g.screenSpan);
        for (let i = 0; i < state.histBins.length; i++) {
          const u = (i / (state.histBins.length - 1)) * 2 - 1;
          const y = g.cy + u * g.screenSpan;
          const amp = (state.histBins[i] / maxBin) * graphW;
          ctx.lineTo(g.screenX + 4 + amp, y);
        }
        ctx.lineTo(g.screenX + 4, g.cy + g.screenSpan);
        ctx.fillStyle = activeMode === 'particle'
          ? rgba(pal.accent, 0.14)
          : rgba(pal.ink, 0.08);
        ctx.fill();
        ctx.strokeStyle = activeMode === 'particle'
          ? rgba(pal.accent, 0.68)
          : rgba(pal.ink, 0.56);
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    };
  }

  /* =======================================================================
     SCENE 2: INTERACTIVE BLOCH SPHERE
     ======================================================================= */
  function createBlochSphere() {
    const state = {
      theta: 1.04,
      phi: 0.6,
      vTheta: 0,
      vPhi: 0.62,
      dragging: false,
      lastX: 0,
      lastY: 0,
      dragDist: 0,
      trail: [],
      measureRipple: null,
      collapseHold: 0
    };

    const tilt = 0.30;
    const azim = -0.42;
    const cA = Math.cos(azim), sA = Math.sin(azim);
    const cT = Math.cos(tilt), sT = Math.sin(tilt);

    function proj(x, y, z, cx, cy, R) {
      const xr = x * cA - y * sA;
      const yr = x * sA + y * cA;
      const zp = z * cT - yr * sT;
      const depth = yr * cT + z * sT;
      return { x: cx + xr * R, y: cy - zp * R, depth };
    }

    return {
      onDown(nx, ny, w, h) {
        state.dragging = true;
        state.lastX = nx * w;
        state.lastY = ny * h;
        state.dragDist = 0;
      },
      onMove(nx, ny, w, h) {
        if (!state.dragging) return;
        const x = nx * w, y = ny * h;
        const dx = x - state.lastX;
        const dy = y - state.lastY;
        state.dragDist += Math.hypot(dx, dy);
        state.lastX = x;
        state.lastY = y;
        state.phi += dx * 0.013;
        state.theta = Math.max(0.03, Math.min(Math.PI - 0.03, state.theta + dy * 0.013));
        state.vPhi = dx * 0.14;
        state.vTheta = dy * 0.08;
        state.collapseHold = 0;
      },
      onUp() {
        const wasClick = state.dragging && state.dragDist < 6;
        state.dragging = false;
        if (wasClick) {
          const p0 = Math.cos(state.theta * 0.5) ** 2;
          const outcome0 = Math.random() < p0;
          state.theta = outcome0 ? 0.001 : Math.PI - 0.001;
          state.vTheta = 0;
          state.trail = [];
          state.collapseHold = 2.3;
          state.measureRipple = { pole: outcome0 ? 1 : -1, life: 1.0 };
        }
      },
      render(ctx, w, h, t, dt, ptr, pal) {
        ctx.clearRect(0, 0, w, h);
        const cx = w * 0.5;
        const cy = h * 0.5;
        const R = Math.min(w * 0.40, h * 0.42, 210);

        if (!state.dragging) {
          if (state.collapseHold > 0) {
            state.collapseHold -= dt;
          } else {
            state.vPhi += (0.62 - state.vPhi) * Math.min(1, dt * 1.8);
            state.vTheta *= Math.exp(-dt * 4);
            state.phi += state.vPhi * dt;
            state.theta += state.vTheta * dt;
            if (state.theta < 0.22 || state.theta > Math.PI - 0.22) {
              state.theta += (1.10 - state.theta) * dt * 0.45;
            } else {
              state.theta = Math.max(0.15, Math.min(Math.PI - 0.15, state.theta + Math.sin(t * 0.45) * 0.065 * dt));
            }
          }
        }

        function drawGreatCircle(fn, frontAlpha, backAlpha) {
          const N = 112;
          for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            let open = false;
            for (let i = 0; i <= N; i++) {
              const a = (i / N) * Math.PI * 2;
              const [x, y, z] = fn(a);
              const p = proj(x, y, z, cx, cy, R);
              const isFront = p.depth <= 0;
              if ((pass === 0 && !isFront) || (pass === 1 && isFront)) {
                if (!open) { ctx.moveTo(p.x, p.y); open = true; }
                else ctx.lineTo(p.x, p.y);
              } else {
                open = false;
              }
            }
            ctx.strokeStyle = rgba(pal.ink, pass === 0 ? backAlpha : frontAlpha);
            ctx.lineWidth = pass === 0 ? 0.85 : 1.05;
            ctx.setLineDash(pass === 0 ? [3, 4] : []);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        // Outer sphere silhouette
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(pal.ink, 0.28);
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Subtle sculptural inner sheen
        const grad = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.28, R * 0.06, cx, cy, R);
        grad.addColorStop(0, rgba(pal.ink, 0.045));
        grad.addColorStop(1, rgba(pal.ink, 0));
        ctx.fillStyle = grad;
        ctx.fill();

        // Great circles
        drawGreatCircle((a) => [Math.cos(a), Math.sin(a), 0], 0.27, 0.11);
        drawGreatCircle((a) => [Math.cos(a), 0, Math.sin(a)], 0.13, 0.06);
        drawGreatCircle((a) => [0, Math.cos(a), Math.sin(a)], 0.10, 0.05);

        // Axes
        [
          [[0, 0, -1], [0, 0, 1], 0.22],
          [[-1, 0, 0], [1, 0, 0], 0.11],
          [[0, -1, 0], [0, 1, 0], 0.11]
        ].forEach(([a, b, op]) => {
          const p1 = proj(a[0], a[1], a[2], cx, cy, R);
          const p2 = proj(b[0], b[1], b[2], cx, cy, R);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = rgba(pal.ink, op);
          ctx.lineWidth = 0.85;
          ctx.stroke();
        });

        // Subtle pole and cardinal ticks
        [[0, 0, 1], [0, 0, -1]].forEach(([x, y, z]) => {
          const p = proj(x, y, z, cx, cy, R);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
          ctx.fillStyle = rgba(pal.ink, 0.48);
          ctx.fill();
        });

        // State vector
        const sx = Math.sin(state.theta) * Math.cos(state.phi);
        const sy = Math.sin(state.theta) * Math.sin(state.phi);
        const sz = Math.cos(state.theta);

        state.trail.push([sx, sy, sz]);
        if (state.trail.length > 95) state.trail.shift();

        // Phase trail with subtle front/back depth dimming
        if (state.trail.length > 2) {
          for (let i = 1; i < state.trail.length; i++) {
            const frac = i / state.trail.length;
            const p0 = proj(state.trail[i - 1][0], state.trail[i - 1][1], state.trail[i - 1][2], cx, cy, R);
            const p1 = proj(state.trail[i][0], state.trail[i][1], state.trail[i][2], cx, cy, R);
            const depthBoost = p1.depth <= 0 ? 1.0 : 0.48;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = rgba(pal.accent, frac * frac * 0.58 * depthBoost);
            ctx.lineWidth = 1.45;
            ctx.stroke();
          }
        }

        const pOrigin = proj(0, 0, 0, cx, cy, R);
        const pTip = proj(sx, sy, sz, cx, cy, R);
        const pEq = proj(sx, sy, 0, cx, cy, R);

        // Equatorial projection drop-line
        ctx.beginPath();
        ctx.moveTo(pOrigin.x, pOrigin.y);
        ctx.lineTo(pEq.x, pEq.y);
        ctx.lineTo(pTip.x, pTip.y);
        ctx.strokeStyle = rgba(pal.accent, 0.26);
        ctx.lineWidth = 0.9;
        ctx.setLineDash([2.5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // State vector shaft
        ctx.beginPath();
        ctx.moveTo(pOrigin.x, pOrigin.y);
        ctx.lineTo(pTip.x, pTip.y);
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2.1;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Origin dot
        ctx.beginPath();
        ctx.arc(pOrigin.x, pOrigin.y, 2.3, 0, Math.PI * 2);
        ctx.fillStyle = rgba(pal.ink, 0.56);
        ctx.fill();

        // State tip glow + core
        ctx.beginPath();
        ctx.arc(pTip.x, pTip.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = rgba(pal.accent, 0.16);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pTip.x, pTip.y, 3.8, 0, Math.PI * 2);
        ctx.fillStyle = pal.accent;
        ctx.fill();

        // Born-rule collapse ripple
        if (state.measureRipple) {
          state.measureRipple.life -= dt * 1.35;
          if (state.measureRipple.life <= 0) {
            state.measureRipple = null;
          } else {
            const pPole = proj(0, 0, state.measureRipple.pole, cx, cy, R);
            const rad = (1 - state.measureRipple.life) * R * 0.65;
            ctx.beginPath();
            ctx.arc(pPole.x, pPole.y, rad, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(pal.accent, state.measureRipple.life * 0.75);
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        }
      }
    };
  }

  /* =======================================================================
     SCENE 3: QUANTUM TELEPORTATION CIRCUIT
     ======================================================================= */
  function createTeleportation() {
    const state = {
      cycle: 0.12,
      inputAngle: 0.95,
      m0: 1,
      m1: 1,
      customPulse: 0
    };

    function drawStateGlyph(ctx, x, y, r, angle, pal, alpha) {
      if (alpha <= 0.02) return;
      ctx.save();
      ctx.translate(x, y);

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = pal.bg;
      ctx.fill();
      ctx.strokeStyle = rgba(pal.accent, 0.9 * alpha);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, angle - 0.55, angle + 0.55);
      ctx.strokeStyle = rgba(pal.accent, 0.36 * alpha);
      ctx.lineWidth = 2.6;
      ctx.stroke();

      const nx = Math.cos(angle) * (r * 0.72);
      const ny = Math.sin(angle) * (r * 0.72);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = rgba(pal.ink, 0.94 * alpha);
      ctx.lineWidth = 1.45;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(nx, ny, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(pal.accent, alpha);
      ctx.fill();

      ctx.restore();
    }

    return {
      onMove(nx, ny) {
        if (nx < 0.28) {
          state.inputAngle = (ny - 0.5) * Math.PI * 2.3;
        }
      },
      onClick(nx, ny) {
        state.inputAngle = ((ny - 0.5) * Math.PI * 2.4) + nx * 1.6;
        state.cycle = 0.04;
        state.m0 = Math.random() < 0.5 ? 0 : 1;
        state.m1 = Math.random() < 0.5 ? 0 : 1;
        if (state.m0 === 0 && state.m1 === 0) state.m1 = 1;
        state.customPulse = 1.0;
      },
      render(ctx, w, h, t, dt, ptr, pal) {
        ctx.clearRect(0, 0, w, h);

        const prevCycle = state.cycle;
        state.cycle = (state.cycle + dt / 7.2) % 1.0;
        if (state.cycle < prevCycle) {
          state.m0 = Math.random() < 0.5 ? 0 : 1;
          state.m1 = Math.random() < 0.5 ? 0 : 1;
          if (!ptr.inside) state.inputAngle = (state.inputAngle + 1.18) % (Math.PI * 2);
        }
        state.customPulse *= Math.exp(-dt * 3);

        if (ptr.inside && ptr.nx < 0.28) {
          const targetA = (ptr.ny - 0.5) * Math.PI * 2.4;
          state.inputAngle += (targetA - state.inputAngle) * Math.min(1, dt * 8);
        }

        const span = Math.min(w * 0.88, 760);
        const leftX = (w - span) * 0.5;
        const rightX = leftX + span;
        const wireGap = Math.min(68, Math.max(40, h * 0.22));
        const cy = h * 0.5;
        const y0 = cy - wireGap;
        const y1 = cy;
        const y2 = cy + wireGap;

        const xH1 = leftX + span * 0.16;
        const xCN1 = leftX + span * 0.26;
        const xCN2 = leftX + span * 0.43;
        const xH0 = leftX + span * 0.53;
        const xM = leftX + span * 0.65;
        const xX = leftX + span * 0.77;
        const xZ = leftX + span * 0.85;

        const gateHalf = Math.max(8.5, Math.min(11, span * 0.017));

        // Quantum wires
        [y0, y1, y2].forEach((yw, idx) => {
          ctx.beginPath();
          ctx.moveTo(leftX, yw);
          ctx.lineTo(idx < 2 ? xM : rightX, yw);
          ctx.strokeStyle = rgba(pal.ink, 0.30);
          ctx.lineWidth = 1.15;
          ctx.stroke();
        });

        const c = state.cycle;
        const pulseM1 = Math.max(0, Math.min(1, (c - 0.58) / 0.16));
        const pulseM0 = Math.max(0, Math.min(1, (c - 0.64) / 0.18));

        function drawDoubleClassical(fromX, fromY, toX, toY, active, progress) {
          const col = active && progress > 0 ? rgba(pal.accent, 0.78) : rgba(pal.ink, 0.20);
          [-1.6, 1.6].forEach(off => {
            ctx.beginPath();
            ctx.moveTo(fromX, fromY + off);
            ctx.lineTo(toX + off, fromY + off);
            ctx.lineTo(toX + off, toY);
            ctx.strokeStyle = col;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          });
          if (active && progress > 0 && progress < 1) {
            const seg1 = Math.abs(toX - fromX);
            const seg2 = Math.abs(toY - fromY);
            const dist = progress * (seg1 + seg2);
            const px = dist < seg1 ? fromX + dist : toX;
            const py = dist < seg1 ? fromY : fromY + (dist - seg1);
            ctx.beginPath();
            ctx.arc(px, py, 3.0, 0, Math.PI * 2);
            ctx.fillStyle = pal.accent;
            ctx.fill();
          }
        }

        drawDoubleClassical(xM + gateHalf, y1, xX, y2 - gateHalf, state.m1 === 1, pulseM1);
        drawDoubleClassical(xM + gateHalf, y0, xZ, y2 - gateHalf, state.m0 === 1, pulseM0);

        // Bell-pair entanglement wave between q1 and q2
        const eprActive = Math.max(0, Math.min(1, (c - 0.18) / 0.10))
          * Math.max(0, 1 - Math.max(0, (c - 0.58) / 0.08));
        if (eprActive > 0.02) {
          const bridgeEnd = leftX + span * Math.min(0.64, Math.max(0.26, c * 1.05));
          ctx.beginPath();
          for (let x = xCN1; x <= bridgeEnd; x += 3) {
            const env = Math.sin(((x - xCN1) / Math.max(10, bridgeEnd - xCN1)) * Math.PI);
            const wave = Math.sin(x * 0.11 - t * 6) * 5 * env;
            const midY = (y1 + y2) * 0.5 + wave;
            if (x === xCN1) ctx.moveTo(x, midY);
            else ctx.lineTo(x, midY);
          }
          ctx.strokeStyle = rgba(pal.accent, 0.34 * eprActive);
          ctx.lineWidth = 1.1;
          ctx.stroke();

          for (let x = xCN1 + 14; x < bridgeEnd - 6; x += 24) {
            const ph = 0.5 + 0.5 * Math.sin(x * 0.08 - t * 5);
            ctx.beginPath();
            ctx.moveTo(x, y1 + 4);
            ctx.lineTo(x, y2 - 4);
            ctx.strokeStyle = rgba(pal.accent, 0.14 * ph * eprActive);
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }

        function drawGateBox(x, y, glyph, lit) {
          const s = gateHalf;
          ctx.beginPath();
          ctx.rect(x - s, y - s, s * 2, s * 2);
          ctx.fillStyle = pal.bg;
          ctx.fill();
          ctx.strokeStyle = lit > 0.1 ? rgba(pal.accent, 0.45 + lit * 0.55) : rgba(pal.ink, 0.52);
          ctx.lineWidth = lit > 0.1 ? 1.5 : 1.1;
          ctx.stroke();

          ctx.strokeStyle = lit > 0.1 ? pal.accent : rgba(pal.ink, 0.74);
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          if (glyph === 'H') {
            ctx.moveTo(x - 3.3, y - 4.2); ctx.lineTo(x - 3.3, y + 4.2);
            ctx.moveTo(x + 3.3, y - 4.2); ctx.lineTo(x + 3.3, y + 4.2);
            ctx.moveTo(x - 3.3, y); ctx.lineTo(x + 3.3, y);
          } else if (glyph === 'X') {
            ctx.moveTo(x - 3.6, y - 3.6); ctx.lineTo(x + 3.6, y + 3.6);
            ctx.moveTo(x + 3.6, y - 3.6); ctx.lineTo(x - 3.6, y + 3.6);
          } else if (glyph === 'Z') {
            ctx.moveTo(x - 3.6, y - 3.6); ctx.lineTo(x + 3.6, y - 3.6);
            ctx.lineTo(x - 3.6, y + 3.6); ctx.lineTo(x + 3.6, y + 3.6);
          }
          ctx.stroke();
        }

        function drawCNOT(x, yCtrl, yTarg, lit) {
          const col = lit > 0.1 ? pal.accent : rgba(pal.ink, 0.58);
          ctx.beginPath();
          ctx.moveTo(x, yCtrl);
          ctx.lineTo(x, yTarg);
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.15;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(x, yCtrl, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();

          const r = gateHalf * 0.76;
          ctx.beginPath();
          ctx.arc(x, yTarg, r, 0, Math.PI * 2);
          ctx.fillStyle = pal.bg;
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.15;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - r, yTarg); ctx.lineTo(x + r, yTarg);
          ctx.moveTo(x, yTarg - r); ctx.lineTo(x, yTarg + r);
          ctx.stroke();
        }

        function drawMeter(x, y, outcome, measured) {
          const s = gateHalf;
          ctx.beginPath();
          ctx.rect(x - s, y - s, s * 2, s * 2);
          ctx.fillStyle = pal.bg;
          ctx.fill();
          ctx.strokeStyle = measured ? rgba(pal.accent, 0.82) : rgba(pal.ink, 0.50);
          ctx.lineWidth = 1.15;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(x, y + 3.5, 6.2, Math.PI, 0);
          ctx.strokeStyle = rgba(pal.ink, 0.45);
          ctx.lineWidth = 1.0;
          ctx.stroke();

          const needleAng = measured
            ? (outcome ? -0.85 : -2.28)
            : (-Math.PI * 0.5 + Math.sin(t * 4 + y) * 0.28);
          ctx.beginPath();
          ctx.moveTo(x, y + 4);
          ctx.lineTo(x + Math.cos(needleAng) * 7.5, y + 4 + Math.sin(needleAng) * 7.5);
          ctx.strokeStyle = measured ? pal.accent : rgba(pal.ink, 0.74);
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }

        const litH1 = Math.exp(-Math.pow((c - 0.14) / 0.04, 2));
        const litCN1 = Math.exp(-Math.pow((c - 0.24) / 0.04, 2));
        const litCN2 = Math.exp(-Math.pow((c - 0.40) / 0.04, 2));
        const litH0 = Math.exp(-Math.pow((c - 0.49) / 0.04, 2));
        const measured = c > 0.58;
        const litX = state.m1 === 1 ? Math.exp(-Math.pow((c - 0.74) / 0.045, 2)) : 0;
        const litZ = state.m0 === 1 ? Math.exp(-Math.pow((c - 0.82) / 0.045, 2)) : 0;

        drawGateBox(xH1, y1, 'H', litH1);
        drawCNOT(xCN1, y1, y2, litCN1);
        drawCNOT(xCN2, y0, y1, litCN2);
        drawGateBox(xH0, y0, 'H', litH0);
        drawMeter(xM, y0, state.m0, measured);
        drawMeter(xM, y1, state.m1, measured);
        drawGateBox(xX, y2, 'X', litX);
        drawGateBox(xZ, y2, 'Z', litZ);

        // Input state glyph on q0
        const waveX = leftX + span * Math.min(1, c * 1.04);
        if (ptr.inside && ptr.nx < 0.28) {
          drawStateGlyph(ctx, leftX, y0, 8.8, state.inputAngle, pal, 0.55);
        }
        if (waveX < xM) {
          const fadeOut = waveX > xH0 ? Math.max(0, 1 - (waveX - xH0) / (xM - xH0)) : 1;
          drawStateGlyph(ctx, waveX, y0, 9.8 + state.customPulse * 2, state.inputAngle, pal, fadeOut);
        }

        // Teleported & Pauli-corrected state emerging on Bob's wire q2
        if (c > 0.55) {
          const bobX = xM + (rightX - xM) * Math.min(1, (c - 0.55) / 0.42);
          let bobAngle = state.inputAngle;
          if (bobX < xZ && state.m0 === 1) bobAngle = -bobAngle;
          if (bobX < xX && state.m1 === 1) bobAngle = Math.PI - bobAngle;

          const bobAlpha = Math.min(1, (c - 0.55) / 0.08) * (c > 0.93 ? (1 - c) / 0.07 : 1);
          drawStateGlyph(ctx, bobX, y2, 9.8, bobAngle, pal, bobAlpha);
        }
      }
    };
  }

  /* =======================================================================
     BOOT & LIFECYCLE
     ======================================================================= */
  const stage = document.getElementById('quantum-stage');
  if (!stage) return;

  const sceneName = pickScene();
  const engine = sceneName === 'doubleslit'
    ? createDoubleSlit()
    : sceneName === 'bloch'
      ? createBlochSphere()
      : createTeleportation();

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const ptr = { nx: 0.5, ny: 0.5, inside: false, down: false };
  let width = 300;
  let height = 240;

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(stage);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  function getCoords(e) {
    const r = canvas.getBoundingClientRect();
    return {
      nx: Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))),
      ny: Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height)))
    };
  }

  canvas.addEventListener('pointerenter', (e) => {
    const p = getCoords(e);
    ptr.nx = p.nx; ptr.ny = p.ny; ptr.inside = true;
  });

  canvas.addEventListener('pointerleave', () => {
    ptr.inside = false;
    if (ptr.down && engine.onUp) engine.onUp();
    ptr.down = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = getCoords(e);
    ptr.nx = p.nx; ptr.ny = p.ny; ptr.inside = true;
    if (engine.onMove) engine.onMove(p.nx, p.ny, width, height);
  });

  canvas.addEventListener('pointerdown', (e) => {
    const p = getCoords(e);
    ptr.nx = p.nx; ptr.ny = p.ny; ptr.inside = true; ptr.down = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (engine.onDown) engine.onDown(p.nx, p.ny, width, height);
  });

  canvas.addEventListener('pointerup', (e) => {
    const p = getCoords(e);
    ptr.down = false;
    if (engine.onUp) engine.onUp(p.nx, p.ny, width, height);
    if (engine.onClick) engine.onClick(p.nx, p.ny, width, height);
  });

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timeScale = prefersReduced ? 0.35 : 1.0;

  let lastTime = performance.now();
  let rafId = null;

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000) * timeScale;
    lastTime = now;
    if (!document.hidden) {
      engine.render(ctx, width, height, (now / 1000) * timeScale, dt, ptr, PALETTE);
    }
    rafId = requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastTime = performance.now();
  });

  rafId = requestAnimationFrame(loop);
})();
