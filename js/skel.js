/* SKEL — bộ chạy xương 2D riêng của Thần Tiên Đại Chiến (không phụ thuộc runtime Spine).
   Học theo cách làm của Bộ Kinh Vân (VLĐMT) và Ngộ Không (TDDC):
   • Tay/chân = nhiều MẢNH CỨNG đầu tròn chồng lên nhau, xoay quanh khớp → không méo, không gãy.
   • Lưới có trọng số CHỈ dùng cho vải / đuôi (áo choàng, khăn, đuôi) → uốn mềm.
   • Đổi hình bộ phận theo thời gian (bàn tay nắm/xoè, mặt cười/quát) thay vì bẻ cong ảnh.
   • Chuyển động phụ bằng vật lý lò xo (đuôi, áo, khăn, tua lắc trễ nhịp).
   • Hoà trộn 0,12 giây khi đổi động tác → không giật.
   Dữ liệu: window.SKEL_DEFS[id] (tools/build_skel.py). Toạ độ y hướng xuống, gốc ở chân (0,0), góc theo độ (chiều kim đồng hồ).
   API: Skel.load(id) → Promise, Skel.has(id), Skel.draw(ctx, id, st, h, opt) → toạ độ đầu vũ khí (để vẽ vệt chém) hoặc null. */
