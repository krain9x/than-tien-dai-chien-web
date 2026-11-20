'use strict';
// =====================================================================
// Nhân vật tách lớp kiểu Live2D: thân nền (khung nướng sẵn, biến dạng lưới)
// + các lớp cắt từ tranh gốc (tay+vũ khí, đầu, đuôi) xoay quanh khớp lúc chạy.
// Dữ liệu: art/layers/<id>/layers.js (tools/make_layers.py + tools/bake_layered.py)
// =====================================================================
const Layered = (() => {
  const L = {};
  const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

  function load(id) {
    const d = (window.LAYER_DEFS || {})[id];
    if (!d || !d.sheet) return Promise.resolve(false);
    const base = 'art/rig/' + id + '/';
    const files = { sheet: d.sheet.file };
    for (const k in d.layers) if (k !== 'body') files[k] = d.layers[k].file;
    const img = {};
    return Promise.all(Object.entries(files).map(([k, f]) => new Promise(res => {
      const im = new Image();
      im.onload = () => { img[k] = im; res(); };
      im.onerror = () => res();
      im.src = base + f;
    }))).then(() => {
      if (Object.keys(files).some(k => !img[k])) return false;
      L[id] = { d, img };
      return true;
    });
  }

  function frameIndex(sh, st) {
    const A = sh.anims;
    if (st.anim === 'attack') return A.attack.start + Math.min(A.attack.n - 1, Math.floor(st.p * A.attack.n));
    if (st.anim === 'cast') return A.cast.start + Math.min(A.cast.n - 1, Math.floor(st.p * A.cast.n));
    if (st.anim === 'walk') return A.walk.start + Math.floor(st.t * A.walk.fps) % A.walk.n;
    return A.idle.start + Math.floor((st.t || 0) * A.idle.fps) % A.idle.n;
  }

  // Khung khoá: [p, góc tay, dịch tay x, dịch tay y (px tranh gốc), góc vũ khí rời (chỉ Ngộ Không), góc đầu]
  const PRESETS = {
    staff: [ // Ngộ Không: gậy rời, quét cung lớn qua đỉnh đầu
      [0.00, 0.00, 0, 0, 0.00, 0.00],
      [0.35, -0.38, -25, -62, -1.65, -0.06],
      [0.55, 0.30, 70, 80, 0.45, 0.10],
      [0.66, 0.25, 62, 72, 0.30, 0.07],
      [1.00, 0.00, 0, 0, 0.00, 0.00]],
    swing: [ // vung vũ khí (đinh ba, chuỳ, đao): giơ lên ra sau → bổ xuống phía trước
      [0.00, 0.00, 0, 0, 0, 0.00],
      [0.35, -0.55, -20, -55, 0, -0.06],
      [0.55, 0.62, 55, 60, 0, 0.10],
      [0.66, 0.52, 48, 52, 0, 0.07],
      [1.00, 0.00, 0, 0, 0, 0.00]],
    thrust: [ // đâm / ném (thương, kích): rút về sau → đâm thẳng tới
      [0.00, 0.00, 0, 0, 0, 0.00],
      [0.35, -0.18, -55, -15, 0, -0.04],
      [0.52, 0.16, 95, 10, 0, 0.06],
      [0.66, 0.12, 80, 8, 0, 0.04],
      [1.00, 0.00, 0, 0, 0, 0.00]],
    cast: [ // niệm phép: nâng tay lên, đưa tới, giữ rồi hạ
      [0.00, 0.00, 0, 0, 0, 0.00],
      [0.35, -0.30, 10, -70, 0, -0.08],
      [0.55, -0.12, 45, -40, 0, 0.04],
      [0.70, -0.10, 40, -36, 0, 0.03],
      [1.00, 0.00, 0, 0, 0, 0.00]],
    bow: [ // bắn cung: kéo về, bật dây, giật nhẹ
      [0.00, 0.00, 0, 0, 0, 0.00],
      [0.40, -0.05, -25, 0, 0, -0.03],
      [0.50, 0.04, 18, -4, 0, 0.02],
      [0.65, 0.02, 8, -2, 0, 0.01],
      [1.00, 0.00, 0, 0, 0, 0.00]],
  };
  const EASES = [easeOut, x => x * x * x * 0.25 + easeOut(x) * 0.75, ease, ease];
  function keyAt(K, p) {
    for (let i = 0; i < K.length - 1; i++) {
      if (p <= K[i + 1][0]) {
        const q = EASES[i]((p - K[i][0]) / (K[i + 1][0] - K[i][0]));
        return K[i].map((v, j) => v + (K[i + 1][j] - v) * q);
      }
    }
    return K[K.length - 1];
  }
  // góc xoay (radian, dương = chiều kim đồng hồ) + dịch chuyển của các lớp theo trạng thái
  function motion(st, d) {
    const t = st.t || 0, sh = d.sheet;
    const m = { arm: 0, ax: 0, ay: 0, staff: 0, head: 0, tail: 0 };
    const kind = d.layers.staff ? 'staff' : (d.kind || 'swing');
    if (st.anim === 'attack') {
      const k = keyAt(PRESETS[kind] || PRESETS.swing, Math.min(1, Math.max(0, st.p)));
      m.arm = k[1]; m.ax = k[2]; m.ay = k[3]; m.staff = k[4]; m.head = k[5];
      m.tail = 0.3 * Math.sin(st.p * Math.PI * 2 + 0.5);
    } else if (st.anim === 'cast') {
      const q = easeOut(st.p / 0.45);
      m.arm = -0.35 * q; m.ax = -10 * q; m.ay = -70 * q; m.staff = -0.55 * q; m.head = -0.08 * q;
      m.tail = 0.2 * Math.sin(t * 4);
    } else if (st.anim === 'walk') {
      const cyc = sh.anims.walk.n / sh.anims.walk.fps;
      const ph = t * 2 * Math.PI / cyc;
      m.arm = -0.07 * Math.sin(ph); m.staff = -0.06 * Math.sin(ph); m.ay = -6 * Math.abs(Math.sin(ph));
      m.head = 0.03 * Math.sin(2 * ph - 0.8); m.tail = 0.3 * Math.sin(ph + 1.2);
    } else {
      m.arm = 0.035 * Math.sin(t * 2.4 - 0.3); m.staff = 0.02 * Math.sin(t * 2.4 - 0.6);
      m.head = 0.035 * Math.sin(t * 2.4 - 1.0); m.tail = 0.16 * Math.sin(t * 1.7);
    }
    return m;
  }

  // Vẽ với gốc toạ độ ở chân nhân vật, cao h px. Trả về vị trí đầu vũ khí (để vẽ vệt) hoặc null.
  function draw(ctx, id, st, h) {
    const o = L[id];
    if (!o) return null;
    const { d, img } = o, sh = d.sheet;
    const i = frameIndex(sh, st);
    const anc = sh.anchors[i];
    const m = motion(st, d);
    const k = h / sh.ch, s = sh.s;
    const arm = d.layers.arm, stf = d.layers.staff;
    const g = stf && arm ? [stf.grip_abs[0] - arm.pivot_abs[0], stf.grip_abs[1] - arm.pivot_abs[1]] : null;
    const sAng = stf ? stf.angle + m.staff : 0;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-sh.ax, -sh.ay);
    const part = (name, a, extra, tx, ty) => {
      const ly = d.layers[name], p = anc[name];
      if (!ly || !p || !img[name]) return;
      ctx.save();
      ctx.translate(p[0], p[1]); ctx.rotate(a); ctx.scale(s, s);
      if (tx || ty) ctx.translate(tx, ty);
      if (extra) extra();
      ctx.drawImage(img[name], -ly.pivot[0], -ly.pivot[1], ly.w, ly.h); // ảnh đã thu nhỏ, vẽ theo kích thước gốc
      ctx.restore();
    };
    for (const name of (d.order || ['tail', 'body', 'arm', 'head'])) {
      if (name === 'body') ctx.drawImage(img.sheet, (i % sh.cols) * sh.fw, Math.floor(i / sh.cols) * sh.fh, sh.fw, sh.fh, 0, 0, sh.fw, sh.fh);
      else if (name === 'arm') part('arm', m.arm, stf ? () => {
        ctx.save(); ctx.translate(g[0], g[1]); ctx.rotate(sAng);
        ctx.drawImage(img.staff, -stf.pivot[0], -stf.pivot[1], stf.w, stf.h); ctx.restore();
      } : null, m.ax, m.ay);
      else part(name, m[name] || 0);
    }
    ctx.restore();
    // đầu vũ khí → toạ độ tại chân nhân vật (để vẽ vệt chém)
    let lx, ly;
    if (stf) {
      const tipL = stf.w - stf.pivot[0];
      lx = g[0] + Math.cos(sAng) * tipL; ly = g[1] + Math.sin(sAng) * tipL;
    } else if (arm && arm.tip_abs) {
      lx = arm.tip_abs[0] - arm.pivot_abs[0]; ly = arm.tip_abs[1] - arm.pivot_abs[1];
    } else return null;
    lx += m.ax; ly += m.ay;
    const cr = Math.cos(m.arm), sr = Math.sin(m.arm), ap = anc.arm;
    const fx = ap[0] + (lx * cr - ly * sr) * s, fy = ap[1] + (lx * sr + ly * cr) * s;
    return [(fx - sh.ax) * k, (fy - sh.ay) * k];
  }

  return { load, draw, has: id => !!L[id], kind: id => (L[id] ? (L[id].d.layers.staff ? 'staff' : L[id].d.kind) : null) };
})();
