'use strict';
// =====================================================================
// Rig 2D theo bộ phận (kiểu Spine) — dựng từ art/parts/<id>/rig.js (tools/build_rig.py).
// Mỗi xương = một mảnh ảnh. Góc xương tính theo hệ toạ độ thế giới: 0 = sang phải, PI/2 = xuống.
// Nhân vật quay mặt sang phải; game lật ngang khi quay trái.
// =====================================================================
const Rig = (() => {
  const PI = Math.PI, HP = Math.PI / 2;
  const RIGS = {};
  const ORDER_FRONT = ['cape', 'tail', 'armB_up', 'armB_lo', 'legB_up', 'legB_lo', 'legF_up', 'legF_lo', 'pelvis', 'torso', 'head', 'staff', 'armF_up', 'armF_lo'];
  const ORDER_BEHIND = ['cape', 'tail', 'staff', 'armB_up', 'armB_lo', 'legB_up', 'legB_lo', 'legF_up', 'legF_lo', 'pelvis', 'torso', 'head', 'armF_up', 'armF_lo'];

  function load(id) {
    const d = (window.RIG_DEFS || {})[id];
    if (!d) return Promise.resolve(false);
    const jobs = Object.values(d.parts).map(p => new Promise(res => {
      const im = new Image();
      im.onload = () => { p.img = im; res(); };
      im.onerror = () => res();
      im.src = d.dir + p.file;
    }));
    return Promise.all(jobs).then(() => {
      if (Object.values(d.parts).some(p => !p.img)) return false;
      RIGS[id] = build(d);
      return true;
    });
  }

  function build(d) {
    const P = d.parts, T = d.tune || {};
    const axis = { head: -HP, torso: -HP, pelvis: HP, cape: HP };
    for (const k in P) if (P[k].ang == null) P[k].ang = axis[k];
    const fr = (p, f) => [f[0] * p.w - p.pivot[0], f[1] * p.h - p.pivot[1]];
    const tip = p => [p.tip[0] - p.pivot[0], p.tip[1] - p.pivot[1]];
    const tt = T.torso || {}, tp = T.pelvis || {}, th = T.head || {};
    const neck = fr(P.torso, tt.neck || [0.5, 0.05]);
    const bones = [
      ['pelvis', null, [0, 0]],
      ['torso', 'pelvis', [0, P.pelvis.h * (tp.overlap || 0.08)]],
      ['head', 'torso', [neck[0], neck[1] + P.head.h * (th.overlap || 0.05)]],
      ['cape', 'torso', fr(P.torso, tt.cape || [0.5, 0.1])],
      ['armB_up', 'torso', fr(P.torso, tt.shB || [0.7, 0.2])],
      ['armB_lo', 'armB_up', tip(P.armB_up)],
      ['armF_up', 'torso', fr(P.torso, tt.shF || [0.3, 0.2])],
      ['armF_lo', 'armF_up', tip(P.armF_up)],
      ['staff', 'armF_lo', tip(P.armF_lo)],
      ['legB_up', 'pelvis', fr(P.pelvis, tp.hipB || [0.42, 0.3])],
      ['legB_lo', 'legB_up', tip(P.legB_up)],
      ['legF_up', 'pelvis', fr(P.pelvis, tp.hipF || [0.58, 0.3])],
      ['legF_lo', 'legF_up', tip(P.legF_up)],
      ['tail', 'pelvis', fr(P.pelvis, tp.tail || [0.3, 0.3])],
    ];
    const rig = { P, bones };
    // đo chiều cao tư thế nghỉ: chân chạm đất ở y = 0
    const W = solve(rig, { a: REST, rx: 0, ry: 0 });
    const footY = Math.max(pt(W.legF_lo, P.legF_lo, [P.legF_lo.pivot[0], P.legF_lo.h])[1],
                           pt(W.legB_lo, P.legB_lo, [P.legB_lo.pivot[0], P.legB_lo.h])[1]);
    const headY = pt(W.head, P.head, [P.head.pivot[0], 0])[1];
    rig.hipH = footY * 0.985;
    rig.height = footY - headY;
    return rig;
  }

  // điểm (toạ độ ảnh của mảnh) → toạ độ thế giới
  function pt(w, p, q) {
    const dx = (q[0] - p.pivot[0]) * w.sc, dy = (q[1] - p.pivot[1]) * w.sc;
    const c = Math.cos(w.rot), s = Math.sin(w.rot);
    return [w.x + dx * c - dy * s, w.y + dx * s + dy * c];
  }

  function solve(rig, pose) {
    const W = {};
    for (const [n, par, off] of rig.bones) {
      const p = rig.P[n];
      const rot = pose.a[n] - p.ang;
      const sc = (pose.sc && pose.sc[n]) || 1;
      let x, y;
      if (!par) { x = pose.rx; y = pose.ry; } else {
        const q = W[par], c = Math.cos(q.rot), s = Math.sin(q.rot);
        x = q.x + (off[0] * c - off[1] * s) * q.sc;
        y = q.y + (off[0] * s + off[1] * c) * q.sc;
      }
      W[n] = { x, y, rot, sc };
    }
    return W;
  }

  // ------------------------------------------------------------ tư thế
  const REST = { pelvis: HP, torso: -HP, head: -HP, cape: HP, tail: -HP - 0.5,
    armF_up: HP, armF_lo: HP, armB_up: HP, armB_lo: HP, legF_up: HP, legF_lo: HP, legB_up: HP, legB_lo: HP, staff: 0 };
  // các tư thế khoá (góc thế giới, chưa tính độ nghiêng thân)
  const K = {
    idle: { legF_up: HP - 0.22, legF_lo: HP - 0.06, legB_up: HP + 0.22, legB_lo: HP + 0.08,
      armB_up: HP + 0.30, armB_lo: HP - 0.35, armF_up: HP - 0.75, armF_lo: -HP + 0.15, staff: -PI + 0.30 },
    windup: { armF_up: -HP - 0.55, armF_lo: -HP - 0.85, staff: -PI - 0.55, armB_up: HP + 0.9, armB_lo: HP + 0.2,
      legF_up: HP - 0.35, legF_lo: HP + 0.05, legB_up: HP + 0.35, legB_lo: HP + 0.15 },
    smash: { armF_up: HP - 1.05, armF_lo: 0.15, staff: 0.42, armB_up: HP + 0.55, armB_lo: HP - 0.2,
      legF_up: HP - 0.55, legF_lo: HP + 0.1, legB_up: HP + 0.45, legB_lo: HP + 0.25 },
    cast: { armF_up: -HP - 0.15, armF_lo: -HP - 0.05, staff: -HP - 0.05, armB_up: -0.35, armB_lo: -0.9,
      legF_up: HP - 0.2, legF_lo: HP - 0.05, legB_up: HP + 0.2, legB_lo: HP + 0.08 },
  };
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  function mix(a, b, t) {
    const o = {};
    for (const k in REST) o[k] = (a[k] != null ? a[k] : REST[k]) * (1 - t) + (b[k] != null ? b[k] : REST[k]) * t;
    return o;
  }
  const full = k => mix(K[k], K[k], 0);

  // state: { anim: 'idle'|'walk'|'attack'|'cast', t (giây), p (0..1 cho attack/cast), phys }
  function pose(rig, st) {
    const t = st.t || 0;
    let a, tilt = 0, rx = 0, bob = 0, staffBehind = false, breath = 0;
    if (st.anim === 'attack') {
      const p = st.p;
      if (p < 0.38) { a = mix(K.idle, K.windup, easeOut(p / 0.38)); tilt = -0.14 * ease(p / 0.38); staffBehind = true; }
      else if (p < 0.58) { const q = easeOut((p - 0.38) / 0.2); a = mix(K.windup, K.smash, q); tilt = -0.14 + 0.36 * q; rx = 16 * q; }
      else { const q = ease((p - 0.58) / 0.42); a = mix(K.smash, K.idle, q); tilt = 0.22 * (1 - q); rx = 16 * (1 - q); bob = -6 * (1 - q) * 0; }
    } else if (st.anim === 'cast') {
      const q = easeOut(Math.min(1, st.p / 0.45));
      a = mix(K.idle, K.cast, q); tilt = -0.12 * q; bob = -10 * q;
    } else if (st.anim === 'walk') {
      const ph = t * 2 * PI * 1.6, s = Math.sin(ph), c = Math.cos(ph);
      a = full('idle');
      a.legF_up = HP + 0.55 * s; a.legB_up = HP - 0.55 * s;
      a.legF_lo = a.legF_up + 0.15 + 0.75 * Math.max(0, -c);
      a.legB_lo = a.legB_up + 0.15 + 0.75 * Math.max(0, c);
      a.armB_up = HP - 0.5 * s; a.armB_lo = a.armB_up - 0.35;
      a.armF_up += 0.12 * s; a.armF_lo += 0.12 * s; a.staff += 0.08 * s;
      tilt = 0.12; bob = -Math.abs(Math.sin(ph)) * 14 + 6;
    } else {
      const b = Math.sin(t * 2.4);
      a = full('idle');
      a.armF_up += 0.04 * b; a.armF_lo += 0.05 * b; a.staff += 0.03 * b;
      a.armB_up += 0.05 * Math.sin(t * 2.4 - 0.6); a.armB_lo += 0.06 * Math.sin(t * 2.4 - 0.8);
      bob = 3 * b; breath = 0.012 * b;
    }
    // nghiêng thân trên: cộng cho mọi xương thuộc thân trên
    for (const k of ['torso', 'head', 'armF_up', 'armF_lo', 'armB_up', 'armB_lo', 'staff', 'cape']) a[k] += tilt;
    a.head += -tilt * 0.4 + 0.05 * Math.sin(t * 2.4 - 0.9);
    // vật lý lò xo cho áo choàng và đuôi
    const ph = st.phys;
    if (ph) {
      a.cape = HP + 0.12 + ph.cape;
      a.tail = -HP - 0.55 + ph.tail + 0.18 * Math.sin(t * 3.1);
    } else { a.cape = HP + 0.12 + tilt * 0.5; a.tail = -HP - 0.55 + 0.18 * Math.sin(t * 3.1); }
    return { a, rx, ry: -rig.hipH + bob, staffBehind, sc: { torso: 1 + breath, staff: 0.62 } };
  }

  // Cập nhật vật lý lò xo (gọi mỗi khung): vx = vận tốc ngang (px/s, đã nhân hướng mặt)
  function physics(ph, dt, vx, tilt) {
    const targetCape = -Math.min(0.9, Math.max(-0.3, vx * 0.006)) - (tilt || 0) * 0.3;
    const targetTail = -Math.min(0.6, Math.max(-0.4, vx * 0.004));
    ph.capeV += ((targetCape - ph.cape) * 60 - ph.capeV * 8) * dt; ph.cape += ph.capeV * dt;
    ph.tailV += ((targetTail - ph.tail) * 40 - ph.tailV * 5) * dt; ph.tail += ph.tailV * dt;
  }

  // Vẽ: gốc toạ độ tại chân nhân vật, chiều cao hiển thị = h (px). Trả về vị trí đầu gậy (để vẽ vệt).
  function draw(ctx, id, st, h) {
    const rig = RIGS[id];
    if (!rig) return null;
    const ps = pose(rig, st);
    const W = solve(rig, ps);
    const k = h / rig.height;
    ctx.save();
    ctx.scale(k, k);
    for (const n of (ps.staffBehind ? ORDER_BEHIND : ORDER_FRONT)) {
      const w = W[n], p = rig.P[n];
      ctx.save();
      ctx.translate(w.x, w.y); ctx.rotate(w.rot);
      if (w.sc !== 1) ctx.scale(w.sc, w.sc);
      ctx.drawImage(p.img, -p.pivot[0], -p.pivot[1]);
      ctx.restore();
    }
    ctx.restore();
    const s = rig.P.staff;
    if (!s) return null;
    const tp = pt(W.staff, s, s.tip);
    return [tp[0] * k, tp[1] * k];
  }

  return { load, draw, physics, has: id => !!RIGS[id], newPhys: () => ({ cape: 0, capeV: 0, tail: 0, tailV: 0 }) };
})();
