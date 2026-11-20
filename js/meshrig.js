'use strict';
// =====================================================================
// MeshRig: nhân vật tách lớp biến dạng lưới THỜI GIAN THỰC bằng WebGL (60 khung/giây).
// - Thân nền: lưới uốn theo hàm thở/chạy/đánh liên tục (không nướng khung).
// - Tay/đầu/đuôi/gậy: xoay theo khớp, vùng gần khớp hoà dần với thân → vai, cổ uốn mềm.
// - Chuyển động phụ: tóc lắc trễ nhịp, đuôi cuộn như dây xích, áo choàng bay.
// - Đổi trạng thái (đứng → chạy → đánh) hoà trộn 0,15 giây.
// Dữ liệu: art/mesh/<id>.js (tools/pack_mesh.py), toạ độ theo tranh gốc.
// Vẽ: dựng hình vào canvas WebGL ẩn rồi drawImage sang canvas 2D của game.
// =====================================================================
const MeshRig = (() => {
  const PI = Math.PI;
  const sst = (e0, e1, x) => { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const M = {};
  let gl = null, cv = null, loc = null, vbuf, ubuf, ibuf;

  // ------------------------------------------------------------ WebGL
  function init() {
    if (gl) return true;
    cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false });
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER,
      'attribute vec2 aPos; attribute vec2 aUV; uniform vec2 uRes; varying vec2 vUV;' +
      'void main(){ vec2 c = aPos / uRes * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); vUV = aUV; }'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER,
      'precision mediump float; varying vec2 vUV; uniform sampler2D uTex;' +
      'void main(){ gl_FragColor = texture2D(uTex, vUV); }'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(p);
    loc = { pos: gl.getAttribLocation(p, 'aPos'), uv: gl.getAttribLocation(p, 'aUV'), res: gl.getUniformLocation(p, 'uRes') };
    vbuf = gl.createBuffer(); ubuf = gl.createBuffer(); ibuf = gl.createBuffer();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    return true;
  }

  // lưới đều trên hình chữ nhật w×h (toạ độ ảnh, đơn vị px tranh gốc)
  function grid(w, h, step) {
    const nx = Math.max(2, Math.ceil(w / step) + 1), ny = Math.max(2, Math.ceil(h / step) + 1);
    const rest = new Float32Array(nx * ny * 2), uv = new Float32Array(nx * ny * 2);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 2, u = i / (nx - 1), v = j / (ny - 1);
      rest[k] = u * w; rest[k + 1] = v * h; uv[k] = u; uv[k + 1] = v;
    }
    const idx = new Uint16Array((nx - 1) * (ny - 1) * 6);
    let n = 0;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[n++] = a; idx[n++] = b; idx[n++] = c; idx[n++] = b; idx[n++] = d; idx[n++] = c;
    }
    return { rest, uv, idx, out: new Float32Array(rest.length), pix: new Float32Array(rest.length) };
  }

  function load(id) {
    const d = (window.MESH_DEFS || {})[id];
    if (!d || !init()) return Promise.resolve(false);
    const tex = {};
    const jobs = Object.entries(d.tex).map(([n, url]) => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        try {
          const t = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          tex[n] = t;
        } catch (e) { /* ảnh bị chặn → bỏ qua, dùng renderer cũ */ }
        res();
      };
      im.onerror = () => res();
      im.src = url;
    }));
    return Promise.all(jobs).then(() => {
      if (Object.keys(d.tex).some(n => !tex[n])) return false;
      const H = d.fig.Hc, mesh = {};
      for (const n in d.layers) {
        const L = d.layers[n];
        const step = n === 'body' ? H / 30 : n === 'staff' ? Math.max(20, L.w / 24) : H / 45;
        mesh[n] = grid(L.w, L.h, step);
      }
      M[id] = { d, tex, mesh };
      return true;
    });
  }

  // ------------------------------------------------------------ biến dạng thân (px tranh gốc)
  function bodyDisp(name, ph, X, Y, F) {
    const Hc = F.Hc, u = (X - F.cx) / Hc, v = (Y - (F.gy - Hc)) / Hc, h = 1 - v, T = 2 * PI * ph;
    const upper = sst(F.v_waist + 0.06, F.v_waist - 0.14, v), headw = sst(F.v_head + 0.10, F.v_head - 0.02, v);
    const legw = sst(F.v_hip - 0.02, 1, v) * F.legs, footw = sst(0.82, 1, v);
    const edge = sst(0.13, 0.30, Math.abs(u)) * sst(0.30, 0.55, v) * F.flutter;
    let dx = 0, dy = 0;
    if (name === 'walk') {
      const side = Math.tanh(u / 0.03), s = Math.sin(T);
      const lift = Math.max(0, s * side), plant = Math.max(0, -s * side);
      dy += -lift * 0.075 * Math.pow(legw, 1.4);
      dx += lift * 0.045 * legw - plant * 0.02 * legw + lift * 0.02 * footw;
      dy += -Math.abs(s) * 0.03 * (1 - legw * 0.85);
      dx += 0.035 * h + Math.sin(T) * 0.01 * h;
      dy += -Math.sin(2 * T - 0.6) * 0.006 * upper;
      dx += -0.035 * edge + Math.sin(2 * T + v * 8) * 0.014 * edge;
      dy += Math.cos(2 * T + v * 8) * 0.006 * edge;
    } else if (name === 'attack') {
      let th, lunge;
      if (ph < 0.35) { th = -0.07 * (ph / 0.35); lunge = -0.01 * (ph / 0.35); }
      else if (ph < 0.55) { const q = 1 - Math.pow(1 - (ph - 0.35) / 0.2, 3); th = -0.07 + 0.19 * q; lunge = -0.01 + 0.07 * q; }
      else if (ph < 0.68) { const q = (ph - 0.55) / 0.13; th = 0.12 - 0.03 * Math.sin(q * PI); lunge = 0.06; }
      else { const q = ease((ph - 0.68) / 0.32); th = 0.12 * (1 - q); lunge = 0.06 * (1 - q); }
      const px = F.cx, py = F.gy - Hc * (1 - F.v_waist), a = th * upper;
      const rx = X - px, ry = Y - py, c = Math.cos(a), s = Math.sin(a);
      dx += (px + rx * c - ry * s - X) / Hc + lunge * h * 1.3;
      dy += (py + rx * s + ry * c - Y) / Hc + Math.max(0, th) * 0.05 * (1 - legw);
      dx += -0.03 * edge * Math.sin(Math.min(1, ph / 0.6) * PI);
      // vẫn thở nhẹ khi đánh
      dy += -Math.sin(T * 0.5) * 0.004 * upper;
    } else if (name === 'cast') {
      const k = ph < 0.5 ? ease(ph / 0.5) : 1;
      dy += -0.03 * k * h; dx += -0.025 * k * h; dy += -0.012 * k * upper;
      dx += Math.sin(T * 2 + v * 8) * 0.016 * edge;
    } else { // idle
      const b = Math.sin(T);
      dy += -b * 0.010 * upper; dy += -Math.sin(T - 0.6) * 0.006 * headw; dx += Math.sin(T) * 0.006 * h;
      dx += Math.sin(T + v * 7) * 0.012 * edge; dy += Math.cos(T + v * 7) * 0.004 * edge;
    }
    return [dx * Hc, dy * Hc];
  }

  // ------------------------------------------------------------ chuyển động các lớp (khung khoá, giống layered.js)
  const PRESETS = {
    staff: [[0, 0, 0, 0, 0, 0], [0.35, -0.38, -25, -62, -1.65, -0.06], [0.55, 0.30, 70, 80, 0.45, 0.10], [0.66, 0.25, 62, 72, 0.30, 0.07], [1, 0, 0, 0, 0, 0]],
    swing: [[0, 0, 0, 0, 0, 0], [0.35, -0.55, -20, -55, 0, -0.06], [0.55, 0.62, 55, 60, 0, 0.10], [0.66, 0.52, 48, 52, 0, 0.07], [1, 0, 0, 0, 0, 0]],
    thrust: [[0, 0, 0, 0, 0, 0], [0.35, -0.18, -55, -15, 0, -0.04], [0.52, 0.16, 95, 10, 0, 0.06], [0.66, 0.12, 80, 8, 0, 0.04], [1, 0, 0, 0, 0, 0]],
    cast: [[0, 0, 0, 0, 0, 0], [0.35, -0.30, 10, -70, 0, -0.08], [0.55, -0.12, 45, -40, 0, 0.04], [0.70, -0.10, 40, -36, 0, 0.03], [1, 0, 0, 0, 0, 0]],
    bow: [[0, 0, 0, 0, 0, 0], [0.40, -0.05, -25, 0, 0, -0.03], [0.50, 0.04, 18, -4, 0, 0.02], [0.65, 0.02, 8, -2, 0, 0.01], [1, 0, 0, 0, 0, 0]],
  };
  // niệm phép mặc định cho tay một khối: nâng vũ khí/tay lên (dương = xoay theo chiều kim đồng hồ: tay bên trái giơ lên)
  const CAST_ROT = [[0, 0, 0, 0, 0, 0], [0.45, 0.85, 0, 0, 0, -0.06], [0.8, 0.8, 0, 0, 0, -0.04], [1, 0, 0, 0, 0, 0]];
  const EASES = [easeOut, x => x * x * x * 0.25 + easeOut(x) * 0.75, ease, ease];
  function keyAt(K, p) {
    for (let i = 0; i < K.length - 1; i++) if (p <= K[i + 1][0]) {
      const q = EASES[i]((p - K[i][0]) / (K[i + 1][0] - K[i][0]));
      return K[i].map((v, j) => v + (K[i + 1][j] - v) * q);
    }
    return K[K.length - 1];
  }
  function phaseOf(st) {
    if (st.anim === 'walk') return ((st.t || 0) / 0.7) % 1;
    if (st.anim === 'attack' || st.anim === 'cast') return Math.min(1, Math.max(0, st.p || 0));
    return ((st.t || 0) / 1.6) % 1;
  }
  function motion(st, d) {
    const t = st.t || 0;
    const m = { arm: 0, ax: 0, ay: 0, staff: 0, head: 0, tail: 0 };
    const kind = d.layers.staff ? 'staff' : (d.kind || 'swing');
    if (st.anim === 'attack') {
      const k = keyAt(d.atkPreset || PRESETS[kind] || PRESETS.swing, phaseOf(st));
      m.arm = k[1]; m.ax = k[2]; m.ay = k[3]; m.staff = k[4]; m.head = k[5]; m.slide = k[6] || 0;
      m.tail = 0.3 * Math.sin(st.p * PI * 2 + 0.5);
    } else if (st.anim === 'cast' && (d.castPreset || d.atkPreset)) {
      // tay một khối (chibi): chỉ XOAY quanh vai, không kéo tay đi (kéo đi là tay rời vai)
      const k = keyAt(d.castPreset || CAST_ROT, phaseOf(st));
      m.arm = k[1]; m.ax = k[2]; m.ay = k[3]; m.staff = k[4]; m.head = k[5]; m.tail = 0.2 * Math.sin(t * 4);
    } else if (st.anim === 'cast') {
      const q = easeOut(phaseOf(st) / 0.45);
      m.arm = -0.35 * q; m.ax = -10 * q; m.ay = -70 * q; m.staff = -0.55 * q; m.head = -0.08 * q; m.tail = 0.2 * Math.sin(t * 4);
    } else if (st.anim === 'walk') {
      const ph = 2 * PI * phaseOf(st);
      m.arm = -0.07 * Math.sin(ph); m.staff = -0.06 * Math.sin(ph); m.ay = -6 * Math.abs(Math.sin(ph));
      m.head = 0.03 * Math.sin(2 * ph - 0.8); m.tail = 0.3 * Math.sin(ph + 1.2);
    } else {
      m.arm = 0.035 * Math.sin(t * 2.4 - 0.3); m.staff = 0.02 * Math.sin(t * 2.4 - 0.6);
      m.head = 0.035 * Math.sin(t * 2.4 - 1.0); m.tail = 0.16 * Math.sin(t * 1.7);
    }
    return m;
  }

  // ------------------------------------------------------------ tay 2 đoạn (vai → khuỷu → nắm tay)
  // Khung khoá đòn đập: [p, góc cánh tay trên, góc cẳng tay (so với cánh tay trên), góc gậy thêm, góc đầu]
  const ELBOW_ATK = [
    [0.00, 0.00, 0.00, 0.00, 0.00],
    [0.35, 0.70, -1.40, -1.30, -0.06],   // lấy đà: khuỷu nâng ngang vai, cẳng tay gập ra sau đầu
    [0.55, -0.77, 2.50, -0.98, 0.10],    // đập: cánh tay đưa xuống trước, cẳng tay duỗi thẳng, gậy chéo xuống trước
    [0.66, -0.70, 2.35, -0.95, 0.07],    // nảy nhẹ khi trúng
    [1.00, 0.00, 0.00, 0.00, 0.00],
  ];
  function elbowOne(st, m, d) {
    if (st.anim === 'attack') { const k = keyAt((d && d.atk) || ELBOW_ATK, phaseOf(st)); return { au: k[1], af: k[2], s: k[3], head: k[4] }; }
    if (st.anim === 'cast') {
      const q = easeOut(phaseOf(st) / 0.45), c = (d && d.castPose) || [0.45, -0.7, -0.2];
      return { au: c[0] * q, af: c[1] * q, s: c[2] * q };
    }
    return { au: m.arm, af: m.arm * 0.6, s: m.staff };   // đứng/chạy: đung đưa nhẹ, khuỷu cong theo
  }
  function elbowAngles(st, m, prev, w, d) {
    const a = elbowOne(st, m, d);
    if (!prev) return a;
    const b = elbowOne(prev, m, d);
    return { au: b.au + (a.au - b.au) * w, af: b.af + (a.af - b.af) * w, s: b.s + (a.s - b.s) * w };
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function twoSeg(o, d, disp, j, R) {
    const L = d.layers.arm, mm = o.mesh.arm;
    const P0 = L.pivot_abs, E = L.elbow_abs, G = L.fist_abs || L.elbow_abs;
    const A0 = disp(P0[0], P0[1]), A = [P0[0] + A0[0], P0[1] + A0[1]];
    const cu = Math.cos(j.au), su = Math.sin(j.au), cf = Math.cos(j.au + j.af), sf = Math.sin(j.au + j.af);
    const ex = E[0] - P0[0], ey = E[1] - P0[1];
    const Ew = [A[0] + ex * cu - ey * su, A[1] + ex * su + ey * cu];               // khuỷu sau khi xoay vai
    const upper = (X, Y) => { const lx = X - P0[0], ly = Y - P0[1]; return [A[0] + lx * cu - ly * su, A[1] + lx * su + ly * cu]; };
    const fore = (X, Y) => { const lx = X - E[0], ly = Y - E[1]; return [Ew[0] + lx * cf - ly * sf, Ew[1] + lx * sf + ly * cf]; };
    const rb = 0.04 * R, eb = 0.022 * R;   // bán kính hoà mềm ở vai và khuỷu
    for (let i = 0; i < mm.rest.length; i += 2) {
      const X = L.x + mm.rest[i], Y = L.y + mm.rest[i + 1];
      // trọng số cẳng tay: gần đoạn khuỷu→nắm tay hơn đoạn vai→khuỷu
      const du = segDist(X, Y, P0[0], P0[1], E[0], E[1]), df = segDist(X, Y, E[0], E[1], G[0], G[1]);
      const wf = sst(-eb, eb, du - df);
      const u = upper(X, Y), f = fore(X, Y);
      let x = u[0] + (f[0] - u[0]) * wf, y = u[1] + (f[1] - u[1]) * wf;
      const wv = sst(0, rb, Math.hypot(X - P0[0], Y - P0[1]));                    // sát vai: bám theo thân
      if (wv < 1) { const q = disp(X, Y); x = (X + q[0]) * (1 - wv) + x * wv; y = (Y + q[1]) * (1 - wv) + y * wv; }
      mm.out[i] = x; mm.out[i + 1] = y;
    }
    return { A, Ew, fore: (X, Y) => fore(X, Y), upper, fistW: fore(G[0], G[1]) };
  }

  // ------------------------------------------------------------ dựng tư thế: toạ độ thế giới (px tranh gốc) cho mọi đỉnh
  function pose(o, st, mem, dt) {
    const d = o.d, F = d.fig;
    // hoà trộn khi đổi trạng thái
    let w = 1, prev = null;
    if (mem) {
      if (mem.anim !== st.anim) { mem.prev = mem.last ? { ...mem.last } : null; mem.anim = st.anim; mem.blend = 0; }
      mem.blend = Math.min(1, (mem.blend == null ? 1 : mem.blend) + (dt || 1 / 60) / 0.15);
      w = ease(mem.blend); prev = w < 1 ? mem.prev : null;
      mem.last = { anim: st.anim, t: st.t, p: st.p };
    }
    const ph = phaseOf(st);
    const disp = prev
      ? (X, Y) => { const a = bodyDisp(prev.anim, phaseOf(prev), X, Y, F), b = bodyDisp(st.anim, ph, X, Y, F); return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]; }
      : (X, Y) => bodyDisp(st.anim, ph, X, Y, F);
    let m = motion(st, d);
    if (prev) { const mp = motion({ ...prev, t: st.t }, d); for (const k in m) m[k] = mp[k] + (m[k] - mp[k]) * w; }
    const t = st.t || 0, R = F.Hc;

    // thân
    const out = {};
    const body = d.layers.body, bm = o.mesh.body;
    for (let i = 0; i < bm.rest.length; i += 2) {
      const X = body.x + bm.rest[i], Y = body.y + bm.rest[i + 1], q = disp(X, Y);
      bm.out[i] = X + q[0]; bm.out[i + 1] = Y + q[1];
    }
    out.body = bm;
    // lớp xoay quanh khớp, hoà với thân trong bán kính rb quanh khớp
    const rigid = (name, ang, tx, ty, rb, extra) => {
      const L = d.layers[name], mm = o.mesh[name];
      if (!L || !mm) return;
      const P0 = L.pivot_abs, A0 = disp(P0[0], P0[1]), Ax = P0[0] + A0[0], Ay = P0[1] + A0[1];
      for (let i = 0; i < mm.rest.length; i += 2) {
        const X = L.x + mm.rest[i], Y = L.y + mm.rest[i + 1];
        const lx = X - P0[0], ly = Y - P0[1], dist = Math.hypot(lx, ly);
        const a = ang + (extra ? extra(dist) : 0), c = Math.cos(a), s = Math.sin(a);
        const rx = Ax + (lx + tx) * c - (ly + ty) * s, ry = Ay + (lx + tx) * s + (ly + ty) * c;
        const wj = sst(0, rb, dist);
        if (wj < 1) { const q = disp(X, Y); mm.out[i] = (X + q[0]) * (1 - wj) + rx * wj; mm.out[i + 1] = (Y + q[1]) * (1 - wj) + ry * wj; }
        else { mm.out[i] = rx; mm.out[i + 1] = ry; }
      }
      out[name] = mm;
      return [Ax, Ay];
    };
    // tay (+ vũ khí): vai uốn mềm trong bán kính ~4% chiều cao
    const arm0 = d.layers.arm;
    let armA = null, foreT = null;
    if (arm0 && arm0.elbow_abs) {
      // TAY 2 ĐOẠN: cánh tay trên xoay quanh vai, cẳng tay xoay quanh khuỷu, khuỷu uốn mềm (skinning)
      const j = elbowAngles(st, m, prev, w, d);
      if (j.head != null) m.head = j.head;
      const r = twoSeg(o, d, disp, j, R);
      armA = r.A; foreT = r.fore; o._joints = { shoulder: r.A, elbow: r.Ew, fist: r.fistW };
      if (d.layers.arm_up && o.tex.arm_up) {
        // 2 mảnh cứng cắt từ tay gốc: cẳng tay chồng lên cánh tay trên → khuỷu gập bao nhiêu cũng không xoắn
        for (const [nm, tf] of [['arm_up', r.upper], ['arm_lo', r.fore]]) {
          const L = d.layers[nm], mm = o.mesh[nm];
          for (let i = 0; i < mm.rest.length; i += 2) { const q = tf(L.x + mm.rest[i], L.y + mm.rest[i + 1]); mm.out[i] = q[0]; mm.out[i + 1] = q[1]; }
          out[nm] = mm;
        }
        if (d.layers.sleeve && o.tex.sleeve) { // ống tay nối vai → khuỷu, kéo giãn theo khớp (nằm sau tay gốc)
          const S = d.layers.sleeve, mm = o.mesh.sleeve;
          const sx = S.b[0] - S.a[0], sy = S.b[1] - S.a[1], L2 = sx * sx + sy * sy, L = Math.sqrt(L2);
          const Tx = r.Ew[0] - r.A[0], Ty = r.Ew[1] - r.A[1], Lt = Math.hypot(Tx, Ty) || 1;
          // bắt đầu hơi dưới vai (khuất dưới giáp vai), kéo quá khuỷu 12% (khuất dưới cẳng tay)
          const st0 = [r.A[0] + Tx * 0.04, r.A[1] + Ty * 0.04], span = [Tx * 1.08, Ty * 1.08];
          const sc = (Lt * 1.08 / L) * 0.95, nx = -Ty / Lt, ny = Tx / Lt;
          for (let i = 0; i < mm.rest.length; i += 2) {
            const dx = mm.rest[i] - S.a[0], dy = mm.rest[i + 1] - S.a[1];
            const u = (dx * sx + dy * sy) / L2, v = (sx * dy - sy * dx) / L;
            mm.out[i] = st0[0] + span[0] * u + nx * v * sc; mm.out[i + 1] = st0[1] + span[1] * u + ny * v * sc;
          }
          out.sleeve = mm;
        }
        if (d.layers.cover && o.tex.cover) { // giáp vai bám theo thân, phủ lên gốc tay
          const L = d.layers.cover, mm = o.mesh.cover;
          for (let i = 0; i < mm.rest.length; i += 2) { const X = L.x + mm.rest[i], Y = L.y + mm.rest[i + 1], q = disp(X, Y); mm.out[i] = X + q[0]; mm.out[i + 1] = Y + q[1]; }
          out.cover = mm;
        }
      } else out.arm = o.mesh.arm;
      m.staff = j.s; m.head = m.head;
    } else {
      // tay một khối: có giáp vai che chỗ nối thì không hoà ở vai (tránh gai), chỉ bám thân trong bán kính rất nhỏ
      armA = rigid('arm', m.arm, m.ax, m.ay, d.layers.cover ? 0.008 * R : 0.04 * R);
      if (d.layers.cover && o.tex.cover) {
        const L = d.layers.cover, mm = o.mesh.cover;
        for (let i = 0; i < mm.rest.length; i += 2) { const X = L.x + mm.rest[i], Y = L.y + mm.rest[i + 1], q = disp(X, Y); mm.out[i] = X + q[0]; mm.out[i + 1] = Y + q[1]; }
        out.cover = mm;
      }
    }
    // đầu: cổ uốn mềm, tóc lắc trễ nhịp theo khoảng cách tới cổ
    const hsz = d.layers.head ? Math.max(d.layers.head.w, d.layers.head.h) : 1;
    rigid('head', m.head, 0, 0, 0.025 * R, dist => 0.045 * Math.sin(t * 2.4 - 1.7) * Math.min(1, dist / hsz) * Math.min(1, dist / hsz));
    // đuôi: cuộn như dây xích, sóng chạy dọc đuôi
    if (d.layers.tail) {
      const tl = d.layers.tail, tsz = Math.max(tl.w, tl.h);
      rigid('tail', 0, 0, 0, 0.02 * R, dist => { const k = Math.min(1, dist / tsz); return m.tail * k * 1.3 + 0.14 * Math.sin(t * 3.2 - k * 4) * k; });
    }
    // gậy (Ngộ Không): gắn nắm tay, xoay cùng cánh tay + xoay thêm quanh nắm tay
    let tip = null;
    const arm = d.layers.arm, stf = d.layers.staff;
    if (stf && arm && foreT) { // tay 2 đoạn: gậy gắn vào cẳng tay
      const sm = o.mesh.staff, sA = stf.angle + m.staff;
      const cs = Math.cos(sA), ss = Math.sin(sA);
      const tf = (qx, qy) => foreT(stf.grip_abs[0] + (qx - stf.pivot[0]) * cs - (qy - stf.pivot[1]) * ss,
                                   stf.grip_abs[1] + (qx - stf.pivot[0]) * ss + (qy - stf.pivot[1]) * cs, true);
      for (let i = 0; i < sm.rest.length; i += 2) { const r = tf(sm.rest[i], sm.rest[i + 1]); sm.out[i] = r[0]; sm.out[i + 1] = r[1]; }
      out.staff = sm;
      tip = tf(stf.w, stf.h / 2);
    } else if (stf && arm && armA) {
      const sm = o.mesh.staff, P0 = arm.pivot_abs;
      const gx = stf.grip_abs[0] - P0[0], gy = stf.grip_abs[1] - P0[1], sA = stf.angle + m.staff;
      const ca = Math.cos(m.arm), sa = Math.sin(m.arm), cs = Math.cos(sA), ss = Math.sin(sA);
      const tf = (qx, qy) => {
        const qa = qx - stf.pivot[0] - Math.min(m.slide || 0, stf.slide_max || 0); // trượt cán: tay dời về phía chuôi
        const lx = m.ax + gx + qa * cs - (qy - stf.pivot[1]) * ss;
        const ly = m.ay + gy + qa * ss + (qy - stf.pivot[1]) * cs;
        return [armA[0] + lx * ca - ly * sa, armA[1] + lx * sa + ly * ca];
      };
      for (let i = 0; i < sm.rest.length; i += 2) { const r = tf(sm.rest[i], sm.rest[i + 1]); sm.out[i] = r[0]; sm.out[i + 1] = r[1]; }
      out.staff = sm;
      tip = tf(stf.tip_a ? 0 : stf.w, stf.h / 2);
    } else if (arm && arm.tip_abs && armA) {
      const P0 = arm.pivot_abs, lx = arm.tip_abs[0] - P0[0] + m.ax, ly = arm.tip_abs[1] - P0[1] + m.ay;
      const c = Math.cos(m.arm), s = Math.sin(m.arm);
      tip = [armA[0] + lx * c - ly * s, armA[1] + lx * s + ly * c];
    }
    return { out, tip };
  }

  // ------------------------------------------------------------ vẽ
  // ctx: canvas 2D (gốc toạ độ đang ở chân nhân vật, đã lật theo hướng mặt). h: chiều cao hiển thị (px).
  // Trả về đầu vũ khí (px, theo gốc chân) để vẽ vệt chém, hoặc null.
  function draw(ctx, id, st, h, opt) {
    const o = M[id];
    if (!o) return null;
    opt = opt || {};
    const d = o.d, F = d.fig;
    const { out, tip } = pose(o, st, opt.mem, opt.dt);
    const k = h / F.Hc;
    const tr = ctx.getTransform(), ds = Math.min(3, Math.hypot(tr.a, tr.b)) || 1;
    // khung bao các đỉnh
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n in out) { const a = out[n].out; for (let i = 0; i < a.length; i += 2) { const x = a[i], y = a[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    x0 -= 4; y0 -= 4; x1 += 4; y1 += 4;
    const ks = k * ds;
    let W = Math.ceil((x1 - x0) * ks), H = Math.ceil((y1 - y0) * ks);
    const cap = 2048, f = Math.min(1, cap / Math.max(W, H));
    const kk = ks * f; W = Math.ceil(W * f); H = Math.ceil(H * f);
    if (W < 2 || H < 2) return null;
    if (cv.width < W || cv.height < H) { cv.width = Math.max(cv.width, W); cv.height = Math.max(cv.height, H); }
    gl.viewport(0, cv.height - H, W, H);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, cv.height - H, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(loc.res, W, H);
    for (const n of (d.order || ['tail', 'body', 'arm', 'head'])) {
      const list = n !== 'arm' ? [n]
        : out.arm_up ? ['staff', 'sleeve', 'arm_up', 'cover', 'arm_lo']
        : out.staff ? ['staff', 'arm', 'cover'] : ['arm', 'cover'];
      for (const nn of list) {
        const mm = out[nn];
        if (!mm || !o.tex[nn]) continue;
        const a = mm.out, px = mm.pix;
        for (let i = 0; i < a.length; i += 2) { px[i] = (a[i] - x0) * kk; px[i + 1] = (a[i + 1] - y0) * kk; }
        gl.bindBuffer(gl.ARRAY_BUFFER, vbuf); gl.bufferData(gl.ARRAY_BUFFER, px, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, ubuf); gl.bufferData(gl.ARRAY_BUFFER, mm.uv, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc.uv); gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mm.idx, gl.STATIC_DRAW);
        gl.bindTexture(gl.TEXTURE_2D, o.tex[nn]);
        gl.drawElements(gl.TRIANGLES, mm.idx.length, gl.UNSIGNED_SHORT, 0);
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    ctx.drawImage(cv, 0, 0, W, H, (x0 - F.cx) * k, (y0 - F.gy) * k, W / kk * k, H / kk * k);
    if (opt.debug && o._joints) { opt.debug.joints = {}; for (const j in o._joints) opt.debug.joints[j] = [(o._joints[j][0] - F.cx) * k, (o._joints[j][1] - F.gy) * k]; }
    return tip ? [(tip[0] - F.cx) * k, (tip[1] - F.gy) * k] : null;
  }

  return { load, draw, has: id => !!M[id] && !window.__noMesh, kind: id => (M[id] ? (M[id].d.layers.staff ? 'staff' : M[id].d.kind) : null) };
})();
