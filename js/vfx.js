/* Hiệu ứng tuyệt kỹ riêng của từng tướng (vẽ bằng canvas, không cần ảnh).
   VFX.has(id) → có hiệu ứng riêng; VFX.draw(ctx, f) vẽ 1 hiệu ứng: f = {id, x, y, tx, ty, f(hướng), t, dur}.
   Toạ độ: (x,y) = chân người tung chiêu, (tx,ty) = tâm vùng chiêu (đất). p = t/dur (0..1). */
(function () {
  const TAU = Math.PI * 2;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
  const out3 = x => 1 - Math.pow(1 - cl(x, 0, 1), 3);
  const seg = (p, a, b) => cl((p - a) / (b - a), 0, 1);      // tiến độ trong đoạn [a,b]
  const fade = (p, a, b) => (p < a ? 1 : p > b ? 0 : 1 - (p - a) / (b - a));
  // số giả ngẫu nhiên ổn định theo chỉ số (không nhấp nháy giữa các khung)
  const rn = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function shock(c, x, y, r, w, col, a) { // vòng sóng chấn động dẹt (mặt đất)
    c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.ellipse(x, y, r, r * 0.42, 0, 0, TAU); c.stroke();
  }
  function cracks(c, x, y, R, n, col, p, seed) { // vết nứt toả ra trên mặt đất
    c.strokeStyle = col; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rn(seed + i) * 0.5, L = R * (0.6 + rn(seed + i + 9) * 0.5) * out3(p);
      c.lineWidth = 4 * (1 - p * 0.5); c.beginPath(); c.moveTo(x, y);
      let px = x, py = y;
      for (let k = 1; k <= 4; k++) {
        const q = k / 4, j = (rn(seed * 3 + i * 7 + k) - 0.5) * 0.5;
        px = x + Math.cos(a + j) * L * q; py = y + Math.sin(a + j) * L * q * 0.45; c.lineTo(px, py);
      }
      c.stroke();
    }
  }
  function debris(c, x, y, n, R, p, col, seed) { // đá vụn bắn lên rồi rơi
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + rn(seed + i) * 0.8), v = R * (0.5 + rn(seed + i + 5) * 0.7);
      const dx = Math.cos(a) * v * p, dy = Math.sin(a) * v * p + 260 * p * p;
      const s = 3 + rn(seed + i + 11) * 5;
      c.globalAlpha = 1 - p; c.fillRect(x + dx - s / 2, y + dy - s / 2, s, s);
    }
  }
  function sparks(c, x, y, n, R, p, cols, seed, up) {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI / 2 + (rn(seed + i) - 0.5) * 1.6 : rn(seed + i) * TAU;
      const d = R * out3(p) * (0.4 + rn(seed + i + 3) * 0.8);
      c.globalAlpha = (1 - p) * 0.95; c.fillStyle = cols[i % cols.length];
      c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * (up ? 1 : 0.6), 2 + rn(seed + i + 7) * 3 * (1 - p), 0, TAU); c.fill();
    }
  }
  function flame(c, x, y, w, h, t, a) { // 1 lưỡi lửa
    c.globalAlpha = a;
    const g = c.createLinearGradient(x, y, x, y - h);
    g.addColorStop(0, '#ffef9a'); g.addColorStop(0.35, '#ff9a2e'); g.addColorStop(0.75, '#e8321e'); g.addColorStop(1, 'rgba(160,20,10,0)');
    c.fillStyle = g; const s = Math.sin(t * 9 + x) * w * 0.35;
    c.beginPath(); c.moveTo(x - w / 2, y);
    c.quadraticCurveTo(x - w * 0.6 + s, y - h * 0.5, x + s * 1.5, y - h);
    c.quadraticCurveTo(x + w * 0.6 + s, y - h * 0.45, x + w / 2, y); c.closePath(); c.fill();
  }

  const FX = {
    // ---------------- Ngộ Không: Kim Cô Bổng khổng lồ giáng xuống
    ngokhong(c, f, p) {
      const x = f.tx, y = f.ty, fall = seg(p, 0, 0.22), hit = seg(p, 0.22, 1);
      if (p < 0.22) { // vệt sáng báo trước
        c.globalAlpha = 0.5 * fall; c.fillStyle = '#ffe680'; c.fillRect(x - 6, y - 520, 12, 520);
      }
      // cây gậy: dài 420px, rơi từ trên cao, cắm đất rồi mờ dần
      const L = 420, w = 26, yb = y - 8 - (1 - out3(fall)) * 520 + (p > 0.22 ? Math.sin(hit * 40) * 6 * (1 - hit) : 0);
      c.save(); c.globalAlpha = fade(p, 0.7, 1);
      const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, '#8a1010'); g.addColorStop(0.5, '#e8473c'); g.addColorStop(1, '#7a0c0c');
      c.fillStyle = g; c.fillRect(x - w / 2, yb - L, w, L);
      for (const cy of [yb - L, yb - 46]) { // 2 đầu bịt vàng
        const gg = c.createLinearGradient(x - w, 0, x + w, 0);
        gg.addColorStop(0, '#a87a10'); gg.addColorStop(0.5, '#fff1a0'); gg.addColorStop(1, '#a87a10');
        c.fillStyle = gg; c.fillRect(x - w / 2 - 4, cy, w + 8, 46);
      }
      c.restore();
      if (p > 0.22) {
        glow(c, x, y - 20, 170 * (0.6 + hit * 0.6), 'rgba(255,214,80,0.55)', 0.9 * (1 - hit));
        shock(c, x, y, 60 + 230 * out3(hit), 10 * (1 - hit) + 1, '#ffe27a', 1 - hit);
        shock(c, x, y, 30 + 150 * out3(seg(p, 0.3, 1)), 6 * (1 - hit) + 1, '#ffffff', 0.8 * (1 - hit));
        c.globalAlpha = fade(p, 0.6, 1); cracks(c, x, y, 190, 9, 'rgba(70,40,10,0.85)', seg(p, 0.22, 0.4), 3);
        debris(c, x, y - 4, 22, 260, hit, '#8a6a40', 7);
        sparks(c, x, y - 30, 26, 200, hit, ['#ffe680', '#fff', '#ffb02e'], 13, true);
      }
    },
    // ---------------- Na Tra: luồng thương lửa xoắn + bánh xe lửa
    nata(c, f, p) {
      const a = Math.atan2(f.ty - f.y, f.tx - f.x), len = 430, x0 = f.x, y0 = f.y - 30;
      const run = out3(seg(p, 0, 0.35)), al = fade(p, 0.6, 1);
      c.save(); c.translate(x0, y0); c.rotate(a);
      const L = len * run;
      for (let k = 0; k < 2; k++) { // 2 dải lửa xoắn quanh trục
        c.beginPath();
        for (let s = 0; s <= 40; s++) {
          const q = s / 40, xx = L * q, yy = Math.sin(q * 14 + p * 30 + k * Math.PI) * 26 * (0.4 + q * 0.6);
          s ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
        }
        c.globalAlpha = al; c.lineCap = 'round'; c.lineWidth = 16; c.strokeStyle = 'rgba(232,50,30,0.8)'; c.stroke();
        c.lineWidth = 6; c.strokeStyle = '#ffe680'; c.stroke();
      }
      const g = c.createLinearGradient(0, -14, 0, 14); // lõi sáng
      g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(0.5, '#fff6c0'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.globalAlpha = al; c.fillStyle = g; c.fillRect(0, -14, L, 28);
      // mũi thương lửa ở đầu luồng
      c.translate(L, 0); c.fillStyle = '#ffd34d'; c.beginPath(); c.moveTo(34, 0); c.lineTo(-10, -14); c.lineTo(-4, 0); c.lineTo(-10, 14); c.closePath(); c.fill();
      glow(c, 0, 0, 60, 'rgba(255,120,40,0.6)', 0.9 * al);
      c.restore();
      // 2 bánh xe lửa lăn dọc luồng
      for (let k = 0; k < 2; k++) {
        const q = cl(run - k * 0.18, 0, 1), wx = x0 + Math.cos(a) * len * q, wy = y0 + Math.sin(a) * len * q + (k ? 18 : -18);
        c.save(); c.translate(wx, wy); c.rotate(p * 40); c.globalAlpha = al;
        c.strokeStyle = '#ffd34d'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.stroke();
        for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(20, 0); c.stroke(); flame(c, 20, 0, 14, 22, p * 3 + i, al * 0.9); }
        c.restore();
      }
      sparks(c, x0 + Math.cos(a) * len * run, y0 + Math.sin(a) * len * run, 18, 120, seg(p, 0.2, 1), ['#ffe680', '#ff7a2e', '#fff'], 21);
    },
    // ---------------- Ngưu Ma Vương: bóng đầu trâu gầm + đất nứt đỏ
    ngumavuong(c, f, p) {
      const x = f.x, y = f.y, rise = out3(seg(p, 0, 0.3)), al = fade(p, 0.65, 1);
      c.save(); c.translate(x, y - 150 - 30 * rise); c.scale(0.6 + 0.5 * rise, 0.6 + 0.5 * rise); c.globalAlpha = 0.55 * al;
      const head = () => {
        c.beginPath(); c.ellipse(0, 10, 70, 62, 0, 0, TAU);
        c.moveTo(-55, -20); c.quadraticCurveTo(-150, -40, -140, -120); c.quadraticCurveTo(-110, -60, -40, -45); c.closePath();
        c.moveTo(55, -20); c.quadraticCurveTo(150, -40, 140, -120); c.quadraticCurveTo(110, -60, 40, -45); c.closePath();
      };
      const gh = c.createRadialGradient(0, 0, 10, 0, 0, 150);
      gh.addColorStop(0, 'rgba(120,10,10,0.95)'); gh.addColorStop(0.6, 'rgba(200,40,20,0.75)'); gh.addColorStop(1, 'rgba(255,120,40,0.2)');
      c.globalAlpha = 0.85 * al; c.fillStyle = gh; head(); c.fill();
      c.shadowColor = '#ff5a1e'; c.shadowBlur = 30; c.lineWidth = 5; c.strokeStyle = '#ff9a3a'; head(); c.stroke(); c.shadowBlur = 0;
      for (let i = 0; i < 7; i++) flame(c, -60 + i * 20, -40 - Math.abs(i - 3) * 6, 18, 40 + rn(i) * 30, p * 3 + i, 0.7 * al); // lửa bốc trên đầu trâu
      c.globalAlpha = al; c.fillStyle = '#ff3a1e'; // mắt đỏ rực
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 28, 0, 12, 7, s * 0.3, 0, TAU); c.fill(); glow(c, s * 28, 0, 30, 'rgba(255,60,30,0.6)', 0.8 * al); }
      c.restore();
      const q = seg(p, 0.15, 1);
      for (let i = 0; i < 3; i++) shock(c, x, y, 50 + 240 * out3(cl(q - i * 0.12, 0, 1)), 8 * (1 - q) + 1, i ? '#ff6a3a' : '#ffd0a0', (1 - q) * 0.9);
      c.globalAlpha = al; cracks(c, x, y, 210, 11, 'rgba(255,70,30,0.9)', seg(p, 0.15, 0.45), 5);
      debris(c, x, y, 16, 220, q, '#5a2a10', 31);
    },
    // ---------------- Quan Âm: sen nở + mưa cam lộ
    quanam(c, f, p) {   // Tịnh Bình Dương Liễu — như Tây Du VNG: cột sáng vàng chiếu xuống cả đội, hoa sen vàng nở, mưa cam lộ
      const x = f.x, y = f.y, open = out3(seg(p, 0, 0.3)), al = fade(p, 0.72, 1);
      // cột sáng từ trên cao
      for (let k = 0; k < 3; k++) {
        const w = (70 - k * 18) * open, a = (0.34 - k * 0.08) * al * (0.85 + 0.15 * Math.sin(p * 26 + k));
        const g = c.createLinearGradient(0, y - 520, 0, y + 10); g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(0.35, 'rgba(255,226,110,' + a + ')'); g.addColorStop(1, 'rgba(255,255,230,' + a * 1.3 + ')');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - w * 0.5, y - 520); c.lineTo(x + w * 0.5, y - 520); c.lineTo(x + w * 1.8, y + 10); c.lineTo(x - w * 1.8, y + 10); c.closePath(); c.fill();
      }
      c.save(); c.translate(x, y + 6);
      for (let ring = 0; ring < 3; ring++) {   // 3 tầng sen vàng nở dưới chân
        const n = [14, 10, 7][ring], R = [170, 120, 70][ring] * open;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + ring * 0.35 + p * (ring % 2 ? -0.5 : 0.5);
          c.save(); c.scale(1, 0.42); c.rotate(a); c.globalAlpha = (0.85 - ring * 0.1) * al;
          const g = c.createLinearGradient(0, 0, R, 0); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.6, ring ? '#ffd34d' : '#ffe58a'); g.addColorStop(1, ring ? '#e8a020' : '#ffc23a');
          c.fillStyle = g; c.strokeStyle = 'rgba(160,100,10,0.5)'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(R * 0.5, -R * 0.3, R, 0); c.quadraticCurveTo(R * 0.5, R * 0.3, 0, 0); c.fill(); c.stroke();
          c.restore();
        }
      }
      glow(c, 0, -20, 200 * open, 'rgba(255,230,120,0.5)', 0.8 * al);
      c.globalAlpha = 0.9 * al; c.strokeStyle = '#fff3a0'; c.lineWidth = 3;
      for (let k = 0; k < 2; k++) { c.beginPath(); c.ellipse(0, -150 - k * 8, (80 + k * 26) * open, (80 + k * 26) * open, 0, 0, TAU); c.stroke(); }   // vầng hào quang
      c.restore();
      for (let i = 0; i < 50; i++) {   // hạt cam lộ rơi cùng cột sáng
        const sx = x + (rn(i) - 0.5) * 380, t0 = rn(i + 50) * 0.55, q = seg(p, t0, t0 + 0.4);
        if (q <= 0 || q >= 1) continue;
        const sy = y - 420 + 420 * q;
        c.globalAlpha = (1 - q) * 0.95 * al; c.fillStyle = i % 3 ? '#fff6c0' : '#bff6ff';
        c.beginPath(); c.ellipse(sx, sy, 2.6, 7, 0, 0, TAU); c.fill();
      }
      for (let i = 0; i < 8; i++) {   // cánh sen vàng bay lên
        const q = seg(p, 0.15 + i * 0.05, 0.95), lx = x + (rn(i + 90) - 0.5) * 260 + Math.sin(q * 5 + i) * 24, ly = y - 20 - 280 * q;
        c.globalAlpha = fade(q, 0.6, 1) * al; c.fillStyle = '#ffe27a';
        c.save(); c.translate(lx, ly); c.rotate(q * 4 + i); c.beginPath(); c.ellipse(0, 0, 10, 4, 0, 0, TAU); c.fill(); c.restore();
      }
      sparks(c, x, y - 40, 26, 170, seg(p, 0.1, 1), ['#ffffff', '#fff3a0', '#ffd34d'], 41, true);
    },
    // ---------------- Đát Kỷ: trận hồ ly hồng + cánh hoa xoáy
    datky(c, f, p) {
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.7, 1), R = 175;
      c.save(); c.translate(x, y); c.scale(1, 0.45);
      c.globalAlpha = 0.35 * al; c.fillStyle = '#ff5fd2'; c.beginPath(); c.arc(0, 0, R * o, 0, TAU); c.fill();
      c.globalAlpha = al; c.strokeStyle = '#ffb0ee'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, R * o, 0, TAU); c.stroke();
      c.rotate(p * 2); c.lineWidth = 3; c.strokeStyle = '#ff7ae0'; // ngôi sao 9 cánh (cửu vĩ)
      c.beginPath(); for (let i = 0; i <= 9; i++) { const a = i * TAU * 4 / 9; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R * 0.85 * o, Math.sin(a) * R * 0.85 * o); } c.stroke();
      c.restore();
      for (let k = 0; k < 9; k++) { // 9 đuôi cáo lửa hồng vươn lên quanh trận
        const a = k / 9 * TAU + p, bx = x + Math.cos(a) * R * 0.8 * o, by = y + Math.sin(a) * R * 0.36 * o;
        c.save(); c.globalAlpha = 0.8 * al * fade(p, 0.55, 0.9);
        const g = c.createLinearGradient(bx, by, bx, by - 110); g.addColorStop(0, '#ff5fd2'); g.addColorStop(1, 'rgba(255,200,240,0)');
        c.fillStyle = g; const s = Math.sin(p * 12 + k) * 18;
        c.beginPath(); c.moveTo(bx - 10, by); c.quadraticCurveTo(bx - 26 + s, by - 60, bx + s, by - 110 * o); c.quadraticCurveTo(bx + 24 + s, by - 55, bx + 10, by); c.fill();
        c.restore();
      }
      for (let i = 0; i < 30; i++) { // cánh hoa xoáy vào tâm
        const a = rn(i) * TAU + p * 5, d = R * (1.2 - seg(p, 0, 1) * (0.6 + rn(i + 3) * 0.5));
        c.save(); c.translate(x + Math.cos(a) * d, y - 40 + Math.sin(a) * d * 0.45 - rn(i + 5) * 60); c.rotate(a * 2);
        c.globalAlpha = al; c.fillStyle = i % 3 ? '#ff9ad8' : '#fff0fa'; c.beginPath(); c.ellipse(0, 0, 7, 3.5, 0, 0, TAU); c.fill(); c.restore();
      }
      glow(c, x, y - 30, 120 * o, 'rgba(255,95,210,0.5)', 0.7 * al);
    },
    // ---------------- Bát Giới: đinh ba khổng lồ đập + sóng nước Thiên Hà
    batgioi(c, f, p) {
      const L = 300, px = f.x - f.f * 180, py = f.y - 60, x = f.x + f.f * 110, y = f.y; // đầu đinh ba cắm ngay trước mặt (vùng sát thương quanh Bát Giới)
      const sw = Math.pow(seg(p, 0, 0.25), 2), al = fade(p, 0.65, 1), aEnd = 1.775, a = -0.7 + (aEnd + 0.7) * sw;
      c.save(); c.translate(px, py); c.scale(f.f, 1); c.globalAlpha = al;
      if (p < 0.27) { // vệt quét
        c.globalAlpha = 0.35 * al; c.strokeStyle = '#cfe6ff'; c.lineWidth = 40; c.beginPath(); c.arc(0, 0, L - 20, -Math.PI / 2 - 0.7, -Math.PI / 2 + a); c.stroke(); c.globalAlpha = al;
      }
      c.rotate(a); c.fillStyle = '#5a3a20'; c.fillRect(-7, -L, 14, L);
      c.translate(0, -L); c.fillStyle = '#e4e8ef'; c.fillRect(-48, -12, 96, 18);
      for (let i = 0; i < 9; i++) { const tx = -44 + i * 11; c.beginPath(); c.moveTo(tx, 4); c.lineTo(tx + 5, 4); c.lineTo(tx + 2.5, 50); c.closePath(); c.fill(); }
      c.restore();
      if (p > 0.25) {
        const q = seg(p, 0.25, 1);
        glow(c, x, y - 20, 150 * (0.6 + q * 0.5), 'rgba(127,179,255,0.5)', 0.8 * (1 - q));
        for (let i = 0; i < 2; i++) shock(c, x, y, 40 + 210 * out3(cl(q - i * 0.15, 0, 1)), 9 * (1 - q) + 1, i ? '#7fb3ff' : '#e0f0ff', 1 - q);
        for (let i = 0; i < 34; i++) { // cột nước Thiên Hà bắn lên
          const a2 = -Math.PI / 2 + (rn(i) - 0.5) * 2.0, v = 180 + rn(i + 4) * 200;
          const dx = Math.cos(a2) * v * q, dy = Math.sin(a2) * v * q + 360 * q * q;
          c.globalAlpha = (1 - q) * al; c.fillStyle = i % 2 ? '#7fb3ff' : '#e8f6ff';
          c.beginPath(); c.arc(x + dx, y + dy - 10, 4 + rn(i + 8) * 5, 0, TAU); c.fill();
        }
        c.globalAlpha = (1 - q) * 0.45 * al; c.fillStyle = '#7fb3ff';
        c.beginPath(); c.ellipse(x, y, 170 * out3(q), 64 * out3(q), 0, 0, TAU); c.fill();
        c.globalAlpha = fade(p, 0.6, 1); cracks(c, x, y, 160, 8, 'rgba(40,60,110,0.8)', seg(p, 0.25, 0.4), 17);
      }
    },
    // ---------------- Đường Tăng: chữ kinh vàng xoay + vòng kim cô siết
    duongtang(c, f, p) {   // Khẩn Cô Chú — như Tây Du VNG: kinh văn vàng bay quanh người từ bàn tay, vòng kim cô siết lại, bong bóng sen
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.72, 1), R = 190;
      const words = '唵嘛呢叭咪吽唵嘛呢叭咪吽唵嘛呢叭咪吽';
      c.save(); c.font = '800 28px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let ring = 0; ring < 2; ring++) {   // 2 vòng kinh văn xoay ngược chiều
        for (let i = 0; i < words.length; i++) {
          const a = i / words.length * TAU + p * (ring ? -4 : 3.2), r = R * (ring ? 0.62 : 1.0) * (1.15 - 0.3 * seg(p, 0.3, 0.8)) * o;
          const wx = x + Math.cos(a) * r, wy = y - 60 + Math.sin(a) * r * 0.42 - ring * 22 + Math.sin(p * 12 + i) * 4;
          c.globalAlpha = al * (0.55 + 0.45 * Math.sin(p * 10 + i)); c.lineWidth = 4; c.strokeStyle = '#7a4a00'; c.strokeText(words[i], wx, wy);
          c.fillStyle = ring ? '#fff0a0' : '#ffe14d'; c.fillText(words[i], wx, wy);
        }
      }
      c.restore();
      const sq = seg(p, 0.35, 0.62);   // vòng kim cô siết lại
      c.globalAlpha = al; c.strokeStyle = '#ffd34d'; c.lineWidth = 8;
      c.beginPath(); c.ellipse(x, y - 20, R * (1 - 0.55 * ease(sq)), R * 0.42 * (1 - 0.55 * ease(sq)), 0, 0, TAU); c.stroke();
      c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
      for (let i = 0; i < 7; i++) {   // bong bóng sen toả sáng trôi lên
        const q = seg(p, 0.08 + i * 0.06, 0.9), bx = x + (rn(i + 7) - 0.5) * 300, by = y - 20 - 250 * q;
        c.globalAlpha = fade(q, 0.6, 1) * al * 0.9;
        const g = c.createRadialGradient(bx, by, 2, bx, by, 18); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.6, 'rgba(255,214,90,0.8)'); g.addColorStop(1, 'rgba(255,200,60,0)');
        c.fillStyle = g; c.beginPath(); c.arc(bx, by, 18, 0, TAU); c.fill();
      }
      glow(c, x, y - 50, 170 * o, 'rgba(255,220,90,0.5)', 0.8 * al);
      if (sq >= 1) sparks(c, x, y - 30, 22, 180, seg(p, 0.6, 1), ['#ffe14d', '#fff'], 61);
    },
    // ---------------- Hồng Hài Nhi: cột lửa xoáy + mây lửa
    duongtien(c, f, p) {   // Hao Thiên Khuyển: mắt thứ ba loé → chó thần vàng vồ từ trên cao xuống chỗ quái → vuốt xé + sóng chấn
      const x0 = f.x, y0 = f.y - 70, X = f.tx, Y = f.ty, d = f.f || 1;
      const fly = seg(p, 0.04, 0.27), hit = seg(p, 0.27, 0.62), al = fade(p, 0.7, 1);
      // mắt thứ ba loé trên đầu người tung chiêu
      const eye = fade(p, 0.0, 0.3) * seg(p, 0, 0.06);
      if (eye > 0) { glow(c, x0, y0 - 40, 40 + 30 * eye, 'rgba(255,200,60,0.7)', 0.8 * eye); c.globalAlpha = eye; c.fillStyle = '#fff3a0'; c.beginPath(); c.ellipse(x0, y0 - 44, 4, 11, 0, 0, TAU); c.fill(); }
      // chó thần bay theo cung parabol
      if (fly > 0 && fly < 1) {
        const t = ease(fly), hx = x0 + (X - x0) * t, hy = y0 + (Y - y0) * t - Math.sin(t * Math.PI) * 190, ang = Math.atan2((Y - y0) * 0.6 - Math.cos(t * Math.PI) * 190 * 0.9, (X - x0) * 0.9);
        for (let k = 6; k >= 1; k--) {   // vệt lông vàng
          const tt = Math.max(0, t - k * 0.045), tx_ = x0 + (X - x0) * tt, ty_ = y0 + (Y - y0) * tt - Math.sin(tt * Math.PI) * 190;
          c.globalAlpha = 0.5 * (1 - k / 7); glow(c, tx_, ty_, 30 - k * 2, 'rgba(255,200,60,0.55)', 0.5);
        }
        hound(c, hx, hy, 1.9 + 0.5 * Math.sin(t * Math.PI), ang, d);
      }
      // trúng đích: vuốt xé + sóng chấn + vụn vàng
      if (hit > 0) {
        const a = fade(hit, 0.55, 1);
        shock(c, X, Y, 40 + 160 * out3(hit), 10 * (1 - hit) + 2, '#ffd34d', 0.9 * a);
        shock(c, X, Y, 20 + 110 * out3(hit), 5, '#ffffff', 0.7 * a);
        glow(c, X, Y - 20, 120 * out3(hit), 'rgba(255,210,80,0.5)', 0.7 * a);
        c.lineCap = 'round';
        for (let k = 0; k < 3; k++) {   // ba đường vuốt chéo
          const q = seg(hit, 0.05 + k * 0.08, 0.4 + k * 0.08), ox = (k - 1) * 46;
          if (q <= 0) continue;
          c.globalAlpha = a; c.strokeStyle = '#fff6c2'; c.lineWidth = 9 - k;
          c.beginPath(); c.moveTo(X + ox - 60, Y - 150); c.lineTo(X + ox - 60 + 120 * out3(q), Y - 150 + 190 * out3(q)); c.stroke();
          c.strokeStyle = '#ffb02e'; c.lineWidth = 4; c.stroke();
        }
        cracks(c, X, Y, 150, 9, '#7a4a10', out3(hit), 17);
        for (let i = 0; i < 26; i++) {
          const an = rn(i) * TAU, v = 60 + rn(i + 40) * 170, q = out3(hit);
          c.globalAlpha = a; c.fillStyle = i % 3 ? '#ffd34d' : '#ffffff';
          c.beginPath(); c.arc(X + Math.cos(an) * v * q, Y - 10 + Math.sin(an) * v * q * 0.55 - 40 * q * (1 - q) * 4, 3 + rn(i + 9) * 3, 0, TAU); c.fill();
        }
      }
      // phân thân chó mờ ngồi lại cạnh Dương Tiễn khi kết thúc
      if (p > 0.6) { c.globalAlpha = 0.55 * (1 - al * 0) * seg(p, 0.6, 0.75) * al; hound(c, x0 + d * 70, f.y + 6, 0.9, 0, d, true); }
      c.globalAlpha = 1;
    },
    honghainhi(c, f, p) {
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.75, 1), R = 150;
      c.globalAlpha = 0.45 * al; c.fillStyle = '#ff6a2a'; c.beginPath(); c.ellipse(x, y, R * o, R * 0.42 * o, 0, 0, TAU); c.fill();
      for (let i = 0; i < 22; i++) { // rừng lưỡi lửa bùng lên trong vùng
        const a = rn(i) * TAU, d = Math.sqrt(rn(i + 3)) * R * 0.9;
        const fx = x + Math.cos(a) * d * o, fy = y + Math.sin(a) * d * 0.42 * o;
        flame(c, fx, fy, 26 + rn(i + 5) * 22, (60 + rn(i + 9) * 90) * o * (0.8 + 0.2 * Math.sin(p * 20 + i)), p * 4 + i, al * 0.9);
      }
      for (let k = 0; k < 3; k++) { // cột lửa xoáy ở tâm
        c.save(); c.translate(x, y); c.globalAlpha = al * 0.85;
        for (let s = 0; s < 14; s++) {
          const q = s / 14, r = (18 + q * 40) * o, a = q * 9 + p * 18 + k * 2.1;
          c.fillStyle = s % 2 ? '#ffb02e' : '#ff4a1e';
          c.beginPath(); c.arc(Math.cos(a) * r, -q * 230 * o + Math.sin(a) * r * 0.3, 10 * (1 - q * 0.5), 0, TAU); c.fill();
        }
        c.restore();
      }
      for (let i = 0; i < 9; i++) { // mây lửa cuộn trên đầu (khói gradient)
        const cx = x - 150 + i * 37 + Math.sin(i * 2 + p * 5) * 8, cy = y - 245 * o + Math.sin(i + p * 6) * 8, r = 34 + rn(i + 30) * 22;
        const g = c.createRadialGradient(cx, cy, 2, cx, cy, r);
        g.addColorStop(0, 'rgba(255,190,80,0.85)'); g.addColorStop(0.5, 'rgba(220,60,30,0.6)'); g.addColorStop(1, 'rgba(90,20,20,0)');
        c.globalAlpha = al; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
      }
      glow(c, x, y - 60, 160 * o, 'rgba(255,120,40,0.5)', 0.8 * al);
      sparks(c, x, y - 40, 30, 220, seg(p, 0.1, 1), ['#ffe680', '#ff7a2e', '#fff'], 81, true);
    },
    khuongtanha(c, f, p) {   // Phong Thần: Bảng Phong Thần hạ từ trời, tên quái hiện rồi bị gạch đỏ, sấm sét giáng xuống
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.25)), al = fade(p, 0.78, 1), top = y - 260;
      glow(c, x, top + 90, 190 * o, 'rgba(120,170,255,0.5)', 0.7 * al);
      // cuộn bảng
      const w = 120 * o, h = 150 * o;
      c.save(); c.globalAlpha = al; c.translate(x, top + 60 - 30 * (1 - o));
      c.fillStyle = '#f4e6b8'; c.strokeStyle = '#8a5a1a'; c.lineWidth = 4; c.fillRect(-w / 2, -h / 2, w, h); c.strokeRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#c8962a'; c.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, 12); c.fillRect(-w / 2 - 8, h / 2 - 4, w + 16, 12);
      c.font = '700 22px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const nm = ['妖', '魔', '鬼', '怪'];
      for (let i = 0; i < 4; i++) {   // tên quái hiện rồi bị gạch
        const q = seg(p, 0.25 + i * 0.08, 0.4 + i * 0.08), ty = -h / 2 + 24 + i * 32;
        c.fillStyle = '#3a2410'; c.fillText(nm[i], 0, ty);
        if (q > 0) { c.strokeStyle = '#d82a1a'; c.lineWidth = 5; c.beginPath(); c.moveTo(-26, ty); c.lineTo(-26 + 52 * q, ty); c.stroke(); }
      }
      c.restore();
      for (let k = 0; k < 4; k++) {   // sét giáng từ bảng xuống từng điểm
        const q = seg(p, 0.35 + k * 0.1, 0.5 + k * 0.1); if (q <= 0 || q >= 1) continue;
        const tx = x + (k - 1.5) * 70, ty2 = y + (rn(k + 3) - 0.5) * 24;
        c.save(); c.globalAlpha = (1 - q) * al; c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx, top + 110);
        for (let s = 1; s <= 6; s++) c.lineTo(tx + (rn(k * 9 + s) - 0.5) * 36, top + 110 + (ty2 - top - 110) * s / 6);
        c.stroke(); c.strokeStyle = '#7fb3ff'; c.lineWidth = 3; c.stroke(); c.restore();
        shock(c, tx, ty2, 20 + 90 * q, 5, '#bfe0ff', (1 - q) * al);
      }
      sparks(c, x, y - 30, 26, 190, seg(p, 0.3, 1), ['#ffffff', '#9fd0ff', '#ffe58a'], 21, true);
    },
    vantieu(c, f, p) {   // Cửu Khúc Hoàng Hà Trận: mê cung sông vàng nổi lên, dòng chảy quanh, kim đấu chiếu sáng
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.25)), al = fade(p, 0.78, 1), R = 175;
      c.save(); c.translate(x, y); c.scale(1, 0.45);
      c.globalAlpha = 0.5 * al * o; const g = c.createRadialGradient(0, 0, 10, 0, 0, R * o); g.addColorStop(0, 'rgba(255,230,120,0.9)'); g.addColorStop(1, 'rgba(255,180,40,0.15)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * o, 0, TAU); c.fill();
      c.lineCap = 'round'; c.globalAlpha = al;
      for (let k = 0; k < 3; k++) {   // 9 khúc sông: 3 vòng sóng xoáy ngược chiều
        c.strokeStyle = k % 2 ? '#fff3a0' : '#ffb02e'; c.lineWidth = 7 - k * 1.5; c.beginPath();
        for (let a = 0; a <= TAU * 3; a += 0.12) { const r = (22 + k * 40 + a * 8) * o + Math.sin(a * 3 + p * 14 * (k % 2 ? 1 : -1)) * 6; const px = Math.cos(a + p * 6 * (k % 2 ? 1 : -1)) * r, py = Math.sin(a + p * 6 * (k % 2 ? 1 : -1)) * r; a ? c.lineTo(px, py) : c.moveTo(px, py); }
        c.stroke();
      }
      c.restore();
      const by = y - 150 * o; glow(c, x, by, 70 * o, 'rgba(255,220,100,0.7)', 0.9 * al);
      c.globalAlpha = al; c.fillStyle = '#ffd34d'; c.strokeStyle = '#8a5a10'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, by, 26, 12, 0, 0, Math.PI); c.fill(); c.stroke();
      for (let i = 0; i < 10; i++) { const q = seg(p, 0.15 + i * 0.03, 0.8); c.globalAlpha = fade(q, 0.5, 1) * al; c.fillStyle = '#ffe58a'; c.beginPath(); c.arc(x + Math.sin(i * 2 + p * 8) * 30, by + q * 130, 4, 0, TAU); c.fill(); }
      sparks(c, x, y - 30, 20, 170, seg(p, 0.1, 1), ['#fff3a0', '#ffd34d'], 31, true);
    },
    trieucongminh(c, f, p) {   // Định Hải Châu: châu vàng khổng lồ rơi từ trời, nổ; mưa tiền vàng
      const x = f.tx, y = f.ty, fall = seg(p, 0.02, 0.32), boom = seg(p, 0.32, 0.7), al = fade(p, 0.75, 1);
      if (fall < 1) { const py = y - 330 + 330 * ease(fall), r = 34 + 14 * fall;
        for (let k = 5; k >= 1; k--) { c.globalAlpha = 0.4 * (1 - k / 6); glow(c, x, py - k * 22, r + 10, 'rgba(255,210,80,0.5)', 0.5); }
        c.globalAlpha = 1; const g = c.createRadialGradient(x - 8, py - 8, 3, x, py, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe58a'); g.addColorStop(1, '#d89a20');
        c.fillStyle = g; c.beginPath(); c.arc(x, py, r, 0, TAU); c.fill(); c.strokeStyle = '#8a5a10'; c.lineWidth = 3; c.stroke(); }
      if (boom > 0) {
        const a = fade(boom, 0.6, 1) * al;
        glow(c, x, y - 20, 210 * out3(boom), 'rgba(255,220,100,0.7)', 0.9 * a);
        shock(c, x, y, 30 + 190 * out3(boom), 12 * (1 - boom) + 2, '#ffd34d', a); shock(c, x, y, 20 + 120 * out3(boom), 5, '#ffffff', a);
        for (let i = 0; i < 28; i++) {   // đồng tiền vàng bắn lên rồi rơi
          const an = -Math.PI * (0.1 + rn(i) * 0.8), v = 120 + rn(i + 7) * 190, q = boom;
          const cx = x + Math.cos(an) * v * q, cy = y + Math.sin(an) * v * q + 340 * q * q;
          c.save(); c.translate(cx, cy); c.rotate(q * 12 + i); c.globalAlpha = a; c.scale(1, Math.abs(Math.cos(q * 10 + i)) * 0.8 + 0.2);
          c.fillStyle = '#ffd34d'; c.strokeStyle = '#8a5a10'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#8a5a10'; c.fillRect(-2.5, -2.5, 5, 5); c.restore();
        }
        cracks(c, x, y, 160, 8, '#7a4a10', out3(boom), 23);
      }
    },
    thailaoquan(c, f, p) {   // Bát Quái Lô: trận bát quái xoay, lửa tam muội xanh-cam, hào quang hồi máu
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.25)), al = fade(p, 0.78, 1), R = 170;
      c.save(); c.translate(x, y); c.scale(1, 0.45); c.rotate(p * 2.4); c.globalAlpha = 0.85 * al;
      c.strokeStyle = '#7dffb0'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, R * o, 0, TAU); c.stroke(); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R * o * 0.62, 0, TAU); c.stroke();
      for (let k = 0; k < 8; k++) {   // 8 quẻ: 3 vạch, đứt/liền
        c.save(); c.rotate(k * TAU / 8); c.translate(0, -R * o * 0.82);
        for (let l = 0; l < 3; l++) { c.fillStyle = (k >> l) & 1 ? '#ffe58a' : '#9fffd0'; if ((k + l) % 3) c.fillRect(-22, l * 9 - 9, 44, 5); else { c.fillRect(-22, l * 9 - 9, 18, 5); c.fillRect(4, l * 9 - 9, 18, 5); } }
        c.restore();
      }
      c.restore();
      for (let i = 0; i < 18; i++) {   // lửa tam muội
        const a = rn(i) * TAU, d = Math.sqrt(rn(i + 3)) * R * 0.75 * o, fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.42, hh = (50 + rn(i + 5) * 60) * o * (0.8 + 0.2 * Math.sin(p * 18 + i));
        c.globalAlpha = al * 0.8; const g = c.createLinearGradient(fx, fy, fx, fy - hh); g.addColorStop(0, 'rgba(255,140,40,0.9)'); g.addColorStop(0.5, 'rgba(120,255,170,0.7)'); g.addColorStop(1, 'rgba(120,255,170,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(fx - 10, fy); c.quadraticCurveTo(fx, fy - hh * 0.6, fx + Math.sin(p * 10 + i) * 6, fy - hh); c.quadraticCurveTo(fx, fy - hh * 0.5, fx + 10, fy); c.fill();
      }
      glow(c, x, y - 40, 190 * o, 'rgba(120,255,180,0.45)', 0.7 * al);
      sparks(c, x, y - 30, 22, 170, seg(p, 0.1, 1), ['#9fffd0', '#ffe58a', '#ffffff'], 41, true);
    },
    satang(c, f, p) {   // Lưu Sa Hà: xoáy cát nuốt quái, mặt sọ hiện trong cát
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.75, 1), R = 160;
      c.globalAlpha = 0.5 * al; c.fillStyle = '#b89a5a'; c.beginPath(); c.ellipse(x, y, R * o, R * 0.42 * o, 0, 0, TAU); c.fill();
      for (let k = 0; k < 140; k++) {   // hạt cát xoáy
        const q = k / 140, a = q * 22 + p * 14 + rn(k) * 0.6, r = (14 + q * R) * o, h = q * 150 * o;
        c.globalAlpha = al * (0.4 + 0.5 * (1 - q)); c.fillStyle = k % 3 ? '#d8b86a' : '#8a6a3a';
        c.beginPath(); c.arc(x + Math.cos(a) * r, y - h + Math.sin(a) * r * 0.42, 2.5 + rn(k + 5) * 3, 0, TAU); c.fill();
      }
      for (let k = 0; k < 3; k++) {   // sọ trong cát
        const sx = x + Math.cos(p * 6 + k * 2.1) * 80 * o, sy = y - 40 + Math.sin(p * 6 + k * 2.1) * 30 * o - 50 * k * o;
        c.globalAlpha = al * 0.85; c.fillStyle = '#f4ecd8'; c.strokeStyle = '#6a5a3a'; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, 12, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(sx - 4, sy - 1, 2.6, 0, TAU); c.arc(sx + 4, sy - 1, 2.6, 0, TAU); c.fill();
      }
      shock(c, x, y, R * o, 6, '#d8b86a', 0.8 * al);
      sparks(c, x, y - 30, 18, 150, seg(p, 0.1, 1), ['#f0d890', '#c8a050'], 51, true);
    },
    thietphien(c, f, p) {   // Cuồng Phong: lốc xoáy cuộn lá chuối, vệt gió, hất tung
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.75, 1);
      for (let k = 0; k < 9; k++) {   // phễu lốc: các vòng elip chồng nhau
        const q = k / 8, r = (30 + q * 120) * o, yy = y - q * 240 * o, rot = p * 10 - k * 0.5;
        c.save(); c.translate(x + Math.sin(p * 5 + k) * 10, yy); c.scale(1, 0.3); c.rotate(rot); c.globalAlpha = al * (0.35 + 0.4 * (1 - q)); c.strokeStyle = k % 2 ? '#c8ffd8' : '#7fe8a0'; c.lineWidth = 8 - q * 4;
        c.beginPath(); c.arc(0, 0, r, 0.3, TAU - 0.4); c.stroke(); c.restore();
      }
      for (let i = 0; i < 14; i++) {   // lá chuối bay xoáy
        const q = (p * 1.4 + rn(i)) % 1, a = q * 14 + i, r = (40 + q * 110) * o, lx = x + Math.cos(a) * r, ly = y - q * 230 * o + Math.sin(a) * r * 0.3;
        c.save(); c.translate(lx, ly); c.rotate(a * 2); c.globalAlpha = al * (1 - q * 0.5); c.fillStyle = '#4fb85a'; c.strokeStyle = '#1f6a2a'; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(0, 0, 14, 5, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
      }
      shock(c, x, y, 40 + 150 * out3(seg(p, 0.1, 0.6)), 7, '#c8ffd8', 0.7 * al);
      glow(c, x, y - 40, 120 * o, 'rgba(160,255,190,0.4)', 0.6 * al);
    },
    litinh(c, f, p) {   // Thác Tháp Trấn Yêu: tháp 7 tầng rơi từ trời, từng tầng sáng lần lượt, đè xuống
      const x = f.tx, y = f.ty, fall = seg(p, 0.02, 0.3), lit = seg(p, 0.3, 0.7), al = fade(p, 0.78, 1);
      const py = fall < 1 ? y - 340 + 340 * ease(fall) : y, tiers = 7;
      if (fall < 1) glow(c, x, py - 60, 130, 'rgba(255,220,100,0.45)', 0.6);
      c.save(); c.globalAlpha = al; c.translate(x, py); const sc = 1.7 + 0.2 * Math.sin(lit * 20) * (lit > 0 && lit < 1 ? 0.1 : 0);
      for (let t = 0; t < tiers; t++) {
        const w = (58 - t * 6) * sc, h = 24 * sc, by = -t * h * 0.92, on = lit * tiers > t;
        c.fillStyle = on ? '#fff0a0' : '#d8a52a'; c.strokeStyle = '#6a3a0a'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-w, by); c.lineTo(w, by); c.lineTo(w * 0.8, by - h * 0.5); c.lineTo(-w * 0.8, by - h * 0.5); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = on ? '#ffffff' : '#a8741a'; c.fillRect(-w * 0.55, by - h * 0.5, w * 1.1, h * 0.42); c.strokeRect(-w * 0.55, by - h * 0.5, w * 1.1, h * 0.42);
        if (on) { c.globalAlpha = 0.5 * al; glow(c, 0, by - 8, 50, 'rgba(255,230,120,0.6)', 0.7); c.globalAlpha = al; }
      }
      c.restore();
      if (fall >= 1) { const b = seg(p, 0.3, 0.9); shock(c, x, y, 30 + 190 * out3(b), 10 * (1 - b) + 2, '#ffd34d', 0.9 * (1 - b) * al); cracks(c, x, y, 170, 9, '#6a3a0a', out3(b), 61);
        for (let k = 0; k < 4; k++) { c.globalAlpha = (1 - b) * al * 0.7; c.fillStyle = '#ffe58a'; c.fillRect(x - 3 + (k - 1.5) * 44, y - 300 * b, 6, 300 * b); } }
      sparks(c, x, y - 20, 20, 170, seg(p, 0.3, 1), ['#ffe58a', '#ffffff'], 71, true);
    },
    hangnga(c, f, p) {   // Nguyệt Cung: trăng tròn lên cao, mưa ánh trăng, thỏ ngọc, cánh quế rơi, hồi máu
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.78, 1), my = y - 250, R = 74 * o;
      glow(c, x, my, 190 * o, 'rgba(190,210,255,0.55)', 0.85 * al);
      c.globalAlpha = al; const g = c.createRadialGradient(x - 18, my - 18, 6, x, my, R); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#eef2ff'); g.addColorStop(1, '#bcc8f0');
      c.fillStyle = g; c.beginPath(); c.arc(x, my, R, 0, TAU); c.fill();
      c.fillStyle = 'rgba(160,175,220,0.45)'; for (const [dx, dy, r] of [[-22, -10, 14], [18, 12, 18], [-4, 28, 9]]) { c.beginPath(); c.arc(x + dx * o, my + dy * o, r * o, 0, TAU); c.fill(); }
      c.fillStyle = '#ffffff'; c.strokeStyle = '#8a98c8'; c.lineWidth = 2; c.beginPath(); c.ellipse(x + 10 * o, my - 4 * o, 8 * o, 12 * o, 0.2, 0, TAU); c.fill(); c.stroke();   // bóng thỏ ngọc
      c.beginPath(); c.ellipse(x + 4 * o, my - 22 * o, 3 * o, 10 * o, -0.2, 0, TAU); c.ellipse(x + 12 * o, my - 22 * o, 3 * o, 10 * o, 0.2, 0, TAU); c.fill(); c.stroke();
      const b = seg(p, 0.25, 0.9);
      for (let k = 0; k < 5; k++) {   // chùm sáng trăng
        const bx = x + (k - 2) * 62; c.globalAlpha = 0.4 * al * Math.min(1, b * 3); const lg = c.createLinearGradient(x, my + 20, bx, y + 10); lg.addColorStop(0, 'rgba(230,240,255,0.9)'); lg.addColorStop(1, 'rgba(200,220,255,0.1)');
        c.fillStyle = lg; c.beginPath(); c.moveTo(x - 8, my + 40); c.lineTo(x + 8, my + 40); c.lineTo(bx + 24, y + 10); c.lineTo(bx - 24, y + 10); c.closePath(); c.fill();
      }
      for (let i = 0; i < 26; i++) {   // cánh quế + hạt sáng rơi
        const q = (p * 1.2 + rn(i)) % 1, lx = x + (rn(i + 4) - 0.5) * 300 + Math.sin(q * 6 + i) * 16, ly = my + 20 + q * (y - my);
        c.globalAlpha = al * Math.min(1, b * 3) * (1 - q * 0.6); c.fillStyle = i % 3 ? '#ffffff' : '#ffe0f0'; c.beginPath(); c.arc(lx, ly, i % 3 ? 2.6 : 3.6, 0, TAU); c.fill();
      }
      shock(c, x, y, 40 + 150 * out3(seg(p, 0.3, 0.8)), 5, '#dfe8ff', 0.7 * al);
    },
    bachcot(c, f, p) {   // Bạch Cốt Ma Âm: bộ xương khổng lồ tím hiện sau lưng, sóng sọ lan ra, xương trồi lên đất
      const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.78, 1);
      c.save(); c.globalAlpha = 0.55 * al * o; c.translate(x, y - 40); c.scale(1.6 * o, 1.6 * o);
      const sk = c.createRadialGradient(0, -80, 10, 0, -80, 130); sk.addColorStop(0, 'rgba(190,120,255,0.9)'); sk.addColorStop(1, 'rgba(90,30,140,0)'); c.fillStyle = sk; c.beginPath(); c.arc(0, -80, 130, 0, TAU); c.fill();
      c.fillStyle = '#e8dcf8'; c.strokeStyle = '#4a2a6a'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -120, 34, 38, 0, 0, TAU); c.fill(); c.stroke();   // sọ
      c.fillStyle = '#2a1040'; c.beginPath(); c.ellipse(-13, -122, 9, 12, 0, 0, TAU); c.ellipse(13, -122, 9, 12, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(0, -112); c.lineTo(-4, -100); c.lineTo(4, -100); c.closePath(); c.fill();
      c.fillStyle = '#e8dcf8'; c.fillRect(-22, -90, 44, 14); c.strokeRect(-22, -90, 44, 14); for (let t = -16; t <= 16; t += 8) { c.beginPath(); c.moveTo(t, -90); c.lineTo(t, -76); c.stroke(); }
      for (let r = 0; r < 4; r++) { c.beginPath(); c.moveTo(-50 + r * 4, -60 + r * 16); c.quadraticCurveTo(0, -48 + r * 16, 50 - r * 4, -60 + r * 16); c.lineWidth = 6; c.strokeStyle = '#d8c8f0'; c.stroke(); }   // xương sườn
      c.restore();
      for (let k = 0; k < 3; k++) { const q = seg(p, 0.15 + k * 0.12, 0.7 + k * 0.1); if (q > 0 && q < 1) shock(c, x, y, 40 + 190 * q, 7 - 4 * q, '#c88aff', (1 - q) * al); }
      for (let i = 0; i < 12; i++) {   // xương nhọn trồi lên
        const q = out3(seg(p, 0.2 + i * 0.02, 0.45 + i * 0.02)), bx = x + (rn(i) - 0.5) * 260 * o, by = y + (rn(i + 6) - 0.5) * 60, hh = (34 + rn(i + 9) * 40) * q;
        c.globalAlpha = al; c.fillStyle = '#f0e8f8'; c.strokeStyle = '#4a2a6a'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 7, by); c.lineTo(bx, by - hh); c.lineTo(bx + 7, by); c.closePath(); c.fill(); c.stroke();
      }
      glow(c, x, y - 30, 170 * o, 'rgba(170,90,255,0.4)', 0.7 * al);
      sparks(c, x, y - 30, 22, 170, seg(p, 0.1, 1), ['#e0c0ff', '#a060ff', '#ffffff'], 81, true);
    },
  };

  // tuyệt kỹ chung cho tướng mới (hình chính lấy từ art/fx/ult_<id>.webp, vẽ trong main.js)
  const GEN = { loichantu: '#9fd0ff', thohanhton: '#d8b86a', thaiatchannhan: '#ff7a2e', thancongbao: '#6a7ad8', longnu: '#9fe8ff', kimgiac: '#b88aff', tieubachlong: '#bfeaff', thaibachkimtinh: '#ffe58a', culinhthan: '#ffd34d', hoangphongquai: '#e8c060' };
  for (const id in GEN) FX[id] = (c, f, p) => { const x = f.tx, y = f.ty, o = out3(seg(p, 0, 0.3)), al = fade(p, 0.75, 1);
    glow(c, x, y - 40, 190 * o, GEN[id] + '88', 0.8 * al); shock(c, x, y, 40 + 170 * out3(seg(p, 0.2, 0.7)), 8, GEN[id], 0.9 * al); shock(c, x, y, 20 + 110 * out3(seg(p, 0.25, 0.75)), 4, '#ffffff', 0.7 * al);
    sparks(c, x, y - 30, 26, 190, seg(p, 0.15, 1), ['#ffffff', GEN[id]], 91, true); };
  const ANCHOR_SELF = { ngumavuong: 1, quanam: 1, batgioi: 1, nata: 1 };
  // vẽ chó Hao Thiên Khuyển (bằng canvas): s = cỡ, rot = góc bay, d = hướng nhìn, sit = ngồi
  function hound(c, x, y, s, rot, d, sit) {
    c.save(); c.translate(x, y); c.scale(s * d, s); if (!sit) c.rotate(rot * (d > 0 ? 1 : -1) * 0.5);
    const fur = '#ffc83a', fur2 = '#fff1c0', ln = '#7a4a10';
    c.lineWidth = 2.2; c.strokeStyle = ln; c.lineJoin = 'round';
    // đuôi
    c.fillStyle = fur; c.beginPath(); c.moveTo(-22, -4); c.quadraticCurveTo(-48, -22 - (sit ? 0 : 6), -36, -34); c.quadraticCurveTo(-30, -20, -18, -8); c.closePath(); c.fill(); c.stroke();
    // chân sau / trước (duỗi khi bay)
    const ext = sit ? 0 : 1;
    c.fillStyle = fur; for (const lg of [[-14, 8, -22 - 10 * ext, 20 + 2 * ext], [-4, 9, -10 - 6 * ext, 22], [12, 9, 20 + 12 * ext, 20 + 2 * ext], [20, 8, 30 + 12 * ext, 14 + 4 * ext]]) {
      c.beginPath(); c.moveTo(lg[0], lg[1]); c.lineTo(lg[2], lg[3]); c.lineTo(lg[2] + 7, lg[3] + 1); c.lineTo(lg[0] + 9, lg[1]); c.closePath(); c.fill(); c.stroke();
    }
    // thân
    c.fillStyle = fur; c.beginPath(); c.ellipse(0, 0, 28, 15, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = fur2; c.beginPath(); c.ellipse(6, 6, 18, 7, 0, 0, TAU); c.fill();
    // khăn đỏ
    c.fillStyle = '#d83a2a'; c.beginPath(); c.moveTo(18, -10); c.lineTo(34, -6); c.lineTo(30, 6); c.lineTo(16, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(18, -6); c.lineTo(2, -2 - 8 * (sit ? 0 : 1)); c.lineTo(6, 6); c.closePath(); c.fill();
    // đầu
    c.fillStyle = fur; c.beginPath(); c.arc(32, -12, 13, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(24, -22); c.lineTo(22, -38); c.lineTo(32, -26); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(34, -24); c.lineTo(40, -39); c.lineTo(44, -22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = fur2; c.beginPath(); c.ellipse(41, -7, 9, 6, 0.15, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(48, -9, 2.4, 0, TAU); c.fill(); c.beginPath(); c.arc(35, -15, 2, 0, TAU); c.fill();
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(43, -2, 4, 3, 0, 0, Math.PI); c.fill();
    c.restore();
  }
  window.VFX = {
    has: id => !!FX[id],
    dur: 1.25,
    draw(c, f) {
      const p = cl(f.t / f.dur, 0, 1);
      // thu nhỏ quanh tâm chiêu cho hợp cỡ nhân vật chibi trên sân (Na Tra: luồng thương giữ đúng độ dài vùng sát thương)
      const K = f.id === 'nata' ? 1 : 0.7;
      const ax = ANCHOR_SELF[f.id] ? f.x : f.tx, ay = ANCHOR_SELF[f.id] ? f.y : f.ty;
      c.save(); c.translate(ax, ay); c.scale(K, K); c.translate(-ax, -ay); FX[f.id](c, f, p); c.restore();
    },
  };
})();