(function () {
  const D2R = Math.PI / 180;
  const M = {};           // id → { d, tex }
  let gl = null, cv = null, prog, loc, vbuf;

  // ------------------------------------------------------------ WebGL (một canvas dùng chung)
  function initGL() {
    if (gl) return true;
    cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
    if (!gl) return false;
    const vs = 'attribute vec2 p; attribute vec2 u; uniform vec2 res; varying vec2 vu; void main(){ vu=u; gl_Position=vec4(p.x/res.x*2.0-1.0, 1.0-p.y/res.y*2.0, 0.0, 1.0); }';
    const fs = 'precision mediump float; varying vec2 vu; uniform sampler2D t; void main(){ gl_FragColor = texture2D(t, vu); }';
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    gl.useProgram(prog);
    loc = { p: gl.getAttribLocation(prog, 'p'), u: gl.getAttribLocation(prog, 'u'), res: gl.getUniformLocation(prog, 'res') };
    vbuf = gl.createBuffer();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    return true;
  }
  function load(id) {
    const d = window.SKEL_DEFS && window.SKEL_DEFS[id];
    if (!d) return Promise.resolve(false);
    if (M[id]) return Promise.resolve(true);
    if (!initGL()) return Promise.resolve(false);
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        prep(d, img.width, img.height);
        M[id] = { d, tex };
        res(true);
      };
      img.onerror = () => res(false);
      img.src = d.atlas;
    });
  }
  // chuẩn hoá: UV từ toạ độ atlas, đỉnh mảnh cứng trong không gian xương
  function prep(d, aw, ah) {
    d.boneIx = {}; d.bones.forEach((b, i) => { d.boneIx[b.n] = i; b.pi = b.p == null ? -1 : d.boneIx[b.p]; });
    d.slotIx = {}; d.slots.forEach((s, i) => { d.slotIx[s.n] = i; s.bi = d.boneIx[s.b]; });
    for (const n in d.atts) {
      const a = d.atts[n], r = d.regions[a.reg];
      if (a.t === 'r') {
        const c = Math.cos(a.r * D2R), s = Math.sin(a.r * D2R), hw = a.w / 2, hh = a.h / 2;
        a.lv = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [a.x + x * c - y * s, a.y + x * s + y * c]);
        a.uv = [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]].map(([u, v]) => [u / aw, v / ah]);
      } else {
        a.uvn = a.uv.map((q, i) => (i % 2 ? (r[1] + q * r[3]) / ah : (r[0] + q * r[2]) / aw));
        a.vw.forEach(list => list.forEach(e => { e[0] = typeof e[0] === 'number' ? e[0] : d.boneIx[e[0]]; }));
      }
    }
    d.chainIx = (d.springs || []).map(sp => ({ ...sp, bi: sp.b.map(n => d.boneIx[n]) }));
  }

  // ------------------------------------------------------------ hoạt ảnh
  const EASE = {
    0: x => x,
    1: x => x * x * (3 - 2 * x),
    2: x => 1 - (1 - x) * (1 - x) * (1 - x),
    3: x => x * x * x,
  };
  function sample(keys, t) {
    if (!keys || !keys.length) return null;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) {
        if (a[2] === 's') return a[1];
        const q = (EASE[a[2] || 0] || EASE[0])((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
        return a[1] + (b[1] - a[1]) * q;
      }
    }
    return keys[keys.length - 1][1];
  }
  function stepKey(keys, t) {   // khung khoá dạng bậc (đổi hình, thứ tự lớp)
    let v = null; for (const k of keys) { if (k[0] <= t + 1e-6) v = k[1]; else break; } return v;
  }
  // tư thế cục bộ của mọi xương ở thời điểm t trong clip
  function localPose(d, clip, t) {
    const L = d.bones.map(b => [b.x, b.y, b.r, b.sx || 1, b.sy || 1]);
    const A = d.anims[clip]; if (!A) return L;
    for (const bn in A.b) {
      const i = d.boneIx[bn]; if (i == null) continue;
      const tl = A.b[bn], q = L[i];
      let v;
      if ((v = sample(tl.r, t)) != null) q[2] = d.bones[i].r + v;
      if ((v = sample(tl.x, t)) != null) q[0] = d.bones[i].x + v;
      if ((v = sample(tl.y, t)) != null) q[1] = d.bones[i].y + v;
      if ((v = sample(tl.s, t)) != null) { q[3] = (d.bones[i].sx || 1) * v; q[4] = (d.bones[i].sy || 1) * v; }
    }
    return L;
  }
  function blendPose(A, B, w) {
    return A.map((a, i) => { const b = B[i]; let dr = b[2] - a[2]; while (dr > 180) dr -= 360; while (dr < -180) dr += 360;
      return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + dr * w, a[3] + (b[3] - a[3]) * w, a[4] + (b[4] - a[4]) * w]; });
  }
  // ma trận thế giới [a,b,c,d,tx,ty]
  function worldFrom(d, L, from, W) {
    for (let i = from || 0; i < d.bones.length; i++) {
      const q = L[i], c = Math.cos(q[2] * D2R), s = Math.sin(q[2] * D2R);
      const la = c * q[3], lb = s * q[3], lc = -s * q[4], ld = c * q[4];
      const p = d.bones[i].pi;
      if (p < 0) W[i] = [la, lb, lc, ld, q[0], q[1]];
      else { const P = W[p]; W[i] = [P[0] * la + P[2] * lb, P[1] * la + P[3] * lb, P[0] * lc + P[2] * ld, P[1] * lc + P[3] * ld, P[0] * q[0] + P[2] * q[1] + P[4], P[1] * q[0] + P[3] * q[1] + P[5]]; }
    }
    return W;
  }
  const xf = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  // vật lý lò xo cho chuỗi xương (đuôi, áo choàng, khăn, tóc, tua)
  function springs(d, L, W, mem, dt) {
    if (!d.chainIx.length || !dt) return;
    const S = mem.spr = mem.spr || {};
    for (const ch of d.chainIx) {
      for (const bi of ch.bi) {
        const b = d.bones[bi], len = b.l || 30, m = W[bi];
        const base = [m[4], m[5]], tip = xf(m, len, 0);
        let s = S[bi];
        if (!s) { s = S[bi] = { x: tip[0], y: tip[1], px: tip[0], py: tip[1] }; continue; }
        const vx = (s.x - s.px) * (ch.d ?? 0.82), vy = (s.y - s.py) * (ch.d ?? 0.82);
        s.px = s.x; s.py = s.y;
        s.x += vx + (tip[0] - s.x) * (ch.k ?? 0.18); s.y += vy + (tip[1] - s.y) * (ch.k ?? 0.18) + (ch.g || 0) * dt;
        const dx = s.x - base[0], dy = s.y - base[1], dl = Math.hypot(dx, dy) || 1;
        s.x = base[0] + dx / dl * len; s.y = base[1] + dy / dl * len;
        let off = (Math.atan2(dy, dx) - Math.atan2(tip[1] - base[1], tip[0] - base[0])) / D2R;
        while (off > 180) off -= 360; while (off < -180) off += 360;
        const lim = ch.lim ?? 55; off = Math.max(-lim, Math.min(lim, off));
        // xương cha đã bị lật hướng (lật trục) → đảo dấu góc
        const det = Math.sign(m[0] * m[3] - m[1] * m[2]) || 1;
        L[bi][2] += off * det;
        worldFrom(d, L, bi, W);
      }
    }
  }

  // ------------------------------------------------------------ chọn clip theo trạng thái trận
  function clipOf(d, st) {
    const has = n => d.anims[n];
    let clip = 'idle', t = st.t || 0;
    if (st.anim === 'attack' && has('attack')) { clip = 'attack'; t = (st.p || 0) * d.anims.attack.d; }
    else if (st.anim === 'cast') { clip = st.ult && has('ult') ? 'ult' : has('skill') ? 'skill' : 'attack'; t = (st.p || 0) * d.anims[clip].d; }
    else if (st.anim === 'hit' && has('hit')) { clip = 'hit'; t = (st.p || 0) * d.anims.hit.d; }
    else if (st.anim === 'die' && has('die')) { clip = 'die'; t = Math.min(d.anims.die.d, st.t || 0); }
    else if (st.anim === 'win' && has('win')) { clip = 'win'; t = (st.t || 0) % d.anims.win.d; }
    else if (st.anim === 'walk' && has('walk')) { clip = 'walk'; t = (st.t || 0) % d.anims.walk.d; }
    else { clip = has('idle') ? 'idle' : Object.keys(d.anims)[0]; t = (st.t || 0) % d.anims[clip].d; }
    return { clip, t };
  }

  // ------------------------------------------------------------ vẽ
  function draw(ctx, id, st, h, opt) {
    const o = M[id]; if (!o) return null;
    opt = opt || {};
    const d = o.d, mem = opt.mem || {};
    const { clip, t } = clipOf(d, st);
    let L = localPose(d, clip, t);
    // hoà trộn khi đổi clip
    if (mem.clip !== clip) { mem.from = mem.last; mem.blend = 0; mem.clip = clip; }
    if (mem.from && mem.blend < 1) { mem.blend = Math.min(1, mem.blend + (opt.dt || 1 / 60) / 0.12); L = blendPose(mem.from, L, mem.blend); }
    mem.last = L.map(q => q.slice());
    const W = worldFrom(d, L, 0, []);
    springs(d, L, W, mem, opt.dt);
    // hình gắn + thứ tự lớp
    const A = d.anims[clip] || {};
    let order = d.slots.map((s, i) => i);
    if (A.o) { const v = stepKey(A.o, t); if (v) order = v.map(n => d.slotIx[n]); }
    const T0 = ctx.getTransform(), SS = Math.min(3, Math.max(1, Math.hypot(T0.a, T0.b)));   // tỉ lệ phóng thật (scale × dpr)
    const k = h / d.H * SS;
    const verts = [];
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    const push = (x, y, u, v) => { verts.push(x, y, u, v); if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; };
    for (const si of order) {
      const s = d.slots[si];
      let an = s.a;
      if (A.a && A.a[s.n]) { const v = stepKey(A.a[s.n], t); if (v !== null) an = v; }
      if (!an) continue;
      const a = d.atts[an]; if (!a) continue;
      if (a.t === 'r') {
        const m = W[s.bi], P = a.lv.map(([x, y]) => xf(m, x, y));
        for (const j of [0, 1, 2, 0, 2, 3]) push(P[j][0] * k, P[j][1] * k, a.uv[j][0], a.uv[j][1]);
      } else {
        const P = a.vw.map(list => { let x = 0, y = 0; for (const [bi, vx, vy, w] of list) { const p = xf(W[bi], vx, vy); x += p[0] * w; y += p[1] * w; } return [x, y]; });
        for (const j of a.tri) push(P[j][0] * k, P[j][1] * k, a.uvn[j * 2], a.uvn[j * 2 + 1]);
      }
    }
    if (!verts.length) return null;
    // vẽ ra canvas phụ rồi dán vào ctx (gốc chân nhân vật)
    const pad = 2, x0 = Math.floor(minx) - pad, y0 = Math.floor(miny) - pad;
    const Wd = Math.ceil(maxx - x0) + pad, Hd = Math.ceil(maxy - y0) + pad;
    if (cv.width < Wd || cv.height < Hd) { cv.width = Math.max(cv.width, Wd); cv.height = Math.max(cv.height, Hd); }
    for (let i = 0; i < verts.length; i += 4) { verts[i] -= x0; verts[i + 1] -= y0; }
    gl.viewport(0, cv.height - Hd, Wd, Hd);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, cv.height - Hd, Wd, Hd);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(loc.res, Wd, Hd);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(loc.u); gl.vertexAttribPointer(loc.u, 2, gl.FLOAT, false, 16, 8);
    gl.bindTexture(gl.TEXTURE_2D, o.tex);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 4);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, 0, 0, Wd, Hd, x0 / SS, y0 / SS, Wd / SS, Hd / SS);
    // đầu vũ khí (vệt chém)
    if (d.tip) { const bi = d.boneIx[d.tip.b]; if (bi != null) { const p = xf(W[bi], d.tip.x, d.tip.y); return [p[0] * k / SS, p[1] * k / SS]; } }
    return null;
  }

  window.Skel = {
    load, draw,
    has: id => !!M[id],
    kind: id => (M[id] ? M[id].d.kind || 'staff' : null),
    clips: id => (M[id] ? Object.keys(M[id].d.anims) : []),
  };
})();
