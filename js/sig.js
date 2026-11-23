// =====================================================================
// CHIÊU CÓ CHỮ KÝ (SIG): biên đạo riêng từng tướng, thay khuôn chung. Sát thương giữ đúng tổng như mô tả.
//   SIG[id].small(u, sk, tgt) / SIG[id].ult(u, sk, tgt): thay hẳn chiêu
//   SIG[id].ultPre(u, P) / SIG[id].ultHit(u, P): thêm nhịp vào tuyệt kỹ biên đạo sẵn có
// Hiệu ứng dùng B.fx kiểu 'sigx' { upd(f, dt), draw(f, p) } (main.js gọi trong vòng cập nhật / vẽ).
// Mẫu: Ngưu Ma Vương (SSR), Na Tra (SSR+), Thông Thiên (UR).
// =====================================================================
const SIG = {};
['tru_sword', 'golden_ring', 'spear_fire', 'firewheel'].forEach(n => ucImg(n));
function sigFx(o) { const f = Object.assign({ k: 'sigx', t: 0, done: {} }, o); B.fx.push(f); return f; }
function sigOnce(f, k, fn) { if (!f.done[k]) { f.done[k] = 1; fn(); } }
function sigPt(u, r, tgt) { return bestCluster(r) || (tgt ? { x: tgt.x, y: tgt.y } : { x: u.x + 220 * (u.f || 1), y: u.y }); }
function sigImg(n, x, y, S, rot, a, filter) {
  const im = ucImg(n); if (!im) return; const w = S, h = S * im.height / im.width;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.globalAlpha = a == null ? 1 : a; if (filter) ctx.filter = filter;
  ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
}
function sigGlow(x, y, r, col, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
function sigRand(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

// ---------------------------------------------------------------- NGƯU MA VƯƠNG (SSR)
SIG.ngumavuong = {
  // Tiểu chiêu: giậm đất → vết nứt chạy tới chỗ quái đông → đá nhọn phun lên (sát thương + choáng lúc đá trồi)
  small(u, sk, tgt) {
    const P = sigPt(u, 110, tgt), f0 = sk.fx.find(f => f.t === 'aoe'), R = sigRand((u.x | 0) + 7);
    for (const f of sk.fx) if (f.t !== 'aoe') runFx(u, f, tgt, 'skill');
    const x0 = u.x + 26 * u.f, y0 = u.y, pts = []; const n = 14;
    for (let i = 0; i <= n; i++) { const q = i / n; pts.push([x0 + (P.x - x0) * q + (i && i < n ? (R() - 0.5) * 26 : 0), y0 + (P.y - y0) * q + (i && i < n ? (R() - 0.5) * 16 : 0)]); }
    const spikes = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU + R(), d: 18 + R() * 60, h: 40 + R() * 46, w: 14 + R() * 10 }));
    B.shake = Math.max(B.shake, 0.3); sfx('boom'); particles(x0, y0, '#a08060', 14, 160, 5);
    sigFx({ dur: 1.0, upd(f) {
      if (f.t >= 0.36) sigOnce(f, 'hit', () => { runFx(u, { ...f0, P }, tgt, 'skill'); B.shake = Math.max(B.shake, 0.45); sfx('boom');
        particles(P.x, P.y - 20, '#8a6a4a', 26, 300, 7); particles(P.x, P.y - 10, '#ffb040', 14, 220, 4); fxBurst(P.x, P.y - 30, 'smoke', 200);
        B.decals.push({ x: P.x, y: P.y + 4, r: 100, t: 0, dur: 4 }); });
    }, draw(f, p) {
      const q = Math.min(1, f.t / 0.36), k = Math.max(1, Math.floor(q * n));
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, col, a] of [[10, '#ff7a1a', 0.55], [4, '#2a1408', 1], [1.6, '#ffd070', 1]]) {   // khe nứt có lửa bên trong
        ctx.globalAlpha = a * (p > 0.75 ? (1 - p) / 0.25 : 1); ctx.strokeStyle = col; ctx.lineWidth = w; if (col === '#ff7a1a') ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= k; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
      if (f.t >= 0.36) {   // đá nhọn trồi lên rồi vỡ
        const e = Math.min(1, (f.t - 0.36) / 0.12), fade = f.t > 0.75 ? Math.max(0, 1 - (f.t - 0.75) / 0.25) : 1;
        sigGlow(P.x, P.y - 10, 120, 'rgba(255,140,40,0.8)', 0.6 * fade);
        for (const s of spikes) {
          const sx = P.x + Math.cos(s.a) * s.d, sy = P.y + Math.sin(s.a) * s.d * 0.45, hh = s.h * e * (f.t > 0.7 ? 1 - (f.t - 0.7) * 2.4 : 1);
          if (hh <= 2) continue;
          ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = '#7a5a40'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx - s.w / 2, sy); ctx.lineTo(sx + (s.a > 3 ? -4 : 4), sy - hh); ctx.lineTo(sx + s.w / 2, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#b08a60'; ctx.beginPath(); ctx.moveTo(sx - s.w / 2 + 3, sy); ctx.lineTo(sx + (s.a > 3 ? -4 : 4), sy - hh); ctx.lineTo(sx - 1, sy); ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
    } });
  },
  // Tuyệt kỹ: thêm nhịp GẦM (sóng âm + sân loé đỏ) trước hồn trâu, và CỘT LỬA Hoả Diệm Sơn lúc trâu húc trúng
  ultPre(u) {
    sigFx({ ult: 1, dur: 0.9, draw(f, p) {
      ctx.save(); ctx.globalAlpha = 0.28 * Math.sin(Math.PI * p); ctx.fillStyle = '#ff2a10'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();
      for (let i = 0; i < 3; i++) { const q = p * 1.4 - i * 0.18; if (q <= 0 || q >= 1) continue;
        ctx.save(); ctx.globalAlpha = (1 - q) * 0.9; ctx.strokeStyle = '#ffd0a0'; ctx.lineWidth = 6 * (1 - q) + 1; ctx.beginPath(); ctx.ellipse(u.x, u.y - 60, 40 + q * 360, (40 + q * 360) * 0.55, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    } });
    B.shake = Math.max(B.shake, 0.5); snd('thunder', 0.6, 0.7);
  },
  ultHit(u, P) {
    sigFx({ ult: 1, dur: 1.4, draw(f, p) {
      const rise = Math.min(1, p / 0.2), fade = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1, hh = 320 * rise, w = 90 + 30 * Math.sin(p * 30);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
      const g = ctx.createLinearGradient(0, P.y, 0, P.y - hh); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.3, 'rgba(255,140,30,0.95)'); g.addColorStop(1, 'rgba(255,40,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(P.x - w, P.y); ctx.quadraticCurveTo(P.x - w * 0.3, P.y - hh * 0.5, P.x, P.y - hh); ctx.quadraticCurveTo(P.x + w * 0.3, P.y - hh * 0.5, P.x + w, P.y); ctx.closePath(); ctx.fill(); ctx.restore();
      sigGlow(P.x, P.y - 20, 200, 'rgba(255,120,20,0.9)', 0.7 * fade);
      if (Math.random() < 0.5) particles(P.x + (Math.random() - 0.5) * 120, P.y - 20, '#ffb040', 2, 260, 5);
    } });
    fxBurst(P.x, P.y - 60, 'fire', 300); B.flash = Math.max(B.flash || 0, 0.25);
  },
};

// ---------------------------------------------------------------- NA TRA (SSR+)
SIG.nata = {
  // Tiểu chiêu: 3 Càn Khôn Quyển vàng xoay tròn, kéo vệt lửa, toả rộng rồi quét qua đám quái (mỗi vòng trúng mỗi quái 1 lần)
  small(u, sk, tgt) {
    const f0 = sk.fx[0], P = sigPt(u, 120, tgt), x0 = u.x + 20 * u.f, y0 = u.y - 50;
    const dx = P.x - x0, dy = P.y - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const n = (f0.n || 3) + TG(u, 'skillN');
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 150, c1 = { x: x0 + dx * 0.45 + nx * off, y: y0 + dy * 0.45 + ny * off * 0.6 }, end = { x: P.x + dx / L * 140, y: P.y + dy / L * 60 };
      sigFx({ dur: 0.85, delay: i * 0.06, hit: new Set(), trail: [], upd(f) {
        const q = Math.max(0, Math.min(1, (f.t - f.delay) / 0.7)); if (q <= 0) return;
        const a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q;
        f.x = a * x0 + b * c1.x + c * end.x; f.y = a * y0 + b * c1.y + c * end.y; f.trail.push([f.x, f.y]); if (f.trail.length > 12) f.trail.shift();
        for (const e of B.enemies) if (!e.dead && !f.hit.has(e) && Math.hypot(e.x - f.x, (e.y - 30) - f.y) < 34 + unitR(e)) {
          f.hit.add(e); dealDmg(u, e, f0.mult, 'skill'); particles(e.x, e.y - 30, '#ffcf3f', 6, 180, 3); }
      }, draw(f, p) {
        if (f.x == null) return; const a = p > 0.85 ? (1 - p) / 0.15 : 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        f.trail.forEach(([tx, ty], j) => { const k = (j + 1) / f.trail.length; ctx.globalAlpha = 0.5 * k * a; ctx.fillStyle = j > 8 ? '#ffd060' : '#ff6a1a'; ctx.beginPath(); ctx.arc(tx, ty, 6 + 12 * k, 0, TAU); ctx.fill(); });
        ctx.restore();
        sigImg('golden_ring', f.x, f.y, 52, f.t * 22, a);
      } });
    }
    sfx('shoot'); snd('whoosh');
  },
  // Tuyệt kỹ: Tam Đầu Lục Tý (2 thân phụ hiện hai bên) → 6 Hoả Tiêm Thương phóng liên tiếp → Phong Hoả Luân lăn dọc đường lửa
  ult(u, sk, tgt) {
    const f0 = sk.fx[0], ty = tgt ? tgt.y : u.y, a0 = tgt ? Math.atan2(ty - u.y, tgt.x - u.x) : 0, len = f0.len;
    const x2 = u.x + Math.cos(a0) * len, y2 = u.y + Math.sin(a0) * len, h = spriteH(u);
    B.slowmo = 0.3; B.cam = { x: u.x + 120, y: u.y - 60, t: 0, dur: 0.7 };
    sigFx({ ult: 1, dur: 2.4, upd(f) {
      for (let i = 0; i < 6; i++) if (f.t >= 0.5 + i * 0.09) sigOnce(f, 's' + i, () => { sfx('shoot'); });
      if (f.t >= 1.1) sigOnce(f, 'hit', () => { runFx(u, f0, tgt, 'ult'); B.shake = Math.max(B.shake, 0.9); B.flash = 0.25; sfx('boom'); });
    }, draw(f, p) {
      const t = f.t;
      if (t < 1.2) {   // ba đầu sáu tay: hai thân phụ hiện hai bên
        const e = Math.min(1, t / 0.3), fade = t > 0.9 ? 1 - (t - 0.9) / 0.3 : 1;
        sigGlow(u.x, u.y - h * 0.5, h * 0.9, 'rgba(255,90,30,0.85)', 0.7 * e * fade);
        for (const s of [-1, 1]) { ctx.save(); ctx.translate(u.x + s * 30 * e, u.y); ctx.rotate(s * 0.28 * e); ctx.scale(u.f * 1.12, 1.12); ctx.filter = 'sepia(1) saturate(4) hue-rotate(-20deg) brightness(1.2)';
          if (!drawPose({ id: u.id, hurt: 0 }, 'ult', 0, h, 0.5 * e * fade)) { ctx.filter = 'none'; } ctx.restore(); }
      }
      for (let i = 0; i < 6; i++) {   // giáo lửa
        const s0 = 0.5 + i * 0.09, q = (t - s0) / 0.32; if (q < 0 || q > 1.6) continue;
        const tx = u.x + (x2 - u.x) * (0.25 + i * 0.13), tyy = u.y + (y2 - u.y) * (0.25 + i * 0.13) + (i % 2 ? 22 : -22);
        const sx = u.x + 10 * u.f, sy = u.y - h * 0.7 - (i % 3) * 16, qq = Math.min(1, q), px = sx + (tx - sx) * qq, py = sy + (tyy - 30 - sy) * qq - Math.sin(qq * Math.PI) * 40;
        const ang = Math.atan2((tyy - 30) - sy, tx - sx);
        if (q <= 1) sigImg('spear_fire', px, py, 22, ang + Math.PI / 2, 1); else { sigGlow(tx, tyy - 30, 70, 'rgba(255,120,30,0.9)', 1.6 - q); }
        if (q > 1 && q < 1.08) sigOnce(f, 'b' + i, () => fxBurst(tx, tyy - 30, 'fire', 150));
      }
      if (t >= 1.05) {   // Phong Hoả Luân lăn dọc đường lửa, để lại vệt cháy
        const q = Math.min(1, (t - 1.05) / 0.9), wx = u.x + (x2 - u.x) * q, wy = u.y + (y2 - u.y) * q - 30, fade = t > 2.0 ? 1 - (t - 2.0) / 0.4 : 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 46; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(u.x, u.y - 30); ctx.lineTo(wx, wy); ctx.stroke(); ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 12; ctx.stroke(); ctx.restore();
        if (q < 1) { sigImg('firewheel', wx, wy, 110, t * 18, 1); sigGlow(wx, wy, 90, 'rgba(255,140,40,0.9)', 0.8); if (Math.random() < 0.6) particles(wx, wy + 20, '#ff9a3a', 2, 160, 4); }
      }
    } });
    snd('magic');
  },
};

// ---------------------------------------------------------------- THÔNG THIÊN GIÁO CHỦ (UR)
const TT_SW = [['Tru Tiên', 'none', '#ff3a3a'], ['Lục Tiên', 'hue-rotate(200deg) saturate(1.4)', '#3aa8ff'], ['Hãm Tiên', 'hue-rotate(260deg) saturate(1.5)', '#b05aff'], ['Tuyệt Tiên', 'grayscale(1) brightness(1.5)', '#e8e8ff']];
SIG.giaochu = {
  // Tiểu chiêu: lưỡi kiếm khí lưỡi liềm đỏ quét ngang đám quái
  small(u, sk, tgt) {
    const f0 = sk.fx[0], P = sigPt(u, 110, tgt);
    sigFx({ dur: 0.55, upd(f) { if (f.t >= 0.12) sigOnce(f, 'hit', () => { runFx(u, { ...f0, P }, tgt, 'skill'); B.shake = Math.max(B.shake, 0.3); }); },
      draw(f, p) {
        const R = 120, sweep = Math.min(1, p / 0.35), a0 = -2.6, a1 = a0 + 2.9 * sweep, fade = p > 0.45 ? 1 - (p - 0.45) / 0.55 : 1;
        ctx.save(); ctx.translate(P.x, P.y - 40); ctx.scale(1, 0.6); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [w, col, a] of [[34, '#ff2a2a', 0.35], [16, '#ff6a5a', 0.8], [5, '#ffffff', 1]]) {
          ctx.globalAlpha = a * fade; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, R, Math.max(a0, a1 - 1.6), a1); ctx.stroke(); }
        ctx.restore();
        for (let i = 0; i < 3; i++) { const q = Math.min(1, Math.max(0, (p - 0.15 - i * 0.07) / 0.2)); if (q <= 0 || q >= 1) continue;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#ffd0d0'; ctx.lineWidth = 3;
          const yy = P.y - 70 + i * 26; ctx.beginPath(); ctx.moveTo(P.x - 120 + q * 40, yy - 30); ctx.lineTo(P.x + 120 - q * 40, yy + 30); ctx.stroke(); ctx.restore(); }
      } });
    snd('whoosh');
  },
  // Tuyệt kỹ: TRU TIÊN KIẾM TRẬN — 4 kiếm bay cắm 4 góc → kiếm khí nối thành trận → chém liên hoàn 4 nhịp → trận nổ
  ult(u, sk, tgt) {
    const f0 = sk.fx[0], P0 = sigPt(u, 160, tgt), rx = 175, ry = 95, h = spriteH(u);
    const P = { x: Math.min(P0.x, VIEW_R() - rx - 40), y: clamp(P0.y, LANE_Y0 + ry * 0.6, LANE_Y1 - ry * 0.4) };   // trận luôn nằm trọn trong sân
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: P.x + a * rx, y: P.y + b * ry }));
    const per = f0.mult * 0.2, fin = f0.mult * 0.2;   // 4 nhịp × 20% + nổ cuối 20% = đúng tổng
    const inTrap = () => B.enemies.filter(e => !e.dead && Math.pow((e.x - P.x) / (rx + 20), 2) + Math.pow((e.y - P.y) / (ry + 20), 2) <= 1);
    B.cam = { x: P.x, y: P.y - 40, t: 0, dur: 2.6 };
    sigFx({ ult: 1, dur: 2.9, slashes: [], upd(f, dt) {
      for (let i = 0; i < 4; i++) if (f.t >= 0.55 + i * 0.05) sigOnce(f, 'land' + i, () => { const c = corners[i]; fxBurst(c.x, c.y - 20, 'ring', 140); B.shake = Math.max(B.shake, 0.4); sfx('boom'); B.decals.push({ x: c.x, y: c.y + 4, r: 40, t: 0, dur: 4 }); });
      for (let k = 0; k < 4; k++) if (f.t >= 1.0 + k * 0.3) sigOnce(f, 'cut' + k, () => { for (const e of inTrap()) dealDmg(u, e, per, 'ult'); B.shake = Math.max(B.shake, 0.3); sfx('hit'); });
      if (f.t >= 2.25) sigOnce(f, 'fin', () => { for (const e of inTrap()) dealDmg(u, e, fin, 'ult'); B.shake = 1.1; B.flash = 0.35; sfx('boom'); snd('thunder', 0.8, 0.7);
        fxBurst(P.x, P.y - 50, 'burst_gold', 420); fxBurst(P.x, P.y - 30, 'ring', 520); B.decals.push({ x: P.x, y: P.y + 4, r: 200, t: 0, dur: 6 }); particles(P.x, P.y - 30, '#ff5a5a', 40, 420, 6); });
      if (f.t > 0.95 && f.t < 2.2 && Math.random() < dt * 22) {   // vệt kiếm khí chém ngẫu nhiên trong trận
        const a = Math.random() * TAU, r = 60 + Math.random() * 100, cx = P.x + (Math.random() - 0.5) * rx, cy = P.y + (Math.random() - 0.5) * ry;
        f.slashes.push({ x1: cx - Math.cos(a) * r, y1: cy - Math.sin(a) * r * 0.55, x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r * 0.55, t: 0, col: TT_SW[(Math.random() * 4) | 0][2] }); }
      for (const s of f.slashes) s.t += dt; f.slashes = f.slashes.filter(s => s.t < 0.22);
    }, draw(f, p) {
      const t = f.t, fade = t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.5) : 1;
      ctx.save(); ctx.globalAlpha = 0.5 * Math.sin(Math.PI * Math.min(1, t / 2.9)); ctx.fillStyle = '#12040a'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();   // trời tối
      if (t >= 0.6) {   // trận đồ dưới đất: vòng elip + nối 4 kiếm
        const e = Math.min(1, (t - 0.6) / 0.35); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
        ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(P.x, P.y, rx * 1.12 * e, ry * 1.12 * e, 0, 0, TAU); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,200,200,0.7)'; ctx.beginPath(); ctx.ellipse(P.x, P.y, rx * 0.7 * e, ry * 0.7 * e, t * 0.5, 0, TAU); ctx.stroke();
        for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i + 1) % 4], c = corners[(i + 2) % 4], k = Math.min(1, e * 1.4 - i * 0.1);
          if (k <= 0) continue; ctx.strokeStyle = TT_SW[i][2]; ctx.lineWidth = 4; ctx.shadowColor = TT_SW[i][2]; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.moveTo(a.x, a.y - 30); ctx.lineTo(a.x + (b.x - a.x) * k, a.y - 30 + (b.y - a.y) * k); ctx.stroke();
          ctx.globalAlpha = 0.35 * fade; ctx.beginPath(); ctx.moveTo(a.x, a.y - 30); ctx.lineTo(a.x + (c.x - a.x) * k, a.y - 30 + (c.y - a.y) * k); ctx.stroke(); ctx.globalAlpha = fade; }
        ctx.restore();
      }
      for (const s of f.slashes) { const q = s.t / 0.22; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q; ctx.lineCap = 'round';
        ctx.strokeStyle = s.col; ctx.lineWidth = 9 * (1 - q) + 2; ctx.beginPath(); ctx.moveTo(s.x1, s.y1 - 30); ctx.lineTo(s.x2, s.y2 - 30); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      for (let i = 0; i < 4; i++) {   // 4 kiếm: bay từ trên đầu Thông Thiên tới 4 góc, mũi chĩa xuống, cắm đất; cuối cùng bị hút vào tâm
        const c = corners[i], s0 = i * 0.05, q = Math.min(1, Math.max(0, (t - s0) / 0.55)); if (t < s0) continue;
        const sx = u.x + (i - 1.5) * 34, sy = u.y - h - 40, eq = 1 - Math.pow(1 - q, 3);
        let x = sx + (c.x - sx) * eq, y = (sy + (c.y - 70 - sy) * eq) - Math.sin(q * Math.PI) * 80, rot = (q < 1 ? (1 - q) * (i < 2 ? -1.2 : 1.2) : 0), S = 96;
        if (t > 2.05) { const k = Math.min(1, (t - 2.05) / 0.2); x += (P.x - x) * k; y += (P.y - 90 - y) * k; S *= 1 - 0.4 * k; }
        if (t < 2.3) { sigGlow(x, y, 54, TT_SW[i][2], 0.7 * fade); sigImg('tru_sword', x, y, S * 0.42, rot, fade, TT_SW[i][1] !== 'none' ? TT_SW[i][1] : null); }
        if (q >= 1 && t < 2.05) { ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff'; ctx.font = '800 12px "Baloo 2",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = TT_SW[i][2];
          ctx.strokeText(TT_SW[i][0], c.x, c.y + 18); ctx.fillText(TT_SW[i][0], c.x, c.y + 18); ctx.restore(); }
      }
    } });
    snd('gong');
  },
};
