'use strict';
// =====================================================================
// Art: vẽ nhân vật chibi, nền chiến trường bằng Canvas 2D (không cần ảnh).
// Gốc toạ độ của nhân vật là điểm giữa hai chân; đầu ở khoảng y = -44.
// Khi có ảnh/sprite do hoạ sĩ vẽ, thay hàm draw() bằng drawImage.
// =====================================================================
const Art = (() => {
  const OL = '#4a2a1c';
  const TAU = Math.PI * 2;

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function C(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function E(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function fs(c, col, lw) {
    c.fillStyle = col; c.fill();
    if (lw !== 0) { c.lineWidth = lw || 2; c.strokeStyle = OL; c.stroke(); }
  }
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = a < 0 ? 0 : 255, p = Math.abs(a);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // ------------------------------------------------------------ back layer
  function tailPath(c, t, bob) {
    c.beginPath();
    c.moveTo(-6, -14 - bob);
    c.bezierCurveTo(-26, -12, -28, -34 + Math.sin(t * 3) * 3, -17, -40);
    c.quadraticCurveTo(-9, -43, -11, -36);
  }
  function back(c, L, t, bob) {
    if (L.halo) {
      c.save(); c.translate(0, -46 - bob);
      const g = c.createRadialGradient(0, 0, 6, 0, 0, 32);
      g.addColorStop(0, 'rgba(255,244,170,0.95)'); g.addColorStop(1, 'rgba(255,220,120,0)');
      c.fillStyle = g; C(c, 0, 0, 32); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = '#ffd34d'; C(c, 0, 0, 24); c.stroke();
      c.restore();
    }
    if (L.cape) {
      c.beginPath();
      c.moveTo(-10, -28 - bob);
      c.quadraticCurveTo(-24, -10, -19 + Math.sin(t * 4) * 2, 1);
      c.lineTo(14, 1);
      c.quadraticCurveTo(16, -12, 10, -28 - bob);
      c.closePath(); fs(c, L.cape);
    }
    if (L.tail) {
      c.save(); c.lineCap = 'round';
      c.strokeStyle = OL; c.lineWidth = 6.5; tailPath(c, t, bob); c.stroke();
      c.strokeStyle = L.hair; c.lineWidth = 4; tailPath(c, t, bob); c.stroke();
      c.restore();
    }
    if (L.tails) {
      const n = L.tails;
      for (let i = 0; i < n; i++) {
        const th = n === 1 ? -0.7 : -1.55 + 1.9 * i / (n - 1);
        const sw = Math.sin(t * 3 + i) * 0.08;
        c.save(); c.translate(-3, -16 - bob); c.rotate(th + sw);
        E(c, 0, -18, 7.5, 18); fs(c, L.hair, 1.8);
        E(c, 0, -31, 4.6, 6.2); fs(c, '#fff6f0', 0);
        c.restore();
      }
    }
    if (L.sash) {
      c.save(); c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const x = -28 + i * 2.8;
        const y = -30 - bob + Math.sin(t * 4 + i * 0.5) * 4 - Math.sin(i / 20 * Math.PI) * 12;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.strokeStyle = OL; c.lineWidth = 7; c.stroke();
      c.strokeStyle = '#ff3b4e'; c.lineWidth = 4.5; c.stroke();
      c.restore();
    }
  }

  // ------------------------------------------------------------ weapon
  function weapon(c, L, t) {
    const col = L.wcolor || '#c89b3c';
    switch (L.weapon) {
      case 'staff':
        rr(c, -16, -2.6, 66, 5.2, 2.6); fs(c, '#d63a2a');
        rr(c, -18, -3.6, 9, 7.2, 2); fs(c, col);
        rr(c, 43, -3.6, 9, 7.2, 2); fs(c, col);
        break;
      case 'spear':
        rr(c, -10, -2, 56, 4, 2); fs(c, '#9b6a3b');
        c.beginPath(); c.moveTo(46, -5); c.lineTo(64, 0); c.lineTo(46, 5); c.closePath(); fs(c, '#e8edf2');
        c.beginPath(); c.moveTo(47, -4); c.quadraticCurveTo(58, -10 - Math.sin(t * 9) * 2, 52, 0); c.quadraticCurveTo(58, 10, 47, 4);
        c.closePath(); fs(c, col, 1.5);
        C(c, 44, 4, 3); fs(c, '#e8322a', 1.5);
        break;
      case 'firespear':
        rr(c, -8, -2, 48, 4, 2); fs(c, '#b8322a');
        c.beginPath(); c.moveTo(40, -6); c.quadraticCurveTo(52, -12 - Math.sin(t * 10) * 3, 60, 0);
        c.quadraticCurveTo(52, 12, 40, 6); c.closePath(); fs(c, '#ffb02e', 1.6);
        c.beginPath(); c.moveTo(43, -3); c.quadraticCurveTo(52, -5, 55, 0); c.quadraticCurveTo(52, 5, 43, 3);
        c.closePath(); fs(c, '#fff3a0', 0);
        break;
      case 'rake':
        rr(c, -10, -2, 50, 4, 2); fs(c, '#8b6a3b');
        rr(c, 38, -11, 6, 22, 2); fs(c, '#c7d2da');
        for (let i = 0; i < 5; i++) { rr(c, 43, -10 + i * 4.4, 8, 2.6, 1); fs(c, '#c7d2da', 1); }
        break;
      case 'club':
        rr(c, -8, -3, 42, 6, 3); fs(c, '#5a4a42');
        E(c, 40, 0, 11, 8); fs(c, '#757786');
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(40 + i * 6, -7); c.lineTo(41 + i * 6, -12); c.lineTo(43 + i * 6, -7); fs(c, '#d9d9e0', 1.2); }
        break;
      case 'khakkhara':
        rr(c, -12, -2, 54, 4, 2); fs(c, col);
        c.lineWidth = 2.4; c.strokeStyle = col; C(c, 47, 0, 7); c.stroke();
        c.lineWidth = 1.5; c.strokeStyle = OL; C(c, 47, 0, 8.4); c.stroke();
        C(c, 41, -6, 2); fs(c, '#ffe58a', 1); C(c, 41, 6, 2); fs(c, '#ffe58a', 1);
        break;
      case 'vase':
        E(c, 12, 0, 6.5, 8.5); fs(c, '#f4f8ff');
        rr(c, 9, -13, 6, 5, 2); fs(c, '#dfe8f5');
        c.strokeStyle = '#3fae5a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(12, -13);
        c.quadraticCurveTo(14, -24, 22, -28); c.stroke();
        E(c, 18, -24, 2.4, 1.2, -0.6); fs(c, '#6ad37a', 0); E(c, 21, -27, 2.4, 1.2, -0.3); fs(c, '#6ad37a', 0);
        break;
      case 'orb': {
        const g = c.createRadialGradient(12, 0, 1, 12, 0, 13);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(255,90,210,0)');
        c.fillStyle = g; C(c, 12, 0, 13 + Math.sin(t * 6)); c.fill();
        C(c, 12, 0, 5.5); fs(c, '#fff0fb', 1.2);
        break;
      }
      case 'blade':
        rr(c, -4, -2, 12, 4, 2); fs(c, '#6b4529');
        c.beginPath(); c.moveTo(8, -4); c.quadraticCurveTo(26, -8, 30, 0); c.lineTo(8, 4); c.closePath(); fs(c, '#d7dde3');
        break;
      case 'bow':
        c.lineWidth = 3; c.strokeStyle = OL; c.beginPath(); c.arc(4, 0, 16, -1.2, 1.2); c.stroke();
        c.lineWidth = 2; c.strokeStyle = '#9b6a3b'; c.beginPath(); c.arc(4, 0, 16, -1.2, 1.2); c.stroke();
        c.lineWidth = 1; c.strokeStyle = '#fff'; c.beginPath();
        c.moveTo(4 + Math.cos(-1.2) * 16, Math.sin(-1.2) * 16); c.lineTo(4 + Math.cos(1.2) * 16, Math.sin(1.2) * 16); c.stroke();
        break;
      case 'halberd':
        rr(c, -12, -2, 60, 4, 2); fs(c, '#4a3a30');
        c.beginPath(); c.moveTo(44, -3); c.quadraticCurveTo(52, -16, 62, -12); c.quadraticCurveTo(56, -4, 58, 0);
        c.lineTo(66, 0); c.lineTo(58, 4); c.lineTo(44, 3); c.closePath(); fs(c, '#d7dde3');
        C(c, 42, 5, 3.4); fs(c, '#e23b3b', 1.2);
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------ body
  function limbArm(c, L) {
    rr(c, -3.6, -2, 7.2, 12, 3.6); fs(c, L.sleeve || L.outfit, 1.8);
    C(c, 0, 11, 3.7); fs(c, L.skin, 1.6);
  }
  function legs(c, L, sw) {
    const pants = L.pants || shade(L.outfit, -0.25);
    const shoe = L.shoe || '#4a2f22';
    for (const side of [-1, 1]) {
      c.save(); c.translate(side * 5, -11); c.rotate(side * -sw * 0.35);
      if (!L.robe) { rr(c, -3.6, 0, 7.2, 10, 3); fs(c, pants, 1.8); }
      rr(c, -4.2, 7, 8.4, 4.4, 2); fs(c, shoe, 1.6);
      c.restore();
    }
  }
  function body(c, L, t) {
    if (L.robe) {
      c.beginPath(); c.moveTo(-11, -20); c.lineTo(-15, -2); c.quadraticCurveTo(0, 2 + Math.sin(t * 3), 15, -2);
      c.lineTo(11, -20); c.closePath(); fs(c, L.outfit);
      c.beginPath(); c.moveTo(-14, -5); c.quadraticCurveTo(0, -1, 14, -5); c.lineWidth = 2.5; c.strokeStyle = L.outfit2; c.stroke();
    }
    rr(c, -11, -28, 22, 19, 7); fs(c, L.outfit);
    switch (L.style) {
      case 'bald': // cà sa chéo
        c.save(); rr(c, -11, -28, 22, 19, 7); c.clip();
        c.beginPath(); c.moveTo(-12, -30); c.lineTo(-4, -30); c.lineTo(12, -12); c.lineTo(12, -6); c.closePath();
        c.fillStyle = L.outfit2; c.fill(); c.restore();
        rr(c, -11, -28, 22, 19, 7); c.lineWidth = 2; c.strokeStyle = OL; c.stroke();
        break;
      case 'kid': // yếm đỏ
        rr(c, -11, -28, 22, 19, 7); fs(c, L.skin);
        c.beginPath(); c.moveTo(-8, -24); c.lineTo(8, -24); c.lineTo(9, -12); c.quadraticCurveTo(0, -6, -9, -12); c.closePath(); fs(c, L.outfit, 1.6);
        C(c, 0, -18, 2.4); fs(c, L.outfit2, 1);
        break;
      case 'bull': case 'general': // giáp
        rr(c, -12, -28, 24, 9, 4); fs(c, L.outfit2, 1.8);
        C(c, 0, -23, 3); fs(c, shade(L.outfit2, 0.4), 1);
        break;
      default:
        c.beginPath(); c.moveTo(-5, -28); c.lineTo(0, -20); c.lineTo(5, -28); c.closePath(); fs(c, L.outfit2, 1.5);
    }
    rr(c, -11.5, -15, 23, 4.5, 2); fs(c, L.belt || L.outfit2, 1.5);
  }

  // ------------------------------------------------------------ head
  function hairCap(c, hy, R, col) {
    c.beginPath(); c.arc(0, hy, R + 1.2, Math.PI * 1.02, Math.PI * 1.98);
    c.lineTo(R - 2, hy - 2);
    c.quadraticCurveTo(R * 0.5, hy - 9, R * 0.15, hy - 5);
    c.quadraticCurveTo(-R * 0.2, hy - 10, -R * 0.55, hy - 4);
    c.quadraticCurveTo(-R * 0.8, hy - 8, -R + 1, hy - 1);
    c.closePath(); fs(c, col);
  }
  function eyes(c, L, hy, o) {
    const ex = 2.2; // lệch về phía trước
    if (L.eyes === 'closed') {
      c.lineWidth = 2; c.strokeStyle = '#2a1b16'; c.lineCap = 'round';
      for (const x of [-6 + ex, 6 + ex]) { c.beginPath(); c.arc(x, hy + 1, 3.6, 0.2, Math.PI - 0.2); c.stroke(); }
      return;
    }
    if (L.evil) {
      for (const x of [-6 + ex, 6 + ex]) {
        E(c, x, hy + 1, 3.6, 3.4); fs(c, '#ffe95a', 1.4);
        C(c, x + 0.8, hy + 1.4, 1.7); fs(c, '#1d1010', 0);
      }
      c.lineWidth = 2.4; c.strokeStyle = OL; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10 + ex, hy - 5); c.lineTo(-3 + ex, hy - 2.5);
      c.moveTo(10 + ex, hy - 5); c.lineTo(3 + ex, hy - 2.5); c.stroke();
      return;
    }
    for (const x of [-6.5 + ex, 6.5 + ex]) {
      E(c, x, hy + 1, 3.5, 4.8); fs(c, '#2a1b16', 0);
      C(c, x + 1.1, hy - 0.9, 1.5); fs(c, '#ffffff', 0);
      C(c, x - 1, hy + 3, 0.8); fs(c, '#ffffff', 0);
    }
    if (o.angry) {
      c.lineWidth = 2; c.strokeStyle = OL; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10 + ex, hy - 6.5); c.lineTo(-3.5 + ex, hy - 4.5);
      c.moveTo(10 + ex, hy - 6.5); c.lineTo(3.5 + ex, hy - 4.5); c.stroke();
    }
  }
  function mouth(c, L, hy, o) {
    const mx = 2.2;
    if (L.style === 'pig') return; // mõm heo đã vẽ
    if (o.shout) { E(c, mx, hy + 8.5, 2.6, 2.2); fs(c, '#a8323a', 1.2); return; }
    if (L.evil) {
      c.beginPath(); c.moveTo(mx - 4, hy + 8); c.lineTo(mx + 4, hy + 8); c.lineWidth = 1.8; c.strokeStyle = OL; c.stroke();
      c.beginPath(); c.moveTo(mx - 3, hy + 8); c.lineTo(mx - 2, hy + 11); c.lineTo(mx - 1, hy + 8); fs(c, '#fff', 1);
      return;
    }
    c.beginPath(); c.arc(mx, hy + 7, 2.4, 0.15, Math.PI - 0.15); c.lineWidth = 1.7; c.strokeStyle = OL; c.stroke();
  }
  function head(c, L, t, o) {
    const hy = -44, R = 17, st = L.style;
    // phía sau đầu
    if (st === 'fox') { rr(c, -18, hy - 6, 36, 36, 13); fs(c, L.hair); }
    if (st === 'veil') { rr(c, -20, hy - 15, 40, 46, 17); fs(c, '#ffffff'); }
    if (st === 'buns') {
      for (const x of [-11, 11]) { C(c, x, hy - 16, 7); fs(c, L.hair); }
      for (const x of [-11, 11]) { rr(c, x - 7, hy - 13, 14, 3, 1.5); fs(c, '#ff3b4e', 1.2); }
    }
    if (st === 'monkey') {
      C(c, 0, hy, R + 3); fs(c, L.hair);
      for (const x of [-R - 3, R + 3]) { C(c, x, hy + 2, 5); fs(c, L.skin, 1.8); C(c, x, hy + 2, 2.5); fs(c, '#f2b58e', 0); }
    }
    if (st === 'pig') {
      E(c, -15, hy - 5, 8, 12, -0.6); fs(c, L.skin); E(c, 15, hy - 5, 8, 12, 0.6); fs(c, L.skin);
      E(c, -15, hy - 4, 4, 7, -0.6); fs(c, shade(L.skin, -0.12), 0); E(c, 15, hy - 4, 4, 7, 0.6); fs(c, shade(L.skin, -0.12), 0);
    }
    if (st === 'bull' || st === 'brute') {
      const hc = st === 'bull' ? '#f3ead2' : '#e9e2cc';
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(s * 11, hy - 10); c.quadraticCurveTo(s * 30, hy - 14, s * 26, hy - 32);
        c.quadraticCurveTo(s * 22, hy - 18, s * 6, hy - 15); c.closePath(); fs(c, hc);
      }
    }
    if (st === 'goblin') {
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 14, hy - 4); c.lineTo(s * 27, hy - 9); c.lineTo(s * 15, hy + 5); c.closePath(); fs(c, L.skin); }
    }
    if (st === 'fox') {
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(s * 5, hy - 14); c.lineTo(s * 15, hy - 31); c.lineTo(s * 17, hy - 9); c.closePath(); fs(c, L.hair);
        c.beginPath(); c.moveTo(s * 8, hy - 15); c.lineTo(s * 14, hy - 26); c.lineTo(s * 15, hy - 12); c.closePath(); fs(c, '#ffc3dd', 0);
      }
    }
    // mặt
    C(c, 0, hy, R); fs(c, L.skin);
    if (st === 'monkey') { E(c, 1, hy + 4, 11.5, 9.5); fs(c, shade(L.skin, 0.3), 0); }
    // phía trước
    switch (st) {
      case 'monkey':
        c.beginPath(); c.moveTo(-8, hy - 15); c.lineTo(-4, hy - 24); c.lineTo(0, hy - 16); c.lineTo(4, hy - 25); c.lineTo(7, hy - 15); c.closePath(); fs(c, L.hair);
        rr(c, -17, hy - 12, 34, 5, 2.5); fs(c, '#f6c445', 1.6);
        C(c, 0, hy - 9.5, 2.4); fs(c, '#e23b3b', 1);
        break;
      case 'buns':
        hairCap(c, hy, R, L.hair);
        E(c, 2, hy - 8, 1.3, 2.4); fs(c, '#e8322a', 0);
        break;
      case 'bald':
        c.save(); c.translate(0, hy - 13);
        for (let i = -2; i <= 2; i++) {
          c.save(); c.rotate(i * 0.38);
          c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-4, -11, 0, -14); c.quadraticCurveTo(4, -11, 4, 0); c.closePath();
          fs(c, '#ffd34d', 1.5); C(c, 0, -7, 1.6); fs(c, '#e23b3b', 0);
          c.restore();
        }
        rr(c, -14, -2, 28, 5, 2); fs(c, '#ffd34d', 1.5);
        c.restore();
        break;
      case 'pig':
        E(c, 2, hy + 5, 7.5, 5.5); fs(c, shade(L.skin, -0.08), 1.8);
        E(c, -0.5, hy + 5, 1.4, 2); fs(c, '#a0525e', 0); E(c, 4.5, hy + 5, 1.4, 2); fs(c, '#a0525e', 0);
        c.beginPath(); c.moveTo(-3, hy - 16); c.lineTo(0, hy - 23); c.lineTo(2, hy - 16); c.lineTo(5, hy - 21); c.lineTo(6, hy - 15); c.closePath(); fs(c, L.hair);
        rr(c, -16, hy - 12, 32, 4.5, 2); fs(c, L.outfit, 1.4);
        break;
      case 'bull':
        hairCap(c, hy, R, L.hair);
        c.lineWidth = 1.8; c.strokeStyle = '#ffd34d'; C(c, 2, hy + 10, 3.2); c.stroke();
        break;
      case 'veil':
        c.beginPath(); c.arc(0, hy, R + 2.5, Math.PI * 0.92, Math.PI * 2.08); c.lineTo(R - 3, hy - 4);
        c.quadraticCurveTo(0, hy - 12, -R + 3, hy - 4); c.closePath(); fs(c, '#ffffff');
        C(c, 0, hy - 13, 2.6); fs(c, '#ffd34d', 1.2);
        C(c, 2, hy - 6, 1.2); fs(c, '#e8322a', 0);
        break;
      case 'kid':
        hairCap(c, hy, R, L.hair);
        c.beginPath(); c.moveTo(-5, hy - 15); c.quadraticCurveTo(-2, hy - 30 - Math.sin(t * 8) * 2, 6, hy - 27);
        c.quadraticCurveTo(2, hy - 22, 5, hy - 15); c.closePath(); fs(c, L.hair);
        break;
      case 'fox':
        hairCap(c, hy, R, L.hair);
        C(c, -12, hy - 11, 3); fs(c, '#ffffff', 1.2); C(c, -12, hy - 11, 1.2); fs(c, '#ffd34d', 0);
        if (L.crown) {
          c.beginPath(); c.moveTo(-9, hy - 15); c.lineTo(-9, hy - 25); c.lineTo(-4, hy - 19); c.lineTo(0, hy - 28);
          c.lineTo(4, hy - 19); c.lineTo(9, hy - 25); c.lineTo(9, hy - 15); c.closePath(); fs(c, '#ffcc33', 1.6);
          C(c, 0, hy - 18, 1.8); fs(c, '#e8322a', 0);
        }
        break;
      case 'goblin':
        c.beginPath(); c.moveTo(-4, hy - 15); c.lineTo(1, hy - 29); c.lineTo(5, hy - 15); c.closePath(); fs(c, '#f1e3c3');
        break;
      case 'brute':
        hairCap(c, hy, R, L.hair);
        break;
      case 'general':
        c.beginPath(); c.arc(0, hy - 1, R + 2.5, Math.PI, 0); c.lineTo(R + 2.5, hy - 3); c.lineTo(-R - 2.5, hy - 3); c.closePath();
        fs(c, L.outfit);
        rr(c, -R - 3, hy - 5, 2 * R + 6, 4, 2); fs(c, L.outfit2, 1.4);
        c.beginPath(); c.moveTo(-2, hy - 19); c.quadraticCurveTo(-12 - Math.sin(t * 5) * 2, hy - 34, -18, hy - 28);
        c.quadraticCurveTo(-8, hy - 26, 2, hy - 18); c.closePath(); fs(c, '#e23b3b', 1.4);
        break;
      default: break;
    }
    eyes(c, L, hy, o);
    if (!L.evil) { E(c, -9, hy + 6, 3.4, 2); fs(c, 'rgba(255,110,120,0.45)', 0); E(c, 12.5, hy + 6, 3.4, 2); fs(c, 'rgba(255,110,120,0.45)', 0); }
    mouth(c, L, hy, o);
  }

  // ------------------------------------------------------------ main draw
  // o: { t, f (1 phải / -1 trái), walk, atk (0..1 khi đang đánh, -1 nếu không), cast, hurt, scale, alpha }
  function draw(c, L, o) {
    const t = o.t || 0, s = (o.scale || 1) * (L.size || 1);
    c.save();
    c.scale((o.f || 1) * s, s);
    if (o.alpha != null) c.globalAlpha *= o.alpha;
    if (o.hurt > 0) c.filter = 'brightness(1.9) saturate(0.7)';
    const walk = !!o.walk;
    const bob = walk ? Math.abs(Math.sin(t * 11)) * 2.2 : Math.sin(t * 2.6) * 0.9;
    const sw = walk ? Math.sin(t * 11) : 0;
    back(c, L, t, bob);
    legs(c, L, sw);
    c.translate(0, -bob);
    // tay sau
    c.save(); c.translate(-10, -23); c.rotate(0.35 + sw * 0.35); limbArm(c, L); c.restore();
    body(c, L, t);
    // vũ khí + tay trước
    const casterW = L.weapon === 'vase' || L.weapon === 'orb';
    let ang;
    if (o.atk >= 0) ang = casterW ? -1.2 + o.atk * 0.8 : -2.4 + o.atk * 3.3;
    else if (o.cast) ang = -2.2;
    else ang = casterW ? -0.15 + Math.sin(t * 2.6) * 0.05 : -1.05 + Math.sin(t * 2.6) * 0.05;
    c.save(); c.translate(11, -13); c.rotate(ang); weapon(c, L, t); c.restore();
    c.save(); c.translate(10, -23); c.rotate(-0.25 + (o.atk >= 0 ? -0.5 + o.atk * 0.7 : 0)); limbArm(c, L); c.restore();
    head(c, L, t, { shout: o.atk >= 0 || o.cast, angry: o.atk >= 0 });
    c.restore();
  }

  function shadow(c, x, y, size) {
    E(c, x, y + 1, 15 * size, 5 * size); c.fillStyle = 'rgba(30,40,20,0.28)'; c.fill();
  }

  // Ảnh chân dung (đầu + thân trên) dạng dataURL, dùng cho giao diện
  function portrait(L, size) {
    const k = 2, cv = document.createElement('canvas');
    cv.width = cv.height = size * k;
    const c = cv.getContext('2d'); c.scale(k, k);
    const s = size / 64;
    c.translate(size / 2, 6 + 68 * s);
    c.scale(s, s);
    draw(c, L, { t: 0.4, f: 1, walk: false, atk: -1, scale: 1 / (L.size || 1) });
    return cv.toDataURL();
  }
  // Toàn thân
  function full(L, size) {
    const k = 2, cv = document.createElement('canvas');
    cv.width = size * k; cv.height = size * 1.25 * k;
    const c = cv.getContext('2d'); c.scale(k, k);
    const s = size / 80;
    c.translate(size / 2, size * 1.2);
    shadow(c, 0, 0, s * 1.2);
    c.scale(s, s);
    draw(c, L, { t: 0.4, f: 1, walk: false, atk: -1, scale: 1 / (L.size || 1) });
    return cv.toDataURL();
  }

  // ------------------------------------------------------------ background
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const THEMES = {
    forest: { top: '#9ad86f', bot: '#5fb24a', light: '#c8f08a', dark: '#3f8f3a', grass: '#4a9a3c',
              path: '#ecd5a0', pathEdge: '#c9a86a', stone: '#d6bf8a', tree: '#3e9a46', tree2: '#6fcf5e',
              rock: '#a7a38f', flowers: ['#ff8fb1', '#fff27a', '#ffffff', '#ffb35c'], wall: '#c9b38f', roof: '#2f7f8f' },
    pass:   { top: '#e3cf86', bot: '#a9bd60', light: '#f5e7a8', dark: '#8a9a45', grass: '#7f9a3c',
              path: '#e8cfa0', pathEdge: '#bb9a66', stone: '#cdb07a', tree: '#6f9e3e', tree2: '#a8cf5e',
              rock: '#b49a7a', flowers: ['#ffd36b', '#ffffff', '#ff9a6b'], wall: '#c2a983', roof: '#9a3b2f' },
    tomb:   { top: '#8a78bf', bot: '#4d6e72', light: '#b7a8e6', dark: '#3e4f6e', grass: '#5a6f8a',
              path: '#c9b9d9', pathEdge: '#9481ad', stone: '#b3a4c9', tree: '#5a4a8a', tree2: '#8a73c9',
              rock: '#8f8aa8', flowers: ['#c58bff', '#7fe3ff', '#ffffff'], wall: '#a99fb8', roof: '#5a2f6e' },
  };
  function wall(c, W, H, T) {
    const y0 = H - 112;
    c.fillStyle = shade(T.wall, -0.25); c.fillRect(0, y0 + 4, W, H - y0);
    c.fillStyle = T.wall; c.fillRect(0, y0, W, H - y0);
    c.strokeStyle = shade(T.wall, -0.3); c.lineWidth = 1.5;
    for (let r = 0; r < 6; r++) {
      const y = y0 + 12 + r * 18; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      for (let x = (r % 2) * 22; x < W; x += 44) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 18); c.stroke(); }
    }
    for (let x = 4; x < W; x += 40) { rr(c, x, y0 - 16, 24, 20, 3); fs(c, T.wall, 2); }
    // cổng chính
    const gx = W / 2;
    rr(c, gx - 62, y0 - 44, 124, 70, 4); fs(c, shade(T.wall, -0.1), 2);
    rr(c, gx - 34, y0 - 20, 68, 60, 30); fs(c, '#5a3020', 2);
    c.beginPath(); c.moveTo(gx, y0 - 20); c.lineTo(gx, y0 + 40); c.lineWidth = 2; c.strokeStyle = OL; c.stroke();
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { C(c, gx + s * 14, y0 - 2 + i * 13, 2.2); fs(c, '#ffd34d', 1); }
    for (const s of [-1, 1]) { rr(c, gx + s * 52 - 6, y0 - 40, 12, 66, 3); fs(c, '#d6372e', 2); }
    c.beginPath(); c.moveTo(gx - 86, y0 - 40); c.quadraticCurveTo(gx - 70, y0 - 50, gx - 60, y0 - 66);
    c.lineTo(gx + 60, y0 - 66); c.quadraticCurveTo(gx + 70, y0 - 50, gx + 86, y0 - 40); c.closePath(); fs(c, T.roof, 2.5);
    rr(c, gx - 66, y0 - 72, 132, 8, 4); fs(c, shade(T.roof, -0.25), 2);
    rr(c, gx - 28, y0 - 60, 56, 18, 3); fs(c, '#ffd34d', 2);
    c.fillStyle = '#7a2a1a'; c.font = 'bold 12px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('TÂY KỲ', gx, y0 - 50);
  }
  // Tường thành DỌC bên trái (màn ngang): quái từ phải sang, đánh vào cổng ở giữa tường
  function wallV(c, W, H, T) {
    const x1 = 86;
    c.fillStyle = shade(T.wall, -0.25); c.fillRect(0, 0, x1 + 4, H);
    c.fillStyle = T.wall; c.fillRect(0, 0, x1, H);
    c.strokeStyle = shade(T.wall, -0.3); c.lineWidth = 1.5;
    for (let col = 0; col < 5; col++) {
      const x = 6 + col * 17; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
      for (let y = (col % 2) * 22; y < H; y += 44) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 17, y); c.stroke(); }
    }
    for (let y = 4; y < H; y += 40) { rr(c, x1 - 4, y, 20, 24, 3); fs(c, T.wall, 2); } // răng cưa mặt thành
    // cổng chính giữa tường
    const gy = H * 0.56;
    rr(c, 8, gy - 70, 84, 140, 4); fs(c, shade(T.wall, -0.1), 2);
    rr(c, 30, gy - 40, 60, 80, 26); fs(c, '#5a3020', 2);
    c.beginPath(); c.moveTo(30, gy); c.lineTo(90, gy); c.lineWidth = 2; c.strokeStyle = OL; c.stroke();
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { C(c, 48 + i * 13, gy + s * 14, 2.2); fs(c, '#ffd34d', 1); }
    for (const s of [-1, 1]) { rr(c, 14, gy + s * 54 - 6, 76, 12, 3); fs(c, '#d6372e', 2); }
    rr(c, 4, gy - 30, 22, 60, 3); fs(c, '#ffd34d', 2);
    c.save(); c.translate(15, gy); c.rotate(-Math.PI / 2);
    c.fillStyle = '#7a2a1a'; c.font = 'bold 12px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('TÂY KỲ', 0, 1); c.restore();
  }
  // Nền ải màn ngang: đường đất chạy ngang từ phải sang cổng thành bên trái
  function backgroundH(W, H, themeName, seed) {
    const T = THEMES[themeName] || THEMES.forest, R = rng(seed || 1);
    const k = 2, cv = document.createElement('canvas');
    cv.width = W * k; cv.height = H * k;
    const c = cv.getContext('2d'); c.scale(k, k);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, T.top); g.addColorStop(1, T.bot);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      c.globalAlpha = 0.16; E(c, R() * W, R() * H, 40 + R() * 100, 14 + R() * 30);
      c.fillStyle = R() < 0.5 ? T.light : T.dark; c.fill();
    }
    c.globalAlpha = 1;
    const py = x => H * 0.56 + Math.sin(x / 170) * 26;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const line = (w, col) => { c.beginPath(); for (let x = 60; x <= W + 30; x += 20) { if (x === 60) c.moveTo(x, py(x)); else c.lineTo(x, py(x)); } c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    line(300, T.pathEdge); line(276, T.path);
    for (let x = 100; x < W; x += 34) for (let j = 0; j < 4; j++) { E(c, x + (R() - 0.5) * 24, py(x) + (R() - 0.5) * 220, 6 + R() * 8, 4 + R() * 4); fs(c, T.stone, 0); }
    c.restore();
    const off = (x, y) => Math.abs(y - py(x)) < 150;
    for (let i = 0; i < 520; i++) {
      const x = 90 + R() * (W - 90), y = R() * H; if (off(x, y)) continue;
      c.strokeStyle = R() < 0.5 ? T.dark : T.grass; c.lineWidth = 1.6; c.beginPath();
      c.moveTo(x - 3, y); c.lineTo(x - 4, y - 6); c.moveTo(x, y); c.lineTo(x, y - 8); c.moveTo(x + 3, y); c.lineTo(x + 4, y - 6); c.stroke();
    }
    for (let i = 0; i < 170; i++) {
      const x = 90 + R() * (W - 90), y = R() * H; if (off(x, y)) continue;
      c.fillStyle = T.flowers[Math.floor(R() * T.flowers.length)];
      for (let a = 0; a < 5; a++) { C(c, x + Math.cos(a * TAU / 5) * 2.6, y + Math.sin(a * TAU / 5) * 2.6, 2); c.fill(); }
      C(c, x, y, 1.4); c.fillStyle = '#ffd34d'; c.fill();
    }
    for (let i = 0; i < 12; i++) {
      const x = 140 + R() * (W - 180), y = R() < 0.5 ? 70 + R() * 40 : H - 30 - R() * 30;
      E(c, x, y, 14 + R() * 10, 9 + R() * 6); fs(c, T.rock, 2);
      E(c, x - 4, y - 3, 6, 3); fs(c, shade(T.rock, 0.3), 0);
    }
    const tree = (x, y, s) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      E(c, 0, 4, 26, 8); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill();
      rr(c, -5, -22, 10, 26, 3); fs(c, '#8a5a36');
      for (const [a, b, r] of [[-14, -30, 18], [14, -30, 18], [0, -46, 22], [0, -28, 20]]) { C(c, a, b, r); fs(c, T.tree, 2); }
      for (const [a, b, r] of [[-8, -48, 9], [10, -36, 7], [-16, -30, 6]]) { C(c, a, b, r); fs(c, T.tree2, 0); }
      c.restore();
    };
    for (let x = 130; x < W; x += 80 + R() * 50) tree(x, 46 + R() * 14, 0.8 + R() * 0.3);   // hàng cây mép trên
    for (let x = 150; x < W; x += 110 + R() * 70) tree(x, H + 6 - R() * 8, 0.9 + R() * 0.3); // mép dưới (khuất một nửa)
    wallV(c, W, H, T);
    return cv;
  }
  function background(W, H, themeName, seed) {
    const T = THEMES[themeName] || THEMES.forest, R = rng(seed || 1);
    const k = 2, cv = document.createElement('canvas');
    cv.width = W * k; cv.height = H * k;
    const c = cv.getContext('2d'); c.scale(k, k);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, T.top); g.addColorStop(1, T.bot);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      c.globalAlpha = 0.16; E(c, R() * W, R() * H, 30 + R() * 90, 14 + R() * 30);
      c.fillStyle = R() < 0.5 ? T.light : T.dark; c.fill();
    }
    c.globalAlpha = 1;
    const px = y => W / 2 + Math.sin(y / 140) * 60;
    // con đường
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const line = (w, col) => { c.beginPath(); for (let y = -20; y <= H - 90; y += 20) { if (y === -20) c.moveTo(px(y), y); else c.lineTo(px(y), y); } c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    line(150, T.pathEdge); line(132, T.path);
    for (let y = 0; y < H - 120; y += 34) {
      for (let j = 0; j < 3; j++) { E(c, px(y) + (R() - 0.5) * 100, y + (R() - 0.5) * 24, 6 + R() * 8, 4 + R() * 4); fs(c, T.stone, 0); }
    }
    c.restore();
    // cỏ & hoa
    for (let i = 0; i < 460; i++) {
      const x = R() * W, y = R() * (H - 120);
      if (Math.abs(x - px(y)) < 72) continue;
      c.strokeStyle = R() < 0.5 ? T.dark : T.grass; c.lineWidth = 1.6; c.beginPath();
      c.moveTo(x - 3, y); c.lineTo(x - 4, y - 6); c.moveTo(x, y); c.lineTo(x, y - 8); c.moveTo(x + 3, y); c.lineTo(x + 4, y - 6); c.stroke();
    }
    for (let i = 0; i < 150; i++) {
      const x = R() * W, y = R() * (H - 120);
      if (Math.abs(x - px(y)) < 72) continue;
      const col = T.flowers[Math.floor(R() * T.flowers.length)];
      c.fillStyle = col;
      for (let a = 0; a < 5; a++) { C(c, x + Math.cos(a * TAU / 5) * 2.6, y + Math.sin(a * TAU / 5) * 2.6, 2); c.fill(); }
      C(c, x, y, 1.4); c.fillStyle = '#ffd34d'; c.fill();
    }
    // đá
    for (let i = 0; i < 10; i++) {
      const x = R() < 0.5 ? 60 + R() * 70 : W - 60 - R() * 70, y = 90 + R() * (H - 330);
      E(c, x, y, 14 + R() * 10, 9 + R() * 6); fs(c, T.rock, 2);
      E(c, x - 4, y - 3, 6, 3); fs(c, shade(T.rock, 0.3), 0);
    }
    // cây hai bên
    const tree = (x, y, s) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      E(c, 0, 4, 26, 8); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill();
      rr(c, -5, -22, 10, 26, 3); fs(c, '#8a5a36');
      for (const [a, b, r] of [[-14, -30, 18], [14, -30, 18], [0, -46, 22], [0, -28, 20]]) { C(c, a, b, r); fs(c, T.tree, 2); }
      for (const [a, b, r] of [[-8, -48, 9], [10, -36, 7], [-16, -30, 6]]) { C(c, a, b, r); fs(c, T.tree2, 0); }
      c.restore();
    };
    for (let y = 70; y < H - 170; y += 70 + R() * 40) {
      tree(14 + R() * 24, y, 0.8 + R() * 0.4);
      tree(W - 14 - R() * 24, y + R() * 30, 0.8 + R() * 0.4);
    }
    wall(c, W, H, T);
    return cv;
  }

  return { draw, shadow, portrait, full, background, backgroundH, shade, rr, C, E, fs };
})();
