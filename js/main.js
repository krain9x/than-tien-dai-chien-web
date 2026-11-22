(() => {
'use strict';
// =====================================================================
// Thần Tiên Đại Chiến — bản prototype giai đoạn 1 (GDD mục 12.1)
// =====================================================================
const W = 960, H = 540, TAU = Math.PI * 2;   // màn NGANG (kiểu Võ Lâm Đại Minh Tinh)
const GATE_X = 112;
const EGROW = 0.22;   // quái mạnh thêm mỗi cấp ải (cân bằng bằng #balance)
const VIEW_Z = 0.9, VIEW_PY = 0.6, VIEW_R = () => GATE_X + (W - GATE_X) / VIEW_Z;   // mép phải khung nhìn (toạ độ thế giới)   // khung trận thu nhỏ 10% (neo ở cổng thành, giữa làn)          // quái tới cột này thì đánh cổng thành (tường thành dọc bên trái)
const LANE_Y0 = 150, LANE_Y1 = 440;   // dải đường quái đi (toạ độ chân)
// 5 ô đứng cố định: 3 ô hàng sau (đánh xa / hồi máu) sát tường, 2 ô hàng trước (cận chiến / đỡ đòn)
const SLOTS_BACK = [[160, 310], [176, 192], [176, 428]];
const SLOTS_FRONT = [[300, 262], [300, 390]];

const $ = s => document.querySelector(s);
const ui = $('#ui'), cv = $('#game'), ctx = cv.getContext('2d');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = n => Math.round(n).toLocaleString('vi-VN');
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ------------------------------------------------------------------ SAVE
const SAVE_KEY = 'ttdc_save_v1';
const newRec = () => ({ lv: 1, star: 1, shard: 0 });
function defaultSave() {
  const owned = {};
  ['culinhthan', 'hoangphongquai', 'longnu'].forEach(id => { owned[id] = newRec(); });   // tân thủ: 3 tướng R (Hộ Pháp, Chiến Tướng, Linh Y); SR/SSR mở dần qua chương
  return { ngoc: 1500, vang: 3000, univ: 0, owned,
           lineup: ['culinhthan', 'hoangphongquai', 'longnu'],
           cleared: {}, pity: 0, pity10: 0, pulls: 0 };
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.owned) return Object.assign(defaultSave(), s); }
  } catch (e) { /* bỏ qua */ }
  return defaultSave();
}
function save() { S.ts = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* bỏ qua */ } if (window.Cloud && Cloud.user) Cloud.push(S); }
let S = loadSave();
// Tặng 10 tướng mới vào kho hiện có (một lần cho mỗi bản save) để thử ngay, không cần quay gacha
// (đã bỏ) tặng sẵn 10 tướng mới — tân thủ đi từ thấp lên cao

// ------------------------------------------------------------------ RESIZE
let scale = 1, dpr = 1;
function resize() {
  const vv = window.visualViewport, vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  scale = Math.min(vw / W, vh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const app = $('#app');
  app.style.width = W * scale + 'px'; app.style.height = H * scale + 'px';
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
  ui.style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
// Mở trong trình duyệt (chưa phải app): trang chủ gợi ý thêm vào màn hình chính để chơi full màn hình
const IS_APP = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
// Chạm 1 lần để thử vào toàn màn hình (Android/máy tính; iPhone không hỗ trợ)
document.addEventListener('pointerup', () => { if (!IS_APP && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); }, { once: true });

// ------------------------------------------------------------------ IMAGES
// Ảnh vẽ tay (Codex) ở art/sprites + art/portraits; thiếu ảnh thì dùng hình vẽ bằng code.
const SPR = {};
// Tư thế chính vẽ tay (Codex) theo nhịp đòn: POSES[id][tên] = ảnh. Toạ độ ảnh = toạ độ hình gốc (đặt chân tại `ground`).
const POSES = {};
const EPOSES = {};   // quái vẽ bằng tư thế: walk1, walk2, attack, hit (+ master)
const _enemyLoaded = {};
function ensureEnemyAssets(ids) {
  try { ucImg('cloud'); for (const id of ids) if (ENEMIES[id] && ENEMIES[id].boss) { formImg(id); scImg('ngumavuong_fx'); } } catch (e) {}   // tải sẵn hình biến hình boss
  return Promise.all([...new Set(ids)].filter(id => (window.EPOSE || {})[id]).map(id => {
    if (_enemyLoaded[id]) return _enemyLoaded[id];
    EPOSES[id] = {};
    return (_enemyLoaded[id] = Promise.all(['master', 'walk1', 'walk2', 'attack', 'hit'].map(n => new Promise(res => { const im = new Image(); im.onload = () => { EPOSES[id][n] = im; res(); }; im.onerror = res; im.src = 'art/enemies/' + id + '/' + n + '.webp'; }))));
  }));
}
function chapElem(c) {   // hệ ngũ hành chiếm đa số trong quái của chương
  const cnt = {}; for (const st of STAGES) if (st.chap === c) for (const w of st.waves) for (const [t, n] of w.list) { const e = (ENEMIES[t] || {}).el; if (e) cnt[e] = (cnt[e] || 0) + n; }
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || null;
}
function stageEnemyIds(st) {
  const s = new Set();
  for (const w of st.waves) for (const [t] of w.list) { s.add(t); for (const p of ((ENEMIES[t] || {}).phases || [])) if (p.summon) s.add(p.summon[0]); }
  return [...s];
}
const FORMI = {}; function formImg(id) { let i = FORMI[id]; if (!i) { i = FORMI[id] = new Image(); i.src = 'art/enemies/' + id + '/form.webp'; } return i.complete && i.naturalWidth ? i : null; }
function drawEnemyPose(u, alpha) {
  if (u.form) { const im = formImg(u.id); if (im) {   // boss đã biến hình: hình mới to hơn, thở + rung khi đánh
    const h = spriteH(u) * 1.35, w = h * im.width / im.height, bob = Math.sin(u.t * 2.4) * 2, lunge = u.atkAnim >= 0 ? Math.sin(Math.min(1, u.atkAnim) * Math.PI) * 14 : 0;
    ctx.save(); ctx.scale(-u.f, 1); ctx.globalAlpha *= alpha; if (u.hitT > 0) ctx.filter = 'brightness(1.8)';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35 + 0.15 * Math.sin(u.t * 4); const g = ctx.createRadialGradient(0, -h * 0.45, 4, 0, -h * 0.45, h * 0.6); g.addColorStop(0, 'rgba(255,60,60,0.6)'); g.addColorStop(1, 'rgba(120,0,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -h * 0.45, h * 0.55, h * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.drawImage(im, -w / 2 - lunge, -h + bob, w, h); ctx.restore(); return true; } }
  const P = EPOSES[u.id], D = (window.EPOSE || {})[u.id]; if (!P || !D) return false;
  // dáng + biến dạng mượt: đi 4 nhịp (bước-trung gian-bước-trung gian) theo tốc độ, ra đòn lấy đà rồi lao, trúng đòn giật lùi
  const sp = Math.max(0.6, (u.move || 70) / 70), ph = (u.t * 2.2 * sp) % 1;   // chu kỳ bước
  let n = 'master', sx = 1, sy = 1, ox = 0, oy = 0, rot = 0;
  if (u.dead || u.hitT > 0) { n = 'hit'; const q = u.dead ? 1 : Math.max(0, u.hitT / 0.35); ox = -10 * q; rot = -0.08 * q; sy = 1 - 0.04 * q; }
  else if (u.atkAnim >= 0 || u.castT > 0) {
    const q = u.atkAnim >= 0 ? Math.min(1, u.atkAnim) : 0.5;
    if (q < 0.35) { n = 'master'; const e = q / 0.35; ox = -6 * e; rot = -0.06 * e; sx = 1 + 0.03 * e; sy = 1 - 0.04 * e; }   // lấy đà
    else { n = 'attack'; const e = (q - 0.35) / 0.65, k2 = Math.sin(Math.min(1, e * 1.6) * Math.PI / 2); ox = 14 * k2 * (1 - e * 0.6); rot = 0.07 * (1 - e); sx = 1.05 - 0.05 * e; sy = 0.97 + 0.03 * e; }
  } else if (u.flyH) { rot = 0.08 + Math.sin(u.t * 3) * 0.02; sy = 1 + Math.sin(u.t * 3) * 0.012;   // cưỡi mây: đứng yên trên mây, nghiêng về trước
  } else if (u.walk) {
    n = ph < 0.25 ? 'walk1' : ph < 0.5 ? 'master' : ph < 0.75 ? 'walk2' : 'master';
    oy = -Math.abs(Math.sin(ph * Math.PI * 2)) * 3.5; rot = 0.04 + Math.sin(ph * Math.PI * 2) * 0.025; sy = 1 + Math.sin(ph * Math.PI * 4) * 0.02; sx = 2 - sy;
  } else { sy = 1 + Math.sin(u.t * 2.4) * 0.015; sx = 1 - Math.sin(u.t * 2.4) * 0.008; }
  const img = P[n] || P.master; if (!img) return false;
  if (u.epN !== n) { u.epPrev = u.epN; u.epAt = u.t; u.epN = n; }
  const h = spriteH(u), k = h / D.h, fade = u.epPrev ? Math.max(0, 1 - (u.t - u.epAt) / 0.06) : 0;
  ctx.save(); ctx.scale(u.f, 1); ctx.globalAlpha *= alpha;
  const FORM = u.d.forms && u.d.forms[(u.phase || 1) - 1];   // boss biến hình: mỗi giai đoạn một dáng (màu/cỡ)
  if (FORM) { ctx.filter = FORM.f; ctx.scale(FORM.s, FORM.s); }
  if (u.hurt > 0) ctx.filter = 'brightness(2) saturate(0.6)';
  ctx.translate(ox, oy); ctx.rotate(rot); ctx.scale(sx, sy);
  if (fade > 0 && P[u.epPrev]) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * fade; const pi = P[u.epPrev]; ctx.drawImage(pi, -D.gx * k, -D.gy * k, pi.width * k, pi.height * k); ctx.globalAlpha = a0; }
  ctx.drawImage(img, -D.gx * k, -D.gy * k, img.width * k, img.height * k);
  ctx.filter = 'none'; ctx.restore(); return true;
}
const POSE_NAMES = ['windup', 'strike', 'skill', 'ult', 'idle1', 'idle2', 'hit'];
const POSE_IDS = ['ngokhong','batgioi','nata','ngumavuong','honghainhi','quanam','datky','duongtang','duongtien','khuongtanha','vantieu','trieucongminh','thailaoquan','satang','thietphien','litinh','hangnga','bachcot','loichantu','thohanhton','thaiatchannhan','thancongbao','longnu','kimgiac','tieubachlong','thaibachkimtinh','culinhthan','hoangphongquai'];   // tướng đã có tư thế chính (thêm id khi đã vẽ xong game/art/poses/<id>/)
const _heroLoaded = {};   // id → Promise: rig xương + tư thế của tướng, chỉ nạp khi tướng ra trận (tiết kiệm ~30 MB lúc khởi động)
function ensureHeroAssets(ids) {
  return Promise.all([...new Set(ids)].map(id => {
    if (_heroLoaded[id]) return _heroLoaded[id];
    try { if (sceneUnlocked(id) || SRX[id]) ['_bg', '_hero', '_fx'].forEach(s => scImg(id + s)); ({ datky: ['fx_ninetails'], quanam: ['fx_halo'], tieubachlong: ['fx_waterpillar'] }[id] || []).forEach(scImg); ({ duongtien: ['sky_eye'], loichantu: ['loi_dive'], thaiatchannhan: ['firedragon_head'], nata: ['firewheel'] }[id] || []).forEach(ucImg); (ULTC[id] && ULTC[id].need || []).forEach(ucImg); for (const k in CX) if (k.split('+').includes(id)) (CX[k].need || []).forEach(ucImg); } catch (e) {}
    const jobs = [];
    if (typeof Skel !== 'undefined' && (window.SKEL_IDS || []).includes(id)) jobs.push(new Promise(res => {
      const sc = document.createElement('script'); sc.src = 'art/skel/' + id + '.js';
      sc.onload = () => Skel.load(id).then(res, res); sc.onerror = () => res(); document.head.appendChild(sc);
    }));
    if (POSE_IDS.includes(id)) { POSES[id] = POSES[id] || {}; for (const n of POSE_NAMES) jobs.push(new Promise(res => { const im = new Image(); im.onload = () => { POSES[id][n] = im; res(); }; im.onerror = () => res(); im.src = 'art/poses/' + id + '/' + n + '.webp'; })); }
    return (_heroLoaded[id] = Promise.all(jobs));
  }));
}
// Hướng nhìn gốc của ảnh: 1 = nhìn sang phải, -1 = nhìn sang trái
const FACE = { tieuyeu: -1, tieuyeu_chibi: -1 };   // ảnh gốc của Tiểu Yêu quay ngược hướng đi
// Hoạt ảnh nướng sẵn (tools/rig_bake.py): sprite sheet + manifest
const ANIM = {};
// nền ải vẽ bằng Codex (art/bg/<theme>.webp); thiếu thì dùng nền vẽ bằng code
const HOMEBG = new Image(); HOMEBG.src = 'art/ui/home_bg.webp';
const BGIMG = {};
for (const t of ['forest', 'pass', 'tomb', 'fire', 'river', 'cave', 'sea', 'snow', 'heaven']) { const i = new Image(); i.src = 'art/bg/' + t + '.webp'; BGIMG[t] = i; }
function loadArt() {
  const ids = [...Object.keys(HEROES), ...Object.keys(ENEMIES)];
  const man = window.ANIM_MANIFEST || {};
  const jobs = ids.map(id => new Promise(res => {
    const img = new Image();
    img.onload = () => { SPR[id] = img; res(); };
    img.onerror = () => res();
    img.src = 'art/sprites/' + id + '.webp';
  }));
  for (const t in BGIMG) jobs.push(new Promise(res => { const i = BGIMG[t]; if (i.complete) res(); else { i.onload = res; i.onerror = res; } }));
  if (typeof Rig !== 'undefined') for (const id of Object.keys(window.RIG_DEFS || {})) jobs.push(Rig.load(id));
  if (typeof Layered !== 'undefined') for (const id of Object.keys(window.LAYER_DEFS || {})) jobs.push(Layered.load(id));
  // lưới WebGL thời gian thực: nạp file dữ liệu từng nhân vật (art/mesh/<id>.js) rồi tạo texture
  if (typeof MeshRig !== 'undefined') for (const id of (window.MESH_IDS || []).filter(x => !HEROES[x.replace('_chibi', '')])) jobs.push(new Promise(res => {
    const sc = document.createElement('script');
    sc.src = 'art/mesh/' + id + '.js';
    sc.onload = () => MeshRig.load(id).then(res, res);
    sc.onerror = () => res();
    document.head.appendChild(sc);
  }));
  for (const id of Object.keys(man)) {
    jobs.push(new Promise(res => {
      const img = new Image();
      img.onload = () => { ANIM[id] = { img, m: man[id] }; res(); };
      img.onerror = () => res();
      img.src = 'art/anim/' + id + '.webp';
    }));
  }
  return Promise.all(jobs);
}
// Chọn khung hình theo trạng thái nhân vật
function animFrame(a, u) {
  const A = a.m.anims;
  let name = 'idle', k;
  if (!u.dead && u.atkAnim >= 0) { name = 'attack'; k = Math.min(A.attack.n - 1, Math.floor(u.atkAnim * A.attack.n)); }
  else if (!u.dead && u.castT > 0) { name = 'cast'; k = Math.min(A.cast.n - 1, Math.floor((1 - u.castT / 0.35) * A.cast.n)); }
  else if (!u.dead && u.walk) { name = 'walk'; k = Math.floor(u.t * A.walk.fps) % A.walk.n; }
  else { k = u.dead ? 0 : Math.floor(u.t * A.idle.fps) % A.idle.n; }
  return A[name].start + k;
}
function drawAnimFrame(a, i, h) {
  const m = a.m, k = h / m.ch;
  const sx = (i % m.cols) * m.fw, sy = Math.floor(i / m.cols) * m.fh;
  ctx.drawImage(a.img, sx, sy, m.fw, m.fh, -m.ax * k, -m.ay * k, m.fw * k, m.fh * k);
}
const PC = {};
function por(id, size) {
  if (SPR[id]) return 'art/portraits/' + id + '.webp';
  size = size || 96; const k = 'p' + id + size;
  if (!PC[k]) PC[k] = Art.portrait((HEROES[id] || ENEMIES[id]).look, size);
  return PC[k];
}
// chân dung trong trận: bản chibi (khớp nhân vật chibi trên sân), thiếu thì dùng bản thường
const CHIBI_POR = new Set(['batgioi','cungyeu','datky','dauda','duongtang','honghainhi','hoyeu','nata','ngokhong','ngumavuong','quanam','tieuyeu','tinhanh']);
function porB(id, size) { return (window.__chibi && CHIBI_POR.has(id)) ? 'art/portraits_chibi/' + id + '.webp' : por(id, size); }
function fullImg(id, size) {
  if (SPR[id]) return 'art/sprites/' + id + '.webp';
  size = size || 160; const k = 'f' + id + size;
  if (!PC[k]) PC[k] = Art.full((HEROES[id] || ENEMIES[id]).look, size);
  return PC[k];
}

// ------------------------------------------------------------------ HERO STATS (menu)
function heroStats(id) {
  const h = HEROES[id], o = S.owned[id] || newRec();
  const m = (1 + 0.06 * (o.lv - 1)) * starMul(h.rar, o.star), bt = btBonus(h.role);
  return { hp: h.hp * m * bt.hp, atk: h.atk * m * bt.atk, def: h.def * m * bt.def, aspd: h.aspd };
}
function power(id) { const s = heroStats(id); return Math.round(s.hp * 0.25 + s.atk * 4 + s.def * 2); }
function bondLv(b) {   // cấp duyên phận 0–10: mỗi sao trên 1 sao và mỗi 10 cấp của thành viên +1 (VLĐMT herofetterconfig)
  let n = 0; for (const id of b.members) { const o = S.owned[id]; if (!o) return 0; n += (o.star - 1) + Math.floor(o.lv / 10); }
  return Math.min(10, n);
}
function teamInfo(ids) {
  const cnt = {};
  ids.forEach(id => { const f = HEROES[id].fac; cnt[f] = (cnt[f] || 0) + 1; });
  const facs = Object.keys(cnt).map(f => {
    const tier = FACTION_TIERS.find(t => cnt[f] >= t[0]);
    return { f, n: cnt[f], pct: tier ? tier[1] : 0 };
  }).sort((a, b) => b.n - a.n);
  const bonds = BONDS.filter(b => b.members.every(m => ids.includes(m)));
  return { facs, bonds };
}

// =====================================================================
// BATTLE
// =====================================================================
let B = null;
const M = k => (B && B.mods[k]) || 0;
const RM = (u, k) => (u && u.side === 'h' && B && B.mods[u.role + '.' + k]) || 0;   // công pháp theo hệ của tướng
const trongOf = u => (u.side === 'h' && u.trong) || 1;
const TG = (u, k) => (u && u.tg && u.tg[k]) || 0;   // nâng cấp theo tầng riêng của tướng (HEROES[id].tang)
function rebuildTang(u) {
  u.tg = {};
  const list = u.d.tang || [];
  for (let i = 0; i < trongOf(u) - 1 && i < list.length; i++) for (const k in list[i].m) u.tg[k] = (u.tg[k] || 0) + list[i].m[k];
}
function sysTang(sys) { let n = 0; if (B) for (const h of B.heroes) if (!h.dead && !h.clone && h.role === sys) n += trongOf(h) - 1; return n; }
const coreBonus = u => RM(u, 'core') ? 0.20 * Math.min(5, sysTang(u.role)) : 0;   // Bản Mệnh: +20%/lần bồi dưỡng, tối đa 5
const AMMO = 8;
const ammoMax = u => AMMO + M('ammo');

function makeHero(id, isCap) {
  const h = HEROES[id], o = S.owned[id] || newRec();
  const m = (1 + 0.06 * (o.lv - 1)) * starMul(h.rar, o.star);
  return {
    side: 'h', id, d: h, look: h.look, name: h.name, el: h.el, role: h.role, fac: h.fac, level: 4 + o.lv,
    base: { hp: h.hp * m * btBonus(h.role).hp, atk: h.atk * m * btBonus(h.role).atk, def: h.def * m * btBonus(h.role).def },
    bonus: { hpPct: 0, atkPct: 0, crit: 0, dmgTaken: 0 },
    aspd: h.aspd, range: 680, move: h.move, ranged: true, front: !h.ranged, proj: (ATK_STYLE[id] && ATK_STYLE[id].proj) || h.proj || MELEE_PROJ[id] || 'palm',
    x: 200, y: H / 2, hp: 1, mp: 40, cdA: 0, cdS: 1, cdU: 3, dk: 0,
    shield: 0, shieldT: 0, buffs: [], stun: 0, slow: 0, burn: 0, burnDps: 0, inv: 0,
    isCap: !!isCap, ammo: AMMO, trong: 1, dead: false, f: 1, t: Math.random() * 5, atkAnim: -1, castT: 0, hurt: 0, walk: false,
  };
}
function takeSlot(u) {
  const used = new Set(B.heroes.filter(h => !h.dead && !h.clone && h.slot).map(h => h.slot));
  const front = !!u.front, prefer = front ? SLOTS_FRONT : SLOTS_BACK, other = front ? SLOTS_BACK : SLOTS_FRONT;
  const s = prefer.find(q => !used.has(q)) || other.find(q => !used.has(q)) || prefer[0];
  u.slot = s; u.x = s[0]; u.y = s[1]; u.f = 1;
}
// chưởng xa của tướng cận chiến: sóng gậy, tảng đá, sóng đinh ba
// độ lao tới (px) khi ra đòn theo kiểu đánh
const LUNGE = { boomerang: 14, pierce: 18, bounce: 8, split: 8, spin: 6, lob: 10, fan: 6 };
const MELEE_PROJ = { ngokhong: 'staffwave', ngumavuong: 'boulder', batgioi: 'rakewave' };
const PIERCE_PROJ = { staffwave: 1, rakewave: 1 };
function makeEnemy(type, lvl, x, y) {
  const d = ENEMIES[type], m = 1 + (window.__eg != null ? window.__eg : EGROW) * (lvl - 1), spd = B && B.mech === 'speed' ? 1.35 : 1;   // chương Đại náo Thiên Cung: quái nhanh hơn
  const e = {
    side: 'e', id: type, d, look: d.look, name: d.name, el: d.el, level: lvl,
    base: { hp: d.hp * m * ((B && B.st.ehp) || 1) * (d.boss && B && B.st.raid ? 60 : 1), atk: d.atk * m * ((B && B.st.eatk) || 1), def: d.def * (1 + 0.1 * (lvl - 1)) },
    bonus: { hpPct: 0, atkPct: 0, crit: 0, dmgTaken: 0 },
    aspd: d.aspd, range: d.range, move: d.move * spd * ((B && B.st.espd) || 1), ranged: !!d.ranged, proj: d.proj,
    x, y, hp: d.hp * m, cdA: rand(0.3, 1.2), buffs: [], stun: 0, slow: 0, burn: 0, burnDps: 0,
    shield: 0, shieldT: 0, inv: 0, trait: d.trait || null,
    dead: false, f: 1, t: Math.random() * 5, atkAnim: -1, castT: 0, hurt: 0, walk: false,
    elite: !!d.elite, boss: !!d.boss, forced: null, forcedT: 0, special: 4, phase: 1,
  };
  return e;
}
const sizeOf = u => u.look.size || 1;
// ảnh vẽ tay rộng hơn hình chibi nên cần bán kính va chạm lớn hơn để không chồng lên nhau
const unitR = u => (u.boss && SPR[u.id] ? 42 : (SPR[u.id] ? 21 : 14) * sizeOf(u));
function buffSum(u, k) { let s = 0; for (const b of u.buffs) if (b.k === k) s += b.v; return s; }
function maxHp(u) { return u.base.hp * (1 + u.bonus.hpPct + (u.side === 'h' ? M('hpPct') + RM(u, 'hpPct') + TG(u, 'hp') : 0)); }
function getAtk(u) {
  let p = u.bonus.atkPct + buffSum(u, 'atk');
  if (u.side === 'h') {
    p += M('atkPct') + RM(u, 'atkPct') + coreBonus(u) + (u.isCap ? M('capAtk') : 0);
    if (M('ad1') && B.amMode === 'am') p += 0.20 + M('ad1Evo');   // Lưỡng Nghi: trạng thái Âm
    if (u.dhT > 0) p += 0.40;                                        // Lưỡng Nghi Giao Hoà
    if (M('tuthan') && trongOf(u) >= 5) p += M('tuthan');                                     // Đắc Đạo
    const pa = u.d.passive;
    if (pa && pa.lowHpAtk && u.hp < maxHp(u) * 0.5) p += pa.lowHpAtk;
  }
  return u.base.atk * (1 + p) * (u.clone ? 0.5 : 1);
}
function getDef(u) { return u.base.def * (1 + (u.side === 'h' ? M('defPct') : 0) + buffSum(u, 'def')) * (1 - (u.defDown || 0)); }
function getAspd(u) { return u.aspd * (1 + (u.side === 'h' ? M('aspdPct') + RM(u, 'aspdPct') + (u.isCap ? 0.20 : 0) + (M('tpAspd') ? (u.tp || 0) * M('tpAspd') : 0) - (M('vn') ? (u.vn || 0) * M('vnSlow') * 1 : 0) : 0) + buffSum(u, 'aspd')); }
function getCrit(u) { return 0.05 + u.bonus.crit + (u.side === 'h' ? M('crit') + RM(u, 'crit') : 0); }
function getCritDmg(u) { return 0.5 + (u.side === 'h' ? M('critDmg') + RM(u, 'critDmg') : 0); }
function moveSpeed(u) { return u.move * (1 + (u.side === 'h' ? M('movePct') : 0)) * (u.slow > 0 ? 0.6 : 1); }
function teamAura(k) {
  if (!B) return 0;
  let s = 0;
  for (const h of B.heroes) if (!h.dead && !h.clone && h.d.passive && h.d.passive[k]) s += h.d.passive[k];
  return s;
}

function applyBonuses(u, info) {
  for (const f of info.facs) if (f.f === u.fac && f.pct) { u.bonus.hpPct += f.pct; u.bonus.atkPct += f.pct; }
  for (const b of info.bonds) {
    if (b.id === 'ketnghia' && b.members.includes(u.id)) u.bonus.atkPct += 0.10;
    if (b.g && b.members.includes(u.id)) for (const k in b.g) u.bonus[k] = (u.bonus[k] || 0) + b.g[k];
    if (b.members.includes(u.id)) { const bl = BOND_LV[bondLv(b)] || 0; u.bonus.atkPct += bl; u.bonus.hpPct += bl; }
    if (b.id === 'phutu') {
      if (u.id === 'ngumavuong') u.bonus.hpPct += 0.20;
      if (u.id === 'honghainhi') u.bonus.dmgTaken += 0.15;
    }
  }
  const eq = eqBonus(u.id); u.bonus.atkPct += eq.atkPct; u.bonus.hpPct += eq.hpPct; u.bonus.crit += eq.crit;   // trang bị
  const pa = u.d.passive || {};
  if (pa.crit) u.bonus.crit += pa.crit;
  if (pa.dr) u.bonus.dmgTaken += pa.dr;
}

function chBg(st) { const c = CHAPTERS[st.raid ? 6 : st.chap]; if (!c) return null; const k = 'ch' + c.id; let i = BGIMG[k]; if (!i) { i = BGIMG[k] = new Image(); i.src = 'art/bg/' + k + '.webp'; } return i; }
function startBattle(si) {   // nạp rig + tư thế của đội trước khi vào trận
  const need = S.lineup.filter(id => S.owned[id]);
  const en = stageEnemyIds(typeof si === 'object' ? si : STAGES[si]);
  if (need.every(id => _heroLoaded[id] && _heroLoaded[id].done) && en.every(id => !(window.EPOSE || {})[id] || (_enemyLoaded[id] && _enemyLoaded[id].done))) { startBattleNow(si); return; }
  let ov = document.getElementById('loadov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'loadov'; ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(40,24,12,.72);color:#ffe9b0;font:800 22px Baloo 2,sans-serif;z-index:99'; ov.textContent = 'Đang tải tướng…'; document.body.appendChild(ov); }
  Promise.all([ensureHeroAssets(need), ensureEnemyAssets(en), new Promise(res => { const bi = chBg(typeof si === 'object' ? si : STAGES[si]); if (!bi || bi.complete) res(); else { bi.onload = res; bi.onerror = res; setTimeout(res, 4000); } })]).then(() => { need.forEach(id => { _heroLoaded[id].done = true; }); en.forEach(id => { if (_enemyLoaded[id]) _enemyLoaded[id].done = true; }); ov.remove(); startBattleNow(si); });
}
function startBattleNow(si) {
  bgmSet('battle');
  try { ucImg('cloud'); } catch (e) {}
  const st = typeof si === 'object' ? si : STAGES[si];
  const ids = S.lineup.filter(id => S.owned[id]);
  if (!ids.length) { toast('Cần ít nhất 1 tướng trong đội hình'); return; }
  B = {
    st, si, time: 0, wave: -1, waveStart: 0, nextT: null, spawnQ: [], waveDef: null, waveDropped: false,
    heroes: [], enemies: [], projs: [], fx: [], parts: [], floaters: [], drops: [], zones: [], warns: [],
    mods: {}, cp: {}, gate: { hp: st.gate, max: st.gate }, gateHurt: 0,
    stat: {}, mech: (CHAPTERS[st.chap] || {}).mk || null, mechT: 4, fxb: [], decals: [], cam: null, ghosts: [], hits: { n: 0, t: 0, id: null }, sparks: [], deploy: [], cap: null, paused: false, over: false, auto: false, speed: 1, shake: 0, slowmo: 0, later: [], flash: 0,
    cutin: null, rerolls: 2, soul: 0, amMode: 'duong', amT: 5, gateT: 10, field: {}, slots: [], kcT: 12, lv: 1, xp: 0, pickQ: [], dodgeCd: 0, deaths: 0, kills: 0, banner: null, endT: null, win: false, joy: null,
    bg: (chBg(st) && chBg(st).complete && chBg(st).naturalWidth) ? chBg(st) : (BGIMG[st.theme] && BGIMG[st.theme].complete && BGIMG[st.theme].naturalWidth) ? BGIMG[st.theme] : Art.backgroundH(W, H, st.theme, st.seed), ids, capTgt: null,
  };
  const info = teamInfo(ids);
  ids.forEach((id, i) => {
    const u = makeHero(id, i === 0);
    applyBonuses(u, info);
    u.hp = maxHp(u);
    if (i < 2) { takeSlot(u); B.heroes.push(u); if (i === 0) B.cap = u; } else B.deploy.push(u);   // mở trận: đội trưởng + 1 tướng; còn lại ra bằng Linh Phù
  });
  showHUD();
  { const cs = capSkill(ids[0]); if (cs.m) addMods(cs.m); B.capRegen = cs.regen || 0; B.banner = { text: 'Đội trưởng: ' + cs.n, sub: cs.d, t: 0, small: true }; }
  if (st.hmods) addMods(st.hmods);
  if (st.hhp) addMods({ hpPct: -(1 - st.hhp) });
  if (st.bookN) for (let i = 0; i < st.bookN; i++) setTimeout(() => B && !B.over && queuePick(openCongPhap), 1200 + i * 300);
  nextWave();
  { let extra = 0; for (const sy of Object.keys(SYS_NAME)) { const b = btBonus(sy); if (b.all && b.tot >= 15) extra++; }   // Hợp Nhất: thêm Thiên Thư đầu trận
    for (let i = 0; i < Math.min(2, extra); i++) setTimeout(() => B && !B.over && queuePick(openCongPhap), 1500 + i * 300); }
}

// ------------------------------------------------------------------ WAVES
function nextWave() {
  B.wave++;
  const wd = B.st.waves[B.wave];
  B.waveDef = wd; B.waveDropped = false; B.waveStart = B.time; B.nextT = null;
  let delay = 0.6;
  const list = [];
  wd.list.forEach(([type, n]) => { for (let i = 0; i < n; i++) list.push(type); });
  // quái tinh anh / boss ra sau cùng
  list.sort((a, b) => (ENEMIES[a].boss || ENEMIES[a].elite ? 1 : 0) - (ENEMIES[b].boss || ENEMIES[b].elite ? 1 : 0));
  list.forEach((type, i) => {
    const big = ENEMIES[type].boss || ENEMIES[type].elite;
    // vật phẩm rơi gắn vào con cuối của đợt → hạ nó lúc nào cũng rơi, kể cả khi đợt sau đã tới
    const drop = i === list.length - 1 ? wd.dropLast : null;
    B.spawnQ.push({ type, at: B.time + delay + (big ? 1.2 : 0), side: !!wd.side, drop });
    delay += 0.24;
  });
  const last = B.wave === B.st.waves.length - 1;
  if (wd.boss) { B.banner = { text: 'BOSS XUẤT HIỆN', sub: '', t: 0, boss: true }; snd('gong'); setTimeout(() => snd('roar'), 400); bgmSet('boss'); }
  else if (wd.horde) { B.banner = { text: 'Vô vàn kẻ địch tập kích!', sub: '', t: 0, boss: true }; B.shake = Math.max(B.shake, 0.3); }
  else if (wd.strong) { B.banner = { text: 'Địch mạnh tấn công!', sub: '', t: 0, small: true }; snd('gong', 0.6, 1.1); }
  else if (B.wave === 0 || last) B.banner = { text: last ? 'Đợt cuối' : 'Bắt đầu!', sub: '', t: 0, small: true };
  if (M('waveMp')) for (const h of B.heroes) if (!h.dead) h.mp = Math.min(100, h.mp + M('waveMp'));
}
function initTrait(e) {   // gán thuộc tính theo kiểu quái
  if (e.trait && !e.elite && !e.boss && Math.random() > 0.4) e.trait = null;   // chỉ ~40% quái thường mang kiểu đặc biệt (trộn lẫn)
  const t = e.trait; if (!t) return e;
  if (t === 'fly') { e.flyH = 48; e.move *= 1.5; }
  if (t === 'stealth') e.hidden = true;
  if (t === 'bomb') e.move *= 1.8;
  if (t === 'heal') e.healCd = 2.5;
  if (t === 'burrow') { e.under = true; e.move *= 1.4; }
  if (t === 'seal') e.sealCd = 3.5;
  return e;
}
function spawnEnemy(q) {
  let x = VIEW_R() + rand(20, 60), y = rand(LANE_Y0, LANE_Y1);
  if (q.side && Math.random() < 0.4 && !ENEMIES[q.type].boss) { x = VIEW_R() + rand(10, 40); y = Math.random() < 0.5 ? LANE_Y0 + rand(0, 30) : LANE_Y1 - rand(0, 30); }   // ra theo mép trên/dưới nhưng vẫn từ ngoài màn phải
  if (ENEMIES[q.type].boss) { x = VIEW_R() + 60; y = H * 0.56; }
  const e = initTrait(makeEnemy(q.type, B.st.lvl, x, y));
  e.drop = q.drop || null;
  if (e.boss && B.st.bossName && q.type === 'hoyeu') e.name = B.st.bossName;
  B.enemies.push(e);
  if (e.boss) { B.shake = 0.5; floater(W / 2, 150, e.name, '#ff6a6a', 28); }
}
function aliveEnemies() { return B.enemies.filter(e => !e.dead); }

// ------------------------------------------------------------------ DAMAGE
function floater(x, y, txt, color, size, crit, el) {
  B.floaters.push({ x: x + rand(-6, 6), y, txt: String(txt), color: color || '#fff', size: size || 16, t: 0, crit: !!crit, el });
}
function particles(x, y, color, n, spd, size) {
  if (gfxLow()) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(0.3, 1) * (spd || 160);
    B.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.35, 0.7), max: 0.7, color, size: rand(2, size || 4.5) });
  }
}
function dealDmg(src, tgt, mult, kind) {
  if (!tgt || tgt.dead) return 0;
  if (tgt.side === 'e' && tgt.trait === 'stealth' && kind !== 'dot') tgt.revealT = 2.5;
  if (tgt.side === 'e' && src.side === 'h' && kind !== 'dot') { for (const s of B.enemies) if (s !== tgt && !s.dead && s.trait === 'shield' && s.x < tgt.x && tgt.x - s.x < 120 && Math.abs(s.y - tgt.y) < 70) { mult *= 0.6; if (Math.random() < 0.15) floater(tgt.x, tgt.y - 60, 'Chặn', '#bcd4f0', 12); break; } }
  if (tgt.inv > 0) { if (kind !== 'dot') floater(tgt.x, tgt.y - 60, 'Né', '#bff3ff', 14); return 0; }
  let a = getAtk(src) * mult;
  if (window.__dmgBy && tgt.side === 'h') window.__dmgBy[src.id] = (window.__dmgBy[src.id] || 0) + a;
  if (src.side === 'e' && B.alive >= 40) a *= B.alive >= 50 ? 1.8 : 1.5;   // quái đông trên sân thì mạnh hơn (VLĐMT): ≥40 +50%, ≥50 +80%
  if (src.side === 'h') {
    const sp = M('skillPct') + RM(src, 'skillPct') + ((src.d.passive && src.d.passive.skillPct) || 0);
    if (kind === 'skill' || kind === 'dot') a *= 1 + sp + TG(src, 'skill');
    if (kind === 'ult') a *= 1 + M('ultPct') + sp + TG(src, 'ult');
    if (kind === 'atk' || kind === 'ht') a *= 1 + TG(src, 'atk');
    a *= 1 + M('dmgPct') + RM(src, 'final');
    if (kind === 'atk' || kind === 'ht') {
      if (M('tp')) a *= 1 + 0.05 * (src.tp || 0);                       // Phong Thế
      if (M('vn')) a *= 1 + (src.vn || 0) * (M('vn') + (M('vnFinal') || 0));                     // Kiếm Ý
      if (M('vk')) a *= Math.random() < 0.5 ? 0.8 : (M('vkEvo') ? 2.2 * rand(0.8, 1.4) : 1.6);   // Nguyệt Tướng: Khuyết −20% / Viên +60%
      if (M('bn')) {   // Triền Đấu: đánh liên tục cùng mục tiêu
        if (src.bnTgt === tgt) src.bn = Math.min(M('bnEvo') ? 37 : 50, (src.bn || 0) + 1); else { src.bnTgt = tgt; src.bn = 0; }
        a *= 1 + src.bn * (M('bnEvo') ? 0.02 : 0.01);
      }
    }
    if (kind === 'ht' && M('htHp')) a *= 1 + M('htHp') * (tgt.hp / maxHp(tgt));
    if (M('tear2') && tgt.tear) a *= 1 + M('tear2') * tgt.tear;          // Phệ Huyết 2
    if (tgt.side === 'e' && M('soul')) a *= 1 + 0.01 * B.soul;          // Thu Hồn: Hồn Phách
    if (src.isCap && (kind === 'skill' || kind === 'ult')) a *= 1.10;
  }
  const K = 500 + 50 * (tgt.level || 1);
  a *= K / (K + getDef(tgt) * (src.side === 'h' && M('vnSee') ? 1 - Math.min(5, src.vn || 0) * M('vnSee') : 1));   // Lạc Anh: Thấu Thị bỏ qua phòng thủ
  if (src.side === 'h' && tgt.side === 'e' && B.st && CHAPTERS[B.st.chap]) { const cr = CH_ROLE[CHAPTERS[B.st.chap].id]; if (cr) { if (src.role === cr[0]) a *= 1.25; else if (src.role === cr[1]) a *= 0.85; } }
  if (BEATS[src.el] === tgt.el) { a *= 1.3; if (src.side === 'h' && kind !== 'dot' && Math.random() < 0.35) floater(tgt.x + 14, tgt.y - 62 * sizeOf(tgt), 'Khắc!', ELEMENTS[src.el].color, 15, false, src.el); }
  else if (BEATS[tgt.el] === src.el) a *= 0.8;
  let crit = false;
  if (kind !== 'dot' && Math.random() < getCrit(src)) { a *= 1 + getCritDmg(src); crit = true; }
  a *= 1 - (tgt.bonus.dmgTaken || 0) - RM(tgt, 'dr') - (tgt.side === 'h' ? M('kc') + (M('vnDr') ? M('vnDr') * Math.min(5, tgt.vn || 0) : 0) + (M('tpDr') ? M('tpDr') * (tgt.tp || 0) : 0) : 0);
  if (tgt.dk > 0) a *= 1.10;
  a = Math.max(1, Math.round(a * rand(0.94, 1.06)));
  // cảm giác đánh: đứng hình, đẩy lùi, tia sáng, rung màn hình
  if (src.side === 'h' && tgt.side === 'e' && kind !== 'dot') {
    const strong = crit || kind === 'ult' || src === B.cap;
    if (strong) B.hitstop = Math.max(B.hitstop || 0, kind === 'ult' ? 0.12 : crit ? 0.09 : 0.05);
    if (crit) B.shake = Math.max(B.shake, 0.12);
    if (!src.ranged && !tgt.boss && kind !== 'chain') {
      const dx = tgt.x - src.x, dy = tgt.y - src.y, d = Math.hypot(dx, dy) || 1, k = crit ? 14 : 7;
      tgt.x += dx / d * k; tgt.y += dy / d * k * 0.5;
    }
    B.fx.push({ k: 'impact', x: tgt.x + rand(-6, 6), y: tgt.y - 30 * sizeOf(tgt) + rand(-8, 8), t: 0, dur: crit ? 0.22 : 0.15, big: crit || kind === 'ult', a: Math.random() * TAU });
  }
  let rem = a;
  if (tgt.shield > 0) { const s = Math.min(tgt.shield, rem); tgt.shield -= s; rem -= s; }
  if (B.stat) {   // thống kê sau trận (phân thân tính cho tướng gốc)
    const sid = src.side === 'h' ? src.id : null, tid = tgt.side === 'h' ? tgt.id : null, dmg = Math.min(a, tgt.hp + (tgt.shield || 0));
    if (sid) { const r = B.stat[sid] || (B.stat[sid] = { d: 0, t: 0, h: 0 }); r.d += dmg; }
    if (tid) { const r = B.stat[tid] || (B.stat[tid] = { d: 0, t: 0, h: 0 }); r.t += dmg; }
  }
  if (tgt.boss && src.side === 'h' && B.st.raid) B.raidDmg = (B.raidDmg || 0) + Math.min(rem, tgt.hp);
  tgt.hp -= rem; tgt.hurt = 0.1; if (rem > maxHp(tgt) * 0.04) tgt.hitT = 0.35;
  if (kind === 'ult' && tgt.side === 'e' && !tgt.boss && !tgt.dead) { tgt.x = Math.min(W + 30, tgt.x + 34); tgt.hitT = 0.35; }   // tuyệt kỹ hất văng
  if (crit && src.side === 'h') sfx('crit');
  if (tgt.side === 'h' && M('ad2')) adLose(tgt, rem);
  const col = tgt.side === 'h' ? '#ff6b6b' : crit ? '#ffe14d' : kind === 'ult' ? '#ffb347' : '#ffffff';
  floater(tgt.x, tgt.y - 50 * sizeOf(tgt), crit ? a + '!' : a, col, crit ? 22 : (kind === 'ult' ? 19 : 15), crit);
  if (src.side === 'h') {
    if (M('lifesteal') && !src.dead) healU(src, a * M('lifesteal'), true);
    if (kind === 'atk') {
      const htc = M('htChance') + RM(src, 'htChance');
      if (htc && !tgt.dead && Math.random() < htc) {   // Một Đòn Thần Kích
        dealDmg(src, tgt, 1.5 * (1 + M('htDmg')), 'ht'); floater(tgt.x, tgt.y - 78 * sizeOf(tgt), 'Thần Kích!', '#ffb347', 15);
      }
      const tr = M('tear') + RM(src, 'tear');
      if (tr && !tgt.dead && Math.random() < tr) { tgt.tear = Math.min(5, (tgt.tear || 0) + 1); tgt.tearT = 3; tgt.tearDps = Math.max(tgt.tearDps || 0, getAtk(src) * 0.6 * (1 + M('tearDmg'))); }
      const spl = TG(src, 'splash'); if (spl) for (const o of enemiesIn(tgt, spl)) if (o !== tgt) dealDmg(src, o, 0.5, 'dot');
      if (TG(src, 'bounce') && Math.random() < 0.5) chainLightning(src, tgt);
      const bh = TG(src, 'burnAll') ? 1 : src.d.passive && src.d.passive.burnHit;
      if (bh && !tgt.dead && Math.random() < bh) { tgt.burn = 2; tgt.burnDps = Math.max(tgt.burnDps || 0, getAtk(src) * 0.2); }
      const sl = RM(src, 'slow'); if (sl && Math.random() < sl) tgt.slow = 1.5;
      const ch = RM(src, 'chain'); if (ch && Math.random() < ch) chainLightning(src, tgt);
      const sh = RM(src, 'stunHit') + TG(src, 'stunHit'); if (sh && !tgt.dead && Math.random() < sh) tgt.stun = Math.max(tgt.stun, tgt.boss ? 0.2 : 0.6);
      const hh = RM(src, 'hitHeal') + TG(src, 'hitHeal'); if (hh) { const w = alliesAlive().sort((x, y) => x.hp / maxHp(x) - y.hp / maxHp(y))[0]; if (w) healAmD(src, w, maxHp(w) * hh); }
      const cb = RM(src, 'critBlast');
      if (cb && crit) { for (const o of enemiesIn(tgt, 60)) if (o !== tgt) dealDmg(src, o, cb, 'dot'); B.fx.push({ k: 'flash', x: tgt.x, y: tgt.y - 20, r: 60, color: '#ff5a5a', t: 0, dur: 0.25 }); }
    }
  } else if (kind === 'atk' && RM(tgt, 'thorns') && !src.dead) {
    rawDmg(src, a * RM(tgt, 'thorns'), '#d8c8ff');
  }
  if (tgt.hp <= 0) kill(tgt, src);
  return a;
}
function rawDmg(u, amt, color) {
  if (u.dead) return;
  amt = Math.max(1, Math.round(amt));
  u.hp -= amt;
  floater(u.x, u.y - 46 * sizeOf(u), amt, color || '#ff9a4d', 13);
  if (u.hp <= 0) kill(u, null);
}
function chainLightning(src, from) {
  const near = aliveEnemies().filter(e => e !== from).sort((a, b) => dist(a, from) - dist(b, from)).slice(0, 3);
  let prev = from;
  for (const e of near) {
    if (dist(e, from) > 220) break;
    B.fx.push({ k: 'bolt', x1: prev.x, y1: prev.y - 25, x2: e.x, y2: e.y - 25, t: 0, dur: 0.25 });
    dealDmg(src, e, 0.8, 'chain');
    prev = e;
  }
}
function adLose(u, amt) {
  u.adLost = (u.adLost || 0) + amt;
  while (u.adLost >= maxHp(u) * 0.08) { u.adLost -= maxHp(u) * 0.08; if (!(u.dhT > 0)) floater(u.x, u.y - 80, 'Lưỡng Nghi Giao Hoà', '#7dffb0', 13); u.dhT = M('ad2Evo') ? 5 : 3; }
}
function healAmD(src, u, amt) {   // hồi máu của tướng; Lưỡng Nghi: gây sát thương quái gần; hồi thừa → khiên
  if (!u || u.dead) return;
  const room = maxHp(u) - u.hp;
  if (B && B.stat && src && src.side === 'h') { const r = B.stat[src.id] || (B.stat[src.id] = { d: 0, t: 0, h: 0 }); r.h += Math.max(0, Math.min(amt, room)); }
  healU(u, amt, true);
  if (M('overShield') && amt > room) { u.shield = Math.max(u.shield, amt - room); u.shieldT = 5; }
  if (M('healDmg')) { const e = nearestEnemy(u, 500); if (e) rawDmg(e, amt * M('healDmg'), '#7dffb0'); }
}
function healU(u, amt, silent) {
  if (!u || u.dead) return;
  const m = maxHp(u), before = u.hp;
  u.hp = Math.min(m, u.hp + amt);
  if (!silent && u.hp - before >= 1) floater(u.x, u.y - 62, '+' + Math.round(u.hp - before), '#5dff8f', 15);
}
function kill(t, src) {
  if (t.dead) return;
  t.dead = true; t.hp = 0; t.deathT = 0;
  if (t.side === 'e') {
    if (t.trait === 'split' && !t.mini) for (const dy of [-26, 26]) { const c = makeEnemy(t.id, t.level, t.x + 10, clamp(t.y + dy, LANE_Y0, LANE_Y1)); c.mini = true; c.trait = null; c.look = { ...c.look, size: sizeOf(t) * 0.65 }; c.base.hp *= 0.35; c.hp = maxHp(c); c.move *= 1.2; B.enemies.push(c); particles(c.x, c.y - 20, '#9fe0ff', 8, 120, 3); }
    B.kills++; sfx('pop'); if (B.fxb.length < 40) fxBurst(t.x, t.y - 22, 'smoke', 120);
    if (M('soul') && Math.random() < 0.10 && B.soul < 40 + M('soulMax')) { B.soul++; floater(t.x, t.y - 60, 'Hồn Phách ' + B.soul, '#9ad0ff', 12); }
    B.xp += t.boss ? 30 : t.elite ? 5 : 1;
    while (B.xp >= xpNeed()) { B.xp -= xpNeed(); B.lv++; floater(W / 2, 120, 'Lên cấp ' + B.lv + '!', '#ffe14d', 24); snd('heal', 0.7, 1.25); queuePick(openCongPhap); }
    particles(t.x, t.y - 20, t.look.skin, t.boss ? 40 : 12, t.boss ? 300 : 170);
    particles(t.x, t.y - 20, '#ffffff', 6, 120, 3);
    if (t.boss) { B.shake = 0.8; B.slowmo = 0.8; }
    if (t.drop) spawnDrop(t.drop, t.x, t.y);
    if (M('healKill')) for (const h of B.heroes) if (!h.dead) healU(h, maxHp(h) * M('healKill'), true);
  } else {
    if (t.clone) { t.gone = true; particles(t.x, t.y - 20, '#ffe58a', 10, 120); return; }
    if (B.mods['dan.revive'] && !t.revived) {
      t.revived = true; t.dead = false; t.hp = maxHp(t) * 0.5; t.ammo = ammoMax(t); t.dk = 0;
      floater(t.x, t.y - 70, 'Bồ Đề hồi sinh!', '#ffe58a', 16); particles(t.x, t.y - 30, '#fff3a0', 24, 180); return;
    }
    B.deaths++;
    floater(t.x, t.y - 70, 'Trọng thương', '#ff8a8a', 15);
    particles(t.x, t.y - 20, '#ffffff', 14, 150);
    if (B.ids.includes('ngokhong') && B.ids.includes('ngumavuong') && (t.id === 'ngokhong' || t.id === 'ngumavuong')) {
      const partner = B.heroes.find(h => !h.dead && !h.clone && h.id === (t.id === 'ngokhong' ? 'ngumavuong' : 'ngokhong'));
      if (partner) { partner.buffs.push({ k: 'atk', v: 0.30, t: 8 }); floater(partner.x, partner.y - 80, 'Huynh đệ báo thù!', '#ffb347', 16); }
    }
    if (t === B.cap) {
      t.isCap = false;
      const n = B.heroes.find(h => !h.dead && !h.clone);
      if (n) { B.cap = n; n.isCap = true; floater(n.x, n.y - 85, 'Đội trưởng mới', '#ffe14d', 15); }
    }
  }
}

// ------------------------------------------------------------------ DROPS
function spawnDrop(k, x, y) {
  const list = k === 'both' ? ['phu', 'thu'] : [k];
  list.forEach((kk, i) => B.drops.push({ k: kk, x: clamp(x + (i ? 26 : 0), GATE_X + 20, W - 30), y: clamp(y, LANE_Y0, LANE_Y1), t: 0, fly: false }));
}
function updateDrops(dt) {
  const cap = B.cap && !B.cap.dead ? B.cap : B.heroes.find(h => !h.dead);
  for (const d of B.drops) {
    d.t += dt;
    if (!cap) continue;
    if (!d.fly && d.t > 0.7) d.fly = true;   // tướng đứng yên: đồ rơi tự bay về đội
    if (d.fly) {
      const dx = cap.x - d.x, dy = cap.y - 30 - d.y, dd = Math.hypot(dx, dy);
      const sp = 520 * dt;
      if (dd <= sp + 6) { d.done = true; collect(d.k); } else { d.x += dx / dd * sp; d.y += dy / dd * sp; }
    }
  }
  B.drops = B.drops.filter(d => !d.done);
}
function xpNeed() { return 2 * Math.min(15, 4 + B.lv); }   // VLĐMT battlelvupconfig: tăng đều tới mốc rồi giữ nguyên
// các khung chọn (Thiên Thư, Linh Phù) xếp hàng, không mở chồng lên nhau

// Công pháp đủ chiều sâu (VLĐMT): bậc 3 có cấp 1–6 (giới hạn cấp = 3 + sao Bí Tịch/3), bậc 3.1 khi đạt cấp 3, bậc 4 cần Bí Tịch ≥5★ và đã có 3.1
const EVO2 = { the_core: 'Bàn Cổ Khai Thiên', the_ht1: 'Phiên Thiên Thần Ấn', the_ht2: 'Phá Sơn Thần Phủ', the_ts: 'Kim Cương Bất Diệt', the_ct: 'Lôi Âm Chấn Thế',
  phap_core: 'Ngũ Lôi Oanh Đỉnh', phap_tp1: 'Cưỡi Gió Vạn Dặm', phap_tp2: 'Súc Địa Thành Thốn', phap_ct: 'Hải Long Đằng Không', phap_qn: 'Vạn Hồn Quy Tông',
  dan_core: 'Cam Lộ Phổ Độ', dan_ad1: 'Âm Dương Hoà Hợp', dan_ad2: 'Khởi Tử Hồi Sinh', dan_tt: 'Phi Thăng Chân Kinh', dan_ct: 'Hoa Nở Vạn Phương',
  sat_core: 'Tru Tiên Tuyệt Kiếm', sat_ct: 'Vạn Kiếm Triều Tông', sat_vk: 'Nguyệt Hoa Vô Biên', sat_vn1: 'Thần Nhập Kiếm Tâm', sat_vn2: 'Nhân Kiếm Hợp Nhất',
  tran_core: 'Bát Môn Kim Toả', tran_xt1: 'Trói Tiên Thiên La', tran_xt2: 'Phá Ma Thần Chú', tran_bn: 'Võng Thiên Khốn Địa', tran_ct: 'Kim Châm Diệt Hồn' };
const PEAK = { the: 'Bàn Cổ Thần Thể', phap: 'Thiên Lôi Vạn Pháp', dan: 'Bồ Đề Diệu Pháp', sat: 'Tru Tiên Tứ Kiếm', tran: 'Phong Thần Đại Trận' };
const cpCap = id => Math.min(6, 3 + Math.floor((typeof btStars === 'function' ? btStars(id) : 0) / 3));
function scaleMod(mod, k) { const o = {}; for (const x in mod) if (typeof mod[x] === 'number' && !/Now$|Max$|^tp$|^vn$|^vk|Evo$|^soul$|^ad1$|^ad2$/.test(x)) o[x] = mod[x] * k; return o; }
function queuePick(fn) { if (B.paused || ui.querySelector('.cp-modal')) B.pickQ.push(fn); else fn(); }
function closePick(wrap) {
  wrap.remove(); B.paused = false; lastT = performance.now();
  if (B.pickQ.length) B.pickQ.shift()();
}
function collect(k) {
  if (k === 'phu') queuePick(deployNext);
  else queuePick(openCongPhap);
}
function deployNext() {
  if (B.deploy.length > 1) { openDeployPick(); return; }
  placeHero(B.deploy.shift());
}
function openDeployPick() {
  snd('pickup'); setTimeout(() => coach('c_phu', { img: 'art/ui/drop_phu.webp', title: 'Linh Phù', text: 'Quái rơi <b>Linh Phù</b> → chọn <b>1 Thần Tướng</b> ra sân. Mở trận chỉ có 2 tướng, đội tối đa 5. Đủ 5 rồi thì Linh Phù hồi máu cả đội.' }), 50);
  B.paused = true;
  const opts = B.deploy.slice(0, 4);
  const wrap = document.createElement('div');
  wrap.className = 'modal cp-modal';
  wrap.innerHTML = `<div class="cp-title"><img class="cp-ico" src="art/ui/drop_phu.webp" alt=""><span>Linh Phù</span><small>Chọn 1 Thần Tướng xuất trận</small></div>
    <div class="cp-list">${opts.map((u, i) => `
      <button class="cp-card dp-card" data-i="${i}">
        <img src="${por(u.id, 110)}"><b>${esc(u.name)}</b><small>${esc(HEROES[u.id].title)}</small>${roleTag(u.role)}
      </button>`).join('')}</div>`;
  ui.appendChild(wrap);
  wrap.querySelectorAll('.dp-card').forEach(btn => btn.addEventListener('click', () => {
    const u = opts[+btn.dataset.i];
    B.deploy.splice(B.deploy.indexOf(u), 1);
    placeHero(u);
    closePick(wrap);
  }));
}
function placeHero(u) {
  const cap = B.cap;
  if (!u) {
    for (const h of B.heroes) if (!h.dead) healU(h, maxHp(h) * 0.15);
    floater(cap.x, cap.y - 90, 'Linh Phù: hồi máu cả đội', '#5dff8f', 15);
    return;
  }
  takeSlot(u);
  B.heroes.push(u);
  B.fx.push({ k: 'poof', x: u.x, y: u.y - 20, t: 0, dur: 0.5 });
  particles(u.x, u.y - 20, '#fff6c2', 18, 200);
  B.banner = { text: u.name + ' xuất trận!', sub: HEROES[u.id].title, t: 0, small: true };
  buildTeamBar();
}

// ------------------------------------------------------------------ CÔNG PHÁP
// B.slots: [{ id, tier }] — tier 1 cơ bản, 2 cao cấp, 3 đã tiến bậc. Tối đa CP_MAX ô.
const cpOf = id => CONGPHAP.find(c => c.id === id);
const dsc = t => esc(String(t).replace(/ ?\[VLĐMT\]/g, ''));   // bỏ chú thích nguồn khi hiển thị
function slotOf(id) { return B.slots.find(sl => sl.id === id); }
function cpCount() { return B.slots.length; }
function rollCongPhap() {
  const field = B.heroes.filter(h => !h.dead && !h.clone);
  const sys = new Set(field.map(h => h.role));
  const lps = new Set(B.slots.map(sl => cpOf(sl.id).lp).filter(Boolean));
  const freeBasic = new Set(B.slots.filter(sl => sl.tier === 1).map(sl => cpOf(sl.id).sys));
  const cand = [];
  for (const c of CONGPHAP) {
    if (c.tier === 1) {
      if (cpCount() < CP_MAX) cand.push({ kind: 'basic', c, w: sys.has(c.sys) ? 3 : 0.6 });
    } else if (!slotOf(c.id) && freeBasic.has(c.sys) && (!c.req || slotOf(c.req))) {
      cand.push({ kind: 'adv', c, w: 3.5 + (lps.has(c.lp) ? 2 : 0) + (c.req ? 2 : 0) });
    }
  }
  for (const sl of B.slots) if (sl.tier === 2) cand.push({ kind: 'evo', c: cpOf(sl.id), w: 3 });
  for (const sl of B.slots) if (sl.tier >= 3 && (sl.lv || 1) < cpCap(sl.id)) cand.push({ kind: 'evolv', c: cpOf(sl.id), sl, w: 2.2 });
  for (const sl of B.slots) if (sl.tier === 3 && (sl.lv || 1) >= 3 && !sl.e2) cand.push({ kind: 'evo2', c: cpOf(sl.id), sl, w: 2.5 });
  { const sys = {}; for (const sl of B.slots) if (sl.e2) sys[cpOf(sl.id).sys] = 1;
    for (const sy in sys) if (!(B.peak || {})[sy] && typeof btBonus === 'function' && btBonus(sy).tot >= 5) cand.push({ kind: 'peak', sy, c: B.slots.map(sl => cpOf(sl.id)).find(c => c.sys === sy && slotOf(c.id).e2), w: 1.6 }); }
  for (const h of field) if (trongOf(h) < 5 && (h.d.tang || []).length) cand.push({ kind: 'tu', u: h, w: 2.5 });
  const out = [];
  while (out.length < 3 && cand.length) {
    let r = Math.random() * cand.reduce((t, x) => t + x.w, 0), q = 0;
    for (; q < cand.length - 1; q++) { r -= cand[q].w; if (r <= 0) break; }
    const o = cand.splice(q, 1)[0];
    if (o.kind === 'basic') for (let z = cand.length - 1; z >= 0; z--) if (cand[z].kind === 'basic' && cand[z].c.sys === o.c.sys) cand.splice(z, 1);
    out.push(o);
  }
  if (!out.length) out.push({ kind: 'gold' });
  return out;
}
function lpTag(lp) { const L = LUUPHAI[lp]; return L ? `<span class="lp-tag" style="--c:${L.color}" title="${esc(L.desc)}">${L.name}</span>` : ''; }
function cardHTML(o, i) {
  if (o.kind === 'gold') return `<button class="cp-card r1" data-i="${i}"><span class="cp-rar">Đã đủ</span><span class="cp-icon">V</span><b>Vàng thưởng</b><small>+200 vàng</small></button>`;
  if (o.kind === 'tu') {
    const n = trongOf(o.u), t = o.u.d.tang[n - 1];
    return `<button class="cp-card r1 tu" data-i="${i}"><span class="cp-rar">${esc(o.u.name)} · Tầng ${n + 1}</span>
      <img class="cp-por" src="${porB(o.u.id, 96)}"><small>${esc(t.d)}</small><em class="tg-step">${n} ➜ ${n + 1}</em></button>`;
  }
  const c = o.c;
  if (o.kind === 'evolv') return `<button class="cp-card r3" data-i="${i}"><span class="cp-rar">${esc(c.evo.name)} · Cấp ${(o.sl.lv || 1) + 1}</span>${lpTag(c.lp)}
      <span class="cp-icon">${esc(c.evo.name.slice(0, 1))}</span><small>Tăng cấp công pháp: hiệu quả tiến bậc +40%.<br><i>Giới hạn cấp ${cpCap(c.id)} (nâng bằng sao Bí Tịch)</i></small><em class="cp-rec">Cấp ${o.sl.lv || 1} ➜ ${(o.sl.lv || 1) + 1}</em></button>`;
  if (o.kind === 'evo2') return `<button class="cp-card r3" data-i="${i}"><span class="cp-rar">${esc(EVO2[c.id] || c.evo.name)}</span>${lpTag(c.lp)}
      <span class="cp-icon">${esc((EVO2[c.id] || 'T').slice(0, 1))}</span><small><b class="evo-from">${esc(c.evo.name)} tiến bậc lần 2</b>ST cuối Thần Tướng hệ ${SYS_NAME[c.sys]} +8%, toàn thể +10%</small><em class="cp-rec">Tiến bậc 2</em></button>`;
  if (o.kind === 'peak') return `<button class="cp-card r3" data-i="${i}" style="box-shadow:0 0 26px #ff5a2a"><span class="cp-rar">${esc(PEAK[o.sy])}</span>
      <span class="cp-icon">${esc(PEAK[o.sy].slice(0, 1))}</span><small><b class="evo-from">Bậc Đỉnh hệ ${SYS_NAME[o.sy]} (cần Bí Tịch ≥5★)</b>ST cuối hệ ${SYS_NAME[o.sy]} +15%, ST toàn thể +12%, tốc đánh +10%</small><em class="cp-rec">Bậc 4</em></button>`;
  if (o.kind === 'evo') return `<button class="cp-card r3" data-i="${i}"><span class="cp-rar">${esc(c.evo.name)}</span>${lpTag(c.lp)}
      <span class="cp-icon">${esc(c.evo.name.slice(0, 1))}</span><small><b class="evo-from">${esc(c.name)} tiến bậc ${esc(c.evo.name)}</b>${dsc(c.evo.desc)}</small>
      <em class="cp-rec">Tiến bậc</em></button>`;
  const tos = o.kind === 'basic' ? CONGPHAP.filter(x => x.tier === 2 && x.sys === c.sys).map(x => x.name).join(', ') : '';
  return `<button class="cp-card ${CP_RAR[c.tier].cls}" data-i="${i}"><span class="cp-rar">${esc(c.name)}</span>
      ${c.tier === 2 ? lpTag(c.lp) : ''}<span class="cp-icon">${esc(c.name.slice(0, 1))}</span>
      <small>${dsc(c.desc)}${tos ? `<br><i>Có thể tiến bậc lên: ${esc(tos)}</i>` : ''}${o.kind === 'adv' ? `<br><i>(${esc(SYS_NAME[c.sys])} cơ bản tiến bậc thành công pháp này)</i>` : ''}</small>
      <em class="cp-rec">Đề cử: ${c.tier === 1 || /^ST hệ/.test(c.desc) ? 'hệ ' + SYS_NAME[c.sys] : 'Toàn thể'}</em></button>`;
}
function slotIcon(sl) {
  const c = cpOf(sl.id), nm = sl.tier === 3 ? c.evo.name : c.name;
  return `<span class="pf-c ${CP_RAR[sl.tier].cls}" title="${esc(nm)}: ${dsc(sl.tier === 3 ? c.evo.desc : c.desc)}" style="--c:${c.lp ? LUUPHAI[c.lp].color : '#4f8cff'}">${esc(nm.slice(0, 1))}</span>`;
}
function pickFooter() {
  const team = [...B.heroes.filter(h => !h.clone), ...B.deploy];
  return `<div class="pick-foot">
    <div class="pf-row"><span class="pf-lab">Tiểu đội</span>${team.map(u => `<span class="pf-h ${B.heroes.includes(u) ? '' : 'off'}"><img src="${porB(u.id, 64)}"><b>${trongOf(u)}</b></span>`).join('')}</div>
    <div class="pf-row"><span class="pf-lab">Công pháp</span>${Array.from({ length: CP_MAX }, (_, q) => B.slots[q] ? slotIcon(B.slots[q]) : '<span class="pf-c empty"></span>').join('')}</div>
  </div>`;
}
function openBachGiam() {
  const box = document.createElement('div');
  box.className = 'modal bg-modal';
  const own = id => (slotOf(id) || {}).tier || 0;
  box.innerHTML = `<div class="cp-title"><span>Công Pháp Bách Giám</span><small>Chọn cơ bản của hệ → tiến bậc thành công pháp cao cấp → tiến bậc lần nữa · tối đa ${CP_MAX} ô</small></div>
    <div class="bg-grid">${Object.keys(SYS_NAME).map(sy => `<div class="bg-col"><h4>Hệ ${SYS_NAME[sy]}</h4>
      ${CONGPHAP.filter(c => c.sys === sy).map(c => c.tier === 1
        ? `<div class="bg-it t1"><b>${esc(c.name)}</b><i>Cơ bản</i><small>${dsc(c.desc)}</small></div>`
        : `<div class="bg-it t2 ${own(c.id) ? 'own' : ''}"><b>${esc(c.name)}</b>${lpTag(c.lp)}<small>${dsc(c.desc)}</small>
           <div class="bg-evo ${own(c.id) === 3 ? 'own' : ''}">➜ <b>${esc(c.evo.name)}</b><small>${dsc(c.evo.desc)}</small></div></div>`).join('')}
    </div>`).join('')}</div>
    <div class="bg-lp">${Object.values(LUUPHAI).map(L => `<span><b style="color:${L.color}">${L.name}</b>: ${esc(L.desc)}</span>`).join('')}</div>
    <button class="btn small" id="bgClose">Đóng</button>`;
  ui.appendChild(box);
  box.querySelector('#bgClose').onclick = () => box.remove();
}
function openCongPhap() {
  snd('pickup', 0.8, 1.15); setTimeout(() => coach('c_cp', { img: 'art/ui/drop_thu.webp', title: 'Thiên Thư · Công pháp', text: 'Nhặt <b>Thiên Thư</b> hoặc lên cấp → <b>chọn 1 công pháp</b>. Chọn công pháp cơ bản của một hệ trước, sau đó tiến bậc thành công pháp cao cấp. Tối đa 6 ô.' }), 50);
  B.paused = true;
  let opts = rollCongPhap();
  const wrap = document.createElement('div');
  wrap.className = 'modal cp-modal';
  const draw = () => {
    wrap.innerHTML = `<div class="cp-title"><img class="cp-ico" src="art/ui/drop_thu.webp" alt=""><span>Chọn Công Pháp</span><small>Chọn 1 để tu luyện · ${cpCount()}/${CP_MAX} ô công pháp</small></div>
      <div class="cp-list">${opts.map(cardHTML).join('')}</div>
      <div class="cp-side"><button class="btn small" id="cpBG">Bách Giám</button>
        <button class="btn small cp-reroll">${B.rerolls > 0 ? `Đổi thẻ (còn ${B.rerolls})` : `Đổi thẻ ${icon('ngoc')}20`}</button></div>
      ${pickFooter()}`;
    wrap.querySelectorAll('.cp-card').forEach(btn => btn.addEventListener('click', () => { applyPick(opts[+btn.dataset.i]); closePick(wrap); }));
    wrap.querySelector('.cp-reroll').onclick = () => { if (B.rerolls > 0) B.rerolls--; else if (S.ngoc >= 20) { S.ngoc -= 20; save(); } else { toast('Không đủ ngọc'); return; } opts = rollCongPhap(); draw(); };
    wrap.querySelector('#cpBG').onclick = openBachGiam;
  };
  draw();
  ui.appendChild(wrap);
}
function addMods(mod, sign) {
  for (const k in mod) {
    const v = mod[k] * (sign || 1);
    if (k.endsWith('hpPct')) { const sy = k.includes('.') ? k.split('.')[0] : null; for (const h of [...B.heroes, ...B.deploy]) if (!h.dead && (!sy || h.role === sy)) h.hp += h.base.hp * v; }
    B.mods[k] = (B.mods[k] || 0) + v;
  }
}
function applyPick(o) {
  if (!o) return;
  if (o.kind === 'gold') { S.vang += 200; save(); return; }
  if (o.kind === 'tu') {
    const u = o.u, before = maxHp(u);
    u.trong = Math.min(5, trongOf(u) + 1); rebuildTang(u);
    u.hp += Math.max(0, maxHp(u) - before);
    B.banner = u.trong >= 5 ? { text: '✦ ĐẠI THÀNH · ' + u.name + ' ✦', sub: u.d.tang[u.trong - 2].d, t: 0 } : { text: u.name + ' · Tầng ' + u.trong, sub: u.d.tang[u.trong - 2].d, t: 0, small: true };
    if (u.trong >= 5) { B.flash = 0.3; B.shake = Math.max(B.shake, 0.5); sfx('ult'); B.fx.push({ k: 'ring', x: u.x, y: u.y, r: 260, color: '#ffd34d', t: 0, dur: 0.7 }); fxBurst(u.x, u.y - 50, 'burst_gold', 240); particles(u.x, u.y - 60, '#ffe58a', 40, 260, 5); }
    particles(u.x, u.y - 30, '#ffe58a', 18, 160); buildTeamBar(); return;
  }
  const c = o.c;
  if (o.kind === 'basic') { B.slots.push({ id: c.id, tier: 1 }); addMods(c.mod); B.banner = { text: c.name, sub: c.desc.replace(/ ?\[VLĐMT\]/g, ''), t: 0, small: true }; }
  else if (o.kind === 'adv') {
    const sl = B.slots.find(x => x.tier === 1 && cpOf(x.id).sys === c.sys);
    addMods(cpOf(sl.id).mod, -1);                 // cơ bản tiến bậc thành cao cấp (cùng ô)
    sl.id = c.id; sl.tier = 2; addMods(c.mod);
    if (c.field) B.field[c.field] = { t: 1.5 };
    B.banner = { text: c.name, sub: LUUPHAI[c.lp].name + ' · ' + c.desc.replace(/ ?\[VLĐMT\]/g, ''), t: 0, small: true };
  } else if (o.kind === 'evolv') {
    o.sl.lv = (o.sl.lv || 1) + 1; addMods(scaleMod(c.evo.mod, 0.4));
    B.banner = { text: c.evo.name + ' · Cấp ' + o.sl.lv, sub: 'Hiệu quả tiến bậc tăng', t: 0, small: true };
  } else if (o.kind === 'evo2') {
    o.sl.e2 = 1; addMods({ [c.sys + '.final']: 0.08, atkPct: 0.10 });
    B.banner = { text: EVO2[c.id] || c.evo.name, sub: 'Tiến bậc lần 2', t: 0, small: true };
  } else if (o.kind === 'peak') {
    (B.peak = B.peak || {})[o.sy] = 1; addMods({ [o.sy + '.final']: 0.15, dmgPct: 0.12, aspdPct: 0.10 });
    B.banner = { text: PEAK[o.sy], sub: 'Bậc Đỉnh hệ ' + SYS_NAME[o.sy], t: 0, boss: true }; B.shake = 0.4;
  } else if (o.kind === 'evo') {
    slotOf(c.id).tier = 3; addMods(c.evo.mod);
    if (c.evo.mod.soulNow) B.soul += c.evo.mod.soulNow;
    B.banner = { text: c.evo.name, sub: 'Tiến bậc: ' + c.evo.desc.replace(/ ?\[VLĐMT\]/g, ''), t: 0, small: true };
  }
  renderCpList();
}

// ------------------------------------------------------------------ SKILLS
function bestCluster(r) {   // điểm có nhiều quái nhất trong bán kính r (ưu tiên quái tiến sâu)
  let best = null, bs = -1;
  const live = B.enemies.filter(e => !e.dead && e.x < VIEW_R() - 10);
  for (const e of live) {
    let n = 0; for (const o of live) if (dist(e, o) <= r) n++;
    const sc = n * 100 - e.x * 0.05 + (e.boss ? 150 : 0);
    if (sc > bs) { bs = sc; best = e; }
  }
  return best ? { x: best.x, y: best.y } : null;
}
function skillPoint(u, f, tgt) {
  if (f.at === 'cluster') return bestCluster(f.r || 100) || (tgt ? { x: tgt.x, y: tgt.y } : { x: u.x + 220, y: u.y });
  if (f.at === 'front') return { x: u.x + 130, y: u.y };
  if (f.at === 'self' || !tgt) return { x: u.x + (f.at === 'self' ? 0 : u.f * 90), y: u.y - (f.at === 'self' ? 0 : 40) };
  return { x: tgt.x, y: tgt.y };
}
const FIELD = {
  hoavu: { sys: 'phap', cd: 5, name: 'Hỏa Vũ' },
  phikiem: { sys: 'sat', cd: 4, name: 'Phi Kiếm' },
  batquai: { sys: 'tran', cd: 6, name: 'Bát Quái' },
  thachpha: { sys: 'the', cd: 5, name: 'Lạc Thạch' },
  lachoa: { sys: 'dan', cd: 6, name: 'Lạc Hoa Lưu Thủy' },
};
function updateField(dt) {
  for (const id in B.field) {
    const F = FIELD[id], st = B.field[id];
    st.t -= dt; if (st.t > 0) continue;
    if (!aliveEnemies().length) continue;
    st.t = F.cd;
    const pool = B.heroes.filter(h => !h.dead && !h.clone);
    const src = pool.filter(h => h.role === F.sys).sort((a, b) => getAtk(b) - getAtk(a))[0] || pool[0];
    if (!src) continue;
    const k = (1 + 0.3 * sysTang(F.sys)) * (1 + M('fev.' + id));
    if (id === 'hoavu') {
      const P = bestCluster(110); if (!P) continue;
      for (const e of enemiesIn(P, 110)) dealDmg(src, e, 1.5 * k, 'skill');
      B.fx.push({ k: 'ring', x: P.x, y: P.y, r: 110, color: '#ff7a2e', t: 0, dur: 0.5 }); B.fx.push({ k: 'flash', x: P.x, y: P.y, r: 100, color: '#ff9a3a', t: 0, dur: 0.35 });
      for (let i = 0; i < 14; i++) B.parts.push({ x: P.x + rand(-90, 90), y: P.y - 180 - rand(0, 80), vx: rand(-20, 20), vy: 420, life: 0.45, max: 0.45, color: i % 2 ? '#ffb02e' : '#ff5a2a', size: 4 });
    } else if (id === 'phikiem') {
      for (let i = 0; i < 5; i++) {
        const y = LANE_Y0 + 20 + i * (LANE_Y1 - LANE_Y0 - 40) / 4;
        B.projs.push({ x: 140, y: y - 30, vx: 760, vy: 0, sp: 760, src, side: 'h', mult: 0.8 * k, kind: 'skill', type: 'sword', homing: null, pierce: true, hit: new Set(), life: 1.3, r: 16, rot: 0 });
      }
    } else if (id === 'thachpha') {
      const e = aliveEnemies().sort((a, b) => a.x - b.x)[0]; if (!e) continue;
      for (const o of enemiesIn(e, 80)) { dealDmg(src, o, 1.6 * k, 'skill'); if (!o.dead && !o.boss) o.x += 40; }
      B.fx.push({ k: 'ring', x: e.x, y: e.y, r: 80, color: '#c8a070', t: 0, dur: 0.45 }); particles(e.x, e.y - 10, '#8a6a40', 16, 220, 4); B.shake = Math.max(B.shake, 0.18);
    } else if (id === 'lachoa') {
      for (const h of pool) healAmD(src, h, maxHp(h) * 0.04);
      const P = bestCluster(100);
      if (P) { for (const e of enemiesIn(P, 100)) dealDmg(src, e, 1.0 * k, 'skill'); B.fx.push({ k: 'flash', x: P.x, y: P.y, r: 100, color: '#ff9ad8', t: 0, dur: 0.4 }); }
      for (let i = 0; i < 16; i++) B.parts.push({ x: rand(140, W - 60), y: rand(LANE_Y0 - 60, LANE_Y0), vx: rand(-30, 30), vy: rand(60, 140), life: 1.2, max: 1.2, color: i % 2 ? '#ffb0dc' : '#fff0fa', size: 3.5 });
    } else if (id === 'batquai') {
      const P = bestCluster(120); if (!P) continue;
      for (const e of enemiesIn(P, 120)) { dealDmg(src, e, 1.2 * k, 'skill'); if (!e.dead) e.stun = Math.max(e.stun, e.boss ? 0.3 : 0.8); }
      B.fx.push({ k: 'bagua', x: P.x, y: P.y, r: 120, t: 0, dur: 0.8 });
    }
  }
}
function nearestEnemy(p, maxD) {
  let best = null, bd = maxD || 1e9;
  for (const e of B.enemies) { if (e.dead || e.under || (e.hidden && !(e.revealT > 0))) continue; const d = dist(p, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
function enemiesIn(p, r) { return B.enemies.filter(e => !e.dead && !e.under && dist(p, e) <= r + unitR(e)); }
function alliesAlive() { return B.heroes.filter(h => !h.dead && !h.clone); }
function canCast(u, w) {
  if (!u || u.dead || u.clone || u.stun > 0 || u.dk > 0 || u.sealT > B.time) return false;
  const cost = w === 'ult' ? 60 : 30;
  if (u.mp < cost) return false;
  return w === 'ult' ? u.cdU <= 0 : u.cdS <= 0;
}
function tryCombo(u) {   // hợp kích: tìm cặp vừa tung tuyệt kỹ trong 3 giây
  B.lastUlt = B.lastUlt || {}; B.comboCd = B.comboCd || {};
  for (const c of COMBOS) {
    const o = c.a === u.id ? c.b : c.b === u.id ? c.a : null; if (!o) continue;
    const t = B.lastUlt[o]; if (t == null || B.time - t > 3 || (B.comboCd[c.name] || 0) > B.time) continue;
    B.comboCd[c.name] = B.time + 20; const P = clusterPoint ? clusterPoint() : null, x = P ? P.x : W * 0.65, y = P ? P.y : H * 0.55;
    B.later.push({ t: 1.1, fn: () => {
      if (!B || B.over) return;
      B.banner = { text: 'HỢP KÍCH · ' + c.name, sub: HEROES[c.a].name + ' × ' + HEROES[c.b].name, t: 0, boss: true };
      B.shake = 0.8; B.flash = 0.3; B.cam = { x, y: y - 40, t: 0, dur: 0.9 }; sfx('boom');
      if (uxImg('combo_b1')) B.fx.push({ k: 'combo', x, y, t: 0, dur: 1.8 }); else { for (const f of c.fx) fxBurst(x, y - 50, f, 460); fxBurst(x, y - 30, 'ring', 520); }
      B.decals.push({ x, y: y + 4, r: 170, t: 0, dur: 5 });
      const src = B.heroes.find(h => h.id === u.id) || u;
      for (const e of enemiesIn({ x, y }, 230)) { dealDmg(src, e, c.mult, 'ult'); if (c.stun) e.stun = Math.max(e.stun || 0, c.stun); }
      if (c.heal) for (const a of alliesAlive()) healAmD(src, a, getAtk(src) * c.heal);
      if (c.shield) for (const a of alliesAlive()) { a.shield = Math.max(a.shield, maxHp(a) * c.shield); a.shieldT = 6; }
    } });
  }
  B.lastUlt[u.id] = B.time;
}
function clusterPoint() { const live = aliveEnemies(); if (!live.length) return null; let best = live[0], bn = 0; for (const e of live) { const n = enemiesIn(e, 140).length; if (n > bn) { bn = n; best = e; } } return { x: best.x, y: best.y }; }
function cast(u, w) {
  if (!canCast(u, w)) return false;
  const sk = u.d[w];
  u.mp -= w === 'ult' ? 60 : 30;
  if (w === 'ult') u.cdU = 12; else u.cdS = 6;   // chiêu nhỏ 6 giây/lần
  const sk_ = typeof Skel !== 'undefined' && Skel.has(u.id);
  u.castDur = sk_ ? (w === 'ult' ? 1.0 : 0.6) : 0.35; u.castT = u.castDur; u.castUlt = w === 'ult'; u.atkAnim = sk_ ? -1 : 0;
  const tgt = findTarget(u) || nearestEnemy(u, 400);
  if (tgt) u.f = tgt.x >= u.x ? 1 : -1;
  if (w === 'ult' && typeof VFX !== 'undefined' && VFX.has(u.id)) {
    // tuyệt kỹ có hiệu ứng riêng: hiệu ứng chạy sau cut-in, sát thương nổ đúng lúc hiệu ứng chạm đất
    const self = sk.fx.every(f => f.at === 'self' || f.t === 'heal' || f.t === 'shield' || f.t === 'taunt' || f.t === 'buff' || f.t === 'clone');
    const f0 = sk.fx.find(f => f.at === 'cluster' || f.at === 'front' || f.at === 'target');
    const P = self || (!tgt && !f0) ? { x: u.x, y: u.y } : f0 ? skillPoint(u, f0, tgt) : { x: tgt.x, y: tgt.y };
    const UC = ucReady(u.id) ? ULTC[u.id] : null, D = UC ? UC.dur : VFX.dur, lead = 0.45, hit = lead + D * (UC ? UC.hit : 0.26);
    B.fx.push({ k: 'sig', id: u.id, x: u.x, y: u.y - 34 * sizeOf(u), tx: P.x, ty: P.y, f: u.f, t: -lead, dur: D, uc: !!UC });
    B.later.push({ t: hit, fn: () => {
      if (u.dead) return;
      const t2 = tgt && !tgt.dead ? tgt : findTarget(u) || nearestEnemy(u, 400);
      for (const f of sk.fx) runFx(u, (f.at === 'cluster' || f.at === 'front' || f.at === 'target') ? { ...f, P } : f, t2, 'ult');
      B.shake = Math.max(B.shake, 0.6); B.flash = 0.22;
      B.cam = { x: P.x, y: P.y - 40, t: 0, dur: 0.7 }; sfx('boom');
      fxBurst(P.x, P.y - 40, 'burst_gold', 260); fxBurst(P.x, P.y - 30, 'ring', 380, 0);
      B.decals.push({ x: P.x, y: P.y + 4, r: 120, t: 0, dur: 4.5 });
    } });
  } else for (const f of sk.fx) runFx(u, f, tgt, w === 'ult' ? 'ult' : 'skill');
  if (w === 'small' && RM(u, 'skillZone')) {
    const P = bestCluster(70) || (tgt ? { x: tgt.x, y: tgt.y } : null);
    if (P) { B.zones = B.zones.filter(z => !(z.src === u && z.tag === 'pz')); B.zones.push({ x: P.x, y: P.y, r: 70, mult: 0.4, t: 3, dur: 3, src: u, tick: 0, color: '#ff8a3a', tag: 'pz' }); }
  }
  if (w === 'ult') { B.cutin = { id: u.id, name: sk.name, hero: u.name, t: 0 }; B.slowmo = 0.35; sfx('ult'); if (sk.fx.some(f => f.t === 'heal')) setTimeout(() => snd('heal'), 500); if (UCFG[u.id] && ['wind', 'tornado', 'sweep', 'pierce', 'throw'].includes(UCFG[u.id].t)) setTimeout(() => snd('whoosh', 1, 0.7), 350); if (scReady(u.id) && S.ultScene !== false) startScene(u, sk); }
  else { floater(u.x, u.y - 82, sk.name, '#fff3b0', 15); snd('magic'); }
  if (u.mp < 10) { u.dk = 2.5; floater(u.x, u.y - 64, 'Điều khí', '#7fd3ff', 14); }
  return true;
}
function runFx(u, f, tgt, kind) {
  const P = f.P || skillPoint(u, f, tgt);
  const col = f.color || ELEMENTS[u.el].color;
  switch (f.t) {
    case 'aoe': {
      f = { ...f, r: f.r * (1 + TG(u, 'size')), stun: f.stun ? f.stun + TG(u, 'stunPlus') : 0 };
      for (const e of enemiesIn(P, f.r)) {
        dealDmg(u, e, f.mult, kind);
        if (f.stun && !e.dead) e.stun = Math.max(e.stun, e.boss ? f.stun * 0.4 : f.stun);
        if (f.knock && !e.dead && !e.boss) {
          const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
          e.x += dx / d * f.knock; e.y += dy / d * f.knock;
        }
      }
      B.fx.push({ k: 'ring', x: P.x, y: P.y, r: f.r, color: col, t: 0, dur: 0.45 });
      B.fx.push({ k: 'flash', x: P.x, y: P.y, r: f.r * 0.8, color: col, t: 0, dur: 0.25 });
      particles(P.x, P.y - 10, col, kind === 'ult' ? 30 : 14, kind === 'ult' ? 280 : 180);
      if (f.stun) B.fx.push({ k: 'ring', x: P.x, y: P.y, r: f.r * 0.6, color: '#ffffff', t: 0, dur: 0.6 });
      B.shake = Math.max(B.shake, kind === 'ult' ? 0.35 : 0.15);
      break;
    }
    case 'line': {
      const tx = tgt ? tgt.x : u.x + u.f * 200, ty = tgt ? tgt.y : u.y - 100;
      const a = Math.atan2(ty - u.y, tx - u.x);
      const x2 = u.x + Math.cos(a) * f.len, y2 = u.y + Math.sin(a) * f.len;
      for (const e of B.enemies) {
        if (e.dead) continue;
        if (segDist(e.x, e.y, u.x, u.y, x2, y2) <= f.w / 2 + unitR(e)) {
          dealDmg(u, e, f.mult, kind);
          if (f.burn && !e.dead) { e.burn = 4; e.burnDps = getAtk(u) * 0.5; }
        }
      }
      B.fx.push({ k: 'beam', x1: u.x, y1: u.y - 25, x2, y2: y2 - 25, w: f.w, color: col, t: 0, dur: 0.5 });
      B.shake = Math.max(B.shake, 0.3);
      break;
    }
    case 'proj': {
      const base = tgt ? Math.atan2(tgt.y - u.y, tgt.x - u.x) : (u.f > 0 ? -0.6 : -2.5);
      const nn = f.n + TG(u, 'skillN');
      for (let i = 0; i < nn; i++) {
        const a = base + (nn > 1 ? (i - (nn - 1) / 2) * (f.spread * 2 / (nn - 1)) : 0);
        fireProj(u, null, { angle: a, mult: f.mult, kind, type: f.type, pierce: f.pierce, speed: 480, life: 1.3, r: 11 });
      }
      break;
    }
    case 'heal': {
      const bonus = 1 + ((u.d.passive && u.d.passive.healPct) || 0) + RM(u, 'healPct') + TG(u, 'heal') + (u.role === 'dan' ? coreBonus(u) : 0);
      if (TG(u, 'gateHeal')) { const lo = alliesAlive().sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0]; if (lo) healU(lo, maxHp(lo) * TG(u, 'gateHeal') * 1.5, true); }
      for (const a of alliesAlive()) {
        healAmD(u, a, getAtk(u) * f.mult * bonus);
        if (f.cleanse) { a.stun = 0; a.burn = 0; a.slow = 0; }
        particles(a.x, a.y - 25, '#7dffb0', 8, 90, 3.5);
      }
      B.fx.push({ k: 'ring', x: u.x, y: u.y, r: 160, color: '#7dffb0', t: 0, dur: 0.6 });
      break;
    }
    case 'shield': {
      const who = f.who === 'team' ? alliesAlive() : [u];
      for (const a of who) { a.shield = Math.max(a.shield, maxHp(a) * f.pct); a.shieldT = f.dur; }
      break;
    }
    case 'buff':
      for (const a of alliesAlive()) a.buffs.push({ k: f.k, v: f.v, t: f.dur });
      B.fx.push({ k: 'ring', x: u.x, y: u.y, r: 140, color: '#ffe58a', t: 0, dur: 0.6 });
      break;
    case 'mp':
      for (const a of alliesAlive()) if (a !== u) a.mp = Math.min(100, a.mp + f.v + TG(u, 'mpPlus'));
      break;
    case 'taunt':
      for (const e of enemiesIn(u, f.r)) { e.forced = u; e.forcedT = f.dur; }
      B.fx.push({ k: 'ring', x: u.x, y: u.y, r: f.r, color: '#ff5a5a', t: 0, dur: 0.6 });
      floater(u.x, u.y - 96, 'Khiêu khích!', '#ff8a8a', 15);
      break;
    case 'clone':
      for (let i = 0; i < f.n; i++) {
        const c = makeHero(u.id, false);
        c.base = { ...u.base }; c.bonus = { ...u.bonus };
        c.clone = true; c.life = f.dur + TG(u, 'cloneDur'); c.hp = maxHp(c) * 0.4;
        c.x = 380 + i * 46; c.y = clamp(u.y + (i ? 60 : -60), LANE_Y0 + 20, LANE_Y1 - 20);   // phân thân đứng chặn phía trước
        B.heroes.push(c);
        B.fx.push({ k: 'poof', x: c.x, y: c.y - 20, t: 0, dur: 0.5 });
      }
      break;
    case 'zone':
      B.zones = B.zones.filter(z => !(z.src === u && z.tag === f.r));
      B.zones.push({ x: P.x, y: P.y, r: f.r, mult: f.dps, t: f.dur, dur: f.dur, src: u, tick: 0, color: col, tag: f.r });
      break;
    default: break;
  }
}
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ------------------------------------------------------------------ PROJECTILES
function fireProj(u, tgt, o) {
  const a = o.angle != null ? o.angle : Math.atan2(tgt.y - u.y, tgt.x - u.x);
  const sp = o.speed || (u.side === 'h' ? 520 : 300);
  B.projs.push({
    x: u.x + u.f * 10, y: u.y - 28 * sizeOf(u), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp,
    src: u, side: u.side, mult: o.mult || 1, kind: o.kind || 'atk', type: o.type || 'light',
    homing: o.homing ? tgt : null, pierce: !!o.pierce, hit: new Set(), life: o.life || 1.6, r: o.r || 8, rot: 0,
    pat: o.pat || '', pl: o.pl == null ? null : o.pl, bounces: o.bounces || 0, dmax: o.dmax || 0, trav: 0, ret: false, age: 0,
    splitN: o.splitN || 0, spin: !!o.spin, boom: o.boom || 0, stun: o.stun || 0, child: !!o.child, spinT: 0, tickT: 0,
    dt: u.side === 'h' && !u.clone && trongOf(u) >= 5,
  });
  if (u.side === 'h' && B.fxb.length < 40) { fxBurst(u.x + u.f * 22, u.y - 30 * sizeOf(u), 'flare', 70); sfx('shoot'); }   // chớp nòng
  return B.projs[B.projs.length - 1];
}
// đòn đánh thường theo kiểu riêng của tướng (ATK_STYLE trong data.js)
function fireStyle(u, tgt) {
  const S = ATK_STYLE[u.id], q = u.qnHit || 1, sz = sizeOf(u);
  const base = Math.atan2(tgt.y - (u.y - 28 * sz), tgt.x - u.x);
  const extra = M('extraProj') + RM(u, 'extraProj') + TG(u, 'proj');
  const prc = TG(u, 'pierce');
  const c = { kind: 'atk', type: S.proj, pat: S.pat };
  switch (S.pat) {
    case 'boomerang': fireProj(u, tgt, { ...c, angle: base, mult: 0.7 * q, pierce: true, r: 22, life: 3, dmax: 520 + (S.range || 0), speed: 640 }); break;
    case 'pierce': fireProj(u, tgt, { ...c, angle: base, mult: 0.8 * q, pierce: true, pl: (S.pierceN || 3) + prc * 2, r: 16, life: 1.8, speed: 720 }); break;
    case 'bounce': fireProj(u, tgt, { ...c, homing: true, mult: q, bounces: (S.bounces || 3) + prc, r: 11, life: 3, speed: S.speed || 560 }); break;
    case 'split': fireProj(u, tgt, { ...c, homing: true, mult: q, r: 11, splitN: (S.n || 2) + prc, life: 1.8 }); break;
    case 'spin': fireProj(u, tgt, { ...c, homing: true, mult: 0.5 * q, r: 11, spin: true, life: 3 }); break;
    case 'lob': fireProj(u, tgt, { ...c, homing: true, mult: 0.9 * q, r: 11, boom: (S.boom || 80) + 15 * prc, stun: S.stun || 0, speed: 430, life: 2.2 }); break;
    case 'fan': {
      const n = (S.n || 3) + (prc ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.2;
        fireProj(u, tgt, { ...c, angle: a, homing: !!S.homing, mult: 0.62 * q, pierce: !!S.pierceN, pl: S.pierceN || null, r: 10, life: 1.5, speed: 560 });
      }
      break;
    }
    default: fireProj(u, tgt, { ...c, homing: true, mult: q });
  }
  for (let i = 0; i < extra; i++) {   // đạn phụ (tầng tướng): thêm tia thẳng hai bên
    fireProj(u, tgt, { kind: 'atk', type: S.proj, angle: base + (i % 2 ? 0.26 : -0.26) * Math.ceil((i + 1) / 2), mult: 0.55 * q, pierce: true, pl: 2, r: 10, life: 1.4 });
  }
  if (S.heal && !u.clone) {   // cứ N đòn hồi máu đồng đội yếu nhất (đúng nhịp tướng Y của VLĐMT)
    u.hc = (u.hc || 0) + 1;
    if (u.hc >= S.heal) {
      u.hc = 0;
      const al = alliesAlive().sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0];
      if (al) { healAmD(u, al, getAtk(u) * 1.1 * (1 + ((u.d.passive && u.d.passive.healPct) || 0) + RM(u, 'healPct') + TG(u, 'heal'))); particles(al.x, al.y - 25, '#7dffb0', 8, 90, 3.5); }
    }
  }
}
function updateProjs(dt) {
  const spawn = [];
  for (const p of B.projs) {
    p.life -= dt; p.rot += dt * 14; p.age += dt;
    if (p.spinT > 0) {   // đang xoay tại chỗ: cắt nhiều nhịp
      p.spinT -= dt; p.tickT -= dt; p.rot += dt * 16;
      if (p.tickT <= 0) {
        p.tickT = 0.25;
        for (const t of enemiesIn(p, 78)) dealDmg(p.src, t, p.mult, p.kind);
        particles(p.x, p.y, projColor(p.type), 5, 120, 3);
      }
      if (p.spinT <= 0) p.done = true;
      continue;
    }
    if (p.pat === 'boomerang') {
      p.trav += Math.hypot(p.vx, p.vy) * dt;
      if (!p.ret && p.trav >= p.dmax) { p.ret = true; p.hit = new Set(); }
      if (p.ret) {
        const sx = p.src.x, sy = p.src.y - 28, a2 = Math.atan2(sy - p.y, sx - p.x);
        p.vx = Math.cos(a2) * p.sp; p.vy = Math.sin(a2) * p.sp;
        if (Math.hypot(sx - p.x, sy - p.y) < 30) { p.done = true; continue; }
      }
    } else if (p.homing && !p.homing.dead) {
      const a2 = Math.atan2(p.homing.y - 25 - p.y, p.homing.x - p.x);
      p.vx = Math.cos(a2) * p.sp; p.vy = Math.sin(a2) * p.sp;
    } else if (p.homing && p.homing.dead && (p.bounces > 0 || p.pat === 'bounce')) {
      const nx = nearestEnemyTo(p, 260, p.hit);
      if (nx) p.homing = nx; else { p.done = true; continue; }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.side === 'h') { (p.hist = p.hist || []).push([p.x, p.y]); if (p.hist.length > 9) p.hist.shift(); }
    const edge = p.pat === 'boomerang' ? (p.x < -80 || p.x > W + 120) && p.ret : (p.x < -60 || p.x > VIEW_R() + 60);
    if (p.life <= 0 || edge || p.y < -80 || p.y > H) { p.done = true; continue; }
    const targets = p.side === 'h' ? B.enemies : B.heroes;
    for (const t of targets) {
      if (t.dead || p.hit.has(t)) continue;
      if (Math.hypot(t.x - p.x, t.y - 22 * sizeOf(t) - p.y) >= p.r + unitR(t)) continue;
      p.hit.add(t);
      dealDmg(p.src, t, p.mult, p.kind);
      particles(p.x, p.y, projColor(p.type), 5, 110, 3);
      if (p.side === 'h') hitFeel(p, t);
      if (p.boom) {   // ném nổ: sát thương lan
        for (const e of enemiesIn(p, p.boom)) if (e !== t) dealDmg(p.src, e, p.mult * 0.6, p.kind);
        for (const e of enemiesIn(p, p.boom)) if (p.stun) e.stun = Math.max(e.stun || 0, p.stun);
        B.fx.push({ k: 'ring', x: p.x, y: p.y + 20, r: p.boom, color: projColor(p.type), t: 0, dur: 0.35 });
        if (B.decals.length < 12) B.decals.push({ x: p.x, y: p.y + 20, r: p.boom * 0.6, t: 0, dur: 2.5 });
        particles(p.x, p.y, '#ffd9a0', 10, 170, 4);
        p.done = true; break;
      }
      if (p.spin) { p.spinT = 1.0; p.tickT = 0; p.vx = p.vy = 0; p.homing = null; break; }
      if (p.splitN && !p.child) {   // tách đạn con bay chéo
        const n = p.splitN, a0 = Math.atan2(p.vy, p.vx);
        for (let i = 0; i < n; i++) spawn.push({ x: p.x, y: p.y, a: a0 + (i - (n - 1) / 2) * 0.55, p, t });
        p.done = true; break;
      }
      if (p.bounces > 0) {   // nảy sang quái gần nhất chưa trúng
        const nx = nearestEnemyTo(p, 270, p.hit);
        if (nx) { p.homing = nx; p.bounces--; p.mult *= 0.88; p.life = Math.max(p.life, 1.2); particles(p.x, p.y, '#ffffff', 4, 90, 2.5); }
        else p.done = true;
        break;
      }
      if (p.pl != null) { p.pl--; if (p.pl <= 0) { p.done = true; break; } }
      else if (!p.pierce) { p.done = true; break; }
    }
  }
  for (const s of spawn) {
    B.projs.push({
      x: s.x, y: s.y, vx: Math.cos(s.a) * 520, vy: Math.sin(s.a) * 520, sp: 520, src: s.p.src, side: s.p.side, mult: s.p.mult * 0.6, kind: s.p.kind,
      type: s.p.type, homing: null, pierce: false, pl: 1, hit: new Set([s.t]), life: 0.9, r: 10, rot: 0, pat: '', bounces: 0, dmax: 0, trav: 0, ret: false, age: 0,
      splitN: 0, spin: false, boom: 0, stun: 0, child: true, spinT: 0, tickT: 0,
    });
  }
  B.projs = B.projs.filter(p => !p.done);
}
// cảm giác trúng đòn: tia sáng xoè tại điểm trúng, vệt cắt, đồng hồ Hits của tướng
function hitFeel(p, t) {
  const col = projColor(p.type), a = Math.atan2(p.vy, p.vx);
  B.sparks.push({ x: t.x, y: t.y - 24 * sizeOf(t), a, col, t: 0, dur: 0.22, big: p.kind !== 'atk' });
  sfx(p.kind !== 'atk' ? 'hitBig' : 'hit');
  if (B.fxb.length < 40) fxBurst(t.x, t.y - 24 * sizeOf(t), (PFX[p.type] || {}).burst || 'burst_gold', p.kind !== 'atk' ? 150 : 95, Math.random() * 6);
  if (p.src && p.src.side === 'h') {
    const h = B.hits; if (h.id !== p.src.id || h.t <= 0) h.n = 0;
    h.id = p.src.id; h.n++; h.t = 1.4;
  }
}
function nearestEnemyTo(p, maxD, skip) {
  let best = null, bd = maxD;
  for (const e of B.enemies) {
    if (e.dead || (skip && skip.has(e))) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function projColor(t) {
  return { ring: '#ffd34d', light: '#fff6c2', foxfire: '#ff7ad9', fire: '#ff7a2e', bead: '#ffcf4a',
           arrow: '#e8e0d0', fireball: '#ff5a2a', staff: '#ffd34d', crescent: '#cfe0f0', rake: '#c8d0d8', spear: '#bfe0ff', drop: '#9fe8ff', bolt: '#bfe0ff', pearl: '#ffe58a', fan: '#7fe8a0', pill: '#ffb347', pagoda: '#ffd34d', moon: '#eaf0ff', bone: '#f0e8d8' }[t] || '#ffffff';
}

// ------------------------------------------------------------------ UPDATE UNITS
function tickUnit(u, dt) {
  u.t += dt;
  if (u.hurt > 0) u.hurt -= dt;
  // tướng có rig vung vũ khí chậm hơn để thấy rõ động tác lấy đà → đập
  if (u.atkAnim >= 0) { u.atkAnim += dt * (hasRig(u.id) ? 2.4 : u.side === 'e' ? 2.8 : 4.5); if (u.atkAnim > 1) u.atkAnim = -1; }
  if (u.castT > 0) u.castT -= dt;
  if (u.hitT > 0) u.hitT -= dt;
  u.cdA -= dt;
  if (u.stun > 0) u.stun -= dt;
  if (u.slow > 0) u.slow -= dt;
  if (u.inv > 0) u.inv -= dt;
  if (u.dhT > 0) u.dhT -= dt;
  if (u.tearT > 0) {
    u.tearT -= dt; u.tearTick = (u.tearTick || 0) - dt;
    if (u.tearTick <= 0) { u.tearTick = 0.5; rawDmg(u, u.tearDps * u.tear * 0.5, '#d68aff'); if (M('tearDef')) u.defDown = Math.min(0.2, (u.defDown || 0) + 0.04); }
    if (u.tearT <= 0) u.tear = 0;
  }
  if (u.burn > 0) {
    u.burn -= dt; u.burnTick = (u.burnTick || 0) - dt;
    if (u.burnTick <= 0) { u.burnTick = 0.5; rawDmg(u, u.burnDps * 0.5, '#ff9a4d'); }
  }
  if (u.buffs.length) u.buffs = u.buffs.filter(b => (b.t -= dt) > 0);
  if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shield = 0; }
}
function findTarget(u) {
  if (u === B.cap && B.capTgt && !B.capTgt.dead && (u.ranged || dist(u, B.capTgt) <= u.range + unitR(B.capTgt))) return B.capTgt;
  let best = null, bd = 1e9;
  for (const e of B.enemies) {
    if (e.dead || e.x > VIEW_R() + 5 || e.under || (e.hidden && !(e.revealT > 0)) || (e.flyH && !u.ranged)) continue;
    const d = dist(u, e);
    if (d > u.range + unitR(e)) continue;
    const score = u.ranged ? e.x + (e.boss ? -60 : 0) : d;   // đánh xa: con tiến sâu nhất trước
    if (score < bd) { bd = score; best = e; }
  }
  return best;
}
function tryAttack(u, tgt) {
  if (u.cdA > 0 || !tgt || tgt.dead) return;
  if (u.side === 'h' && !u.clone) {
    if (u.dk > 0) return;                           // đang điều khí (nạp lại chưởng)
    u.ammo = (u.ammo == null ? ammoMax(u) : u.ammo) - (M('freeShot') && Math.random() < M('freeShot') ? 0 : 1);   // Thuấn Di Độn Pháp: 15% không tốn lượt
    if (M('tp') && Math.random() < 0.5) u.tp = Math.min(10 + M('tpMax'), (u.tp || 0) + 1);
    if (M('vn')) u.vn = (u.vn || 0) >= 5 + M('vnMax') ? 1 : (u.vn || 0) + 1;
    u.qnHit = 1;
    if (u.ammo <= 0) {   // hết chưởng → điều khí; Phong Thế / Kiếm Ý mất hết
      let t = 2.0 / (u.isCap ? 1.2 : 1);
      if (RM(u, 'coreEvo')) t *= 1 - Math.min(0.175, 0.035 * sysTang(u.role));   // [VLĐMT] −3,5%/cấp, tối đa −17,5%
      if (M('tuthanEvo') && trongOf(u) >= 5) t *= 0.95;   // [VLĐMT] −5%
      u.dk = t; u.tp = 0; u.vn = 0;
    }
  } else u.qnHit = 1;
  u.cdA = 1 / getAspd(u); u.atkAnim = 0;
  u.f = tgt.x >= u.x ? 1 : -1;
  if (u.ranged && u.side === 'h' && ATK_STYLE[u.id]) {
    fireStyle(u, tgt);
  } else if (u.ranged) {
    const n = 1 + (u.side === 'h' ? M('extraProj') + RM(u, 'extraProj') + TG(u, 'proj') : 0);
    for (let i = 0; i < n; i++) {
      if (i === 0) fireProj(u, tgt, { kind: 'atk', type: u.proj, homing: u.side === 'h' && !PIERCE_PROJ[u.proj] && !TG(u, 'pierce'), pierce: !!PIERCE_PROJ[u.proj] || !!TG(u, 'pierce'),
                                      mult: (PIERCE_PROJ[u.proj] ? 0.75 : 1) * u.qnHit, r: PIERCE_PROJ[u.proj] ? 18 : u.proj === 'boulder' ? 14 : 8, life: 1.6 });
      else fireProj(u, tgt, { kind: 'atk', type: u.proj, angle: Math.atan2(tgt.y - u.y, tgt.x - u.x) + (i % 2 ? 0.2 : -0.2) * Math.ceil(i / 2), mult: 0.7 });
    }
  } else {
    dealDmg(u, tgt, 1, 'atk');
    B.fx.push({ k: 'slash', x: u.x + u.f * 16, y: u.y - 26 * sizeOf(u), f: u.f, t: 0, dur: 0.2,
                color: u.side === 'h' ? '#ffffff' : '#ffb0b0', s: sizeOf(u) });
  }
}
function moveTo(u, x, y, step) {
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
  if (d < 1) { u.walk = false; return; }
  const s = Math.min(step, d);
  u.x += dx / d * s; u.y += dy / d * s; u.walk = true;
  if (Math.abs(dx) > 1) u.f = dx > 0 ? 1 : -1;
}
function separate(list, gap) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const min = (unitR(a) + unitR(b)) * 0.9 + gap;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < min) {
        const push = (min - d) / 2;
        const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1;
        a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
        b.x += dx / d * push * wb; b.y += dy / d * push * wb;
      }
    }
  }
}

function updateHeroes(dt) {
  const gc = (B.mods['dan.gateCore'] || 0) * sysTang('dan');
  if (gc > 0) {
    B.gateT -= dt;
    if (B.gateT <= 0) { B.gateT = 10; for (const a of alliesAlive()) healU(a, maxHp(a) * gc * 0.5, true); }
  }
  updateField(dt);
  if (M('ad1')) {
    B.amT -= dt;
    if (B.amT <= 0) { B.amT = 5; B.amMode = B.amMode === 'am' ? 'duong' : 'am'; floater(W * 0.22, 120, B.amMode === 'am' ? 'Âm: công +' + Math.round((0.2 + M('ad1Evo')) * 100) + '%' : 'Dương: hồi máu', B.amMode === 'am' ? '#c08aff' : '#7dffb0', 16); }
    for (const h of B.heroes) {
      if (h.dead || h.clone) continue;
      if (B.amMode === 'am') { const l = h.hp * 0.04 * dt; h.hp = Math.max(1, h.hp - l); if (M('ad2')) adLose(h, l); }
      else healU(h, maxHp(h) * 0.025 * dt, true);
    }
  }
  if (M('kcEvo')) { B.kcT -= dt; if (B.kcT <= 0) { B.kcT = 12; for (const h of B.heroes) if (!h.dead) { h.inv = 2; particles(h.x, h.y - 30, '#ffe58a', 8, 90); } floater(W * 0.25, 110, 'Bát Bảo Kim Thân!', '#ffe58a', 18); } }
  for (const u of B.heroes) {
    if (u.dead) { u.deathT += dt; continue; }
    tickUnit(u, dt);
    if (u.clone) { u.life -= dt; if (u.life <= 0) { u.dead = true; u.gone = true; B.fx.push({ k: 'poof', x: u.x, y: u.y - 20, t: 0, dur: 0.5 }); continue; } }
    else {
      const regen = 8 * (1 + M('mpRegen') + (u.isCap ? 0.15 : 0) + teamAura('teamMp')) * (u.dk > 0 ? 2 : 1);
      if (B.capRegen && u.hp < maxHp(u)) u.hp = Math.min(maxHp(u), u.hp + maxHp(u) * B.capRegen * dt);   // đội trưởng hệ Linh Y: hồi máu cả đội
      u.mp = Math.min(100, u.mp + regen * dt);
      if (u.dk > 0) { u.dk -= dt; if (u.dk <= 0) { u.ammo = ammoMax(u); u.qn = 3; } }
      u.cdS -= dt; u.cdU -= dt;
      const pa = u.d.passive;
      if ((pa && pa.regen) || TG(u, 'regen')) healU(u, maxHp(u) * (((pa && pa.regen) || 0) + TG(u, 'regen')) * dt, true);
      const st = RM(u, 'shieldTick');
      if (st) { u.shT = (u.shT == null ? 8 : u.shT) - dt; if (u.shT <= 0) { u.shT = 8; u.shield = Math.max(u.shield, maxHp(u) * st); u.shieldT = 6; } }
    }
    u.walk = false;
    if (u.slot) { u.x = u.slot[0]; u.y = u.slot[1]; }   // đứng yên tại ô (không bị đẩy lùi)
    if (u.stun > 0) continue;
    const tgt = findTarget(u);
    if (tgt) { tryAttack(u, tgt); if (u.atkAnim >= 0) u.f = tgt.x >= u.x ? 1 : -1; } else u.f = 1;
    // chiêu nhỏ luôn tự dùng; tuyệt kỹ: tự dùng khi bật Tự động (hoặc đồng đội không phải đội trưởng)
    if (!u.clone) autoSkills(u, tgt, !!B.auto);   // chưa bật Tự động: tuyệt kỹ chỉ ra khi người chơi bấm
  }
  B.heroes = B.heroes.filter(h => !h.gone);
}
function wantCast(u, w, tgt) {
  const fx = u.d[w].fx;
  if (fx.some(f => f.t === 'heal')) {
    const low = alliesAlive().some(a => a.hp < maxHp(a) * (w === 'ult' ? 0.55 : 0.8));
    return low;
  }
  if (fx.some(f => f.t === 'mp' || f.t === 'buff') && !fx.some(f => f.t === 'aoe')) return aliveEnemies().length > 0;
  if (fx.some(f => f.t === 'taunt' || f.t === 'shield') && fx[0].at === 'self') return enemiesIn(u, 150).length >= 2;
  if (!tgt) return false;
  if (dist(u, tgt) > Math.max(u.range, 120) + 80) return false;
  if (w === 'ult') return enemiesIn(tgt, 220).length >= 3 || tgt.boss || tgt.elite;
  return true;
}
function autoSkills(u, tgt, ultOk) {
  if (ultOk) { const cr = comboFor(u); if (cr) { if (cr.ready) { if (B.auto) { castCombo(cr.c); return; } ultOk = false; } else if (cr.near && canCast(u, 'ult')) ultOk = false; } }   // chờ đồng đội để hợp kích
  if (ultOk && canCast(u, 'ult') && wantCast(u, 'ult', tgt)) { cast(u, 'ult'); return; }
  // để dành nội công cho tuyệt kỹ khi tuyệt kỹ đã hồi
  if (ultOk && u.cdU <= 0 && u.mp < 90) return;
  if (!ultOk && u.cdU <= 0 && u.mp < 75) return;   // người chơi tự bấm tuyệt kỹ: chừa nội công
  if (canCast(u, 'small') && wantCast(u, 'small', tgt)) cast(u, 'small');
}

function updateEnemies(dt) {
  for (const e of B.enemies) {
    if (e.dead) { e.deathT += dt; if (e.deathT > 0.45) e.gone = true; continue; }
    tickUnit(e, dt);
    if (e.stun > 0) { e.walk = false; continue; }
    if (e.forcedT > 0) e.forcedT -= dt;
    if (e.boss && !e.entered) { // boss tiến vào sân trước rồi mới đánh
      moveTo(e, W - 250, H * 0.56, e.move * 2.2 * dt);
      if (e.x <= W - 245) e.entered = true;
      continue;
    }
    if (e.boss) bossSpecial(e, dt);
    if (e.trait && traitTick(e, dt)) continue;
    let tgt = null;
    if (e.forced && !e.forced.dead && e.forcedT > 0) tgt = e.forced;
    else {
      const aggro = e.ranged ? e.range + 40 : (e.boss ? 600 : 120);
      let bd = aggro;
      for (const h of B.heroes) { if (h.dead) continue; const d = dist(e, h); if (d < bd) { bd = d; tgt = h; } }
    }
    const sp = e.move * (e.slow > 0 ? 0.6 : 1) * (1 + buffSum(e, 'aspd') * 0.5);
    if (tgt) {
      const d = dist(e, tgt);
      const reach = e.range + (e.ranged ? 0 : unitR(tgt) + unitR(e) * 0.5);
      if (d > reach) moveTo(e, tgt.x, tgt.y, sp * dt);
      else {
        e.walk = false; e.f = tgt.x >= e.x ? 1 : -1;
        if (e.cdA <= 0) {
          e.cdA = 1 / getAspd(e); e.atkAnim = 0;
          if (e.ranged) fireProj(e, tgt, { kind: 'atk', type: e.proj, speed: 300, r: 7 });
          else {
            dealDmg(e, tgt, 1, 'atk');
            B.fx.push({ k: 'slash', x: e.x + e.f * 16 * sizeOf(e), y: e.y - 24 * sizeOf(e), f: e.f, t: 0, dur: 0.2, color: '#ffb0b0', s: sizeOf(e) });
          }
        }
      }
    } else {
      const hh = nearestHero(e, 5000);
      if (hh) moveTo(e, hh.x, hh.y, sp * dt); else e.walk = false;
    }
  }
  separate(B.enemies.filter(e => !e.dead), 0);
  for (const e of B.enemies) { if (!e.dead) e.y = clamp(e.y, LANE_Y0 - 40, LANE_Y1 + 20); }   // giữ quái trong dải đường
  B.enemies = B.enemies.filter(e => !e.gone);
}
function bossSpecial(e, dt) {
  e.special -= dt;
  const PH = e.d.phases;
  if (PH) {   // boss nhiều giai đoạn (GDD: boss chương có nhiều giai đoạn)
    const nx = PH[e.phase - 1];
    if (nx && e.hp < maxHp(e) * nx.at) {
      e.phase++; e.phaseT = performance.now(); snd('roar', 1, 0.85);
      if (e.phase > PH.length && formImg(e.id)) { e.form = true; startBossScene(e, nx.text || 'Biến hình!'); }
      if (nx.enrage) e.buffs.push({ k: 'aspd', v: nx.enrage, t: 9999 });
      if (nx.heal) e.hp = Math.min(maxHp(e), e.hp + maxHp(e) * nx.heal);
      if (B.mech === 'multiphase') {   // Vạn Tiên Trận: mỗi lần đổi giai đoạn boss bất tử 2 giây và giáng sấm lên cả đội
        e.inv = 2; for (const h of B.heroes) if (!h.dead) B.warns.push({ x: h.x, y: h.y, r: 60, t: 1.6, dur: 1.6, src: e, mult: 1.6 });
      }
      if (nx.shield) { e.shield = Math.max(e.shield || 0, maxHp(e) * nx.shield); e.shieldT = 30; }
      B.banner = { text: nx.text, sub: nx.sub, t: 0, boss: true }; B.shake = 0.5;
      if (nx.summon) for (let i = 0; i < nx.summon[1]; i++) B.enemies.push(makeEnemy(nx.summon[0], B.st.lvl, clamp(e.x + rand(-120, 120), 30, W - 30), e.y + rand(-40, 40)));
      if (typeof fxBurst === 'function') { fxBurst(e.x, e.y - 60, e.d.forms ? 'smoke' : 'burst_gold', 320); fxBurst(e.x, e.y - 40, 'petal', 260); }
    }
  } else if (e.phase === 1 && e.hp < maxHp(e) * 0.5) {
    e.phase = 2;
    e.buffs.push({ k: 'aspd', v: 0.3, t: 9999 });
    B.banner = { text: 'Cửu Vĩ hiện nguyên hình!', sub: 'Boss mạnh hơn, gọi thêm tiểu yêu', t: 0, boss: true };
    for (let i = 0; i < 4; i++) B.enemies.push(makeEnemy('tieuyeu', B.st.lvl, clamp(e.x + rand(-120, 120), 30, W - 30), e.y + rand(-30, 30)));
    B.shake = 0.5;
  }
  if (e.special <= 0) {
    e.special = e.phase >= 2 ? 4 : 5.5;
    e.castT = 0.6;
    const live = B.heroes.filter(h => !h.dead);
    if (!live.length) return;
    if (PH && Math.random() < 0.3) {   // Mị Hoặc: hôn gió làm 1–2 tướng đứng yên
      for (const h of live.slice().sort(() => Math.random() - 0.5).slice(0, e.phase >= 3 ? 2 : 1)) { h.stun = Math.max(h.stun || 0, 1.4); floater(h.x, h.y - 80, 'Mê hoặc!', '#ff7ad9', 15); if (typeof fxBurst === 'function') fxBurst(h.x, h.y - 40, 'petal', 140); }
    } else if (Math.random() < 0.5) {
      const tg = live.slice().sort(() => Math.random() - 0.5).slice(0, e.phase === 2 ? 4 : 3);
      for (const h of tg) B.warns.push({ x: h.x, y: h.y, r: 70, t: 1.3, dur: 1.3, src: e, mult: 2.2 });
    } else {
      const tgt = B.cap && !B.cap.dead ? B.cap : live[0];
      const n = e.phase === 2 ? 9 : 7, a0 = Math.atan2(tgt.y - e.y, tgt.x - e.x);
      for (let i = 0; i < n; i++) fireProj(e, null, { angle: a0 + (i - (n - 1) / 2) * 0.17, mult: 1.2, kind: 'skill', type: 'fireball', speed: 250, r: 13, life: 3.5 });
    }
  }
}
function updateZones(dt) {
  for (const z of B.zones) {
    z.t -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = 0.5; for (const e of enemiesIn(z, z.r)) dealDmg(z.src, e, z.mult * 0.5, 'dot'); }
  }
  B.zones = B.zones.filter(z => z.t > 0);
  for (const w of B.warns) {
    w.t -= dt;
    if (w.t <= 0) {
      for (const h of B.heroes) if (!h.dead && dist(h, w) <= w.r + unitR(h) * 0.5) dealDmg(w.src, h, w.mult, 'skill');
      B.fx.push({ k: 'ring', x: w.x, y: w.y, r: w.r, color: '#ff5a2a', t: 0, dur: 0.4 });
      B.fx.push({ k: 'flash', x: w.x, y: w.y, r: w.r, color: '#ff7a2e', t: 0, dur: 0.3 });
      particles(w.x, w.y, '#ff7a2e', 14, 200);
      B.shake = Math.max(B.shake, 0.2);
    }
  }
  B.warns = B.warns.filter(w => w.t > 0);
}
function updateFx(dt) {
  for (const l of B.later) { l.t -= dt; if (l.t <= 0 && !l.done) { l.done = true; l.fn(); } }
  B.later = B.later.filter(l => !l.done);
  if (B.flash > 0) B.flash -= dt;
  for (const b of B.fxb) b.t += dt; B.fxb = B.fxb.filter(b => b.t < b.dur);
  for (const d of B.decals) d.t += dt; B.decals = B.decals.filter(d => d.t < d.dur);
  if (B.cam && (B.cam.t += dt) > B.cam.dur) B.cam = null;
  for (const g of B.ghosts) g.t += dt; B.ghosts = B.ghosts.filter(g => g.t < 0.22);
  for (const s of B.sparks) s.t += dt; B.sparks = B.sparks.filter(s => s.t < s.dur);
  if (B.hits.t > 0) B.hits.t -= dt;
  for (const f of B.fx) f.t += dt;
  B.fx = B.fx.filter(f => f.t < f.dur);
  for (const p of B.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.97; }
  B.parts = B.parts.filter(p => p.life > 0);
  if (B.parts.length > 600) B.parts.splice(0, B.parts.length - 600);
  for (const f of B.floaters) f.t += dt;
  B.floaters = B.floaters.filter(f => f.t < 0.9);
  if (B.floaters.length > 90) B.floaters.splice(0, B.floaters.length - 90);
  if (B.shake > 0) B.shake = Math.max(0, B.shake - dt * 1.8);
  if (B.gateHurt > 0) B.gateHurt -= dt;
  if (B.banner) { B.banner.t += dt; if (B.banner.t > 1.8) B.banner = null; }
  if (B.cutin) { B.cutin.t += dt; if (B.cutin.t > 0.8) B.cutin = null; }
  if (B.tgtMark > 0) B.tgtMark -= dt;
}


// ---- HƯỚNG DẪN TÂN THỦ có tiêu điểm: khoét sáng mục tiêu, hình minh hoạ, tạm dừng trận
function worldToScreen(wx, wy) { const r = cv.getBoundingClientRect(); return { x: r.left + (GATE_X + (wx - GATE_X) * VIEW_Z) * scale, y: r.top + (H * VIEW_PY + (wy - H * VIEW_PY) * VIEW_Z) * scale }; }
function coach(key, o) {
  S.tut = S.tut || {}; if (S.tut[key] || S.tut.all || (B && B.over) || document.querySelector('.coach')) return false;
  S.tut[key] = 1; save();
  let R = null;
  if (o.sel) { const el = document.querySelector(o.sel); if (el) { const b = el.getBoundingClientRect(); R = { x: b.left - 8, y: b.top - 8, w: b.width + 16, h: b.height + 16 }; } }
  if (!R && o.world) { const p = worldToScreen(o.world.x, o.world.y), s = (o.world.r || 60) * scale; R = { x: p.x - s, y: p.y - s * 1.3, w: s * 2, h: s * 2 }; }
  const wasPaused = B ? B.paused : false; if (B) B.paused = true;
  const ov = document.createElement('div'); ov.className = 'coach';
  const vw = window.innerWidth, vh = window.innerHeight, below = R ? R.y + R.h / 2 < vh / 2 : true;
  const bx = R ? Math.max(12, Math.min(vw - 352, R.x + R.w / 2 - 170)) : vw / 2 - 170, by = R ? (below ? R.y + R.h + 18 : Math.max(12, R.y - 190)) : vh * 0.3;
  ov.innerHTML = `${R ? `<div class="coach-hole" style="left:${R.x}px;top:${R.y}px;width:${R.w}px;height:${R.h}px"></div><div class="coach-arrow ${below ? 'up' : 'down'}" style="left:${R.x + R.w / 2 - 14}px;top:${below ? R.y + R.h + 2 : R.y - 26}px"></div>` : '<div class="coach-dim"></div>'}
    <div class="coach-box" style="left:${bx}px;top:${by}px">${o.img ? `<img src="${o.img}" alt="">` : ''}<div><b>${o.title}</b><p>${o.text}</p>
    <div class="coach-btns"><button class="coach-skip">Bỏ qua hướng dẫn</button><button class="coach-ok">Đã hiểu</button></div></div></div>`;
  const close = () => { ov.remove(); if (B) { B.paused = wasPaused; lastT = performance.now(); } };
  ov.querySelector('.coach-ok').onclick = close;
  ov.querySelector('.coach-skip').onclick = () => { S.tut.all = 1; save(); close(); };
  document.body.appendChild(ov); return true;
}
function coachTick() {   // các bước theo thời điểm trong trận đầu
  if (!B || B.over || B.paused || (S.tut && S.tut.all)) return;
  if (B.time > 1.2) coach('c_prog', { sel: '#hProg', title: 'Tiến độ ải', text: 'Quái kéo tới <b>đánh thẳng vào tướng</b>. Cả đội ngã là thua. Thanh này cho biết đã qua bao nhiêu đợt: mốc <b>⚔</b> là địch mạnh, <b>👹</b> là quái đông, <b>☠</b> là boss. Diệt hết các đợt để thắng.' });
  if (B.time > 4) { const e = B.enemies.find(x => !x.dead && x.x < VIEW_R() - 40); if (e) coach('c_tap', { world: { x: e.x, y: e.y - 30, r: 55 }, img: 'art/ui/ic_battle.webp', title: 'Chạm để nhắm', text: 'Tướng tự đánh. <b>Chạm vào quái</b> để <b>đội trưởng</b> (có vương miện 👑) tập trung đánh con đó.' }); }
  const rd = document.querySelector('#teamBar .tm.ready'); if (rd) coach('c_ult', { sel: '#teamBar .tm.ready', img: rd.querySelector('img') && rd.querySelector('img').src, title: 'Tung tuyệt kỹ', text: 'Thẻ tướng <b>bốc lửa</b> là đã đầy nộ. <b>Chạm thẻ</b> (hoặc phím 1–5) để tung tuyệt kỹ.' });
  if (B.time > 40) coach('c_tools', { sel: '#bAuto', title: 'Tự động và Hiệu ứng', text: 'Bật <b>Tự động</b> để máy tự tung tuyệt kỹ. Bấm nút <b>★ Hiệu ứng</b> bên cạnh để xem mọi buff đội đang có.' });
}
function tutor(key, text) {
  if (!S.tut) S.tut = {}; if (S.tut[key]) return; S.tut[key] = 1; save();
  const t = document.createElement('div'); t.className = 'tutor'; t.innerHTML = '<b>Hướng dẫn</b>' + text + '<small>Chạm để đóng</small>';
  t.onclick = () => t.remove(); ui.appendChild(t); setTimeout(() => t.remove(), 7000);
}
function updateMech(dt) {   // cơ chế riêng chương (GDD §2): bẫy (Thập Tuyệt Trận), lửa (Hoả Diệm Sơn)
  if (!B.mech || B.over) return;
  if (B.mech === 'summon') {   // Kim Ngâu & Tam Tiêu: boss gọi quái theo đợt, mỗi đợt đông hơn
    const bo = B.enemies.find(e => e.boss && !e.dead && e.entered);
    if (bo) { B.mechT -= dt; if (B.mechT <= 0) { B.mechT = 11; bo.callN = (bo.callN || 1) + 1; const t = (CHAPTERS[B.st.chap].mobs || {}).tieuyeu || 'tieuyeu';
      for (let i = 0; i < Math.min(6, bo.callN); i++) B.enemies.push(makeEnemy(t, B.st.lvl, clamp(bo.x + rand(-140, 60), 40, W - 30), bo.y + rand(-60, 60)));
      B.banner = { text: 'Boss gọi viện binh!', sub: 'Đợt ' + bo.callN, t: 0, small: true }; } }
    return;
  }
  if (B.mech === 'traps' || B.mech === 'fire') {
    B.mechT -= dt; if (B.mechT > 0) return;
    const src = B.enemies.find(e => !e.dead); const live = B.heroes.filter(h => !h.dead && !h.clone);
    if (!src || !live.length) { B.mechT = 1; return; }
    B.mechT = B.mech === 'traps' ? 5 : 4;
    const h = pick(live), r = B.mech === 'fire' ? 80 : 60;
    B.warns.push({ x: h.x + rand(-20, 20), y: h.y + rand(-10, 10), r, t: 1.4, dur: 1.4, src, mult: B.mech === 'fire' ? 1.0 : 1.3 });
    if (B.mech === 'fire') B.decals.push({ x: h.x, y: h.y + 4, r: 70, t: 0, dur: 3 });
  }
}
function update(dt) {
  if (B && !B.over) updateMech(dt);
  coachTick();
  if (false && B && !B.over && B.time > 1.5 && B.time < 1.6) tutor('tap', 'Tướng tự đánh. <b>Chạm vào quái</b> để đội trưởng (vòng vàng) nhắm đánh con đó.');
  if (false && B && !B.over && B.heroes.some(h => !h.dead && h.mp >= 60)) tutor('ult', 'Thẻ tướng phát sáng <b>TUYỆT KỸ</b> → chạm thẻ để tung tuyệt kỹ.');
  if (B && !B.over && B.mech) tutor('mech_' + B.mech, { traps: 'Thập Tuyệt Trận: <b>vòng đỏ</b> là bẫy sắp nổ — chạm quái khác để đội trưởng tránh dồn chỗ.', speed: 'Thiên Cung: quái chạy <b>nhanh hơn</b>, dùng tuyệt kỹ sớm.', fire: 'Hoả Diệm Sơn: <b>lửa</b> rơi xuống chỗ tướng đứng định kỳ.', fog: 'Thuỷ tộc: nước đục che <b>nửa phải</b> màn hình.' }[B.mech] || '');
  if (B.over) { updateFx(dt); if (B.endT != null && (B.endT -= dt) <= 0) { B.endT = null; showResult(); } return; }
  B.time += dt;
  while (B.spawnQ.length && B.spawnQ[0].at <= B.time) spawnEnemy(B.spawnQ.shift());
  B.alive = 0; for (const e of B.enemies) if (!e.dead) B.alive++;
  updateHeroes(dt);
  updateEnemies(dt);
  updateProjs(dt);
  updateZones(dt);
  updateDrops(dt);
  updateFx(dt);
  const last = B.wave >= B.st.waves.length - 1;
  const cleared = B.spawnQ.length === 0 && B.enemies.every(e => e.dead);
  if (cleared && B.drops.length === 0) {
    if (last) endBattle(true);
    else if (B.nextT == null) B.nextT = B.time + 1.4;
  } else if (!last && B.spawnQ.length === 0 && B.nextT == null && B.time - B.waveStart > (B.waveDef.gap || 30) && !(B.enemies.some(e => e.boss && !e.dead))) {
    B.nextT = B.time; // sóng ra theo thời gian, không chờ dọn xong (kiểu VLĐMT)
  }
  if (B.nextT != null && B.time >= B.nextT && !B.over) nextWave();
  if (B.st.raid && !B.over && B.time >= B.st.raid) endBattle(true, 'Hết giờ');
  if (!B.heroes.some(h => !h.dead && !h.clone)) { if (!offerRevive('team')) endBattle(false, 'Cả đội đã trọng thương'); }
}

function offerRevive(why) {   // hồi sinh 1 lần/trận bằng ngọc (sau này có thể xem quảng cáo)
  if (B.revUsed || B.paused || B.over) return false;
  B.revUsed = true; B.paused = true;
  const w = document.createElement('div'); w.className = 'modal pause-modal';
  w.innerHTML = `<h3>Cả đội trọng thương!</h3><p class="res-reason">Hồi sinh: cả đội hồi 60% máu, bất tử 2 giây, đẩy lùi quái gần.</p>
    <button class="btn gold" id="rvY">Hồi sinh ${icon('ngoc')}100</button><button class="btn" id="rvN">Bỏ cuộc</button>`;
  ui.appendChild(w);
  $('#rvY').onclick = () => {
    if (S.ngoc < 100) { toast('Không đủ ngọc'); return; }
    S.ngoc -= 100; save(); w.remove(); B.paused = false; lastT = performance.now();
    for (const h of B.heroes) if (!h.clone) { h.dead = false; h.hp = Math.max(h.hp, maxHp(h) * 0.6); h.inv = 2; h.dk = 0; }
    for (const e of B.enemies) if (!e.dead && !e.boss && e.x < W * 0.5) e.x = Math.min(W - 20, e.x + 180);
    B.banner = { text: 'HỒI SINH!', sub: '', t: 0, boss: true }; fxBurst(W * 0.25, H * 0.55, 'burst_gold', 420); B.flash = 0.3; buildTeamBar();
  };
  $('#rvN').onclick = () => { w.remove(); B.paused = false; endBattle(false, 'Cả đội đã trọng thương'); };
  return true;
}

// ---- TIẾN TRÌNH: qua boss chương nhận Thần Tướng (R → SR → SSR theo cốt truyện)
const CH_HERO = { 1: 'batgioi', 2: 'nata', 3: 'litinh', 4: 'duongtang', 5: 'honghainhi', 6: 'khuongtanha', 7: 'satang', 8: 'ngokhong', 9: 'thietphien', 10: 'duongtien', 11: 'tieubachlong', 12: 'quanam' };
function chapterReward(st) {   // gọi khi thắng lần đầu ải boss cuối chương
  const ch = CHAPTERS[st.chap]; if (!ch || st.kind !== 'boss' || st !== STAGES.filter(x => x.chap === st.chap).pop()) return null;
  const id = CH_HERO[ch.id]; if (!id || !HEROES[id]) return null;
  if (S.owned[id]) { S.owned[id].shard += DUP_SHARDS[HEROES[id].rar] * 2; return { id, dup: true }; }
  S.owned[id] = newRec(); if (S.lineup.length < 5) S.lineup.push(id); return { id, dup: false };
}
function endBattle(win, reason) {
  if (B.over) return;
  if (B.st.raid) win = true;
  B.over = true; B.win = win; B.reason = reason || '';
  B.endT = win ? 1.2 : 1.0;
  B.stars = win ? 1 + (B.deaths === 0 ? 1 : 0) + (B.time <= B.st.par ? 1 : 0) : 0;
  B.reward = { ngoc: 0, vang: 0 };
  if (B.st.raid) { const d = Math.round(B.raidDmg || 0), wk = weekKey(); S.raidBest = S.raidBest || {}; if (d > (S.raidBest[wk] || 0)) S.raidBest[wk] = d;
    const tier = RAID_TIER.filter(t => d >= t[0]).pop(); B.st.reward = { ngoc: tier ? tier[1] : 20, vang: Math.round(d / 50) }; B.raidScore = d; lbPush(); win = true; }
  qAdd('fight'); if (win) qAdd('win'); wqAdd('fight'); if (win) wqAdd('win'); if (B.st.tower && win) wqAdd('tower'); if (B.st.raid) wqAdd('raid'); qAdd('kill', B.kills || 0);
  if (win) {
    if (B.st.tower) { S.tower = Math.max(S.tower || 0, B.st.floor); lbPush(); }
    if (B.st.nan) { const N = nanState(); if (N.run) { if (B.st.nanN > N.best) setTimeout(lbPush, 500); N.best = Math.max(N.best, B.st.nanN); N.run.n = B.st.nanN + 1; if (N.run.n <= 81) N.run.pick = nanPick3(); } }
    if (B.st.pb) { const P = PB[B.st.pb], d = B.st.pbD, r = P.rew(d); B.st.reward = { ngoc: 0, vang: (r.vang || 0) + (P.perKill ? P.perKill[d] * (B.kills || 0) : 0) };
      if (r.univ) { S.univ += r.univ; B.reward.univ = r.univ; }
      if (P.items) { B.reward.items = []; for (let k = 0; k < P.items[d]; k++) { const it = rollEquip({ kind: d >= 2 ? 'boss' : 'elite', chap: PB_DIFF[d].ch }); (S.items = S.items || []).push(it); B.reward.items.push(it); } B.reward.item = B.reward.items[0]; } }
    const first = !S.cleared[B.st.id] && !B.st.pb;
    if (first && typeof B.si === 'number') B.chRew = chapterReward(B.st);
    B.reward.ngoc = first || B.st.pb ? B.st.reward.ngoc : Math.round(B.st.reward.ngoc * 0.2);
    B.reward.vang = first || B.st.pb ? B.st.reward.vang : Math.round(B.st.reward.vang * 0.5);
    S.ngoc += B.reward.ngoc; S.vang += B.reward.vang;
    if (!B.st.pb) S.cleared[B.st.id] = Math.max(S.cleared[B.st.id] || 0, B.stars);
    const dropP = B.st.pb ? 0 : B.st.kind === 'boss' ? 1 : B.st.kind === 'elite' ? 0.6 : 0.15;   // trang bị rơi
    if (Math.random() < dropP) { const it = rollEquip(B.st); (S.items = S.items || []).push(it); B.reward.item = it; }
  } else {
    if (B.st.nan) { const N = nanState(); B.nanEnd = N.run ? N.run.n - 1 : 0; N.run = null; }
    B.reward.vang = Math.round(B.st.reward.vang * 0.15 * (B.wave + 1) / B.st.waves.length);
    S.vang += B.reward.vang;
  }
  save();
  B.banner = { text: win ? 'CHIẾN THẮNG' : 'THẤT BẠI', sub: '', t: 0, boss: !win };
}

// ------------------------------------------------------------------ INPUT
const keys = {};
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (!B || B.over || B.paused) return;
  if (k === 'j') capCast('small');
  if (k === 'k') capCast('ult');
  if ('12345'.includes(k) && k.length === 1) heroUlt(+k - 1);
  if (k === 'p' || k === 'escape') openPause();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function logical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}
function capCast(w) {
  if (!B || !B.cap) return;
  if (!cast(B.cap, w)) {
    const u = B.cap;
    if (u.dk > 0) toast('Đang điều khí');
    else if (u.mp < (w === 'ult' ? 60 : 30)) toast('Chưa đủ nội công');
  }
}
function heroUlt(i) {   // bấm thẻ tướng (hoặc phím 1-5) → tướng đó tung tuyệt kỹ
  const u = B && B.teamList && B.teamList[i];
  if (!u || u.dead || !B.heroes.includes(u)) return;
  if (!cast(u, 'ult')) toast(u.dk > 0 ? 'Đang điều khí' : u.mp < 60 ? 'Chưa đủ nội công' : 'Tuyệt kỹ đang hồi');
}
function tapTarget(p) {   // chạm sân: đội trưởng nhắm con quái gần điểm chạm nhất
  let best = null, bd = 140;
  for (const e of B.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - 30 * sizeOf(e) - p.y); if (d < bd) { bd = d; best = e; } }
  if (best) { B.capTgt = best; B.tgtMark = 0.35; }
}

// ------------------------------------------------------------------ RENDER

const heroesAlive = () => B.heroes.filter(h => !h.dead);
function nearestHero(e, maxD) { let b = null, bd = maxD || 1e9; for (const h of B.heroes) { if (h.dead) continue; const d = dist(e, h); if (d < bd) { bd = d; b = h; } } return b; }
function traitTick(e, dt) {
  const t = e.trait;
  if (t === 'stealth') { if (e.revealT > 0) e.revealT -= dt; const h = nearestHero(e, 260); e.hidden = !h && !(e.revealT > 0); return false; }
  if (t === 'fly') {   // bay qua đầu hàng trước, nhắm tướng hàng sau
    const L = heroesAlive(); if (!L.length) { e.walk = false; return true; }
    const back = L.reduce((a, b) => (b.x < a.x ? b : a)), d = dist(e, back);
    if (d > e.range + unitR(back)) { e.walk = true; moveTo(e, back.x + 20, back.y, e.move * (e.slow > 0 ? 0.6 : 1) * dt); }
    else { e.walk = false; e.f = back.x >= e.x ? 1 : -1; if (e.cdA <= 0) { e.cdA = 1 / getAspd(e); e.atkAnim = 0; dealDmg(e, back, 1, 'atk'); } }
    return true;
  }
  if (t === 'bomb') {   // áp sát tướng/cổng thì nổ
    const h = nearestHero(e, 46);
    if (h) {
      for (const o of B.heroes) if (!o.dead && dist(e, o) < 95) dealDmg(e, o, 3, 'atk');
      fxBurst(e.x, e.y - 20, 'fire', 200); particles(e.x, e.y - 20, '#ff8a2e', 24, 260, 5); B.shake = Math.max(B.shake, 0.5); sfx('boom');
      e.exploded = true; kill(e, null); return true;
    }
    const tg = nearestHero(e, 5000); if (tg) { e.walk = true; moveTo(e, tg.x, tg.y, e.move * dt); return true; }
    return false;
  }
  if (t === 'heal') {
    e.healCd -= dt;
    if (e.healCd <= 0) { e.healCd = 3.5; let n = 0;
      for (const o of B.enemies) if (!o.dead && o !== e && dist(e, o) < 190 && o.hp < maxHp(o)) { o.hp = Math.min(maxHp(o), o.hp + maxHp(o) * 0.12); n++; floater(o.x, o.y - 60 * sizeOf(o), '+', '#5dff8f', 16); particles(o.x, o.y - 30, '#7dff9f', 4, 60, 3); }
      if (n) B.fx.push({ k: 'ring', x: e.x, y: e.y, r: 190, color: '#5dff8f', t: 0, dur: 0.6 }); }
    const h = nearestHero(e, 260); if (h) { e.walk = false; e.f = -1; if (e.cdA <= 0 && dist(e, h) < 240) { e.cdA = 1 / getAspd(e); e.atkAnim = 0; fireProj(e, h, { kind: 'atk', type: e.proj || 'orb', speed: 280, r: 6 }); } return true; }   // đứng lại phía sau
    return false;
  }
  if (t === 'burrow' && e.under) {   // dưới đất: lao tới tướng gần nhất, trồi lên làm choáng
    const h = nearestHero(e, 2000);
    if (!h) { e.under = false; return true; }
    moveTo(e, h.x + 40, h.y, e.move * dt); if (Math.random() < 0.5) particles(e.x, e.y, '#8a6a40', 1, 50, 4);
    if (dist(e, h) < 60) { e.under = false; h.stun = Math.max(h.stun || 0, 0.7); dealDmg(e, h, 1.5, 'atk'); uxSheet && B.fx.push({ k: 'ring', x: e.x, y: e.y, r: 120, color: '#c8a070', t: 0, dur: 0.5 }); particles(e.x, e.y - 10, '#a08060', 20, 220, 5); B.shake = Math.max(B.shake, 0.4); floater(h.x, h.y - 70, 'Choáng!', '#ffd34d', 14); }
    return true;
  }
  if (t === 'seal') {
    e.sealCd -= dt;
    if (e.sealCd <= 0) { const L = heroesAlive().filter(h => !h.clone && !(h.sealT > B.time)); if (L.length) { const h = pick(L); e.sealCd = 7; h.sealT = B.time + 4; e.atkAnim = 0;
      B.fx.push({ k: 'ring', x: h.x, y: h.y, r: 70, color: '#b06aff', t: 0, dur: 0.5 }); floater(h.x, h.y - 84, 'Phong ấn!', '#d0a0ff', 15); snd('chain'); particles(h.x, h.y - 40, '#b06aff', 12, 120, 4); } else e.sealCd = 2; }
    return false;
  }
  return false;
}
function drawTraitBadge(u) {   // biểu tượng kiểu quái trên đầu + bùa phong ấn trên tướng
  if (u.dead) return;
  if (u.side === 'h') { if (u.sealT > B.time) { const y = u.y - 98 * sizeOf(u); ctx.save(); ctx.translate(u.x, y + Math.sin(B.time * 6) * 2); ctx.rotate(Math.sin(B.time * 3) * 0.15);
      ctx.fillStyle = '#ffe58a'; ctx.strokeStyle = '#7a10a0'; ctx.lineWidth = 2; ctx.fillRect(-9, -14, 18, 28); ctx.strokeRect(-9, -14, 18, 28); ctx.fillStyle = '#a01010'; ctx.font = '900 13px serif'; ctx.textAlign = 'center'; ctx.fillText('封', 0, 5); ctx.restore(); } return; }
  if (!u.trait || u.under || (u.hidden && !(u.revealT > 0))) return; const I = TRAIT_INFO[u.trait]; if (!I) return;
  const y = u.y - (u.flyH || 0) - 92 * sizeOf(u);
  ctx.save(); ctx.beginPath(); ctx.arc(u.x, y, 10, 0, TAU); ctx.fillStyle = 'rgba(20,8,4,0.8)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd34d'; ctx.stroke();
  ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(I.ico, u.x, y + 1); ctx.restore();
}

function drawTierAura(u) {   // tầng tướng trên sân: vạch tầng dưới chân; tầng 3–4 có vòng khí; Tầng 5 = Đại thành (hào quang vàng bốc lên)
  if (u.dead || u.clone) return; const n = trongOf(u); if (n < 2) return; const s = sizeOf(u), t = B.time, col = (ELEMENTS[u.el] || {}).color || '#ffe58a';
  ctx.save();
  if (n >= 5) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(u.x, u.y - 40 * s, 4, u.x, u.y - 40 * s, 70 * s); g.addColorStop(0, 'rgba(255,230,120,0.45)'); g.addColorStop(1, 'rgba(255,180,40,0)');
    ctx.fillStyle = g; ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 4); ctx.beginPath(); ctx.ellipse(u.x, u.y - 40 * s, 52 * s, 76 * s, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { const ph = (t * 0.9 + i / 6) % 1, x = u.x + Math.sin(i * 2.1 + t * 2) * 22 * s, y = u.y - ph * 90 * s; ctx.globalAlpha = (1 - ph) * 0.9; ctx.fillStyle = i % 2 ? '#ffe58a' : '#fff6c8'; ctx.beginPath(); ctx.ellipse(x, y, 3, 7, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5; ctx.save(); ctx.translate(u.x, u.y + 2); ctx.scale(1, 0.36); ctx.rotate(t * 1.5);
    ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.arc(0, 0, 34 * s, 0, TAU); ctx.stroke(); ctx.restore();
  } else if (n >= 3) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3); ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 30 * s, 10 * s, 0, 0, TAU); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  for (let i = 0; i < n - 1; i++) { const x = u.x + (i - (n - 2) / 2) * 9, y = u.y + 14; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = n >= 5 ? '#ffd34d' : col; ctx.strokeStyle = '#2a0a04'; ctx.lineWidth = 1.5; ctx.fillRect(-3, -3, 6, 6); ctx.strokeRect(-3, -3, 6, 6); ctx.restore(); }
  ctx.restore();
}
function drawUnit(u) {
  const s = 1.0;
  ctx.save();
  ctx.translate(u.x, u.y);
  let alpha = 1;
  if (u.dead) {
    if (u.side === 'e') { alpha = Math.max(0, 1 - u.deathT * 2.2); ctx.translate(0, -u.deathT * 30); }
    else alpha = 0.35;
  }
  if (u.clone) alpha = 0.7;
  if (u.inv > 0 && !u.dead) alpha *= 0.55;
  if (u.shield > 0 && !u.dead) {
    ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(u.t * 6) * 0.08;
    Art.E(ctx, 0, -28 * sizeOf(u), 26 * sizeOf(u), 34 * sizeOf(u)); ctx.fillStyle = '#9fe0ff'; ctx.fill();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 2; ctx.strokeStyle = '#d8f6ff'; ctx.stroke(); ctx.restore();
  }
  if (u.side === 'h' && !u.dead && u.atkAnim >= 0 && typeof ATK_STYLE !== 'undefined' && ATK_STYLE[u.id]) {   // ra đòn: lao tới trước rồi thu về (đường cong nhanh-chậm)
    const q = u.atkAnim, lunge = (q < 0.35 ? Math.sin(q / 0.35 * Math.PI / 2) : Math.max(0, 1 - (q - 0.35) / 0.5)) * (LUNGE[ATK_STYLE[u.id].pat] || 8);
    ctx.translate(u.f * lunge, 0);
    if (lunge > 3) {   // bóng mờ kéo theo phía sau
      if (!gfxLow()) B.ghosts.push({ id: u.id, x: u.x + u.f * lunge, y: u.y, f: u.f, t: 0, st: rigState(u) });
    }
  }
  if (u.side === 'h' && u.dead && !hasSkel(u.id)) ctx.rotate(-1.35);   // rig xương có động tác ngã riêng
  if (u.side === 'h' && u.dead && hasSkel(u.id)) alpha = Math.max(0.35, 1 - (u.deathT || 0) * 0.8);
  if (u.side === 'e' && u.trait && !u.dead) {
    if (u.under) { ctx.save(); ctx.fillStyle = '#6a4a28'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#8a6a40'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-14 + i * 9, -4 - Math.abs(Math.sin(u.t * 9 + i)) * 5, 3, 0, TAU); ctx.fill(); } ctx.restore(); ctx.restore(); return; }
    if (u.flyH) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 2, 26, 8, 0, 0, TAU); ctx.fill(); ctx.restore(); ctx.translate(0, -u.flyH + Math.sin(u.t * 4) * 5);
      if (Math.random() < 0.3) B.parts.push({ x: u.x - u.f * 30, y: u.y - u.flyH + 6, vx: -u.f * 30, vy: 0, life: 0.4, max: 0.4, color: u.d.flyTint ? '#ffb070' : '#fff6e0', size: 4 }); }
    if (u.hidden && !(u.revealT > 0)) alpha *= 0.14 + 0.06 * Math.sin(u.t * 10);
    if (u.trait === 'shield') { ctx.save(); ctx.translate(-22 * sizeOf(u), -30 * sizeOf(u)); ctx.globalAlpha = 0.8; ctx.fillStyle = '#c8d8f0'; ctx.strokeStyle = '#5a6a8a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 9, 26, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.1 * Math.sin(u.t * 5); ctx.fillStyle = '#9fd0ff'; ctx.beginPath(); ctx.ellipse(-4, 0, 16, 40, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  }
  const img = SPR[u.id];
  if (u.side === 'e' && drawEnemyPose(u, alpha)) {   // quái vẽ bằng tư thế
    if (u.flyH && !u.dead) { const cl = ucImg('cloud'); if (cl) { const cw = 110 * sizeOf(u), ch = cw * cl.height / cl.width; ctx.save(); ctx.globalAlpha *= alpha; if (u.d.flyTint) ctx.filter = u.d.flyTint; ctx.drawImage(cl, -cw / 2, -ch * 0.62, cw, ch); ctx.restore(); } }   // mây che chân
  }
  else if (img) drawSprite(u, img, alpha);
  else Art.draw(ctx, u.look, { t: u.t, f: u.f, walk: u.walk && !u.dead, atk: u.dead ? -1 : u.atkAnim, cast: u.castT > 0, hurt: u.hurt, scale: s, alpha });
  ctx.restore();
  if (u.dead) return;
  const sz = sizeOf(u);
  const top = img ? u.y - spriteH(u) - 8 : u.y - 72 * sz * s - 6;
  if (u.stun > 0) {
    for (let i = 0; i < 3; i++) {
      const a = u.t * 5 + i * TAU / 3;
      drawStar(u.x + Math.cos(a) * 14 * sz, top + 10 + Math.sin(a) * 4, 4, '#ffe14d');
    }
  }
  if (u.burn > 0) particlesTiny(u);
  if (u.boss) return;
  const bw = u.side === 'h' ? 40 : (u.elite ? 50 : 30) * Math.min(1.3, sz);
  hpBar(u.x - bw / 2, top, bw, u.side === 'h' ? 5 : 4, u.hp / maxHp(u), u.side === 'h' ? '#46e36b' : (u.elite ? '#c25bff' : '#ff4d4d'), u.shield > 0 ? u.shield / maxHp(u) : 0);
  if (u.side === 'h' && !u.clone) {
    hpBar(u.x - bw / 2, top + 6, bw, 3, u.mp / 100, u.dk > 0 ? '#7fd3ff' : '#4f8cff', 0);
  }
}
// Chiều cao nhân vật vẽ bằng ảnh (anime cao hơn chibi)
function spriteH(u) { return u.boss ? 175 : 108 * sizeOf(u); }
// Hoạt ảnh cho ảnh tĩnh: thở khi đứng, nhún khi chạy, lao + nghiêng khi đánh, phồng khi tung chiêu
function rigState(u) {
  if (u.dead) return { anim: 'die', t: u.deathT || 0 };
  if (B && B.over && B.win && u.side === 'h') return { anim: 'win', t: u.t };
  if (u.hitT > 0 && u.atkAnim < 0 && !(u.castT > 0)) return { anim: 'hit', p: 1 - u.hitT / 0.35, t: u.t };
  if (u.castT > 0) return { anim: 'cast', ult: !!u.castUlt, p: 1 - u.castT / (u.castDur || 0.35), t: u.t };
  if (!u.dead && u.atkAnim >= 0) return { anim: 'attack', p: u.atkAnim, t: u.t };
  if (!u.dead && u.castT > 0) return { anim: 'cast', p: 1 - u.castT / 0.35, t: u.t };
  if (!u.dead && u.walk) return { anim: 'walk', t: u.t };
  return { anim: 'idle', t: u.dead ? 0 : u.t };
}
// chọn tư thế chính theo nhịp đòn (null = dùng rig xương)
function poseFor(u) {
  const P = POSES[u.id]; if (!P || u.dead) return null;
  if (u.castT > 0) {
    const p = 1 - u.castT / (u.castDur || 0.35);
    if (u.castUlt) return p < 0.18 ? ['windup', p / 0.18] : p < 0.97 ? ['ult', (p - 0.18) / 0.8] : null;
    return p < 0.18 ? ['windup', p / 0.18] : p < 0.9 ? ['skill', (p - 0.18) / 0.72] : null;
  }
  if (u.atkAnim >= 0) { const q = u.atkAnim; return q < 0.3 ? ['windup', q / 0.3] : q < 0.66 ? ['strike', (q - 0.3) / 0.36] : null; }
  if (B && B.over) return null;   // thắng/thua: dùng rig (win/die)
  if (u.hitT > 0 && P.hit) return ['hit', 1 - u.hitT / 0.35];
  if (P.idle1 && P.idle2) {   // đứng nghỉ: hai dáng xen kẽ, chuyển mờ 0,3 giây, mỗi tướng lệch pha riêng
    const T = 3.6, ph = ((u.t + (u.id.length * 0.37)) % T), a = ph < 1.8 ? 0 : 1;   // đổi dáng dứt khoát (chuyển mờ làm 2 vũ khí chồng lên nhau trông như bị gãy/cong)
    return ['idle', ph, a];
  }
  return null;
}
const HFIX = { kimgiac: 1.1, hoangphongquai: 1.06 };   // bù dáng đứng khom / tai nhọn để cao ngang các tướng khác
function drawPose(u, name, t, h, alpha) {
  h *= HFIX[u.id] || 1;
  if (!POSES[u.id]) return false;
  const img = POSES[u.id][name], D = (window.HPOSE && HPOSE[u.id]) || (window.SKEL_DEFS && SKEL_DEFS[u.id]); if (!img || !D) return false;
  const k = h / D.H / 0.5, gx = D.gnd[0] * 0.5 * k, gy = D.gnd[1] * 0.5 * k;   // ảnh tư thế = hình gốc giảm nửa, đặt chân tại gốc xương root
  let sx = 1, sy = 1, rot = 0, ox = 0;
  const eo = x => 1 - (1 - x) * (1 - x), ob = x => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);   // ease-out, vượt quá rồi về
  if (name === 'windup') { const e = eo(Math.min(1, t)); sy = 1 - 0.05 * e; sx = 1 + 0.04 * e; ox = -8 * e; rot = -0.03 * e; }
  else if (name === 'strike') { const e = ob(Math.min(1, t)); sx = 1.08 - 0.06 * t; sy = 0.96 + 0.03 * t; ox = 14 * (1 - t) + 4 * Math.sin(e * Math.PI); rot = 0.035 * (1 - t); }
  else if (name === 'skill') { rot = Math.sin(t * Math.PI * 6) * 0.05; sy = 1 + 0.02 * Math.sin(t * Math.PI * 2); }
  else if (name === 'ult') { sy = 1 + 0.012 * Math.sin(t * 9); }
  else if (name.startsWith('idle')) { sy = 1 + 0.014 * Math.sin(t * 2.6); sx = 1 - 0.006 * Math.sin(t * 2.6); }   // thở
  else if (name === 'hit') { const e = 1 - eo(Math.min(1, t)); ox = -11 * e; rot = -0.06 * e; sy = 1 - 0.03 * e; }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(ox, 0); ctx.rotate(rot); ctx.scale(sx, sy);
  if (u.hurt > 0) ctx.filter = 'brightness(1.8) saturate(0.7)';
  ctx.drawImage(img, -gx, -gy, img.width * k, img.height * k);
  ctx.filter = 'none'; ctx.restore();
  return true;
}
function drawRigUnit(u, h, alpha) {
  const pz = poseFor(u) || (window.HPOSE && HPOSE[u.id] && !hasSkel(u.id) ? ['idle1', 0] : null);   // tướng chỉ có tư thế (không rig): thắng/chết dùng dáng đứng
  if (pz) {
    ctx.save(); ctx.scale(u.f * (FACE[u.id] || 1), 1); let ok;
    const nm = pz[0] === 'idle' ? (pz[2] ? 'idle2' : 'idle1') : pz[0];
    if (u.pzN !== nm) { u.pzPrev = u.pzN ? { n: u.pzN, t: u.pzT || 0, at: u.t } : null; u.pzN = nm; u.pzAt = u.t; }
    u.pzT = pz[1];
    const fade = u.pzPrev ? Math.max(0, 1 - (u.t - u.pzPrev.at) / 0.07) : 0;   // chuyển dáng chồng mờ 70 ms cho mượt
    if (fade > 0) drawPose(u, u.pzPrev.n, u.pzPrev.t, h, alpha * fade);
    const pop = Math.max(0, 1 - (u.t - u.pzAt) / 0.12);   // nảy nhẹ khi đổi dáng
    if (pop > 0 && nm !== 'idle1' && nm !== 'idle2') { ctx.translate(0, -3 * pop); ctx.scale(1 + 0.02 * pop, 1 - 0.02 * pop); }
    ok = drawPose(u, nm, pz[1], h, alpha * (fade > 0 ? 1 - fade * 0.35 : 1));
    ctx.restore(); if (ok) return;
  }
  if (!u.rphys) u.rphys = Rig.newPhys();
  const vx = (u.x - (u.px == null ? u.x : u.px)) * 60 * u.f; u.px = u.x;
  Rig.physics(u.rphys, 1 / 60, vx, 0);
  const st = rigState(u); st.phys = u.rphys;
  ctx.save();
  ctx.scale(u.f * (FACE[u.id] || 1), 1);
  if (u.hurt > 0) ctx.filter = 'brightness(1.8) saturate(0.7)';
  ctx.globalAlpha *= alpha;
  const tip = rigDraw(ctx, u.id, st, h, { mem: (u.mm = u.mm || {}), dt: 1 / 60 });
  ctx.filter = 'none';
  // vệt sáng theo đầu gậy khi đập
  const kd = hasSkel(u.id) ? Skel.kind(u.id) : hasMesh(meshId(u.id)) ? MeshRig.kind(meshId(u.id)) : hasLayered(u.id) ? Layered.kind(u.id) : 'staff';
  const trailOk = kd === 'staff' || kd === 'swing' || kd === 'thrust';
  if (trailOk && st.anim === 'attack' && tip && st.p > 0.3 && st.p < 0.7) { (u.trail = u.trail || []).push(tip); if (u.trail.length > 7) u.trail.shift(); }
  else if (u.trail && u.trail.length) u.trail.shift();
  if (u.trail && u.trail.length > 1) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < u.trail.length; i++) {
      const q = i / u.trail.length;
      ctx.globalAlpha = alpha * q * 0.85;
      ctx.strokeStyle = u.side === 'e' ? (i > u.trail.length - 3 ? '#ffe0e0' : '#ff6a5a') : (i > u.trail.length - 3 ? '#fffbe0' : '#ffd34d');
      ctx.lineWidth = 3 + q * 12;
      ctx.beginPath(); ctx.moveTo(u.trail[i - 1][0], u.trail[i - 1][1]); ctx.lineTo(u.trail[i][0], u.trail[i][1]); ctx.stroke();
    }
  }
  ctx.restore();
}
const hasLayered = id => typeof Layered !== 'undefined' && Layered.has(id);
const hasMesh = id => typeof MeshRig !== 'undefined' && MeshRig.has(id);
const POSE_ONLY = new Set(['khuongtanha', 'trieucongminh', 'bachcot']);   // đã vẽ lại theo đúng pháp bảo: chỉ dùng tư thế, bỏ rig cũ
const hasSkel = id => typeof Skel !== 'undefined' && Skel.has(id) && !window.__noSkel && !POSE_ONLY.has(id);
const hasRig = id => !!(window.HPOSE && HPOSE[id]) || hasSkel(id) || hasMesh(id) || hasLayered(id) || (typeof Rig !== 'undefined' && Rig.has(id));
// ưu tiên nhân vật tách lớp (Live2D) → rig bộ phận
// &chibi trên đường dẫn: nhân vật nào có bản chibi (art/mesh/<id>_chibi.js) thì dùng bản đó để so sánh
const meshId = id => (window.__chibi && typeof MeshRig !== 'undefined' && MeshRig.has(id + '_chibi')) ? id + '_chibi' : id;
function rigDraw(c, id, st, h, opt) {
  if (hasSkel(id)) return Skel.draw(c, id, st, h, opt);
  if (hasMesh(meshId(id))) return MeshRig.draw(c, meshId(id), st, h, opt);
  return hasLayered(id) ? Layered.draw(c, id, st, h) : Rig.draw(c, id, st, h);
}
function drawSprite(u, img, alpha) {
  const h = spriteH(u), w = h * img.width / img.height;
  if (hasRig(u.id)) {
    if (u.castT > 0 && !u.dead) {
      const g = ctx.createRadialGradient(0, -h * 0.5, 4, 0, -h * 0.5, h * 0.6);
      g.addColorStop(0, 'rgba(255,240,160,0.55)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.5, h * 0.6, 0, TAU); ctx.fill();
    }
    drawRigUnit(u, h, alpha);
    return;
  }
  const an = ANIM[u.id];
  if (an) { // có rig: cử động lấy từ sprite sheet, chỉ thêm hiệu ứng phát sáng và nháy trắng
    if (u.castT > 0 && !u.dead) {
      const g = ctx.createRadialGradient(0, -h * 0.5, 4, 0, -h * 0.5, h * 0.6);
      g.addColorStop(0, 'rgba(255,240,160,0.55)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.5, h * 0.6, 0, TAU); ctx.fill();
    }
    ctx.save();
    ctx.scale(u.f * (FACE[u.id] || 1), 1);
    if (u.hurt > 0) ctx.filter = 'brightness(1.8) saturate(0.7)';
    ctx.globalAlpha *= alpha;
    drawAnimFrame(an, animFrame(an, u), h);
    ctx.restore();
    return;
  }
  let sx = 1, sy = 1, rot = 0, ox = 0, oy = 0;
  if (u.walk && !u.dead) { oy = -Math.abs(Math.sin(u.t * 11)) * 4; rot = Math.sin(u.t * 11) * 0.035; }
  else { const b = Math.sin(u.t * 2.6) * 0.014; sy = 1 + b; sx = 1 - b * 0.6; }
  if (u.atkAnim >= 0 && !u.dead) {
    const p = u.atkAnim, k = Math.sin(p * Math.PI);
    ox = k * 12;
    rot += p < 0.3 ? -0.12 * (p / 0.3) : -0.12 + 0.24 * ((p - 0.3) / 0.7) * (1 - p);
    sx *= 1 + k * 0.05; sy *= 1 - k * 0.03;
  }
  if (u.castT > 0 && !u.dead) {
    const g = ctx.createRadialGradient(0, -h * 0.5, 4, 0, -h * 0.5, h * 0.6);
    g.addColorStop(0, 'rgba(255,240,160,0.55)'); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.5, h * 0.6, 0, TAU); ctx.fill();
    sx *= 1.05; sy *= 1.05;
  }
  ctx.save();
  ctx.scale(u.f * (FACE[u.id] || 1), 1);
  ctx.translate(ox, oy); ctx.rotate(rot); ctx.scale(sx, sy);
  if (u.hurt > 0) ctx.filter = 'brightness(1.8) saturate(0.7)';
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}
function particlesTiny(u) {
  if (Math.random() < 0.3) B.parts.push({ x: u.x + rand(-8, 8), y: u.y - rand(10, 40), vx: rand(-10, 10), vy: -60, life: 0.4, max: 0.4, color: '#ff8a3d', size: 2.5 });
}
function hpBar(x, y, w, h, p, col, sh) {
  ctx.fillStyle = 'rgba(30,15,10,0.75)'; Art.rr(ctx, x - 1, y - 1, w + 2, h + 2, 2); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(p, 0, 1), h);
  if (sh > 0) { ctx.fillStyle = 'rgba(200,240,255,0.9)'; ctx.fillRect(x, y, w * clamp(sh, 0, 1), Math.max(1.5, h / 2)); }
}
function drawStar(x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#7a4a10'; ctx.stroke();
}
// bóng mờ lao tới: vẽ lại sprite/rig tại vị trí cũ với độ mờ giảm dần
function drawGhosts() {
  for (const g of B.ghosts) {
    const u = B.heroes.find(h => h.id === g.id && !h.dead); if (!u) continue;
    const k = 1 - g.t / 0.22;
    ctx.save(); ctx.globalAlpha = 0.28 * k; ctx.translate(g.x - u.f * 16 * (1 - k), g.y);
    ctx.globalCompositeOperation = 'lighter';
    const img = SPR[g.id]; if (img) drawSprite(u, img, 1);
    ctx.restore();
  }
}
// tia sáng điểm trúng (xoè nan) + đồng hồ số đòn
// ------------------------------------------------------------------ ÂM THANH (tổng hợp bằng WebAudio, không dùng tệp ngoài)
let AC = null; const _sfxT = {};
function audioOn() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } if (AC) sndLoad(); } if (AC && AC.state === 'suspended') AC.resume(); }
document.addEventListener('pointerdown', audioOn);

// ---- ÂM THANH MẪU (game/audio, CC0 OpenGameArt) — nạp sau lần chạm đầu; chưa nạp xong thì dùng tiếng tổng hợp
const SND_VOL = { charge: 0.7, charge_big: 0.85, impact: 0.9, explode: 0.75, thunder: 0.8, whoosh: 0.55, slash: 0.3, hit: 0.3, fire: 1.5, magic: 0.35, heal: 0.8, gong: 0.55, roar: 0.6, pickup: 0.6, chain: 0.6, water: 1.6, gate: 0.3 };
const SNDB = {}; let _sndLoading = false;
function sndLoad() { if (!AC || _sndLoading) return; _sndLoading = true;
  for (const n in SND_VOL) fetch('audio/' + n + '.mp3').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => AC.decodeAudioData(b, ok, no))).then(buf => { SNDB[n] = buf; }).catch(() => {}); }
function snd(n, vol, rate) {
  if (!AC || (S && S.mute)) return false; const b = SNDB[n]; if (!b) return false;
  const now = AC.currentTime, gap = { slash: 0.07, hit: 0.06, gate: 0.25, pickup: 0.1, magic: 0.12 }[n] || 0.03;
  if (_sfxT['_' + n] && now - _sfxT['_' + n] < gap) return true; _sfxT['_' + n] = now;
  const s = AC.createBufferSource(); s.buffer = b; s.playbackRate.value = rate || (0.94 + Math.random() * 0.12);
  const g = AC.createGain(); g.gain.value = (SND_VOL[n] || 0.6) * (vol == null ? 1 : vol) * 0.8; s.connect(g); g.connect(AC.destination); s.start(); return true;
}
function elemSnd(id) {   // tiếng va chạm theo hệ / kiểu chiêu
  const h = HEROES[id]; if (!h) return; const t = UCFG[id] && UCFG[id].t;
  if (t === 'bolt' || id === 'loichantu' || id === 'duongtien') snd('thunder', 0.9);
  else if (h.el === 'hoa') snd('fire', 1.2);
  else if (h.el === 'thuy') snd('water', 1.1);
  else if (t === 'bind') snd('chain');
}
function sfx(kind) {
  if (!AC || (S && S.mute)) return;
  if (kind === 'ult' && snd('charge')) return;
  if (kind === 'boom' && SNDB.impact) { snd('impact'); snd('explode', 0.7, 0.8); }
  if (kind === 'crit') snd('slash', 1.3);
  const now = AC.currentTime, gap = { shoot: 0.06, hit: 0.05, hitBig: 0.08, pop: 0.05, crit: 0.06 }[kind] || 0;
  if (gap && _sfxT[kind] && now - _sfxT[kind] < gap) return; _sfxT[kind] = now;
  const out = AC.createGain(); out.connect(AC.destination);
  const tone = (type, f0, f1, dur, vol, delay) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; const t = now + (delay || 0);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); };
  const noise = (dur, vol, hp, delay) => { const n = AC.createBufferSource(), buf = AC.createBuffer(1, Math.floor(AC.sampleRate * dur), AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = buf; const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = AC.createGain(); g.gain.value = vol; n.connect(f); f.connect(g); g.connect(out); n.start(now + (delay || 0)); };
  if (kind === 'shoot') { tone('triangle', 900, 380, 0.08, 0.05); noise(0.05, 0.03, 2500); }
  else if (kind === 'hit') { noise(0.06, 0.09, 1200); tone('square', 220, 90, 0.06, 0.03); }
  else if (kind === 'hitBig') { noise(0.14, 0.16, 500); tone('sine', 160, 50, 0.16, 0.12); }
  else if (kind === 'crit') { tone('sawtooth', 1400, 600, 0.09, 0.05); noise(0.08, 0.1, 1800); tone('sine', 300, 80, 0.12, 0.08); }
  else if (kind === 'pop') { tone('sine', 520, 140, 0.1, 0.06); }
  else if (kind === 'ult') { tone('sawtooth', 200, 900, 0.35, 0.06); noise(0.4, 0.06, 3000); tone('sine', 1200, 1800, 0.3, 0.04, 0.1); }
  else if (kind === 'boom') { noise(0.6, 0.3, 120); tone('sine', 110, 30, 0.7, 0.32); tone('triangle', 70, 25, 0.9, 0.2, 0.05); }
}
// ------------------------------------------------------------------ CHẤT LIỆU HIỆU ỨNG (art/fx, nền đen, vẽ bằng hoà sáng 'lighter')
const FXT = {};
for (const n of ['burst_gold', 'burst_blue', 'slash', 'orb', 'lightning', 'smoke', 'ring', 'flare', 'fire', 'petal']) { const i = new Image(); i.src = 'art/fx/' + n + '.webp'; FXT[n] = i; }
function fxGlow(name, x, y, size, rot, alpha, sx, sy) {
  const im = FXT[name]; if (!im || !im.complete || !im.naturalWidth || alpha <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx || 1, sy || 1);
  ctx.drawImage(im, -size / 2, -size / 2, size, size); ctx.restore();
}
// kiểu đạn → bộ chất liệu: lõi, quầng, nổ khi trúng
const PFX = {
  staff: { core: 'orb', glow: 'ring', burst: 'burst_gold', trail: '#ffd34d', spin: 1 },
  crescent: { core: 'slash', glow: 'flare', burst: 'burst_blue', trail: '#bfe0ff', spin: 1 },
  spear: { core: 'flare', glow: 'lightning', burst: 'burst_blue', trail: '#9fd0ff', line: 1 },
  light: { core: 'orb', glow: 'flare', burst: 'burst_gold', trail: '#fff3a0' },
  ring: { core: 'ring', glow: 'fire', burst: 'burst_gold', trail: '#ffb02e', spin: 1 },
  fan: { core: 'petal', glow: 'flare', burst: 'burst_gold', trail: '#7fe8a0', spin: 1 },
  pearl: { core: 'orb', glow: 'flare', burst: 'burst_gold', trail: '#ffe58a' },
  bolt: { core: 'lightning', glow: 'flare', burst: 'burst_blue', trail: '#bfe0ff', line: 1 },
  bead: { core: 'orb', glow: 'ring', burst: 'burst_gold', trail: '#ffcf4a', spin: 1 },
  moon: { core: 'orb', glow: 'ring', burst: 'burst_blue', trail: '#dfe8ff', spin: 1 },
  drop: { core: 'orb', glow: 'petal', burst: 'burst_blue', trail: '#9fe8ff' },
  foxfire: { core: 'petal', glow: 'smoke', burst: 'burst_gold', trail: '#ff7ad9' },
  bone: { core: 'orb', glow: 'smoke', burst: 'burst_blue', trail: '#b06aff', line: 1 },
  fire: { core: 'fire', glow: 'orb', burst: 'burst_gold', trail: '#ff7a2e' },
  pill: { core: 'orb', glow: 'smoke', burst: 'burst_gold', trail: '#ffb347' },
  pagoda: { core: 'flare', glow: 'ring', burst: 'burst_gold', trail: '#ffd34d' },
  rake: { core: 'orb', glow: 'ring', burst: 'burst_gold', trail: '#e0e8f0', spin: 1 },
  boulder: { core: 'smoke', glow: 'orb', burst: 'burst_gold', trail: '#c8a070' },
  staffwave: { core: 'slash', glow: 'flare', burst: 'burst_gold', trail: '#ffd34d' },
  rakewave: { core: 'slash', glow: 'flare', burst: 'burst_blue', trail: '#bfe0ff' },
  palm: { core: 'orb', glow: 'flare', burst: 'burst_gold', trail: '#ffe58a' },
  sand: { core: 'smoke', glow: 'orb', burst: 'burst_gold', trail: '#e8c060', spin: 1 },
  wind: { core: 'slash', glow: 'flare', burst: 'burst_blue', trail: '#7fe8a0' },
  axe: { core: 'orb', glow: 'ring', burst: 'burst_gold', trail: '#ffd34d', spin: 1 },
};
// vẽ lớp sáng của đạn: dải đuôi uốn theo đường bay + quầng + lõi
function drawProjFX(p) {
  const S = PFX[p.type]; if (!S || p.side !== 'h') return;
  const h = p.hist || [];
  if (h.length > 1 && !gfxLow()) {   // dải đuôi: nhiều đoạn thon dần, hoà sáng
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < h.length; i++) {
      const q = i / h.length; ctx.globalAlpha = q * 0.55; ctx.strokeStyle = S.trail; ctx.lineWidth = (p.r || 8) * 1.6 * q;
      ctx.beginPath(); ctx.moveTo(h[i - 1][0], h[i - 1][1]); ctx.lineTo(h[i][0], h[i][1]); ctx.stroke();
      ctx.globalAlpha = q * 0.7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (p.r || 8) * 0.5 * q; ctx.stroke();
    }
    ctx.restore();
  }
  const a = Math.atan2(p.vy, p.vx), R = Math.min(52, (p.r || 8) * (p.child ? 3 : 4));
  const pulse = 1 + 0.12 * Math.sin(p.age * 30);
  fxGlow(S.glow, p.x, p.y, R * 1.5 * pulse, S.line ? a : p.age * 4, 0.55, S.line ? 1.6 : 1, S.line ? 0.6 : 1);
  fxGlow(S.core, p.x, p.y, R * pulse, S.spin ? p.rot * 0.8 : a, 0.95);
}
// hình chính của tuyệt kỹ (art/fx/ult_<id>.webp, Codex vẽ nền đen): bật lên, giữ, tan — hoà sáng chồng lên hiệu ứng canvas
const ULTT = {}, ULT_SELF = { quanam: 1, ngumavuong: 1, batgioi: 1 };

// ---- TUYỆT KỸ KIỂU MỚI: cut-in vẽ hẳn + 3 nhịp (gồng → đòn chính → dư chấn) + hiệu ứng nhiều khung (sprite 6 khung)
const ULTX = {
  ngokhong: { beats: ['ngokhong_b1', 'ngokhong_b2', 'ngokhong_b3'], sheets: ['sheet_boom_gold', 'sheet_crack'], col: '#ffcf3f', cut: 'cut_ngokhong' },
  duongtien: { beats: ['duongtien_b1', 'duongtien_b2', 'duongtien_b3'], sheets: ['sheet_boom_blue', 'sheet_slash'], col: '#7fb3ff', cut: 'cut_duongtien' },
};
const ULTX_IMG = {};
function uxImg(n) { let i = ULTX_IMG[n]; if (!i) { i = ULTX_IMG[n] = new Image(); i.src = 'art/ultx/' + n + '.webp'; } return i.complete && i.naturalWidth ? i : null; }
for (const k in ULTX) { ULTX[k].beats.concat(ULTX[k].sheets, [ULTX[k].cut]).forEach(uxImg); }
['combo_b1', 'combo_b2', 'cut_combo'].forEach(uxImg);
function uxDraw(n, x, y, S, a, rot) { const im = uxImg(n); if (!im || a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(im, -S / 2, -S / 2, S, S); ctx.restore(); }
function uxSheet(n, x, y, S, p) {   // p 0..1 → 6 khung
  const im = uxImg(n); if (!im || p < 0 || p >= 1) return; const fw = im.width / 6, f = Math.min(5, Math.floor(p * 6));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.drawImage(im, f * fw, 0, fw, im.height, x - S / 2, y - S * im.height / fw / 2, S, S * im.height / fw); ctx.restore();
}
// vẽ 3 nhịp của tuyệt kỹ (f = hiệu ứng 'sig' trong B.fx, p = 0..1)
function drawUltX(f, X) {
  const p = Math.min(1, f.t / f.dur), x = clamp(f.tx, 160, W - 160), y = clamp(f.ty, 220, H - 40);
  ctx.save(); ctx.globalAlpha = 0.58 * Math.sin(Math.PI * Math.min(1, p * 1.2)); ctx.fillStyle = '#05020c'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();   // trời tối
  const b1 = seg01(p, 0, 0.38), b2 = seg01(p, 0.3, 0.7), b3 = seg01(p, 0.6, 1);
  if (b1 > 0 && b1 < 1) uxDraw(X.beats[0], x, y - 120, 200 + 120 * b1, Math.min(1, b1 * 3) * (1 - Math.max(0, b1 - 0.8) * 5));          // nhịp 1: gồng
  if (b2 > 0 && b2 < 1) { uxDraw(X.beats[1], x, y - 90, 300 + 80 * Math.sin(b2 * Math.PI), Math.sin(b2 * Math.PI) * 0.85); uxSheet(X.sheets[0], x, y - 60, 380, b2); }   // nhịp 2: đòn chính + nổ 6 khung
  if (b3 > 0 && b3 < 1) { uxDraw(X.beats[2], x, y - 20, 340 + 60 * b3, (1 - b3) * 1.1); uxSheet(X.sheets[1], x, y - 30, 420, b3); }   // nhịp 3: dư chấn
}
function seg01(p, a, b) { return p < a ? 0 : p > b ? 1 : (p - a) / (b - a); }
// hợp kích kiểu mới: cut-in đôi + va chạm + cột sáng
function drawComboX(c) {
  const p = c.t / c.dur, x = c.x, y = c.y;
  ctx.save(); ctx.globalAlpha = 0.5 * Math.sin(Math.PI * Math.min(1, p)); ctx.fillStyle = '#05020c'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();
  const b1 = seg01(p, 0.25, 0.6), b2 = seg01(p, 0.5, 1);
  if (b1 > 0 && b1 < 1) { uxDraw('combo_b1', x, y - 100, 320 + 140 * b1, Math.sin(b1 * Math.PI) * 1.2, (1 - b1) * 0.5); uxSheet('sheet_boom_blue', x, y - 80, 460, b1); }
  if (b2 > 0 && b2 < 1) { uxDraw('combo_b2', x, y - 140, 420 + 80 * b2, (1 - b2) * 1.2); uxSheet('sheet_boom_gold', x, y - 60, 520, b2); uxSheet('sheet_crack', x, y, 520, b2); }
  const ci = uxImg('cut_combo'), q = seg01(p, 0, 0.3);   // cut-in đôi trượt vào
  if (ci && q < 1) { const a = q < 0.2 ? q / 0.2 : q > 0.75 ? (1 - q) / 0.25 : 1, w = 760, h = w * ci.height / ci.width;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(10,6,20,0.6)'; ctx.fillRect(0, H / 2 - h / 2, W, h); ctx.drawImage(ci, (W - w) / 2 + (1 - Math.min(1, q * 4)) * 200, H / 2 - h / 2, w, h); ctx.restore(); }
}

// ---- TUYỆT KỸ BIÊN ĐẠO: vật thể thật chuyển động (art/ultc), kèm nổ nhiều khung, rung, vết nứt
const UCI = {}; function ucImg(n) { let i = UCI[n]; if (!i) { i = UCI[n] = new Image(); i.src = 'art/ultc/' + n + '.webp'; } return i.complete && i.naturalWidth ? i : null; }
['staff', 'dragon_head', 'dragon_long', 'hound_run1', 'hound_run2', 'hound_leap', 'hound_bite', 'ngk_jump', 'cloud'].forEach(ucImg);
const ease3 = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3), easeIn = x => Math.pow(Math.max(0, Math.min(1, x)), 2.2);
let UC_NODARK = false;
function ucDark(p, k) { if (UC_NODARK) return; ctx.save(); ctx.globalAlpha = (k || 0.5) * Math.sin(Math.PI * Math.min(1, p)); ctx.fillStyle = '#05020c'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore(); }
function ucOnce(f, key, fn) { f.done = f.done || {}; if (!f.done[key]) { f.done[key] = 1; fn(); } }
function ucStaff(px, py, ang, L, a, glow) {   // vẽ cây gậy: gốc tại (px,py), hướng ang (0 = thẳng lên), dài L
  const im = ucImg('staff'); if (!im) return; const w = L * im.width / im.height * 1.15;
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.globalAlpha = a;
  if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * glow; ctx.fillStyle = '#ffcf3f'; ctx.filter = 'blur(10px)'; ctx.fillRect(-w * 0.9, -L, w * 1.8, L); ctx.restore(); }
  ctx.drawImage(im, -w / 2, -L, w, L); ctx.restore();
}
const ULTC = {
  // Ngộ Không — Như Ý Kim Cô Bổng: gậy trong tay phóng to, dựng thẳng lên trời, quật xuống chỗ quái đông nhất
  ngokhong: { dur: 1.7, hit: 0.55, draw(f, p) {
    ucDark(p, 0.45);
    const px = f.x + 6, py = f.y, dx = f.tx - px, dy = (f.ty - 10) - py, dist = Math.hypot(dx, dy), target = Math.atan2(dx, -dy);
    let L, ang, glow = 0;
    if (p < 0.12) { L = 90 * ease3(p / 0.12); ang = 0.15; }
    else if (p < 0.38) { const q = ease3((p - 0.12) / 0.26); L = 90 + q * 470; ang = 0.15 - 0.25 * q; glow = 0.6 * q; if (Math.random() < 0.5) B.shake = Math.max(B.shake, 0.15); }
    else if (p < 0.55) { const q = easeIn((p - 0.38) / 0.17); L = 560 + q * Math.max(0, dist + 40 - 560); ang = -0.1 + (target + 0.1) * q; glow = 0.8;
      for (let k = 1; k <= 4; k++) { const qq = easeIn(Math.max(0, (p - 0.38) / 0.17 - k * 0.06)); ucStaff(px, py, -0.1 + (target + 0.1) * qq, L, 0.18, 0); } }   // vệt mờ chuyển động
    else if (p < 0.78) { L = dist + 40; ang = target; glow = 0.5 * (1 - (p - 0.55) / 0.23); }
    else { const q = ease3((p - 0.78) / 0.22); L = (dist + 40) * (1 - q) + 70 * q; ang = target * (1 - q); glow = 0; }
    ucStaff(px, py, ang, L, p > 0.95 ? (1 - p) * 20 : 1, glow);
    if (p >= 0.55) ucOnce(f, 'hit', () => { B.shake = 1.0; B.flash = 0.25; sfx('boom'); B.decals.push({ x: f.tx, y: f.ty + 4, r: 190, t: 0, dur: 5 }); particles(f.tx, f.ty - 10, '#c8a070', 40, 380, 7); particles(f.tx, f.ty - 20, '#ffd34d', 30, 300, 5); });
    if (p > 0.53 && p < 0.9) { const q = (p - 0.53) / 0.37; uxSheet('sheet_boom_gold', f.tx, f.ty - 40, 420, q); uxSheet('sheet_crack', f.tx, f.ty, 520, q); }
  } },
  // Dương Tiễn — Hao Thiên Khuyển: chó thần phóng ra (chạy đổi chân), bật nhảy duỗi người, há miệng vồ cắn xé, hất quái
  duongtien: { dur: 1.7, hit: 0.6, draw(f, p) {
    ucDark(p, 0.45);
    const R1 = ucImg('hound_run1'), R2 = ucImg('hound_run2'), LP = ucImg('hound_leap'), BT = ucImg('hound_bite'); if (!R1 || !LP || !BT) return;
    const sx = f.x + 40, sy = f.y + 30, tx = Math.min(f.tx - 40, W - 140), ty = Math.max(f.ty - 10, 300), mx = sx + (tx - sx) * 0.5, my = sy + (ty - sy) * 0.5;
    const dog = (im, x, y, s, rot, a, glow) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.globalAlpha = a == null ? 1 : a; const w = 150 * s, h = w * im.height / im.width;
      if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= glow; ctx.filter = 'blur(8px) brightness(2) sepia(1) saturate(5)'; ctx.drawImage(im, -w / 2 - 6, -h + 4, w + 12, h + 8); ctx.restore(); }
      ctx.drawImage(im, -w / 2, -h + 8, w, h); ctx.restore(); };
    if (p < 0.32) {   // chạy: đổi chân mỗi 0.06, bụi dưới chân
      const q = p / 0.32, x = sx + (mx - sx) * ease3(q), y = sy + (my - sy) * q - Math.abs(Math.sin(q * Math.PI * 5)) * 8;
      for (let k = 1; k <= 3; k++) dog(Math.floor(p / 0.06 - k) % 2 ? R1 : R2, x - k * 26, y, 0.9 + q * 0.4, 0, 0.15, 0.5);   // bóng tốc độ
      dog(Math.floor(p / 0.06) % 2 ? R1 : R2, x, y, 0.9 + q * 0.4, 0, 1, 0.4);
      if (Math.random() < 0.6) particles(x - 30, y, '#d8c090', 2, 60, 3);
    } else if (p < 0.6) {   // phóng: cung parabol, duỗi người, to dần
      const q = (p - 0.32) / 0.28, x = mx + (tx - mx) * q, y = my + (ty - my) * q - Math.sin(q * Math.PI) * 120, s = 1.3 + q * 1.1, rot = -0.35 + q * 0.75;
      for (let k = 1; k <= 5; k++) { const qq = Math.max(0, q - k * 0.06); dog(LP, mx + (tx - mx) * qq, my + (ty - my) * qq - Math.sin(qq * Math.PI) * 120, 1.3 + qq * 1.1, -0.35 + qq * 0.75, 0.12, 0.8); }
      dog(q < 0.55 ? LP : BT, x, y, s, rot, 1, 0.6);
    } else {   // cắn: há miệng, giật lắc, rồi tan thành ánh vàng
      if (p < 0.92) { const qq = (p - 0.58) / 0.34; uxSheet('sheet_slash', tx + 30, ty - 60, 360, qq); uxSheet('sheet_boom_gold', tx + 30, ty - 40, 280, qq); }
      const q = (p - 0.6) / 0.4, sh = Math.sin(q * 40) * 8 * (1 - q);
      dog(BT, tx + sh, ty - 10, 2.3 - q * 0.3, 0.4 + Math.sin(q * 30) * 0.08 * (1 - q), 1 - Math.max(0, q - 0.6) / 0.4, 0.8 * (1 - q));
    }
    if (p >= 0.6) ucOnce(f, 'hit', () => { B.shake = 1.0; B.flash = 0.25; sfx('boom'); particles(f.tx, f.ty - 30, '#ffe58a', 40, 340, 5);
      for (const e of enemiesIn({ x: f.tx, y: f.ty }, 160)) if (!e.boss && !e.dead) { e.x = Math.min(W + 30, e.x + 60); e.hitT = 0.5; } });
  } },
  // Tiểu Bạch Long — Bạch Long Phi Thiên: thân rồng liền mạch uốn theo đường bay (cắt lát ảnh), đầu dẫn, nước bắn
  tieubachlong: { dur: 2.4, hit: 0.5, draw(f, p) {
    ucDark(p, 0.5);
    const head = ucImg('dragon_head'), body = ucImg('dragon_long'); if (!head || !body) return;
    const amp = 75, cy = f.ty - 80, span = 0.55;
    const path = s => [-300 + s * (W + 700), cy + Math.sin(s * 10 + p * 4) * amp - Math.sin(s * Math.PI) * 40];
    const hs = ease3(p) * 1.15, N = 56, BH = 78, bw = body.width, bhImg = body.height, scale = BH / bhImg;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;   // quầng sáng xanh theo thân
    ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = BH * 1.3; ctx.lineCap = 'round'; ctx.filter = 'blur(12px)'; ctx.beginPath();
    for (let j = 0; j <= N; j++) { const [x, y] = path(hs - j / N * span); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    for (let j = N - 1; j >= 0; j--) {   // lát j = 0 sát cổ (mép phải ảnh), j = N-1 là đuôi (mép trái)
      const s0 = hs - j / N * span, s1 = hs - (j + 1) / N * span, [x0, y0] = path(s0), [x1, y1] = path(s1);
      const ang = Math.atan2(y0 - y1, x0 - x1), len = Math.hypot(x0 - x1, y0 - y1) + 1.5, srcW = bw / N, srcX = bw - (j + 1) * srcW;
      ctx.save(); ctx.translate((x0 + x1) / 2, (y0 + y1) / 2); ctx.rotate(ang);
      ctx.drawImage(body, srcX, 0, srcW, bhImg, -len / 2, -bhImg * scale / 2, len, bhImg * scale); ctx.restore();
      if (j % 8 === 0 && Math.random() < 0.35) particles(x0, y0, '#bfeaff', 2, 90, 4);
    }
    const [hx, hy] = path(hs), [hx2, hy2] = path(hs - 0.01), ha = Math.atan2(hy - hy2, hx - hx2), HS = 170;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.filter = 'blur(14px)'; ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(HS * 0.3, 0, HS * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.drawImage(head, -HS * 0.32, -HS * head.height / head.width * 0.55, HS, HS * head.height / head.width); ctx.restore();
    if (p >= 0.5) ucOnce(f, 'hit', () => { B.shake = 0.9; B.flash = 0.22; sfx('boom'); particles(f.tx, f.ty - 40, '#9fe8ff', 46, 360, 6); });
    if (p > 0.45 && p < 0.85) uxSheet('sheet_boom_blue', f.tx, f.ty - 50, 440, (p - 0.45) / 0.4);
  } },
};

// ===================== KHUÔN BIÊN ĐẠO TUYỆT KỸ (dùng chung, vật thể riêng từng tướng ở art/ultc) =====================
function ucObj(n, x, y, w, rot, a, glowCol, glowK, flip) {   // vẽ vật thể tâm (x,y), rộng w
  const im = ucImg(n); if (!im) return null; const h = w * im.height / im.width;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1); ctx.globalAlpha = a == null ? 1 : Math.max(0, Math.min(1, a));
  if (glowCol) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= (glowK || 0.5); ctx.filter = 'blur(12px)'; ctx.fillStyle = glowCol; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.6, h * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); return h;
}
function ucHit(f, c, burst, r) { ucOnce(f, 'hit', () => { if (f.id) { cineImpact(f.tx, f.ty, c, isSSR(f.id)); elemSnd(f.id); } B.shake = Math.max(B.shake, 0.9); B.flash = 0.22; sfx('boom'); particles(f.tx, f.ty - 30, c || '#ffe58a', 40, 340, 5); if (r !== 0) B.decals.push({ x: f.tx, y: f.ty + 4, r: r || 160, t: 0, dur: 4 }); }); }
const tgtXY = f => [clamp(f.tx, 140, W - 120), clamp(f.ty, 280, H - 60)];
const UTPL = {
  // vũ khí trong tay phóng to, dựng lên trời rồi quật xuống mục tiêu
  smash(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), px = f.x + 6, py = f.y, dx = tx - px, dy = (ty - 10) - py, dist = Math.hypot(dx, dy), target = Math.atan2(dx, -dy);
    const im = ucImg(c.obj); if (!im) return; const draw = (ang, L, a, g) => { const w = L * im.width / im.height * (c.wk || 1.15); ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.globalAlpha = a;
      if (g) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * g * 0.45; ctx.fillStyle = c.col; ctx.filter = 'blur(14px)'; ctx.fillRect(-w * 0.6, -L, w * 1.2, L); ctx.restore(); }
      ctx.drawImage(im, -w / 2, -L, w, L); ctx.restore(); };
    let L, ang, g = 0; const MAXL = c.len || 520;
    if (p < 0.12) { L = 90 * ease3(p / 0.12); ang = 0.15; }
    else if (p < 0.38) { const q = ease3((p - 0.12) / 0.26); L = 90 + q * (MAXL - 90); ang = 0.15 - 0.25 * q; g = 0.6 * q; }
    else if (p < 0.55) { const q = easeIn((p - 0.38) / 0.17); L = MAXL + q * Math.max(0, dist + 40 - MAXL); ang = -0.1 + (target + 0.1) * q; g = 0.8;
      for (let k = 1; k <= 4; k++) { const qq = easeIn(Math.max(0, (p - 0.38) / 0.17 - k * 0.06)); draw(-0.1 + (target + 0.1) * qq, L, 0.18, 0); } }
    else if (p < 0.78) { L = dist + 40; ang = target; g = 0.5 * (1 - (p - 0.55) / 0.23); }
    else { const q = ease3((p - 0.78) / 0.22); L = (dist + 40) * (1 - q) + 70 * q; ang = target * (1 - q); }
    draw(ang, L, p > 0.95 ? (1 - p) * 20 : 1, g);
    if (p >= 0.55) ucHit(f, c.col, 1, 190);
    if (p > 0.53 && p < 0.9) { const q = (p - 0.53) / 0.37; uxSheet(c.sheet || 'sheet_boom_gold', tx, ty - 40, 420, q); uxSheet('sheet_crack', tx, ty, 520, q); }
  },
  // vật thể hiện trên trời, lớn dần, rồi giáng xuống mục tiêu
  drop(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), im0 = ucImg(c.obj), S = c.hgt && im0 ? c.hgt * im0.width / im0.height : (c.size || 220), hh = im0 ? S * im0.height / im0.width : S, land = ty + 12 - hh / 2, top = Math.max(60, hh / 2 - 40);
    let y, w = S, a = 1, rot = 0;
    if (p < 0.35) { const q = ease3(p / 0.35); y = top + 40 * Math.sin(q * 6) * (1 - q); w = S * (0.3 + 0.7 * q); a = q; rot = (1 - q) * (c.spin || 0); }
    else if (p < 0.5) { const q = easeIn((p - 0.35) / 0.15); y = top + (land - top) * q; for (let k = 1; k <= 3; k++) ucObj(c.obj, tx, top + (land - top) * Math.max(0, q - k * 0.15), S, 0, 0.2); }
    else { const q = (p - 0.5) / 0.5; y = land + Math.sin(q * 30) * 6 * (1 - q); a = 1 - Math.max(0, q - 0.6) / 0.4; }
    if (p < 0.5 && c.beam) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * Math.min(1, p * 4); ctx.filter = 'blur(18px)'; ctx.fillStyle = c.col; ctx.fillRect(tx - Math.max(S, 90) * 0.25, 0, Math.max(S, 90) * 0.5, ty); ctx.restore(); }
    ucObj(c.obj, tx, y, w, rot, a, c.col, 0.55);
    if (p >= 0.5) ucHit(f, c.col, 1, 170);
    if (p > 0.48 && p < 0.88) { const q = (p - 0.48) / 0.4; uxSheet(c.sheet || 'sheet_boom_gold', tx, ty - 40, 420, q); uxSheet('sheet_crack', tx, ty, 480, q); }
  },
  // thú chạy (đổi chân) → phóng → vồ
  beast(f, p, c) {
    ucDark(p, 0.45); const R = ucImg(c.run), A = ucImg(c.atk); if (!R || !A) return;
    if (c.roar && p < 0.4) ucRings(f.x, f.y + 20, p, c.col, 3, 260, 1 - p / 0.4);
    const sx = f.x + 40, sy = f.y + 30, tx = Math.min(f.tx - 40, W - 140), ty = Math.max(f.ty - 10, 300), mx = sx + (tx - sx) * 0.5, my = sy + (ty - sy) * 0.5, B0 = c.size || 170;
    const one = (im, x, y, s, rot, a, g, fl) => { const w = B0 * s, h = w * im.height / im.width; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.globalAlpha = a == null ? 1 : a;
      if (g) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= g; ctx.filter = 'blur(8px)'; ctx.fillStyle = c.col; ctx.beginPath(); ctx.ellipse(0, -h / 2, w * 0.55, h * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.drawImage(im, -w / 2, -h + 8 + (fl || 0), w, h); ctx.restore(); };
    if (p < 0.32) { const q = p / 0.32, x = sx + (mx - sx) * ease3(q), y = sy + (my - sy) * q - Math.abs(Math.sin(q * Math.PI * 5)) * 8;
      for (let k = 1; k <= 3; k++) one(R, x - k * 28, y, 0.9 + q * 0.4, 0, 0.14, 0.4); one(R, x, y, 0.9 + q * 0.4, Math.sin(p * 60) * 0.04, 1, 0.4); if (Math.random() < 0.6) particles(x - 30, y, '#d8c090', 2, 60, 3); }
    else if (p < 0.6) { const q = (p - 0.32) / 0.28, x = mx + (tx - mx) * q, y = my + (ty - my) * q - Math.sin(q * Math.PI) * 110, s = 1.3 + q * 1.0, rot = -0.3 + q * 0.6;
      for (let k = 1; k <= 4; k++) { const qq = Math.max(0, q - k * 0.07); one(A, mx + (tx - mx) * qq, my + (ty - my) * qq - Math.sin(qq * Math.PI) * 110, 1.3 + qq, -0.3 + qq * 0.6, 0.12, 0.7); }
      one(A, x, y, s, rot, 1, 0.6); }
    else { const q = (p - 0.6) / 0.4; if (p < 0.92) { const qq = (p - 0.58) / 0.34; uxSheet(c.sheet || 'sheet_slash', tx + 30, ty - 60, 360, qq); uxSheet('sheet_boom_gold', tx + 30, ty - 40, 280, qq); }
      one(A, tx + Math.sin(q * 40) * 8 * (1 - q), ty - 10, 2.3 - q * 0.3, 0.3, 1 - Math.max(0, q - 0.6) / 0.4, 0.7 * (1 - q)); }
    if (p >= 0.6) ucOnce(f, 'hit', () => { B.shake = 1.0; B.flash = 0.25; sfx('boom'); particles(f.tx, f.ty - 30, c.col, 40, 340, 5); for (const e of enemiesIn({ x: f.tx, y: f.ty }, 160)) if (!e.boss && !e.dead) { e.x = Math.min(W + 30, e.x + 60); e.hitT = 0.5; } });
  },
  // rồng / sinh vật dài bay uốn ngang màn hình (thân cắt lát)
  serpent(f, p, c) {
    ucDark(p, 0.5); const head = ucImg(c.head), body = ucImg(c.body); if (!head || !body) return;
    const cy = clamp(f.ty, 280, H - 60) - 80, span = 0.55, path = s => [-300 + s * (W + 700), cy + Math.sin(s * 10 + p * 4) * 75 - Math.sin(s * Math.PI) * 40];
    const hs = ease3(p) * 1.15, N = 56, BH = c.bh || 78, bw = body.width, bhI = body.height, sc = BH / bhI;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.strokeStyle = c.col; ctx.lineWidth = BH * 1.3; ctx.lineCap = 'round'; ctx.filter = 'blur(12px)'; ctx.beginPath();
    for (let j = 0; j <= N; j++) { const [x, y] = path(hs - j / N * span); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    for (let j = N - 1; j >= 0; j--) { const [x0, y0] = path(hs - j / N * span), [x1, y1] = path(hs - (j + 1) / N * span), ang = Math.atan2(y0 - y1, x0 - x1), len = Math.hypot(x0 - x1, y0 - y1) + 1.5, sw = bw / N;
      ctx.save(); ctx.translate((x0 + x1) / 2, (y0 + y1) / 2); ctx.rotate(ang); ctx.drawImage(body, bw - (j + 1) * sw, 0, sw, bhI, -len / 2, -bhI * sc / 2, len, bhI * sc); ctx.restore();
      if (j % 8 === 0 && Math.random() < 0.35) particles(x0, y0, c.col, 2, 90, 4); }
    const [hx, hy] = path(hs), [hx2, hy2] = path(hs - 0.01), HS = c.hs || 170; ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(hy - hy2, hx - hx2));
    ctx.drawImage(head, -HS * 0.32, -HS * head.height / head.width * 0.55, HS, HS * head.height / head.width); ctx.restore();
    if (p >= 0.5) ucHit(f, c.col, 1, 0);
    if (p > 0.45 && p < 0.85) uxSheet(c.sheet || 'sheet_boom_blue', f.tx, f.ty - 50, 440, (p - 0.45) / 0.4);
  },
  // ném vật thể xoay bay theo vòng cung tới mục tiêu rồi quay về (nhiều bản)
  throw(f, p, c) {
    ucDark(p, 0.4); const [tx, ty] = tgtXY(f), sx = f.x + 20, sy = f.y - 30, n = c.n || 1, S = c.size || 120;
    for (let k = 0; k < n; k++) { const off = (k - (n - 1) / 2) * 0.12, q = p < 0.5 ? ease3(p / 0.5) : 1 - ease3((p - 0.5) / 0.5), arc = (k % 2 ? -1 : 1) * 90 + off * 300;
      const x = sx + (tx - sx) * q, y = sy + (ty - 30 - sy) * q - Math.sin(q * Math.PI) * arc, rot = p * 30 * (c.spinDir || 1);
      for (let g = 1; g <= 4; g++) { const qq = Math.max(0, q - g * 0.05 * (p < 0.5 ? 1 : -1)); ucObj(c.obj, sx + (tx - sx) * qq, sy + (ty - 30 - sy) * qq - Math.sin(qq * Math.PI) * arc, S, rot - g * 0.4, 0.15); }
      ucObj(c.obj, x, y, S * (1 + 0.5 * Math.sin(q * Math.PI)), rot, 1, c.col, 0.6); }
    if (p >= 0.45) ucHit(f, c.col, 1, 140);
    if (p > 0.42 && p < 0.8) uxSheet(c.sheet || 'sheet_slash', tx, ty - 50, 400, (p - 0.42) / 0.38);
  },
  // vật thể khổng lồ quét ngang từ sau tướng tạo luồng gió/lửa đi qua sân
  sweep(f, p, c) {
    ucDark(p, 0.4); const [tx, ty] = tgtXY(f), px = f.x + 30, py = f.y - 40, S = c.size || 300;
    const q = p < 0.25 ? ease3(p / 0.25) : 1, ang = p < 0.25 ? -1.2 * q : -1.2 + 2.4 * easeIn(Math.min(1, (p - 0.25) / 0.2));
    if (p < 0.6) { ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ucObj(c.obj, 0, -S * 0.45, S * q, 0, 1 - Math.max(0, p - 0.5) * 10, c.col, 0.5); ctx.restore(); }
    if (p > 0.4) { const q2 = ease3((p - 0.4) / 0.6), x = px + (W + 200 - px) * q2; ucObj(c.wave || c.obj, x, ty - 80, 260 + 120 * q2, q2 * 6, 1 - q2, c.col, 0.6);
      if (c.tex) uxDraw(c.tex, x, ty - 90, 300, 1 - q2, 0); }
    if (p >= 0.5) ucHit(f, c.col, 1, 0);
    if (p > 0.45 && p < 0.85) uxSheet(c.sheet || 'sheet_slash', tx, ty - 50, 420, (p - 0.45) / 0.4);
  },
  // mưa vật thể rơi khắp vùng mục tiêu
  rain(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), n = c.n || 14, S = c.size || 70;
    for (let i = 0; i < n; i++) { const t0 = (i * 0.618) % 1 * 0.45, q = (p - t0) / 0.3; if (q < 0 || q > 1.4) continue; const x = tx + ((i * 137) % 260 - 130), yEnd = ty - 20 + ((i * 53) % 60 - 30);
      if (q <= 1) { const y = -60 + (yEnd + 60) * easeIn(q); ucObj(c.obj, x - (1 - q) * 80, y, S, c.tilt || 0.5, 1, c.col, 0.5); }
      else { const qq = (q - 1) / 0.4; uxSheet(c.sheet || 'sheet_boom_gold', x, yEnd - 20, 140, qq); } }
    if (p >= 0.5) ucHit(f, c.col, 1, 150);
  },
  // trồi lên từ mặt đất tại mục tiêu (bàn tay xương, lốc xoáy...), có thể hút quái về tâm
  summon(f, p, c) {
    ucDark(p, 0.5); const [tx, ty] = tgtXY(f), S = c.size || 260;
    if (c.waves && p < 0.6) { ucRings(f.x, f.y, p, c.col, 4, 420, 1 - p / 0.6); }
    const q = p < 0.35 ? ease3(p / 0.35) : p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25, rise = S * 0.9 * q;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, ty + 10); ctx.clip(); ucObj(c.obj, tx, ty + S * 0.45 - rise, S, Math.sin(p * 20) * 0.05, 1); ctx.restore();
    { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, S * 0.7); g.addColorStop(0, c.col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.45 * q; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(tx, ty, S * 0.7, S * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (c.pull && p > 0.2 && p < 0.7) for (const e of enemiesIn({ x: tx, y: ty }, 220)) if (!e.boss && !e.dead) { e.x += (tx - e.x) * 0.06; e.y += (ty - e.y) * 0.06; }
    if (p >= 0.45) ucHit(f, c.col, 1, 160);
    if (p > 0.4 && p < 0.8) uxSheet(c.sheet || 'sheet_crack', tx, ty, 460, (p - 0.4) / 0.4);
  },
  // hồi máu: vật thể lớn hiện trên đội, toả sáng, mưa hạt xuống từng đồng đội
  heal(f, p, c) {
    ucDark(p, 0.35); const al = alliesAlive(); const cx = al.length ? al.reduce((s, h) => s + h.x, 0) / al.length : f.x + 60, cy = 150;
    const q = p < 0.3 ? ease3(p / 0.3) : p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
    if (c.under) ucObj(c.under, cx, (al.length ? Math.max(...al.map(h => h.y)) : f.y) + 10, 320 * q, 0, q * 0.85, c.col, 0.4);
    ucObj(c.obj, cx, cy + Math.sin(p * 8) * 6, (c.size || 200) * q, c.tilt ? Math.sin(p * 4) * 0.2 - 0.3 : 0, q, c.col, 0.7);
    if (c.pet) ucObj(c.pet, cx + 120, cy + 60, 110 * q, 0, q);
    if (p > 0.3 && p < 0.8 && Math.random() < 0.5) for (const h of al) B.parts.push({ x: cx + (Math.random() - 0.5) * 40, y: cy + 20, vx: (h.x - cx) * 2, vy: (h.y - 70 - cy) * 2, life: 0.5, max: 0.5, color: c.col, size: 5 });
    if (p > 0.25 && p < 0.85) for (const h of al) { if (Math.random() < 0.35) particles(h.x + (Math.random() - 0.5) * 30, h.y - 120 + Math.random() * 40, c.col, 1, 40, 4); }
    if (p > 0.3 && p < 0.8) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const h of al) { ctx.globalAlpha = 0.25 * q; ctx.fillStyle = c.col; ctx.fillRect(h.x - 22, cy, 44, h.y - cy); } ctx.restore(); }
  },
};

// ---- v3: khuôn theo cơ chế (hút, xuyên, mê hoặc, niệm chú, bảng phong, rót trận, châu, quạt gió, sét, trói, lốc)
function cxBolt(x0, y0, x1, y1, col, w) {
  const pts = [[x0, y0]]; for (let i = 1; i < 8; i++) { const q = i / 8; pts.push([x0 + (x1 - x0) * q + (Math.random() - 0.5) * 44, y0 + (y1 - y0) * q]); } pts.push([x1, y1]);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [lw, a, cl] of [[w * 4, 0.22, col], [w, 0.95, '#ffffff']]) { ctx.lineWidth = lw; ctx.globalAlpha = a; ctx.strokeStyle = cl; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
  ctx.restore();
}
function ucRings(x, y, p, col, n, R, k) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; for (let i = 0; i < n; i++) { const r = ((p * 1.6 + i / n) % 1); ctx.globalAlpha = (1 - r) * 0.6 * (k == null ? 1 : k); ctx.lineWidth = 6 * (1 - r) + 1; ctx.beginPath(); ctx.ellipse(x, y, 30 + r * R, (30 + r * R) * 0.4, 0, 0, TAU); ctx.stroke(); } ctx.restore(); }
const fadeIO = (p, a, b) => p < a ? ease3(p / a) : p > b ? Math.max(0, (1 - p) / (1 - b)) : 1;
Object.assign(UTPL, {
  // Hồ lô: hiện cạnh tướng, xoay miệng chĩa vào bầy quái, luồng xoáy hút quái + hồn bay vào miệng, đậy nắp rung lắc
  suck(f, p, c) {
    ucDark(p, 0.5); const [tx, ty] = tgtXY(f), gx = f.x + 90, gy = f.y - 40, ang = Math.atan2(ty - 40 - gy, tx - gx), d = Math.hypot(tx - gx, ty - 40 - gy);
    const S = (c.size || 170) * ease3(Math.min(1, p / 0.18)), shake = p > 0.72 && p < 0.86 ? Math.sin(p * 220) * 0.14 : 0;
    if (p > 0.18 && p < 0.78) { const a = Math.min(1, (p - 0.18) / 0.1) * Math.min(1, (0.78 - p) / 0.08);
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, 0, d + 60, 0); g.addColorStop(0, c.col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.4 * a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(S * 0.35, -14); ctx.lineTo(d + 60, -140); ctx.lineTo(d + 60, 140); ctx.lineTo(S * 0.35, 14); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = c.col; ctx.lineWidth = 3;
      for (let i = 0; i < 14; i++) { const t = (p * 2.6 + i / 14) % 1, r = 1 - t, x = S * 0.35 + (d + 40) * r, w = 130 * r, yy = Math.sin(i * 2.3 + p * 25) * w; ctx.beginPath(); ctx.arc(x, yy, 5 + 12 * r, 0, Math.PI * 1.3); ctx.stroke(); }
      ctx.restore();
      for (const e of enemiesIn({ x: tx, y: ty }, c.r || 200)) { if (Math.random() < 0.3) B.parts.push({ x: e.x, y: e.y - 30, vx: (gx - e.x) * 2.2, vy: (gy - e.y + 30) * 2.2, life: 0.45, max: 0.45, color: c.col2 || '#f0d0ff', size: 5 });
        if (!e.boss && !e.dead) { e.x += (gx + 80 - e.x) * 0.012; e.y += (gy + 40 - e.y) * 0.006; } } }
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(ang + shake); ctx.scale(-1, 1); ucObj(c.obj, 0, 0, S, 0, p > 0.92 ? (1 - p) * 12 : 1, c.col, 0.6); ctx.restore();
    if (p > 0.72 && p < 0.76) particles(gx, gy, c.col, 6, 200, 4);
    if (p >= 0.6) ucHit(f, c.col, 1, 0);
  },
  // Thương lửa: thu về lấy đà, phóng xuyên thẳng qua sân, để lại đường lửa cháy
  pierce(f, p, c) {
    ucDark(p, 0.4); const [tx, ty] = tgtXY(f), sx = f.x + 30, sy = f.y, ang = Math.atan2(ty - 30 - sy, tx - sx), dx = Math.cos(ang), dy = Math.sin(ang);
    const q = p < 0.2 ? 0 : easeIn(Math.min(1, (p - 0.2) / 0.25)), D = 1500 * q, hx = sx + dx * D, hy = sy + dy * D;
    if (p < 0.2) { const k = p / 0.2; ucObj(c.obj, sx - dx * 40 * k, sy - dy * 40 * k, 44, ang + Math.PI / 2, k, c.col, 0.9); if (Math.random() < 0.6) particles(sx, sy, c.col, 2, 120, 4); }
    else { const fade = p > 0.6 ? Math.max(0, 1 - (p - 0.6) / 0.4) : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const [lw, a, col] of [[80, 0.22, c.col], [32, 0.5, c.col], [10, 0.9, '#fff3c0']]) { ctx.globalAlpha = a * fade; ctx.strokeStyle = col; ctx.lineWidth = lw * (0.7 + 0.3 * Math.sin(p * 50)); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke(); }
      ctx.restore();
      if (fade > 0) for (let i = 0; i < 3; i++) { const r = Math.random() * D; particles(sx + dx * r, sy + dy * r, c.col, 1, 90, 6); }
      if (q < 1) { for (let k = 1; k <= 3; k++) ucObj(c.obj, hx - dx * k * 50, hy - dy * k * 50, 44, ang + Math.PI / 2, 0.2); ucObj(c.obj, hx, hy, 50, ang + Math.PI / 2, 1, c.col, 0.9); } }
    if (p >= 0.42) ucHit(f, c.col, 1, 0);
  },
  // Mê hoặc: hồn hồ ly hiện sau bầy quái, sóng hồng lan ra, tim mê hoặc lơ lửng trên đầu từng con
  charm(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), q = fadeIO(p, 0.25, 0.85);
    ucObj(c.obj, tx + 60, ty - 150, 330, 0, 0.5 * q, c.col, 0.6, true);
    ucRings(tx, ty - 20, p, c.col, 3, 230, q);
    if (p > 0.3) for (const e of enemiesIn({ x: tx, y: ty }, c.r || 190)) ucObj('heart_charm', e.x + Math.sin(p * 9 + e.x) * 6, e.y - 72 * sizeOf(e) + Math.sin(p * 12 + e.x) * 5, 30, Math.sin(p * 8 + e.y) * 0.3, q);
    if (p >= 0.45) ucHit(f, c.col, 1, 0);
  },
  // Niệm chú: vòng chú vàng lan từ Đường Tăng, chữ Vạn xoay; vòng kim cô hiện trên đầu quái rồi siết lại
  chant(f, p, c) {
    ucDark(p, 0.4); const [tx, ty] = tgtXY(f), q = fadeIO(p, 0.2, 0.85);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.setLineDash([16, 10]); ctx.strokeStyle = c.col;
    for (let i = 0; i < 4; i++) { const r = ((p * 1.4 + i / 4) % 1); ctx.globalAlpha = (1 - r) * 0.7 * q; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, f.y + 30, 30 + r * 560, (30 + r * 560) * 0.35, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.font = '900 28px serif'; ctx.textAlign = 'center'; ctx.fillStyle = c.col; ctx.shadowColor = c.col; ctx.shadowBlur = 12; ctx.globalAlpha = q;
    for (let i = 0; i < 8; i++) { const a = p * 3 + i * Math.PI / 4; ctx.fillText('卍', f.x + Math.cos(a) * 95, f.y - 10 + Math.sin(a) * 38); } ctx.restore();
    if (p > 0.35) for (const e of enemiesIn({ x: tx, y: ty }, c.r || 190)) { const k = Math.min(1, (p - 0.35) / 0.12), s = 74 - 34 * ease3(Math.min(1, (p - 0.47) / 0.12)), sh = p > 0.59 && p < 0.75 ? Math.sin(p * 160) * 3 : 0;
      ucObj(c.obj, e.x + sh, e.y - 64 * sizeOf(e), s, 0, k * q, c.col, 0.7); if (p > 0.59 && Math.random() < 0.12) particles(e.x, e.y - 60, c.col, 2, 80, 3); }
    if (p >= 0.55) ucHit(f, c.col, 1, 0);
  },
  // Bảng Phong Thần: mở cuộn trên trời, tia vàng điểm danh từng con, nổ tại chỗ
  scroll(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), im = ucImg(c.obj); if (!im) return; const S = c.size || 160, h = S * im.height / im.width, cy = h / 2 + 30, un = ease3(Math.min(1, p / 0.3)), a = p > 0.88 ? (1 - p) / 0.12 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.rect(tx - S, cy - h / 2 * un, S * 2, h * un); ctx.clip(); ucObj(c.obj, tx, cy, S, 0, 1, c.col, 0.6); ctx.restore();
    if (p > 0.3) { const k = Math.min(1, (p - 0.3) / 0.15);
      for (const e of enemiesIn({ x: tx, y: ty }, c.r || 210)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * k * a; ctx.strokeStyle = c.col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(tx + (e.x - tx) * 0.15, cy + h / 2 * 0.8); ctx.lineTo(e.x, e.y - 40); ctx.stroke(); ctx.restore();
        if (p > 0.5) uxSheet(c.sheet || 'sheet_boom_blue', e.x, e.y - 40, 130, Math.min(1, (p - 0.5) / 0.3)); } }
    if (p >= 0.5) ucHit(f, c.col, 1, 0);
  },
  // Kim Đấu nghiêng rót dòng Hoàng Hà vàng xuống, thành vòng trận chín khúc trên đất
  pour(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), bx = tx - 70, by = 110, q = fadeIO(p, 0.2, 0.88), tilt = -0.2 + Math.min(1, p / 0.3) * 1.0;
    ucObj(c.obj, bx, by, (c.size || 150) * q, tilt, q, c.col, 0.6);
    if (p > 0.25 && p < 0.85) { const k = Math.min(1, (p - 0.25) / 0.1) * Math.min(1, (0.85 - p) / 0.1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const [lw, a] of [[34, 0.3], [12, 0.85]]) { ctx.globalAlpha = a * k; ctx.strokeStyle = c.col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(bx + 50, by + 20); for (let i = 1; i <= 12; i++) { const t = i / 12; ctx.lineTo(bx + 50 + (tx - bx - 50) * t + Math.sin(t * 9 + p * 30) * 10, by + 20 + (ty - by - 20) * t); } ctx.stroke(); }
      ctx.restore(); }
    if (p > 0.4) { const k = Math.min(1, (p - 0.4) / 0.15) * q, R = c.r || 170; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c.col;
      for (const [lw, a] of [[16, 0.25], [5, 0.85]]) { ctx.globalAlpha = a * k; ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i <= 200; i++) { const t = i / 200 * TAU + p * 2, r = R * (0.82 + 0.18 * Math.sin(t * 9)); const x = tx + Math.cos(t) * r, y = ty + Math.sin(t) * r * 0.4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      ctx.restore(); }
    if (p >= 0.5) ucHit(f, c.col, 1, 0);
  },
  // Định Hải Châu: các viên châu xoay quanh tướng rồi lần lượt bắn vòng cung vào bầy quái
  pearls(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), n = c.n || 5;
    for (let i = 0; i < n; i++) { const t0 = 0.3 + i * 0.07, a = i * TAU / n + Math.min(p, t0) * 10, ox = f.x + Math.cos(a) * 75, oy = f.y - 60 + Math.sin(a) * 30;
      if (p < t0) { const k = Math.min(1, p / 0.2); ucObj(c.obj, f.x + (ox - f.x) * k, f.y - 60 + (oy - f.y + 60) * k, 56 * k, 0, k, c.col, 0.6); }
      else { const q = (p - t0) / 0.18, ex = tx + ((i * 53) % 90 - 45), ey = ty - 30 + ((i * 31) % 40 - 20);
        if (q <= 1) { for (let k = 1; k <= 3; k++) { const qq = Math.max(0, q - k * 0.08); ucObj(c.obj, ox + (ex - ox) * easeIn(qq), oy + (ey - oy) * qq - Math.sin(qq * Math.PI) * 130, 56, 0, 0.2); }
          ucObj(c.obj, ox + (ex - ox) * easeIn(q), oy + (ey - oy) * q - Math.sin(q * Math.PI) * 130, 66, 0, 1, c.col, 0.8); }
        else if (q < 2.2) uxSheet(c.sheet || 'sheet_boom_gold', ex, ey, 230, (q - 1) / 1.2); } }
    if (p >= 0.5) ucHit(f, c.col, 1, 170);
  },
  // Quạt Ba Tiêu: giơ quạt sau lưng rồi quạt mạnh một cái, các lưỡi gió hình trăng khuyết quét qua sân, đẩy lùi quái
  wind(f, p, c) {
    ucDark(p, 0.4); const [tx, ty] = tgtXY(f), im = ucImg(c.obj); if (!im) return; const S = c.size || 180, h = S * im.height / im.width, px = f.x + 40, py = f.y + 40, q = fadeIO(p, 0.2, 0.8);
    const sw = p < 0.3 ? -1.0 * ease3(p / 0.3) : -1.0 + 1.9 * ease3(Math.min(1, (p - 0.3) / 0.12)) - (p > 0.42 ? 0.25 * Math.sin((p - 0.42) * 14) : 0);
    ctx.save(); ctx.translate(px, py); ctx.rotate(sw); ucObj(c.obj, 0, -h / 2, S, 0, q, c.col, 0.4); ctx.restore();
    for (let i = 0; i < 3; i++) { const t0 = 0.38 + i * 0.08, k = (p - t0) / 0.5; if (k < 0 || k > 1) continue; const x = px + 80 + (VIEW_R() - px) * ease3(k), R = 110 + 50 * i;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c.col; ctx.lineCap = 'round';
      for (const [lw, a] of [[28, 0.28], [8, 1]]) { ctx.lineWidth = lw; ctx.globalAlpha = (1 - k) * 0.75 * a; ctx.beginPath(); ctx.ellipse(x, ty - 40, R * 0.45, R, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
      ctx.restore(); if (Math.random() < 0.6) particles(x, ty - 40 + (Math.random() - 0.5) * R * 1.6, c.col, 2, 160, 3); }
    if (p > 0.45 && p < 0.8) for (const e of enemiesIn({ x: tx, y: ty }, c.r || 220)) if (!e.boss && !e.dead) e.x = Math.min(VIEW_R() - 20, e.x + 3);
    if (p >= 0.5) ucHit(f, c.col, 1, 0);
  },
  // Lôi phạt: giơ côn sấm hút sét, rồi sét giáng lần lượt xuống từng con quái
  bolt(f, p, c) {
    ucDark(p, 0.55); const [tx, ty] = tgtXY(f), q = Math.min(1, p / 0.15);
    ucObj(c.obj, f.x + 24, f.y - 70, 30, 0.2, q * (p > 0.9 ? (1 - p) * 10 : 1), c.col, 0.9);
    if (p < 0.4 && Math.random() < 0.6) cxBolt(f.x + 24 + (Math.random() - 0.5) * 80, -40, f.x + 24, f.y - 150, c.col, 3);
    enemiesIn({ x: tx, y: ty }, c.r || 170).slice(0, 8).forEach((e, i) => { const t0 = 0.35 + i * 0.05; if (p > t0 && p < t0 + 0.22 && Math.random() < 0.7) { cxBolt(e.x + (Math.random() - 0.5) * 70, -40, e.x, e.y - 30, c.col, 4); if (Math.random() < 0.4) particles(e.x, e.y - 20, '#ffffff', 3, 200, 3); } });
    if (p > 0.44 && p < 0.52) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.fillStyle = c.col; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore(); }
    if (p >= 0.45) ucHit(f, c.col, 1, 140);
    if (p > 0.45 && p < 0.85) uxSheet('sheet_boom_blue', tx, ty - 40, 340, (p - 0.45) / 0.4);
  },
  // Khổn Tiên Thằng: ném dây, dây quấn vòng quanh bầy quái rồi siết lại, bùa dán quanh, đất nứt
  bind(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), R = c.r || 180;
    if (p < 0.35) { const q = p / 0.35; ucObj(c.obj, f.x + (tx - f.x) * ease3(q), f.y - 40 + (ty - 60 - f.y + 40) * q - Math.sin(q * Math.PI) * 120, 110, q * 10, 1, c.col, 0.6); }
    else { const q = Math.min(1, (p - 0.35) / 0.25), r = R * (1.2 - 0.6 * ease3(q)), a = p > 0.88 ? (1 - p) / 0.12 : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
      for (const [lw, col] of [[16, '#7a4a10'], [10, c.col], [3, '#fff3c0']]) { ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); for (let i = 0; i <= 140; i++) { const t = i / 140 * TAU * 1.15, rr = r + Math.sin(t * 6) * 6; const x = tx + Math.cos(t + p * 4) * rr, y = ty - 20 + Math.sin(t + p * 4) * rr * 0.38 - i * 0.2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      for (let i = 0; i < 6; i++) { const t = i / 6 * TAU + p * 4, x = tx + Math.cos(t) * r, y = ty - 20 + Math.sin(t) * r * 0.38; ctx.fillStyle = '#ffe58a'; ctx.strokeStyle = '#a01010'; ctx.lineWidth = 2; ctx.fillRect(x - 6, y - 2, 12, 22); ctx.strokeRect(x - 6, y - 2, 12, 22); }
      ctx.restore(); }
    if (p >= 0.55) ucHit(f, c.col, 1, 150);
    if (p > 0.5 && p < 0.85) uxSheet('sheet_crack', tx, ty, 420, (p - 0.5) / 0.35);
  },
  // Lốc cát: cơn lốc mọc lên cạnh tướng, lượn tới bầy quái, cuốn quái vào tâm
  tornado(f, p, c) {
    ucDark(p, 0.45); const [tx, ty] = tgtXY(f), im = ucImg(c.obj); if (!im) return; const q = fadeIO(p, 0.2, 0.85), k = ease3(Math.min(1, p / 0.6)), x = f.x + 80 + (tx + 40 - f.x - 80) * k + Math.sin(p * 25) * 14, S = (c.size || 200) * (0.6 + 0.4 * q), h = S * im.height / im.width;
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(x, ty + 10 - h / 2); ctx.scale(1 + Math.sin(p * 30 + i) * 0.07, 1); ucObj(c.obj, 0, 0, S, 0, (i ? 0.25 : 1) * q, c.col, 0.4, i === 1); ctx.restore(); }
    if (Math.random() < 0.8) particles(x + (Math.random() - 0.5) * S, ty - Math.random() * h, c.col, 2, 140, 4);
    if (p > 0.3 && p < 0.8) for (const e of enemiesIn({ x, y: ty }, 120)) if (!e.boss && !e.dead) { e.x += (x - e.x) * 0.08; e.hitT = 0.2; }
    if (p >= 0.55) ucHit(f, c.col, 1, 0);
  },
});
// cấu hình tuyệt kỹ biên đạo cho từng tướng (dur, hit = thời điểm gây sát thương trong 0..1)
const UCFG = {
  batgioi: { t: 'smash', obj: 'rake', col: '#bfe0ff', len: 480 },
  nata: { t: 'pierce', obj: 'spear_fire', col: '#ff7a2e' },
  ngumavuong: { t: 'beast', run: 'bull_run', atk: 'bull_ram', size: 200, col: '#ff5a2a', sheet: 'sheet_boom_gold', roar: 1 },
  honghainhi: { t: 'serpent', head: 'firedragon_head', body: 'firedragon_body', col: '#ff7a2e', sheet: 'sheet_boom_gold' },
  quanam: { t: 'heal', obj: 'vase', under: 'lotus', size: 190, col: '#bfffd8', tilt: 1 },
  datky: { t: 'charm', obj: 'fox_pounce', col: '#ff7ad9' },
  duongtang: { t: 'chant', obj: 'golden_ring', col: '#ffe58a' },
  khuongtanha: { t: 'scroll', obj: 'scroll', size: 160, col: '#9fd0ff' },
  vantieu: { t: 'pour', obj: 'bowl', col: '#ffd34d' },
  trieucongminh: { t: 'pearls', obj: 'dinhhai_pearl', col: '#9fe8ff', sheet: 'sheet_boom_gold' },
  thailaoquan: { t: 'heal', obj: 'furnace', size: 210, col: '#9fffd0' },
  satang: { t: 'throw', obj: 'spade', n: 1, size: 180, col: '#d8e6f4', spinDir: -1 },
  thietphien: { t: 'wind', obj: 'bigfan', size: 180, col: '#9fffc0' },
  litinh: { t: 'drop', obj: 'pagoda', size: 240, col: '#ffd34d', beam: 1 },
  hangnga: { t: 'heal', obj: 'moon', pet: 'rabbit', size: 230, col: '#e0e8ff' },
  bachcot: { t: 'summon', obj: 'bonehand', size: 300, col: '#c88aff', waves: 1 },
  loichantu: { t: 'bolt', obj: 'thunderrod', col: '#9fd0ff' },
  thohanhton: { t: 'bind', obj: 'rope', col: '#ffd34d' },
  thaiatchannhan: { t: 'drop', obj: 'firebell', size: 260, col: '#ff7a2e' },
  thancongbao: { t: 'beast', run: 'leopard_run', atk: 'leopard_pounce', size: 180, col: '#6a7ad8', sheet: 'sheet_boom_blue' },
  longnu: { t: 'heal', obj: 'pearl', size: 190, col: '#9fe8ff' },
  kimgiac: { t: 'suck', obj: 'gourd', col: '#b88aff' },
  thaibachkimtinh: { t: 'heal', obj: 'star', size: 150, col: '#ffe58a' },
  culinhthan: { t: 'smash', obj: 'axe', col: '#ffd34d', len: 480 },
  hoangphongquai: { t: 'tornado', obj: 'sand_tornado', col: '#e8c060' },
};
const UDUR = { pierce: [1.5, 0.42], charm: [1.8, 0.45], chant: [1.9, 0.55], scroll: [1.8, 0.5], pour: [1.9, 0.5], pearls: [1.9, 0.5], wind: [1.7, 0.5], bolt: [1.7, 0.45], bind: [1.8, 0.55], suck: [2.0, 0.6], tornado: [1.9, 0.55], smash: [1.7, 0.55], drop: [1.6, 0.5], beast: [1.7, 0.6], serpent: [2.4, 0.5], throw: [1.6, 0.45], sweep: [1.6, 0.5], rain: [1.8, 0.5], summon: [1.7, 0.45], heal: [1.8, 0.5] };
const ucNeed = c => ['obj', 'run', 'atk', 'head', 'body', 'under', 'pet', 'wave'].map(k => c[k]).concat(c.t === 'charm' ? ['heart_charm'] : []).filter(Boolean);
for (const id in UCFG) { const c = UCFG[id], d = UDUR[c.t], need = ucNeed(c); ULTC[id] = { dur: d[0], hit: d[1], need, draw: (f, p) => UTPL[c.t](f, p, c) }; }
ULTC.duongtien.need = ['hound_run1', 'hound_run2', 'hound_leap', 'hound_bite']; ULTC.tieubachlong.need = ['dragon_head', 'dragon_long'];
const ucReady = id => { const U = ULTC[id]; return !!U && (U.need || []).every(n => ucImg(n)); };   // ảnh chưa có -> dùng tuyệt kỹ cũ
// Ngộ Không — Thất Thập Nhị Biến: 2 phân thân nhảy từ hai bên bổ gậy, rồi gậy thật phóng to quật xuống
ULTC.ngokhong = { dur: 1.9, hit: 0.6, need: ['staff', 'ngk_jump', 'cloud'], draw(f, p) {
  const J = ucImg('ngk_jump'), [tx, ty] = tgtXY(f);
  if (J && p < 0.62) for (const side of [-1, 1]) {   // phân thân: xuất hiện trên mây, vọt lên rồi bổ xuống
    const q = p / 0.62, sx = tx + side * 260, x = sx + (tx + side * 40 - sx) * ease3(q), y = (ty - 60) - Math.sin(q * Math.PI) * 220, w = 150 + 60 * q;
    if (q < 0.25) ucObj('cloud', sx, ty - 30, 200 * (1 - q * 2), 0, 1 - q * 4);
    ucObj('ngk_jump', x, y, w, side * (q - 0.5) * 0.6, q > 0.9 ? (1 - q) * 10 : 0.85, '#ffcf3f', 0.5, side < 0);
  }
  const q2 = Math.max(0, (p - 0.08) / 0.92); UTPL.smash(f, q2, { obj: 'staff', col: '#ffcf3f', len: 560, wk: 1.15 });
  if (p > 0.55 && p < 0.6) ucOnce(f, 'clones', () => { fxBurst(tx - 40, ty - 40, 'burst_gold', 220); fxBurst(tx + 40, ty - 40, 'burst_gold', 220); });
} };

// ===================== HỢP KÍCH CHỦ ĐỘNG =====================
function comboHero(id) { return B && B.heroes.find(h => h.id === id && !h.dead && !h.clone); }
function comboList() {   // các hợp kích có thể dùng ngay
  if (!B || B.over) return []; B.comboCd = B.comboCd || {};
  return COMBOS.filter(c => { const a = comboHero(c.a), b = comboHero(c.b); return a && b && CX[c.a + '+' + c.b] && canCast(a, 'ult') && canCast(b, 'ult') && (B.comboCd[c.name] || 0) <= B.time && cxReady(c); });
}
function comboFor(u) {   // hợp kích của u: đã sẵn chưa / đồng đội sắp đầy nộ
  B.comboCd = B.comboCd || {};
  for (const c of COMBOS) { const o = c.a === u.id ? c.b : c.b === u.id ? c.a : null; if (!o || !CX[c.a + '+' + c.b]) continue;
    const p = comboHero(o); if (!p || (B.comboCd[c.name] || 0) > B.time) continue;
    return { c, ready: canCast(u, 'ult') && canCast(p, 'ult') && cxReady(c), near: p.mp >= 40 && p.dk <= 0 }; }
  return null;
}
const cxReady = c => (CX[c.a + '+' + c.b].need || []).every(n => ucImg(n));
function castCombo(c) {
  const a = comboHero(c.a), b = comboHero(c.b); if (!a || !b) return;
  const X = CX[c.a + '+' + c.b], lead = 0.95;
  for (const u of [a, b]) { u.mp -= 60; u.cdU = 12; const sk_ = typeof Skel !== 'undefined' && Skel.has(u.id); u.castDur = sk_ ? 1.0 : 0.35; u.castT = u.castDur; u.castUlt = true; u.atkAnim = sk_ ? -1 : 0; }
  B.comboCd[c.name] = B.time + 25;
  const P = clusterPoint() || { x: W * 0.65, y: H * 0.6 }, tx = clamp(P.x, 160, W - 140), ty = clamp(P.y, 290, H - 60);
  for (const u of [a, b]) u.f = tx >= u.x ? 1 : -1;
  B.fx.push({ k: 'cx', key: c.a + '+' + c.b, c, a: { x: a.x, y: a.y - 34 * sizeOf(a) }, b: { x: b.x, y: b.y - 34 * sizeOf(b) }, x: a.x, y: a.y, tx, ty, t: -lead, dur: X.dur, sub: {}, done: {} });
  B.banner = { text: 'HỢP KÍCH · ' + c.name, sub: HEROES[c.a].name + ' × ' + HEROES[c.b].name, t: 0, boss: true };
  B.slowmo = 0.35; sfx('ult'); B.stat && (B.stat.combo = (B.stat.combo || 0) + 1);
  const hits = X.hits, src = a, R = X.r || 240;
  hits.forEach((h, i) => B.later.push({ t: lead + X.dur * h, fn: () => {
    if (!B || B.over) return; const last = i === hits.length - 1, n = hits.length;
    B.shake = Math.max(B.shake, last ? 1.1 : 0.6); B.flash = last ? 0.3 : 0.15; sfx('boom');
    const T = c.all ? aliveEnemies() : enemiesIn({ x: tx, y: ty }, R);
    if (c.mult > 0) for (const e of T) dealDmg(src, e, c.mult / n * (last ? 1.4 : 0.8), 'ult');
    if (last) {
      for (const e of T) { if (e.dead) continue;
        if (c.stun) e.stun = Math.max(e.stun || 0, c.stun);
        if (c.push && !e.boss) e.x = Math.min(VIEW_R() - 20, e.x + c.push);
        if (c.execute && !e.boss && e.hp < e.max * c.execute) { dealDmg(src, e, 99, 'ult'); floater(e.x, e.y - 70, 'Thu!', '#e0b0ff', 16); }
        if (c.confuse) { const nb = enemiesIn(e, 110).filter(o => o !== e).length; if (nb) { dealDmg(src, e, 0.6 * Math.min(4, nb), 'ult'); floater(e.x, e.y - 74, 'Loạn!', '#ff7ad9', 13); } } }
      if (c.revive) for (const hh of B.heroes) if (hh.dead && !hh.clone) { hh.dead = false; hh.hp = maxHp(hh) * c.revive; hh.dk = 0; hh.inv = 2; floater(hh.x, hh.y - 80, 'Hồi sinh!', '#fff3a0', 18); }
      if (c.mp) for (const al of alliesAlive()) al.mp = Math.min(100, al.mp + c.mp);
      if (c.buff) for (const al of alliesAlive()) al.buffs.push({ k: 'atk', v: c.buff, t: 8 });
      if (c.shield) for (const al of alliesAlive()) { al.shield = Math.max(al.shield, maxHp(al) * c.shield); al.shieldT = 6; }
      if (c.zone) B.zones.push({ x: tx, y: ty, r: 170, mult: 0.7, t: 4, dur: 4, src, tick: 0, color: c.col, tag: 'cx' });
      if (!c.all && c.mult > 0) B.decals.push({ x: tx, y: ty + 4, r: 200, t: 0, dur: 5 });
    }
    if (c.heal) for (const al of alliesAlive()) healAmD(src, al, getAtk(src) * c.heal / n);
  } }));
}
function updateComboBtn() {
  const bar = $('#teamBar'); if (!bar) return;
  let btn = $('#cxBtn'); const L = comboList(), c = L[0];
  if (!c) { if (btn) btn.remove(); return; }
  if (!btn) { btn = document.createElement('button'); btn.id = 'cxBtn'; btn.className = 'cx-btn'; bar.appendChild(btn); btn.onclick = () => { const k = btn.dataset.k, cc = comboList().find(x => x.name === k); if (cc) castCombo(cc); }; }
  if (btn.dataset.k !== c.name) { btn.dataset.k = c.name; btn.innerHTML = `<span class="cx-faces"><img src="${porB(c.a, 64)}"><img src="${porB(c.b, 64)}"></span><b>HỢP KÍCH</b><small>${esc(c.name)}</small>`; }
}
const CXI = {}; function cxPor(id) { let i = CXI[id]; if (!i) { i = CXI[id] = new Image(); i.src = (ULTX[id] && ULTX[id].cut) ? 'art/ultx/' + ULTX[id].cut + '.webp' : porB(id, 256); } return i.complete && i.naturalWidth ? i : null; }
function drawCX(f) {
  const X = CX[f.key];
  if (f.t < 0) {   // cut-in đôi: hai tướng trượt vào từ hai phía, tên hợp kích ở giữa
    const q = 1 + f.t / 0.95, a = q < 0.15 ? q / 0.15 : q > 0.85 ? (1 - q) / 0.15 : 1, s = ease3(Math.min(1, q * 3));
    ctx.save(); ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#0a0614'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.globalAlpha = a;
    const band = H * 0.56, y0 = H / 2 - band / 2;
    ctx.fillStyle = 'rgba(255,200,80,0.18)'; ctx.fillRect(0, y0, W, band);
    for (const [id, side] of [[f.c.a, -1], [f.c.b, 1]]) { const im = cxPor(id); if (!im) continue; const h = band * 1.05, w = h * im.width / im.height, cx = W / 2 + side * (W * 0.24 + (1 - s) * W * 0.5);
      ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? 0 : W / 2, y0, W / 2, band); ctx.clip(); ctx.translate(cx, H / 2); if (side > 0) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2 + 30, y0); ctx.lineTo(W / 2 - 30, y0 + band); ctx.stroke();
    ctx.restore(); return;
  }
  const p = Math.min(1, f.t / f.dur);
  ctx.save(); ctx.globalAlpha = 0.5 * Math.sin(Math.PI * p); ctx.fillStyle = '#05020c'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();
  UC_NODARK = true; try { X.draw(f, p); } finally { UC_NODARK = false; }
}
// một lớp biên đạo: chạy khuôn/hàm trong khoảng [a,b] của hợp kích, gốc ở tướng `who` (hoặc điểm tuỳ chọn)
function cxL(f, key, who, p, a, b, fn, at) {
  if (p < a || p > b) return; const o = at || f[who];
  const s = f.sub[key] = f.sub[key] || { x: o.x, y: o.y, tx: f.tx, ty: f.ty, f: 1, done: {} }; fn(s, (p - a) / (b - a));
}
const T = (n, cfg) => (s, q) => UTPL[n](s, q, cfg);
function cxStaffSpin(x, y, L, rot, a) { const im = ucImg('staff'); if (!im) return; const w = L * im.width / im.height * 1.15;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.5; ctx.filter = 'blur(10px)'; ctx.fillStyle = '#ffcf3f'; ctx.fillRect(-w, -L / 2, w * 2, L); ctx.restore();
  ctx.drawImage(im, -w / 2, -L / 2, w, L); ctx.restore(); }
function cxOrbit(obj, cx, cy, n, r, rot, S, a, col) { for (let i = 0; i < n; i++) { const t = rot + i * Math.PI * 2 / n; ucObj(obj, cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.45, S, rot * 3, a, col, 0.6); } }
function cxArc(img, x0, y0, x1, y1, q, hgt, w, flip, col) {   // nhân vật/vật nhảy theo cung
  const x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * hgt;
  for (let k = 1; k <= 3; k++) { const qq = Math.max(0, q - k * 0.06); ucObj(img, x0 + (x1 - x0) * qq, y0 + (y1 - y0) * qq - Math.sin(qq * Math.PI) * hgt, w, 0, 0.15, null, 0, flip); }
  ucObj(img, x, y, w, (q - 0.5) * 0.5, 1, col, 0.5, flip); return [x, y];
}
const CX = {
  // Thiên Nhãn Thần Hầu: thiên nhãn mở giữa trời, tia quét đánh dấu MỌI quái; phân thân Ngộ Không giáng xuống từng con
  'ngokhong+duongtien': { dur: 3.3, hits: [0.6, 0.72, 0.84, 0.93], need: ['sky_eye', 'ngk_jump', 'staff'], draw(f, p) {
    const ex = W * 0.55, ey = 105, op = p < 0.2 ? ease3(p / 0.2) : p > 0.9 ? (1 - p) / 0.1 : 1, im = ucImg('sky_eye');
    if (im) { const w = 340, h = w * im.height / im.width; ctx.save(); ctx.translate(ex, ey); ctx.scale(1, Math.max(0.05, op)); ucObj('sky_eye', 0, 0, w, 0, Math.min(1, op * 2), '#ffcf3f', 0.7); ctx.restore(); }
    const L = aliveEnemies().slice(0, 14); f.marks = f.marks || {};
    if (p > 0.22 && p < 0.55) { const sx = -40 + (VIEW_R() + 80) * ((p - 0.22) / 0.33);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(ex, ey, sx, H); g.addColorStop(0, 'rgba(255,220,120,0.7)'); g.addColorStop(1, 'rgba(255,120,60,0.05)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(ex - 10, ey + 20); ctx.lineTo(sx - 60, H); ctx.lineTo(sx + 60, H); ctx.lineTo(ex + 10, ey + 20); ctx.closePath(); ctx.fill(); ctx.restore();
      L.forEach(e => { if (e.x < sx) f.marks[e.uid || (e.uid = Math.random())] = 1; }); }
    if (p > 0.22 && p < 0.95) L.forEach(e => { if (!f.marks[e.uid]) return; const r = 26 + Math.sin(p * 20) * 3; ctx.save(); ctx.translate(e.x, e.y - 40); ctx.rotate(p * 6); ctx.strokeStyle = '#ff4a2a'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r - 8, 0); ctx.lineTo(r + 8, 0); ctx.stroke(); } ctx.restore(); });
    L.forEach((e, i) => { const t0 = 0.55 + (i % 7) * 0.045, q = (p - t0) / 0.12; if (q < 0 || q > 1.6 || !f.marks[e.uid]) return;
      if (q <= 1) { const y = -80 + (e.y - 60 + 80) * easeIn(q); ucObj('ngk_jump', e.x - 20, y, 120, 0.3, 1, '#ffcf3f', 0.5); for (let k = 1; k <= 2; k++) ucObj('ngk_jump', e.x - 20, -80 + (e.y - 60 + 80) * easeIn(Math.max(0, q - k * 0.12)), 120, 0.3, 0.2); }
      else uxSheet('sheet_boom_gold', e.x, e.y - 40, 160, (q - 1) / 0.6); });
  } },
  // Thiên Hà Đảo Lưu: sóng sông Thiên Hà dâng từ sau đội cuốn qua cả sân, đẩy lùi quái; đinh ba + xẻng cưỡi ngọn sóng
  'batgioi+satang': { dur: 2.9, hits: [0.4, 0.55, 0.7], need: ['tidal_wave', 'rake', 'spade'], draw(f, p) {
    const k = ease3(Math.min(1, Math.max(0, (p - 0.1) / 0.75))), a = p > 0.85 ? (1 - p) / 0.15 : Math.min(1, p / 0.1), x = -260 + (VIEW_R() + 520) * k, y = H * 0.56;
    for (let i = 2; i >= 1; i--) ucObj('tidal_wave', x - i * 90, y - 20, 420, 0, 0.18 * a);
    const h = ucObj('tidal_wave', x, y, 460, Math.sin(p * 10) * 0.03, a, '#7fc8ff', 0.4) || 300;
    ucObj('rake', x + 40, y - h * 0.42, 34, -0.9 + Math.sin(p * 12) * 0.2, a, '#bfe0ff', 0.6); ucObj('spade', x - 70, y - h * 0.4, 110, p * 12, a, '#d8e6f4', 0.6);
    if (Math.random() < 0.9) particles(x + 120, y - 60 + (Math.random() - 0.5) * 200, '#dff4ff', 3, 160, 4);
    for (const e of aliveEnemies()) if (!e.boss && Math.abs(e.x - (x + 150)) < 90) { e.x = Math.min(VIEW_R() - 20, e.x + 6); e.hitT = 0.2; }
  } },
  // Hoả Diệm Sơn: trâu dậm vỡ đất phun dung nham, quạt thổi lửa thành lốc lửa lớn quét qua bầy quái, để lại biển lửa
  'ngumavuong+thietphien': { dur: 3.1, hits: [0.3, 0.55, 0.72, 0.9], need: ['bull_ram', 'bigfan', 'fire_tornado'], draw(f, p) {
    const [tx, ty] = tgtXY(f);
    if (p < 0.35) { const q = p / 0.35, x = tx - 180, y = ty - 30 - Math.abs(Math.sin(q * Math.PI * 2)) * 60; ucObj('bull_ram', x, y - 60, 230, 0, 1, '#ff5a2a', 0.5);
      if (q > 0.45) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, ty, 0, x, ty, 200); g.addColorStop(0, 'rgba(255,140,40,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.globalAlpha = (q - 0.45) * 1.8; ctx.beginPath(); ctx.ellipse(x, ty, 200, 70, 0, 0, TAU); ctx.fill(); ctx.restore(); uxSheet('sheet_crack', x, ty, 380, (q - 0.45) / 0.55); } }
    cxL(f, 'fan', 'b', p, 0.2, 0.55, (s, q) => { const im = ucImg('bigfan'); if (!im) return; const h = 200 * im.height / im.width, sw = -1 + 1.8 * ease3(Math.min(1, q / 0.5)); ctx.save(); ctx.translate(s.x + 40, s.y + 40); ctx.rotate(sw); ucObj('bigfan', 0, -h / 2, 200, 0, 1 - Math.max(0, q - 0.7) / 0.3, '#ffb060', 0.4); ctx.restore(); });
    if (p > 0.32 && ucImg('fire_tornado')) { const q = (p - 0.32) / 0.68, im = ucImg('fire_tornado'), S = 150 + 110 * Math.min(1, q * 2), h = S * im.height / im.width, x = tx - 180 + 360 * ease3(q) + Math.sin(p * 30) * 12, a = q > 0.85 ? (1 - q) / 0.15 : 1;
      for (let i = 0; i < 2; i++) { ctx.save(); ctx.translate(x, ty + 10 - h / 2); ctx.scale(1 + Math.sin(p * 34 + i) * 0.08, 1); ucObj('fire_tornado', 0, 0, S, 0, (i ? 0.3 : 1) * a, '#ff7a2e', 0.5, i === 1); ctx.restore(); }
      if (Math.random() < 0.9) particles(x + (Math.random() - 0.5) * S, ty - Math.random() * h, '#ffb060', 2, 160, 4);
      for (const e of enemiesIn({ x, y: ty }, 130)) if (!e.boss && !e.dead) e.x += (x - e.x) * 0.06; }
  } },
  // Cửu Long Hoả Luân: Hoả Tráo úp nhốt bầy quái, chín hoả long xoắn ốc bay lên quanh chuông, Phong Hoả Luân xoay khoá vòng
  'nata+thaiatchannhan': { dur: 3.0, hits: [0.42, 0.62, 0.8, 0.93], need: ['firebell', 'firedragon_head', 'firewheel'], draw(f, p) {
    const [tx, ty] = tgtXY(f);
    cxL(f, 'bell', 'b', p, 0, 0.62, T('drop', { obj: 'firebell', size: 250, col: '#ff7a2e' }));
    if (p > 0.55) { const q = (p - 0.55) / 0.45, a = q > 0.8 ? (1 - q) / 0.2 : 1; ucObj('firebell', tx, ty + 12 - 125, 250, Math.sin(p * 60) * 0.02, a, '#ff7a2e', 0.6);
      for (let i = 0; i < 9; i++) { const t = q * 1.4 - i * 0.07; if (t < 0 || t > 1) continue; const an = i * TAU / 9 + t * 5, r = 140 - t * 60, x = tx + Math.cos(an) * r, y = ty - 60 - t * 380 + Math.sin(an) * r * 0.3;
        ucObj('firedragon_head', x, y, 78, -Math.PI / 2 + Math.cos(an) * 0.5, a * (1 - t * 0.4), '#ff7a2e', 0.6); particles(x, y + 20, '#ffb060', 1, 80, 4); }
      cxOrbit('firewheel', tx, ty - 10, 2, 170, p * 12, 90, a, '#ff7a2e'); }
  } },
  // Thiên Binh Trấn Ma: tháp Linh Lung trấn giữ bầy quái, bóng Cự Linh Thần khổng lồ hiện sau đội vung rìu bổ xuống
  'litinh+culinhthan': { dur: 3.0, hits: [0.42, 0.82], need: ['pagoda', 'giant_culinh'], draw(f, p) {
    const [tx, ty] = tgtXY(f);
    cxL(f, 'pg', 'a', p, 0, 0.6, T('drop', { obj: 'pagoda', size: 200, col: '#ffd34d', beam: 1 }));
    if (p > 0.55) ucObj('pagoda', tx, ty + 12 - 150, 200, 0, Math.min(1, (1 - p) / 0.15), '#ffd34d', 0.5);
    const im = ucImg('giant_culinh'); if (im && p > 0.3) { const S = 330, h = S * im.height / im.width, gx = tx - 230, a = Math.min(1, (p - 0.3) / 0.15) * (p > 0.9 ? (1 - p) / 0.1 : 1), sw = p < 0.62 ? -0.25 * Math.min(1, (p - 0.3) / 0.2) : -0.25 + 0.75 * easeIn(Math.min(1, (p - 0.62) / 0.18));
      ctx.save(); ctx.translate(gx, ty + 30); ctx.rotate(sw); ctx.globalAlpha = 0.85 * a; ucObj('giant_culinh', 0, -h / 2, S, 0, 1, '#ffd34d', 0.5, true); ctx.restore();
      if (p > 0.8 && p < 0.97) { uxSheet('sheet_crack', tx + 40, ty, 640, (p - 0.8) / 0.17); uxSheet('sheet_boom_gold', tx + 40, ty - 40, 460, (p - 0.8) / 0.17); } }
  } },
  // Từ Hàng Phổ Độ: hoa sen lớn nở dưới đội, rồng nước của Long Nữ cuộn quanh, cột sáng hồi sinh đồng đội đã ngã
  'quanam+longnu': { dur: 2.9, hits: [0.35, 0.6, 0.85], need: ['lotus', 'vase', 'pearl'], draw(f, p) {
    cxL(f, 'hl', 'a', p, 0, 1, T('heal', { obj: 'vase', under: 'lotus', size: 160, col: '#bfffd8', tilt: 1 }));
    const al = alliesAlive(), cx = al.length ? al.reduce((s, h) => s + h.x, 0) / al.length : f.a.x, q = fadeIO(p, 0.2, 0.85);
    ucObj('pearl', cx + Math.cos(p * 6) * 150, 200 + Math.sin(p * 6) * 40, 110 * q, p * 3, q, '#9fe8ff', 0.6);
    for (const h of B.heroes) if (h.dead && !h.clone) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, 0, 0, h.y); g.addColorStop(0, 'rgba(255,255,220,0)'); g.addColorStop(1, 'rgba(255,240,160,0.8)'); ctx.fillStyle = g; ctx.globalAlpha = q; ctx.fillRect(h.x - 30, 0, 60, h.y + 10); ctx.restore(); if (Math.random() < 0.5) particles(h.x, h.y - 30, '#fff3a0', 2, 100, 4); }
  } },
  // Bạch Mã Tây Hành: Đường Tăng cưỡi Bạch Long Mã phi băng qua sân, để lại vệt kinh văn vàng; cả đội được gia trì
  'duongtang+tieubachlong': { dur: 2.9, hits: [0.3, 0.48, 0.66, 0.84], need: ['monk_horse'], draw(f, p) {
    const [, ty] = tgtXY(f), k = Math.min(1, p / 0.9), x = -220 + (VIEW_R() + 440) * k, y = ty - 10 - Math.abs(Math.sin(p * 26)) * 10;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x - 600, 0, x, 0); g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(1, 'rgba(255,230,140,0.55)'); ctx.fillStyle = g; ctx.fillRect(x - 600, y - 60, 600, 70); ctx.restore();
    ctx.save(); ctx.font = '900 24px serif'; ctx.fillStyle = '#ffe58a'; ctx.shadowColor = '#ffcf3f'; ctx.shadowBlur = 10; for (let i = 1; i <= 8; i++) { ctx.globalAlpha = Math.max(0, 1 - i / 8); ctx.fillText('卍', x - i * 70, y - 30 + Math.sin(p * 10 + i) * 14); } ctx.restore();
    for (let i = 1; i <= 3; i++) ucObj('monk_horse', x - i * 50, y - 80, 230, 0, 0.15);
    ucObj('monk_horse', x, y - 80, 240, Math.sin(p * 26) * 0.03, 1, '#fff3a0', 0.5);
    if (Math.random() < 0.7) particles(x - 80, y, '#ffe58a', 3, 120, 4);
    for (const h of alliesAlive()) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * fadeIO(p, 0.3, 0.8); ctx.strokeStyle = '#ffe58a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(h.x, h.y + 4, 34, 12, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  } },
  // Kim Đấu Định Hải: Kim Đấu lơ lửng úp miệng xuống hút cả bầy quái về một chỗ, Định Hải Châu nối nhau dội vào, đấu sập xuống nổ
  'vantieu+trieucongminh': { dur: 3.1, hits: [0.5, 0.65, 0.88], need: ['bowl', 'dinhhai_pearl'], draw(f, p) {
    const [tx, ty] = tgtXY(f), by = p < 0.8 ? ty - 230 + Math.sin(p * 8) * 8 : ty - 230 + 200 * easeIn((p - 0.8) / 0.12), a = p > 0.93 ? (1 - p) / 0.07 : Math.min(1, p / 0.15);
    if (p > 0.15 && p < 0.8) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) { const t = (p * 2 + i / 12) % 1, r = 260 * (1 - t), an = i * 0.52 + t * 6; ctx.globalAlpha = 0.6 * t; ctx.beginPath(); ctx.arc(tx, ty - 20, r, an, an + 0.9); ctx.stroke(); } ctx.restore();
      for (const e of aliveEnemies()) if (!e.boss && Math.hypot(e.x - tx, e.y - ty) < 300) { e.x += (tx - e.x) * 0.025; e.y += (ty - e.y) * 0.025; } }
    ucObj('bowl', tx, by, 230, Math.PI, a, '#ffd34d', 0.6);
    for (let i = 0; i < 6; i++) { const t0 = 0.4 + i * 0.06, q = (p - t0) / 0.12; if (q < 0 || q > 1) continue; const ox = f.b.x, oy = f.b.y - 60; ucObj('dinhhai_pearl', ox + (tx - ox) * easeIn(q), oy + (by - oy) * q - Math.sin(q * Math.PI) * 120, 60, 0, 1, '#9fe8ff', 0.8); }
    if (p > 0.88 && p < 1) { uxSheet('sheet_boom_gold', tx, ty - 40, 480, (p - 0.88) / 0.12); uxSheet('sheet_crack', tx, ty, 560, (p - 0.88) / 0.12); }
  } },
  // Phong Thần Lôi Phạt: Phong Thần Bảng mở trên trời điểm danh mọi quái, Lôi Chấn Tử dang cánh bổ nhào, sét giáng từng con
  'khuongtanha+loichantu': { dur: 3.2, hits: [0.6, 0.72, 0.84, 0.93], need: ['scroll', 'loi_dive'], draw(f, p) {
    const im = ucImg('scroll'); if (!im) return; const S = 150, h = S * im.height / im.width, sx = W * 0.5, cy = h / 2 + 24, un = ease3(Math.min(1, p / 0.25)), a = p > 0.9 ? (1 - p) / 0.1 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.rect(sx - S, cy - h / 2 * un, S * 2, h * un); ctx.clip(); ucObj('scroll', sx, cy, S, 0, 1, '#9fd0ff', 0.6); ctx.restore();
    const L = aliveEnemies().slice(0, 14);
    if (p > 0.25 && p < 0.6) { const k = (p - 0.25) / 0.35; L.forEach((e, i) => { if (i / L.length > k) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffe58a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, cy + h / 2 * 0.7); ctx.lineTo(e.x, e.y - 40); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.fillStyle = '#ffe58a'; ctx.strokeStyle = '#a01010'; ctx.lineWidth = 2; ctx.fillRect(e.x - 7, e.y - 92, 14, 26); ctx.strokeRect(e.x - 7, e.y - 92, 14, 26); ctx.restore(); }); }
    if (p > 0.42 && p < 0.72) { const q = (p - 0.42) / 0.3; ucObj('loi_dive', -100 + (W * 0.6 + 100) * ease3(q), 60 + 200 * q, 220, 0, q > 0.85 ? (1 - q) / 0.15 : 1, '#9fd0ff', 0.7); }
    L.forEach((e, i) => { const t0 = 0.58 + (i % 7) * 0.045; if (p > t0 && p < t0 + 0.14) { if (Math.random() < 0.8) cxBolt(e.x + (Math.random() - 0.5) * 60, -40, e.x, e.y - 30, '#9fd0ff', 4); if (Math.random() < 0.3) particles(e.x, e.y - 20, '#ffffff', 3, 200, 3); } });
  } },
  // Yêu Mị Hồn Ca: sương hồng tím phủ sân, bóng hồ ly và tay xương hiện ra, quái mê muội xoay vòng rồi đánh lẫn nhau
  'datky+bachcot': { dur: 2.9, hits: [0.4, 0.6, 0.85], need: ['fox_pounce', 'bonehand', 'heart_charm'], draw(f, p) {
    const [tx, ty] = tgtXY(f), q = fadeIO(p, 0.2, 0.85);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const g = ctx.createRadialGradient(tx + Math.cos(p * 2 + i * 2) * 120, ty - 60, 0, tx, ty - 60, 360); g.addColorStop(0, i % 2 ? 'rgba(200,120,255,0.35)' : 'rgba(255,120,210,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.globalAlpha = q; ctx.fillRect(tx - 400, ty - 400, 800, 600); } ctx.restore();
    ucObj('fox_pounce', tx + 40, ty - 170, 360, 0, 0.45 * q, '#ff7ad9', 0.5, true);
    for (const [dx, d0] of [[-150, 0.15], [150, 0.22]]) cxL(f, 'h' + dx, 'b', p, d0, 0.8 + d0 * 0.5, T('summon', { obj: 'bonehand', size: 200, col: '#c88aff', sheet: 'sheet_crack' }), { x: f.b.x, y: f.b.y }), f.sub['h' + dx] && (f.sub['h' + dx].tx = tx + dx);
    if (p > 0.35) for (const e of enemiesIn({ x: tx, y: ty }, 260)) { const hy = e.y - 72 * sizeOf(e); ucObj('heart_charm', e.x + Math.cos(p * 8 + e.x) * 16, hy + Math.sin(p * 8 + e.x) * 6, 26, 0, q); if (p > 0.55 && Math.random() < 0.04) particles(e.x, e.y - 30, '#ff7ad9', 4, 160, 4); }
  } },
  // Luyện Ma Hồ Lô: hồ lô chĩa vào bầy quái hút quái yếu vào, đổ vào lò Bát Quái luyện thành kim đan bay về hồi máu cả đội
  'thailaoquan+kimgiac': { dur: 3.2, hits: [0.5, 0.88], need: ['gourd', 'furnace'], draw(f, p) {
    cxL(f, 'g', 'b', p, 0, 0.62, T('suck', { obj: 'gourd', col: '#b88aff', size: 170 }));
    const al = alliesAlive(), cx = al.length ? al.reduce((s, h) => s + h.x, 0) / al.length : f.a.x, fy = 170;
    if (p > 0.5) { const q = fadeIO((p - 0.5) / 0.5, 0.2, 0.85); ucObj('furnace', cx, fy, 170 * q, Math.sin(p * 40) * 0.03, q, '#9fffd0', 0.7);
      if (p < 0.72) { const gx = f.b.x + 90, gy = f.b.y - 40; if (Math.random() < 0.7) B.parts.push({ x: gx, y: gy, vx: (cx - gx) * 2.4, vy: (fy - gy) * 2.4, life: 0.4, max: 0.4, color: '#e0b0ff', size: 6 }); }
      if (p > 0.78) for (const h of al) if (Math.random() < 0.2) B.parts.push({ x: cx, y: fy, vx: (h.x - cx) * 2.2, vy: (h.y - 60 - fy) * 2.2, life: 0.45, max: 0.45, color: '#ffe58a', size: 7 }); }
  } },
  // Nguyệt Tinh Dao Trì: trăng tròn lên trên đội, mưa sao nhẹ rơi xuống từng đồng đội, hồi máu và hồi nội công
  'hangnga+thaibachkimtinh': { dur: 2.8, hits: [0.4, 0.7], need: ['moon', 'rabbit', 'star'], draw(f, p) {
    cxL(f, 'm', 'a', p, 0, 1, T('heal', { obj: 'moon', pet: 'rabbit', size: 220, col: '#e0e8ff' }));
    const q = fadeIO(p, 0.2, 0.85);
    for (const [j, h] of alliesAlive().entries()) for (let i = 0; i < 2; i++) { const t = (p * 1.8 + i * 0.5 + j * 0.13) % 1; ucObj('star', h.x + Math.sin(j + i) * 20, -20 + (h.y - 60) * t, 46, 0.5, q * (1 - t * 0.5), '#ffe58a', 0.5); }
    for (const h of alliesAlive()) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * q; ctx.strokeStyle = '#7fb3ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(h.x, h.y + 4, 30 + Math.sin(p * 12) * 4, 11, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  } },
};


// ===================== ĐIỆN ẢNH CHO TUYỆT KỸ =====================
const ULT_THEME = { ngokhong: ['#ffb02e', '#4a1400'], nata: ['#ff5a2a', '#3a0800'], ngumavuong: ['#ff3a1a', '#2a0505'], quanam: ['#bfffe8', '#06262a'], datky: ['#ff6ad0', '#2a0828'],
  duongtien: ['#9fc8ff', '#06102a'], vantieu: ['#ffd34d', '#2a1a00'], thailaoquan: ['#9fffd0', '#04201a'], loichantu: ['#7fb3ff', '#040a2a'], thaiatchannhan: ['#ff7a2e', '#2a0a00'], tieubachlong: ['#7fe0ff', '#021a2a'], khuongtanha: ['#ffe58a', '#1a1404'] };
const cineTheme = id => ULT_THEME[id] || [(UCFG[id] && UCFG[id].col) || '#ffe58a', '#0a0612'];
const isSSR = id => (window.SSR_POOL || SSR_POOL).includes(id);
function drawCineSky(f, p) {   // trời đổi màu theo hệ (lớp thế giới, trước vật thể)
  const [c1, c2] = cineTheme(f.id), k = Math.sin(Math.PI * Math.min(1, p));
  ctx.save(); const g = ctx.createLinearGradient(0, -H * 0.2, 0, H * 0.9); g.addColorStop(0, c2); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.75 * k; ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 2); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35 * k; ctx.fillStyle = c1; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();
}
function drawCharge(f, q) {   // lấy đà: trận pháp dưới chân, cột khí, năng lượng tụ về tướng
  const [c1] = cineTheme(f.id), x = f.x, y = f.y + 30, big = isSSR(f.id);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.globalAlpha = 0.85 * q;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.38); ctx.rotate(q * 5);
  for (const r of [78, 60]) { ctx.beginPath(); ctx.arc(0, 0, r * q, 0, TAU); ctx.stroke(); }
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(60 * q, 0); ctx.lineTo(78 * q, 0); ctx.stroke(); } ctx.restore();
  const g = ctx.createLinearGradient(0, y - 240, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c1); ctx.globalAlpha = (big ? 0.6 : 0.4) * q; ctx.fillStyle = g; ctx.fillRect(x - 46 * q, y - 240, 92 * q, 240);
  ctx.restore();
  for (let i = 0; i < (big ? 6 : 3); i++) { const a = Math.random() * TAU, r = 170 + Math.random() * 90; B.parts.push({ x: x + Math.cos(a) * r, y: y - 50 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 0.6 * 3.2, life: 0.3, max: 0.3, color: c1, size: big ? 5 : 4 }); }
}
function cineImpact(x, y, col, big) {   // trúng đòn: khung âm bản, đứng hình, sóng xung kích, đá vụn
  B.impact = { x, y, col: col || '#fff3c0', t0: performance.now(), big };
  B.hitstop = Math.max(B.hitstop || 0, big ? 0.13 : 0.08); B.shake = Math.max(B.shake, big ? 1.3 : 1);
  for (let i = 0; i < (big ? 26 : 16); i++) { const a = -Math.random() * Math.PI, s = 220 + Math.random() * 380; B.parts.push({ x, y: y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, max: 0.7, color: i % 3 ? '#5a3a1a' : '#a08060', size: 5 + Math.random() * 5 }); }
  B.fx.push({ k: 'ring', x, y, r: big ? 460 : 330, color: col, t: 0, dur: 0.5 }); if (big) B.fx.push({ k: 'ring', x, y, r: 260, color: '#ffffff', t: -0.08, dur: 0.45 });
}
function drawCine() {   // lớp màn hình: viền điện ảnh + khung âm bản + vệt tốc độ toả từ điểm va chạm
  const on = B.fx.some(f => f.k === 'sig' && f.uc && f.t > -0.45 && f.t < f.dur);
  B.lbox = (B.lbox || 0) + ((on ? 1 : 0) - (B.lbox || 0)) * 0.15;
  const I = B.impact;
  if (I) { const a = (performance.now() - I.t0) / 1000, sx = GATE_X + (I.x - GATE_X) * VIEW_Z, sy = H * VIEW_PY + (I.y - 30 - H * VIEW_PY) * VIEW_Z;
    if (a < 0.055) { ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    else if (a < 0.11) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (a < 0.5) { const k = 1 - a / 0.5; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = I.col;
      for (let i = 0; i < 44; i++) { const an = i * TAU / 44 + (i % 2) * 0.04, r0 = 80 + ((i * 37) % 70) + a * 300, r1 = r0 + 200 + ((i * 53) % 220); ctx.globalAlpha = k * 0.75; ctx.lineWidth = 1 + (i % 3) * 1.6; ctx.beginPath(); ctx.moveTo(sx + Math.cos(an) * r0, sy + Math.sin(an) * r0); ctx.lineTo(sx + Math.cos(an) * r1, sy + Math.sin(an) * r1); ctx.stroke(); }
      ctx.restore(); }
    if (a > 0.9) B.impact = null; }
  if (B.lbox > 0.01) { const h = 46 * B.lbox; ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); ctx.restore(); }
}
function bagua(x, y, R, rot, col, a) {   // trận Bát Quái trên mặt đất
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.4); ctx.rotate(rot); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 4;
  for (const r of [R, R * 0.74, R * 0.26]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
  for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4); for (let j = 0; j < 3; j++) { const yy = -R * 0.9 + j * 9; ctx.beginPath(); if ((i >> j) & 1) { ctx.moveTo(-16, yy); ctx.lineTo(-4, yy); ctx.moveTo(4, yy); ctx.lineTo(16, yy); } else { ctx.moveTo(-16, yy); ctx.lineTo(16, yy); } ctx.stroke(); } ctx.restore(); }
  ctx.restore();
}
// lớp vẽ tay cho tướng SR (dùng tranh năng lượng <id>_fx): 'ground' trận dưới đất, 'burst' nổ khi trúng, 'hero' toả sau lưng lúc ra chiêu, 'travel' bay theo đường chiêu
const SRX = {
  batgioi: { k: 'burst', at: 0.55, w: 520, sy: 0.7 }, satang: { k: 'hero', w: 360, sy: 0.6 }, duongtang: { k: 'ground', w: 520, at: 0.3 },
  honghainhi: { k: 'burst', at: 0.5, w: 560 }, thietphien: { k: 'travel', at: 0.38, w: 380 }, bachcot: { k: 'ground', w: 480, at: 0.25 },
  litinh: { k: 'burst', at: 0.48, w: 420, up: 1 }, trieucongminh: { k: 'burst', at: 0.5, w: 480 }, kimgiac: { k: 'hero', w: 420, at: 0.18 },
};
function drawSRX(f, p) {
  const c = SRX[f.id]; if (!c) return; const n = f.id + '_fx', [tx, ty] = tgtXY(f), at = c.at || 0;
  if (c.k === 'ground') { if (p > at) scTex(n, tx, ty, c.w, p * 2.4, fadeIO((p - at) / (1 - at), 0.2, 0.8), 0.42); }
  else if (c.k === 'burst') { if (p > at && p < at + 0.42) { const q = (p - at) / 0.42; scTex(n, tx, ty - (c.up ? 150 : 40), c.w * (0.55 + 0.6 * ease3(q)), 0, (1 - q) * 1.4, c.sy); } }
  else if (c.k === 'hero') { if (p > at && p < 0.85) scTex(n, f.x + 70, f.y - 30, c.w, p * 1.5, fadeIO((p - at) / (0.85 - at), 0.25, 0.7), c.sy); }
  else if (c.k === 'travel') { if (p > at && p < at + 0.5) { const q = (p - at) / 0.5; scTex(n, f.x + 80 + (VIEW_R() - f.x) * ease3(q), ty - 50, c.w, 0, (1 - q) * 1.2); } }
}
// lớp riêng cho tướng SSR (vẽ sau khuôn chiêu) — dùng tranh hiệu ứng vẽ tay (art/scene), hoà sáng
function scTex(n, x, y, w, rot, a, sy) { const im = scImg(n); if (!im || !(a > 0)) return; const h = w * im.height / im.width;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a); ctx.translate(x, y); if (sy) ctx.scale(1, sy); if (rot) ctx.rotate(rot); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
const SSRX = {
  ngokhong(f, p) { if (p > 0.53 && p < 0.95) { const q = (p - 0.53) / 0.42, [tx, ty] = tgtXY(f); scTex('ngokhong_fx', tx, ty - 10, 420 + 380 * ease3(q), 0, (1 - q) * 1.3, 0.6); scTex('ngokhong_fx', tx, ty - 60, 300 + 200 * q, q, (1 - q) * 0.8); } },
  nata(f, p) {   // Tam Đầu Lục Tý: thêm 2 thương lửa toả quạt + xoáy lửa sau lưng lúc lấy đà
    const cfg = UCFG.nata; for (const [k, dy] of [['n1', -110], ['n2', 110]]) { f[k] = f[k] || { x: f.x, y: f.y, tx: f.tx, ty: f.ty + dy, id: f.id, done: { hit: 1 } }; UC_NODARK = true; try { UTPL.pierce(f[k], Math.max(0, p - 0.05), cfg); } finally { UC_NODARK = false; } }
    if (p < 0.45) scTex('nata_fx', f.x, f.y - 30, 300 + 120 * p, p * 4, fadeIO(p / 0.45, 0.3, 0.7));
  },
  ngumavuong(f, p) { if (p < 0.65) scTex('ngumavuong_fx', f.x + 280, 210, 620 + 120 * p, 0, fadeIO(p / 0.65, 0.3, 0.6)); },   // đầu trâu lửa khổng lồ trên trời
  quanam(f, p) { const al = alliesAlive(), cx = al.length ? al.reduce((s, h) => s + h.x, 0) / al.length : f.x, k = fadeIO(p, 0.25, 0.8); scTex('fx_halo', cx, 170, 330 + 60 * k, p * 0.6, k * 0.95); },
  datky(f, p) { const [tx, ty] = tgtXY(f), k = fadeIO(p, 0.25, 0.85); scTex('fx_ninetails', tx + 50, ty - 150, 300 + 300 * ease3(Math.min(1, p / 0.35)), Math.sin(p * 5) * 0.05, k); },
  duongtien(f, p) {   // Thiên Nhãn mở trên trán, tia vàng khoá mục tiêu trước khi chó lao ra
    if (p > 0.38) return; const k = fadeIO(p / 0.38, 0.3, 0.7), hx = f.x + 4, hy = f.y - 56;
    scTex('duongtien_fx', hx, hy, 160, 0, k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; for (const [lw, a, c] of [[26, 0.25, '#ffcf3f'], [10, 0.6, '#ffe58a'], [3, 1, '#ffffff']]) { ctx.globalAlpha = a * k; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(f.tx, f.ty - 40); ctx.stroke(); } ctx.restore();
    scTex('duongtien_fx', f.tx, f.ty - 40, 200, p * 3, k * 0.8);
  },
  khuongtanha(f, p) { const [tx] = tgtXY(f); if (p > 0.15) scTex('khuongtanha_fx', tx, 150, 520 + 100 * p, 0, fadeIO((p - 0.15) / 0.85, 0.2, 0.8) * 0.9); },   // bảng Phong Thần toả kim quang trên trời
  vantieu(f, p) { const [tx, ty] = tgtXY(f); if (p > 0.3) scTex('vantieu_fx', tx, ty, 560, p * 2.2, fadeIO((p - 0.3) / 0.7, 0.2, 0.8), 0.42); },
  thailaoquan(f, p) { const al = alliesAlive(); if (!al.length) return; const cx = al.reduce((s, h) => s + h.x, 0) / al.length, cy = al.reduce((s, h) => s + h.y, 0) / al.length + 10; scTex('thailaoquan_fx', cx, cy, 560, -p * 2, fadeIO(p, 0.2, 0.85), 0.42); },
  loichantu(f, p) { const [tx, ty] = tgtXY(f);
    if (p > 0.12 && p < 0.46) { const q = (p - 0.12) / 0.34; ucObj('loi_dive', -80 + (tx - 40 + 80) * ease3(q), 40 + (ty - 160 - 40) * q, 230, 0, q > 0.85 ? (1 - q) / 0.15 : 1, '#9fd0ff', 0.7); }
    if (p > 0.44 && p < 0.9) { const q = (p - 0.44) / 0.46; scTex('loichantu_fx', tx, ty - 170, 520 + 120 * q, 0, (1 - q) * 1.4); } },
  thaiatchannhan(f, p) {   // chín hoả long xoắn bay lên quanh chuông + xoáy lửa dưới chân chuông
    if (p < 0.5) return; const [tx, ty] = tgtXY(f), q = (p - 0.5) / 0.5, a = q > 0.8 ? (1 - q) / 0.2 : 1;
    scTex('thaiatchannhan_fx', tx, ty - 10, 520, p * 3, a, 0.45);
    for (let i = 0; i < 9; i++) { const t = q * 1.4 - i * 0.07; if (t < 0 || t > 1) continue; const an = i * TAU / 9 + t * 5, r = 140 - t * 60, x = tx + Math.cos(an) * r, y = ty - 60 - t * 380 + Math.sin(an) * r * 0.3;
      ucObj('firedragon_head', x, y, 78, -Math.PI / 2 + Math.cos(an) * 0.5, a * (1 - t * 0.4), '#ff7a2e', 0.6); }
  },
  tieubachlong(f, p) {   // cột nước có rồng bạc phun lên dọc đường rồng bay
    if (p < 0.42) return; const [tx, ty] = tgtXY(f), q = (p - 0.42) / 0.58, im = scImg('fx_waterpillar'); if (!im) return;
    for (let i = 0; i < 4; i++) { const t = q * 1.5 - i * 0.14; if (t < 0 || t > 1) continue; const x = tx - 210 + i * 140, s = Math.sin(t * Math.PI), w = 150, h = w * im.height / im.width;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, s * 1.4); ctx.translate(x, ty + 20); ctx.scale(1, 0.25 + 0.75 * s); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore(); }
  },
};

// ===================== CẢNH CẮT TUYỆT KỸ SSR =====================
const SCI = {}; function scImg(n) { let i = SCI[n]; if (!i) { i = SCI[n] = new Image(); i.src = 'art/scene/' + n + '.webp'; } return i.complete && i.naturalWidth ? i : null; }
const SCENE_D = 1.4;
const sceneUnlocked = id => isSSR(id) || (HEROES[id] && HEROES[id].rar === 'SR' && S.owned[id] && S.owned[id].star >= 5);   // SR: THỨC TỈNH (5★) mở cảnh cắt
const scReady = id => sceneUnlocked(id) && ['_bg', '_hero', '_fx'].every(s => scImg(id + s));
function startBossScene(e, text) {   // cảnh cắt ngắn khi boss biến hình
  const hd = document.querySelector('.hud'); if (hd) hd.classList.add('cine');
  B.scene = { boss: true, id: e.id, name: text, hero: e.name, t0: performance.now(), bgImg: B.bg, heroImg: formImg(e.id), fxImg: scImg('ngumavuong_fx') || scImg('nata_fx') };
  B.hitstop = Math.max(B.hitstop || 0, SCENE_D); snd('gong'); setTimeout(() => snd('roar', 1, 0.8), 300);
}
function startScene(u, sk) { snd('charge_big'); snd('whoosh', 1, 0.8); const hd = document.querySelector('.hud'); if (hd) hd.classList.add('cine'); B.scene = { id: u.id, name: sk.name, hero: u.name, t0: performance.now() }; B.hitstop = Math.max(B.hitstop || 0, SCENE_D); B.cutin = null; }
function drawScene() {
  const S = B.scene; if (!S) return; const a = window.__sceneA != null ? window.__sceneA : (performance.now() - S.t0) / 1000; if (a > SCENE_D) { B.scene = null; const hd = document.querySelector('.hud'); if (hd) hd.classList.remove('cine'); return; }
  const bg = S.bgImg || scImg(S.id + '_bg'), hero = S.heroImg || scImg(S.id + '_hero'), fx = S.fxImg || scImg(S.id + '_fx'); if (!bg || !hero || (!fx && !S.boss)) { B.scene = null; const hd = document.querySelector('.hud'); if (hd) hd.classList.remove('cine'); return; }
  const q = a / SCENE_D, out = a > SCENE_D - 0.16 ? (SCENE_D - a) / 0.16 : 1, c1 = S.boss ? '#ff4a4a' : cineTheme(S.id)[0];
  ctx.save();
  // 1) nền: camera đẩy chậm + trôi ngang
  const z = 1.1 + 0.14 * q, bw = W * z, bh = Math.max(H * z, bw * bg.height / bg.width);
  ctx.drawImage(bg, (W - bw) / 2 - 40 * q, (H - bh) / 2 + 10 * q, bw, bh);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);
  // 2) lớp năng lượng (hoà sáng): nở ra + xoay nhẹ, nhịp đập
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a / 0.25) * (0.85 + 0.15 * Math.sin(a * 30));
  if (fx) { const fz = 0.85 + 0.6 * ease3(q), fw = W * 1.1 * fz, fh = fw * fx.height / fx.width; ctx.translate(W * 0.6, H * 0.5); ctx.rotate(q * 0.12); ctx.drawImage(fx, -fw / 2, -fh / 2, fw, fh); } ctx.restore();
  // 3) vệt tốc độ chéo
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) { const y = ((i * 71 + a * 1600 * (1 + i % 3)) % (H + 300)) - 150, x = (i * 137) % W, L = 120 + (i % 5) * 60; ctx.globalAlpha = 0.35; ctx.strokeStyle = i % 4 ? '#ffffff' : c1; ctx.lineWidth = 1 + (i % 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - L * 0.5, y - L); ctx.stroke(); }
  ctx.restore();
  // 4) nhân vật: lao vào từ trái kèm bóng mờ, rồi đẩy chậm vào camera
  const hs = a < 0.28 ? ease3(a / 0.28) : 1, hh = H * 1.0 * (1 + 0.08 * q), hw = hh * hero.width / hero.height, hx = S.boss ? W * 0.64 + (1 - hs) * W * 0.7 - 24 * q : W * 0.36 - (1 - hs) * W * 0.7 + 24 * q, hy = H * 0.53 - 6 * q;
  if (S.boss) { ctx.fillStyle = 'rgba(120,0,20,0.35)'; ctx.fillRect(0, 0, W, H); }
  if (hs < 1) for (let k = 1; k <= 4; k++) { ctx.globalAlpha = 0.18; ctx.drawImage(hero, hx - hw / 2 - k * 70 * (1 - hs), hy - hh / 2, hw, hh); }
  ctx.globalAlpha = 1; ctx.save(); ctx.shadowColor = c1; ctx.shadowBlur = 30; ctx.drawImage(hero, hx - hw / 2, hy - hh / 2, hw, hh); ctx.restore();
  // 5) viền điện ảnh + tên chiêu
  const lb = 58 * Math.min(1, a / 0.15); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb);
  const tx = S.boss ? 40 - (1 - Math.min(1, Math.max(0, (a - 0.2) / 0.25))) * 300 : W - 40 + (1 - Math.min(1, Math.max(0, (a - 0.2) / 0.25))) * 300; ctx.textAlign = S.boss ? 'left' : 'right';
  ctx.font = '900 54px "Baloo 2",serif'; ctx.lineWidth = 9; ctx.strokeStyle = '#2a0a00'; ctx.strokeText(S.name, tx, H - lb - 40); const g = ctx.createLinearGradient(0, H - lb - 90, 0, H - lb - 40); g.addColorStop(0, '#fff6c8'); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillText(S.name, tx, H - lb - 40);
  ctx.font = '800 22px "Baloo 2",sans-serif'; ctx.lineWidth = 5; ctx.strokeText(S.hero, tx, H - lb - 8); ctx.fillStyle = '#ffffff'; ctx.fillText(S.hero, tx, H - lb - 8);
  ctx.restore();
  // 6) loé trắng khi vào và khi cắt về trận
  const fl = a < 0.07 ? 1 - a / 0.07 : a > SCENE_D - 0.12 ? (a - (SCENE_D - 0.12)) / 0.12 : 0;
  if (fl > 0) { ctx.save(); ctx.globalAlpha = fl; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (out < 1) { ctx.save(); ctx.globalAlpha = 1 - out; ctx.restore(); }
}
function drawUltTex(f) {
  let im = ULTT[f.id]; if (!im) { im = ULTT[f.id] = new Image(); im.src = 'art/fx/ult_' + f.id + '.webp'; }
  if (!im.complete || !im.naturalWidth) return;
  const p = Math.min(1, f.t / f.dur), pop = p < 0.22 ? 0.55 + 0.6 * Math.sin(p / 0.22 * Math.PI / 2) : 1.15 - 0.1 * Math.min(1, (p - 0.22) / 0.5);
  const a = p < 0.12 ? p / 0.12 : p > 0.72 ? Math.max(0, 1 - (p - 0.72) / 0.28) : 1;
  const S = 280 * pop, x = clamp(ULT_SELF[f.id] ? f.x : f.tx, S * 0.45, W - S * 0.45), y = clamp((ULT_SELF[f.id] ? f.y : f.ty) - 95, S * 0.42 + 40, H - 60);
  ctx.save(); ctx.globalAlpha = a * 0.3; ctx.fillStyle = '#0a0414'; ctx.fillRect(-W, -H, W * 3, H * 3);   // trời tối lại khi tuyệt kỹ
  const g = ctx.createRadialGradient(x, y, S * 0.1, x, y, S * 0.62); g.addColorStop(0, 'rgba(12,4,24,0.75)'); g.addColorStop(1, 'rgba(12,4,24,0)');   // nền tối sau hình để không bị cháy trắng trên nền cát sáng
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, S * 0.62, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.85; ctx.drawImage(im, x - S / 2, y - S / 2, S, S); ctx.restore();
}
function fxBurst(x, y, name, size, a) { if (gfxLow() && (B.fxb.length > 10 || name === 'flare' || name === 'smoke')) return; B.fxb.push({ x, y, name, size, a: a || 0, t: 0, dur: 0.32 }); }
function drawFxBursts() {
  for (const b of B.fxb) { const k = b.t / b.dur; fxGlow(b.name, b.x, b.y, b.size * (0.55 + 0.75 * Math.sqrt(k)), b.a + k * 0.6, (1 - k) * 1.1); }
}
function drawSparks() {
  for (const s of B.sparks) {
    const k = s.t / s.dur, R = (s.big ? 46 : 26) * (0.5 + k);
    ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - k) + 1;
    for (let i = 0; i < 5; i++) { const an = s.a + (i - 2) * 0.55 + Math.PI * (i % 2 ? 0.1 : -0.1); ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * 0.3, Math.sin(an) * R * 0.3); ctx.lineTo(Math.cos(an) * R, Math.sin(an) * R); ctx.stroke(); }
    ctx.strokeStyle = s.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  const h = B.hits;
  if (h.t > 0 && h.n >= 3) {   // bộ đếm Hits kiểu game hành động
    const k = Math.min(1, h.t / 1.4), pop = 1 + Math.max(0, h.t - 1.25) * 3; ctx.save(); ctx.globalAlpha = Math.min(1, k * 2.5); ctx.translate(W - 70, 128); ctx.rotate(-0.06);
    ctx.save(); ctx.scale(pop, pop); ctx.textAlign = 'right'; ctx.font = '900 46px "Baloo 2",sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#4a0a04';
    const g = ctx.createLinearGradient(0, -40, 0, 4); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffd34d'); g.addColorStop(1, '#ff6a1e'); ctx.strokeText(h.n, -2, 0); ctx.fillStyle = g; ctx.fillText(h.n, -2, 0);
    ctx.font = '900 18px "Baloo 2",sans-serif'; ctx.lineWidth = 5; ctx.textAlign = 'left'; ctx.strokeText('HITS', 2, -4); ctx.fillStyle = '#fff3c0'; ctx.fillText('HITS', 2, -4); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-110, 10, 160, 5); ctx.fillStyle = '#ffb02e'; ctx.fillRect(-110, 10, 160 * k, 5); ctx.restore();
  }

}
function drawProj(p) {
  if (p.dt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const R = (p.r || 8) * 2.6, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); g.addColorStop(0, 'rgba(255,240,170,0.9)'); g.addColorStop(1, 'rgba(255,170,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill(); ctx.restore();
    if (Math.random() < 0.35) B.parts.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 40, vy: -20, life: 0.35, max: 0.35, color: '#ffe58a', size: 3 }); }
  if (p.side === 'h' && PFX[p.type]) drawProjFX(p);
  else if (p.side === 'h' && !p.child && p.kind !== 'sword') {   // vệt đuôi sáng sau đạn (theo vận tốc), màu theo loại đạn
    const sp = Math.hypot(p.vx, p.vy) || 1, L = Math.min(70, sp * 0.1), ux = p.vx / sp, uy = p.vy / sp, col = projColor(p.type);
    const g = ctx.createLinearGradient(p.x, p.y, p.x - ux * L, p.y - uy * L); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = g; ctx.lineWidth = (p.r || 8) * 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - ux * L, p.y - uy * L); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(p.x, p.y);
  const a = Math.atan2(p.vy, p.vx);
  switch (p.type) {
    case 'ring':
      ctx.rotate(p.rot); ctx.lineWidth = 4; ctx.strokeStyle = '#7a4a10'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2.6; ctx.strokeStyle = '#ffd34d'; ctx.stroke(); break;
    case 'arrow':
      ctx.rotate(a); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-12, -1, 18, 2);
      ctx.beginPath(); ctx.moveTo(6, -3.5); ctx.lineTo(12, 0); ctx.lineTo(6, 3.5); ctx.fillStyle = '#d7dde3'; ctx.fill(); break;
    case 'fireball': {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ff7a2e'); g.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); break;
    }
    case 'sword': { // phi kiếm
      ctx.rotate(a); ctx.fillStyle = '#e8f2ff'; ctx.strokeStyle = '#4a6a9a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(4, -4); ctx.lineTo(-14, -3); ctx.lineTo(-14, 3); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(-18, -6, 4, 12); ctx.globalAlpha = 0.5; ctx.fillStyle = '#9ad0ff'; ctx.fillRect(-46, -2, 30, 4); ctx.globalAlpha = 1; break;
    }
    case 'staffwave': case 'rakewave': { // sóng chưởng hình trăng khuyết bay ngang
      ctx.rotate(a); const gold = p.type === 'staffwave';
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.9 - k * 0.28; ctx.strokeStyle = k ? (gold ? '#ff9a2e' : '#7fb3ff') : (gold ? '#fff3a0' : '#e8f6ff');
        ctx.lineWidth = 7 - k * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(-k * 9, 0, 20, -1.15, 1.15); ctx.stroke();
      }
      ctx.globalAlpha = 1; break;
    }
    case 'boulder': { // tảng đá ném
      ctx.rotate(p.rot * 0.5); ctx.fillStyle = '#7a5a3a'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-4, -13); ctx.lineTo(9, -10); ctx.lineTo(13, 2); ctx.lineTo(5, 12); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a07a52'; ctx.beginPath(); ctx.arc(-3, -4, 4, 0, TAU); ctx.fill(); break;
    }
    case 'staff': { // Kim Cô Bổng xoay
      ctx.rotate(p.rot * 0.9); ctx.fillStyle = '#d33a2a'; ctx.fillRect(-26, -3.5, 52, 7);
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(-30, -5, 8, 10); ctx.fillRect(22, -5, 8, 10); ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1.5; ctx.strokeRect(-26, -3.5, 52, 7); break;
    }
    case 'crescent': { // lưỡi liềm
      ctx.rotate(p.rot * 0.9); ctx.fillStyle = '#d8e6f4'; ctx.strokeStyle = '#4a5a70'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0.4, TAU - 0.4); ctx.arc(5, 0, 13, TAU - 0.5, 0.5, true); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case 'rake': { // bồ cào xoay
      ctx.rotate(p.rot * 0.7); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.strokeStyle = '#d8dee6'; ctx.lineWidth = 3; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(10, k * 4); ctx.lineTo(20, k * 4); ctx.stroke(); } break;
    }
    case 'spear': { // thương / đinh ba bay
      ctx.rotate(a); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(14, 0); ctx.stroke();
      ctx.fillStyle = '#e8f2ff'; ctx.strokeStyle = '#4a6a9a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffb060'; ctx.fillRect(-52, -2, 26, 4); ctx.globalAlpha = 1; break;
    }
    case 'drop': { // giọt cam lộ
      ctx.rotate(a); const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 11); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9fe8ff'); g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, TAU); ctx.fill(); break;
    }
    case 'bolt': { // tia sét
      ctx.rotate(a); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, 0);
      for (let k = 1; k <= 5; k++) ctx.lineTo(-22 + k * 9, (k % 2 ? -5 : 5)); ctx.stroke();
      ctx.strokeStyle = '#7fb3ff'; ctx.lineWidth = 1.5; ctx.stroke(); break;
    }
    case 'pearl': { // châu vàng
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe58a'); g.addColorStop(1, '#d89a20');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 1.5; ctx.stroke(); break;
    }
    case 'fan': { // quạt ba tiêu xoay
      ctx.rotate(p.rot * 0.8); ctx.fillStyle = '#5fc46a'; ctx.strokeStyle = '#1f6a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 18, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke(); break;
    }
    case 'pill': { // kim đan
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10); g.addColorStop(0, '#fff6c2'); g.addColorStop(0.6, '#ffb347'); g.addColorStop(1, '#d9582e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); break;
    }
    case 'pagoda': { // tháp nhỏ
      ctx.rotate(Math.sin(p.rot * 0.3) * 0.3); ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-12 + k * 3, 6 - k * 8); ctx.lineTo(12 - k * 3, 6 - k * 8); ctx.lineTo(8 - k * 3, 0 - k * 8); ctx.lineTo(-8 + k * 3, 0 - k * 8); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
    }
    case 'moon': { // vầng trăng
      ctx.rotate(p.rot * 0.9); const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 15); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#dfe8ff'); g.addColorStop(1, 'rgba(180,200,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = '#9fb0e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11, 0.3, 4.2); ctx.stroke(); break;
    }
    case 'wind': { // lưỡi gió quạt Ba Tiêu (Thiết Phiến)
      ctx.rotate(a); ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [lw, al, c] of [[9, 0.25, '#7fe8a0'], [4, 0.7, '#bfffd0'], [1.6, 1, '#ffffff']]) { ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-8, 0, 16, -1.15, 1.15); ctx.stroke(); }
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#9fffc0'; ctx.lineWidth = 1.5; for (const dy of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(-26, dy); ctx.lineTo(-12, dy * 0.8); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'sand': { // lốc cát (Hoàng Phong Quái)
      ctx.rotate(p.rot * 1.4); for (let k = 0; k < 3; k++) { ctx.strokeStyle = k ? '#e8c060' : '#a07830'; ctx.lineWidth = 3 - k * 0.6; ctx.beginPath(); ctx.arc(0, 0, 13 - k * 4, k, k + 4.6); ctx.stroke(); }
      ctx.fillStyle = '#c8a050'; for (let k = 0; k < 5; k++) { const an = k * 1.26 + p.rot; ctx.beginPath(); ctx.arc(Math.cos(an) * 15, Math.sin(an) * 15, 1.8, 0, TAU); ctx.fill(); } break;
    }
    case 'axe': { // rìu xoay (Cự Linh Thần)
      ctx.rotate(p.rot * 1.2); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-2, -16, 4, 32);
      ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, -14); ctx.quadraticCurveTo(18, -12, 16, 2); ctx.quadraticCurveTo(10, -4, 2, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, -14); ctx.quadraticCurveTo(-18, -12, -16, 2); ctx.quadraticCurveTo(-10, -4, -2, -2); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case 'bone': { // móng vuốt lửa ma (Bạch Cốt)
      ctx.rotate(a); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16); g.addColorStop(0, 'rgba(230,190,255,0.9)'); g.addColorStop(1, 'rgba(140,60,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#efe6ff'; ctx.strokeStyle = '#5a2a8a'; ctx.lineWidth = 1.5;
      for (const dy of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(-10, dy); ctx.quadraticCurveTo(6, dy - 4, 16, dy * 0.4 - 2); ctx.quadraticCurveTo(6, dy + 1, -10, dy + 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      break;
    }
    case 'palm': { // chưởng lực mặc định
      ctx.rotate(a); const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe58a'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, 0, 0, TAU); ctx.fill(); break;
    }
    default: {
      const col = projColor(p.type);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, col); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
function drawFx(f) {
  if (f.k === 'sig') { if (f.t < 0 && f.uc) drawCharge(f, Math.min(1, 1 + f.t / 0.45)); if (f.t >= 0) { if (f.uc) { const pp = Math.min(1, f.t / f.dur); drawCineSky(f, pp); ULTC[f.id].draw(f, pp); if (SSRX[f.id]) SSRX[f.id](f, pp); else drawSRX(f, pp); } else if (ULTX[f.id]) drawUltX(f, ULTX[f.id]); else { VFX.draw(ctx, f); drawUltTex(f); } } return; }
  if (f.k === 'combo') { drawComboX(f); return; }
  if (f.k === 'cx') { drawCX(f); return; }
  const p = f.t / f.dur;
  ctx.save();
  switch (f.k) {
    case 'ring':
      ctx.globalAlpha = 1 - p; ctx.lineWidth = 6 * (1 - p) + 1; ctx.strokeStyle = f.color;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.4 + 0.6 * p), f.r * (0.4 + 0.6 * p) * 0.55, 0, 0, TAU); ctx.stroke(); break;
    case 'flash': {
      ctx.globalAlpha = (1 - p) * 0.55;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, f.color); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, TAU); ctx.fill(); break;
    }
    case 'bagua': { // trận đồ bát quái
      ctx.translate(f.x, f.y); ctx.scale(1, 0.5); ctx.rotate(p * 3); ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, f.r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(f.r * 0.55, -12); ctx.lineTo(f.r * 0.55, 12); ctx.moveTo(f.r * 0.7, -12); ctx.lineTo(f.r * 0.7, 12); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,230,120,0.25)'; ctx.beginPath(); ctx.arc(0, 0, f.r, 0, TAU); ctx.fill(); break;
    }
    case 'slash':
      ctx.translate(f.x, f.y); ctx.scale(f.f * f.s, f.s);
      ctx.globalAlpha = 1 - p; ctx.lineCap = 'round'; ctx.lineWidth = 5 * (1 - p) + 1; ctx.strokeStyle = f.color;
      ctx.beginPath(); ctx.arc(-6, 0, 22, -1.3 + p * 0.6, 1.0 + p * 0.6); ctx.stroke(); break;
    case 'poof':
      ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) { const a = i * TAU / 7; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 26 * p, f.y + Math.sin(a) * 16 * p, 10 * (1 - p) + 3, 0, TAU); ctx.fill(); }
      break;
    case 'beam': {
      ctx.globalAlpha = 1 - p;
      const a = Math.atan2(f.y2 - f.y1, f.x2 - f.x1), len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
      ctx.translate(f.x1, f.y1); ctx.rotate(a);
      const w = f.w * (1 - p * 0.6);
      const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
      g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(0.5, '#fff3a0'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = f.color; ctx.globalAlpha = (1 - p) * 0.6; ctx.fillRect(0, -w / 2, len, w);
      ctx.globalAlpha = 1 - p; ctx.fillStyle = g; ctx.fillRect(0, -w / 4, len, w / 2); break;
    }
    case 'impact': { // tia sáng toé ra tại điểm trúng
      const r = (f.big ? 30 : 18) * (0.4 + p * 0.8);
      ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.globalAlpha = 1 - p; ctx.fillStyle = f.big ? '#fff3a0' : '#ffffff';
      for (let i = 0; i < 6; i++) {
        ctx.rotate(TAU / 6);
        ctx.beginPath(); ctx.moveTo(0, -2.2); ctx.lineTo(r, 0); ctx.lineTo(0, 2.2); ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, (f.big ? 8 : 5) * (1 - p), 0, TAU); ctx.fill();
      break;
    }
    case 'trail': { // vệt vũ khí: danh sách điểm đầu vũ khí theo thời gian
      if (f.pts.length < 2) break;
      ctx.globalAlpha = 1 - p; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < f.pts.length; i++) {
        const q = i / f.pts.length;
        ctx.strokeStyle = f.color; ctx.lineWidth = 2 + q * 10;
        ctx.globalAlpha = (1 - p) * q * 0.9;
        ctx.beginPath(); ctx.moveTo(f.pts[i - 1][0], f.pts[i - 1][1]); ctx.lineTo(f.pts[i][0], f.pts[i][1]); ctx.stroke();
      }
      break;
    }
    case 'bolt':
      ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x1, f.y1);
      for (let i = 1; i < 6; i++) { const q = i / 6; ctx.lineTo(f.x1 + (f.x2 - f.x1) * q + rand(-8, 8), f.y1 + (f.y2 - f.y1) * q + rand(-8, 8)); }
      ctx.lineTo(f.x2, f.y2); ctx.stroke(); break;
    default: break;
  }
  ctx.restore();
}
const DROPI = {}; function dropImg(k) { let i = DROPI[k]; if (!i) { i = DROPI[k] = new Image(); i.src = 'art/ui/drop_' + k + '.webp'; } return i.complete && i.naturalWidth ? i : null; }
['phu', 'thu'].forEach(dropImg);
function drawDrop(d) {
  const y = d.y - 18 + Math.sin(d.t * 5) * 4, im = dropImg(d.k);
  if (im) {   // hình vẽ tay: hào quang xoay + vật phẩm lơ lửng
    const col = d.k === 'phu' ? '255,214,90' : '120,230,190';
    ctx.save(); ctx.translate(d.x, y); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 40); g.addColorStop(0, `rgba(${col},0.75)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
    ctx.rotate(d.t * 1.5); ctx.strokeStyle = `rgba(${col},0.8)`; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(34, 0); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(d.x, y); ctx.rotate(Math.sin(d.t * 3) * 0.12); const w = 48, h = w * im.height / im.width; ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 16, 5, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.font = 'bold 11px "Baloo 2",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,30,10,0.85)';
    const lbl = d.k === 'phu' ? 'Linh Phù' : 'Thiên Thư'; ctx.strokeText(lbl, d.x, y + 34); ctx.fillStyle = d.k === 'phu' ? '#ffe58a' : '#b8ffe0'; ctx.fillText(lbl, d.x, y + 34); ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(d.x, y);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  g.addColorStop(0, d.k === 'phu' ? 'rgba(255,230,120,0.9)' : 'rgba(170,220,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
  if (d.k === 'phu') {
    ctx.rotate(Math.sin(d.t * 3) * 0.15);
    Art.rr(ctx, -9, -14, 18, 28, 2); Art.fs(ctx, '#ffd34d', 2);
    ctx.strokeStyle = '#d6372e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(-5, -4); ctx.lineTo(5, -4); ctx.moveTo(-5, 3); ctx.lineTo(5, 3); ctx.stroke();
  } else {
    Art.rr(ctx, -13, -10, 26, 20, 3); Art.fs(ctx, '#4f8cff', 2);
    Art.rr(ctx, -10, -7, 20, 14, 2); Art.fs(ctx, '#fff6dc', 1.2);
    ctx.strokeStyle = '#4f8cff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.font = 'bold 11px "Baloo 2",sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,30,10,0.85)';
  const lbl = d.k === 'phu' ? 'Linh Phù' : 'Thiên Thư';
  ctx.strokeText(lbl, d.x, y + 26); ctx.fillStyle = '#fff'; ctx.fillText(lbl, d.x, y + 26); ctx.restore();
}
function drawGateDamage() {
  const p = B.gate.hp / B.gate.max;
  if (B.gateHurt > 0) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff3b30'; ctx.fillRect(0, 0, 92, H); ctx.restore(); }
  if (p < 0.66) {
    ctx.save(); ctx.strokeStyle = 'rgba(60,30,20,0.7)'; ctx.lineWidth = 2;
    const n = p < 0.33 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const y = 60 + i * 80; ctx.beginPath(); ctx.moveTo(86, y); ctx.lineTo(68, y + 10); ctx.lineTo(52, y + 2); ctx.lineTo(34, y + 14); ctx.stroke();
    }
    ctx.restore();
  }
}
function drawTargetMark() {   // dấu nhắm của đội trưởng
  const e = B.capTgt;
  if (!e || e.dead) return;
  const y = e.y - 4, r = 22 * sizeOf(e) + (B.tgtMark > 0 ? B.tgtMark * 40 : 0), a = B.time * 3;
  ctx.save(); ctx.translate(GATE_X, H * VIEW_PY); ctx.scale(VIEW_Z, VIEW_Z); ctx.translate(-GATE_X, -H * VIEW_PY);   // cùng hệ toạ độ với sân
  ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(e.x, y, r, r * 0.5, 0, a + k * TAU / 4, a + k * TAU / 4 + 0.9); ctx.stroke(); }
  ctx.restore();
}
const imgCache = {};
function imgOf(url) { if (!imgCache[url]) { const i = new Image(); i.src = url; imgCache[url] = i; } return imgCache[url]; }
function drawCutin() {
  const c = B.cutin, p = c.t;
  const a = p < 0.12 ? p / 0.12 : p > 0.6 ? Math.max(0, (0.8 - p) / 0.2) : 1;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(20,10,30,0.45)'; ctx.fillRect(-W, -H, W * 3, H * 3);
  const y = 170;
  const g = ctx.createLinearGradient(0, y, W, y);
  g.addColorStop(0, '#ffcf3f'); g.addColorStop(0.5, '#ff7a2e'); g.addColorStop(1, '#c2185b');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, y + 20); ctx.lineTo(W, y - 20); ctx.lineTo(W, y + 150); ctx.lineTo(0, y + 190); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 8; i++) { const yy = y + 10 + i * 22; ctx.fillRect(((p * 900 + i * 130) % (W + 200)) - 200, yy, 160, 3); }
  const X = ULTX[c.id], ci = X && uxImg(X.cut);
  const img = imgOf(fullImg(c.id, 200));
  const slide = Math.min(1, p / 0.18);
  if (ci) { const hh = 250, ww = hh * ci.width / ci.height; ctx.drawImage(ci, -ww * 0.6 + slide * ww * 0.6 - 20, y + 195 - hh, ww, hh); }
  else if (img.complete && img.width) {
    const hh = SPR[c.id] ? 330 : 250, ww = hh * img.width / img.height;
    ctx.drawImage(img, -ww + 40 + slide * (ww + 10), y + 190 - hh, ww, hh);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.font = '800 38px "Baloo 2",sans-serif';
  ctx.lineWidth = 7; ctx.strokeStyle = '#4a1a0a'; ctx.strokeText(c.name, W - 24, y + 70);
  ctx.fillStyle = '#fffbe0'; ctx.fillText(c.name, W - 24, y + 70);
  ctx.font = '700 18px "Baloo 2",sans-serif'; ctx.lineWidth = 5; ctx.strokeText(c.hero, W - 26, y + 112);
  ctx.fillStyle = '#ffe14d'; ctx.fillText(c.hero, W - 26, y + 112);
  ctx.restore();
}

function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawBossBar(b) {   // khung boss: chân dung, tên, máu chia vạch theo pha, phần máu trắng tụt trễ, cảnh báo đổi pha
  const w = W * 0.44, x = (W - w) / 2 + 26, y = 98, h = 15, p = Math.max(0, b.hp / maxHp(b));
  b.hpLag = b.hpLag == null || b.hpLag < p ? p : Math.max(p, b.hpLag - 0.0035);
  const fl = b.phaseT ? Math.max(0, 1 - (performance.now() - b.phaseT) / 1600) : 0, rage = b.phase >= 2;
  ctx.save();
  ctx.fillStyle = 'rgba(24,6,6,0.88)'; rrect(x - 8, y - 22, w + 16, h + 30, 10); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = rage ? '#ff5a5a' : '#e0b040'; ctx.stroke();
  ctx.fillStyle = '#2a0a0a'; rrect(x, y, w, h, 7); ctx.fill();
  ctx.save(); rrect(x, y, w, h, 7); ctx.clip();
  ctx.fillStyle = '#fff4e0'; ctx.fillRect(x, y, w * b.hpLag, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rage ? '#ff6a8a' : '#ff8a4a'); g.addColorStop(0.5, rage ? '#e0103a' : '#e0381a'); g.addColorStop(1, rage ? '#8a0a20' : '#8a1a0a');
  ctx.fillStyle = g; ctx.fillRect(x, y, w * p, h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y + 1, w * p, 3);
  ctx.restore();
  for (const ph of b.d.phases || []) { const px = x + w * ph.at; ctx.fillStyle = '#ffd34d'; ctx.fillRect(px - 1, y - 2, 2, h + 4); ctx.save(); ctx.translate(px, y - 4); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
  ctx.font = '800 14px "Baloo 2",sans-serif'; ctx.textAlign = 'left'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; const nm = b.name + (rage ? ' · Cuồng nộ' : '');
  ctx.strokeText(nm, x + 26, y - 6); ctx.fillStyle = rage ? '#ffb0b0' : '#ffe9b0'; ctx.fillText(nm, x + 26, y - 6);
  ctx.textAlign = 'right'; const pt = Math.ceil(p * 100) + '%'; ctx.strokeText(pt, x + w, y - 6); ctx.fillStyle = '#fff'; ctx.fillText(pt, x + w, y - 6);
  const im = EPOSES[b.id] && EPOSES[b.id].master, cx = x - 10, cy = y - 2, R = 26;   // chân dung tròn
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = '#3a1010'; ctx.fill(); ctx.clip();
  if (im) { const s = R * 2.6 / Math.max(im.width, im.height) * Math.max(im.width, im.height) / im.height; ctx.drawImage(im, cx - im.width * s / 2, cy - R * 0.7, im.width * s, im.height * s); }
  ctx.restore(); ctx.lineWidth = 3; ctx.strokeStyle = rage ? '#ff4a4a' : '#ffd34d'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  if (fl > 0) { ctx.globalAlpha = fl * (0.6 + 0.4 * Math.sin(performance.now() / 60)); ctx.fillStyle = '#ff2a2a'; rrect(x - 8, y - 22, w + 16, h + 30, 10); ctx.fill();
    ctx.globalAlpha = fl; ctx.font = '900 20px "Baloo 2",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#3a0000'; ctx.strokeText('⚠ BOSS ĐỔI PHA ⚠', x + w / 2, y + h + 26); ctx.fillStyle = '#ffd0d0'; ctx.fillText('⚠ BOSS ĐỔI PHA ⚠', x + w / 2, y + h + 26); }
  ctx.restore();
}
function drawBanner() {
  const b = B.banner, p = b.t, inK = ease3(Math.min(1, p / 0.28)), outK = p > 1.45 ? ease3(Math.min(1, (p - 1.45) / 0.35)) : 0;
  const off = (1 - inK) * -W * 1.1 + outK * W * 1.1, y = b.small ? 150 : 205, hh = b.small ? 48 : 86, boss = b.boss;
  ctx.save(); ctx.translate(W / 2 + off, y); ctx.rotate(-0.045);
  const g = ctx.createLinearGradient(-W * 0.6, 0, W * 0.6, 0), c = boss ? ['rgba(60,0,8,0)', '#7a0a1a', '#c0182e', '#7a0a1a', 'rgba(60,0,8,0)'] : ['rgba(60,30,4,0)', '#6a3a0a', '#c08a1a', '#6a3a0a', 'rgba(60,30,4,0)'];
  c.forEach((s, i) => g.addColorStop(i / 4, s)); ctx.fillStyle = g; ctx.fillRect(-W * 0.6, -hh / 2, W * 1.2, hh);
  ctx.save(); ctx.beginPath(); ctx.rect(-W * 0.6, -hh / 2, W * 1.2, hh); ctx.clip(); ctx.globalAlpha = 0.13; ctx.strokeStyle = '#fff'; ctx.lineWidth = 10;
  for (let i = -14; i < 14; i++) { const xx = i * 46 + (p * 120) % 46; ctx.beginPath(); ctx.moveTo(xx, -hh); ctx.lineTo(xx + hh, hh); ctx.stroke(); } ctx.restore();
  const lg = ctx.createLinearGradient(-W * 0.5, 0, W * 0.5, 0); lg.addColorStop(0, 'rgba(255,220,120,0)'); lg.addColorStop(0.5, boss ? '#ff9a9a' : '#ffe58a'); lg.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = lg; ctx.fillRect(-W * 0.6, -hh / 2 - 3, W * 1.2, 3); ctx.fillRect(-W * 0.6, hh / 2, W * 1.2, 3);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const sc = 1 + Math.max(0, 0.35 - p) * 1.2; ctx.scale(sc, sc);
  ctx.font = `900 ${b.small ? 28 : 44}px "Baloo 2",sans-serif`; ctx.lineWidth = 8; ctx.strokeStyle = boss ? '#3a0008' : '#3a1a04'; ctx.strokeText(b.text, 0, b.sub ? -10 : 0);
  const tg = ctx.createLinearGradient(0, -24, 0, 18); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, boss ? '#ffb0b0' : '#ffd34d'); ctx.fillStyle = tg; ctx.fillText(b.text, 0, b.sub ? -10 : 0);
  if (b.sub) { ctx.font = '700 17px "Baloo 2",sans-serif'; ctx.lineWidth = 4; ctx.strokeText(b.sub, 0, 24); ctx.fillStyle = '#fff'; ctx.fillText(b.sub, 0, 24); }
  ctx.restore();
}
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  if (!B) { renderHome(); return; }
  ctx.save();
  if (B.shake > 0) ctx.translate(rand(-1, 1) * B.shake * 10, rand(-1, 1) * B.shake * 10);
  if (B.cam) { const k = Math.sin(Math.PI * B.cam.t / B.cam.dur), z = 1 + 0.05 * k; ctx.translate(B.cam.x, B.cam.y); ctx.scale(z, z); ctx.translate(-B.cam.x, -B.cam.y); }   // camera dí sát điểm nổ tuyệt kỹ
  ctx.drawImage(B.bg, 0, 0, W, H);
  ctx.translate(GATE_X, H * VIEW_PY); ctx.scale(VIEW_Z, VIEW_Z); ctx.translate(-GATE_X, -H * VIEW_PY);
  for (const d of B.decals) {   // vết cháy/nứt đọng trên đất
    const a = Math.min(1, (d.dur - d.t) / 1.2) * 0.5, g = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, d.r);
    g.addColorStop(0, 'rgba(40,18,6,0.9)'); g.addColorStop(0.6, 'rgba(70,32,10,0.45)'); g.addColorStop(1, 'rgba(70,32,10,0)');
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.42, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.5 * Math.max(0, 1 - d.t / 1.5); ctx.strokeStyle = '#ff9a2e'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const an = i * 0.9 + d.x * 0.01; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(an) * d.r * 0.8, d.y + Math.sin(an) * d.r * 0.33); ctx.stroke(); }
    ctx.restore();
  }
  for (const z of B.zones) {
    ctx.save(); ctx.globalAlpha = Math.min(1, z.t) * 0.45;
    const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, z.color); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
    if (Math.random() < 0.5) B.parts.push({ x: z.x + rand(-z.r, z.r) * 0.8, y: z.y + rand(-z.r, z.r) * 0.4, vx: 0, vy: -80, life: 0.5, max: 0.5, color: z.color, size: 3 });
  }
  for (const w of B.warns) {
    const p = 1 - w.t / w.dur;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.25 * Math.sin(p * 30);
    ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.strokeStyle = '#ff5a5a'; ctx.stroke();
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#ff7a2e'; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r * p, w.r * p * 0.55, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // vòng đội trưởng
  const cap = B.cap;
  if (cap && !cap.dead) {
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd34d'; ctx.globalAlpha = 0.8 + Math.sin(B.time * 5) * 0.2;
    ctx.beginPath(); ctx.ellipse(cap.x, cap.y + 1, 22, 8, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  const all = [...B.heroes, ...B.enemies].sort((a, b) => a.y - b.y);
  for (const u of all) if (!(u.dead && u.side === 'e')) Art.shadow(ctx, u.x, u.y, sizeOf(u) * 0.9);
  for (const d of B.drops) drawDrop(d);
  for (const h of B.heroes) drawTierAura(h);
  drawGhosts();
  for (const u of all) drawUnit(u);
  for (const u of all) drawTraitBadge(u);
  if (B.mech === 'fog') {   // Thuỷ tộc: nước đục giảm tầm nhìn (GDD chương 11)
    const g = ctx.createLinearGradient(W * 0.42, 0, W, 0); g.addColorStop(0, 'rgba(20,60,90,0)'); g.addColorStop(0.35, 'rgba(20,60,90,0.55)'); g.addColorStop(1, 'rgba(10,40,70,0.85)');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(W * 0.42, 0, W * 0.58, H); ctx.restore();
  }
  if (cap && !cap.dead) {
    const y = cap.y - 82 * sizeOf(cap) + Math.sin(B.time * 6) * 3;
    ctx.save(); ctx.beginPath(); ctx.moveTo(cap.x - 7, y - 9); ctx.lineTo(cap.x + 7, y - 9); ctx.lineTo(cap.x, y);
    ctx.closePath(); Art.fs(ctx, '#ffd34d', 2); ctx.restore();
  }
  for (const p of B.projs) drawProj(p);
  for (const f of B.fx) drawFx(f);
  drawFxBursts();
  drawSparks();
  for (const p of B.parts) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of B.floaters) {
    const p = f.t / 0.9;
    const y = f.y - p * 38 - (f.crit ? Math.sin(Math.min(1, p * 4) * Math.PI) * 10 : 0);
    const sc = f.crit ? 1 + Math.max(0, 0.3 - p) * 2 : 1;
    ctx.save(); ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1; ctx.translate(f.x, y); ctx.scale(sc, sc);
    ctx.font = `800 ${f.size}px "Baloo 2",sans-serif`;
    if (f.crit) {   // bạo kích: chữ to, viền đỏ đậm, tô vàng chuyển cam, có loé sáng sau
      ctx.font = `900 ${f.size + 4}px "Baloo 2",sans-serif`;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.6; ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.ellipse(8, -8, 34, 14, 0, 0, TAU); ctx.fill(); ctx.restore();
      const g = ctx.createLinearGradient(0, -f.size, 0, 2); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffd34d'); g.addColorStop(1, '#ff7a1e');
      ctx.lineWidth = 6; ctx.strokeStyle = '#6a1206'; ctx.strokeText(f.txt, 0, 0); ctx.fillStyle = g; ctx.fillText(f.txt, 0, 0);
    } else if (f.el) {   // khắc hệ: huy hiệu tròn màu nguyên tố + chữ
      ctx.beginPath(); ctx.arc(-14, -6, 12, 0, TAU); ctx.fillStyle = f.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.font = '900 11px "Baloo 2",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(ELEMENTS[f.el].name, -14, -2); ctx.textAlign = 'left';
      ctx.font = `900 ${f.size}px "Baloo 2",sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = '#2a0a04'; ctx.strokeText(f.txt, 2, 0); ctx.fillStyle = '#fff3a0'; ctx.fillText(f.txt, 2, 0);
    } else { ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(50,20,10,0.9)'; ctx.strokeText(f.txt, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.txt, 0, 0); }
    ctx.restore();
  }
  ctx.restore();
  const boss = B.enemies.find(e => e.boss && !e.dead);
  if (boss) drawBossBar(boss);
  if (B.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, B.flash / 0.22) * 0.38; ctx.fillStyle = '#fff8e0'; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore(); }
  drawCine();
  drawTargetMark();
  if (B.cutin) {   // tuyệt kỹ: tối màn + vệt tốc độ hoà sáng
    const k = Math.min(1, B.cutin.t * 4) * Math.max(0, 1 - Math.max(0, B.cutin.t - 0.6) / 0.2);
    ctx.save(); ctx.globalAlpha = 0.45 * k; ctx.fillStyle = '#0a0410'; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * k;
    for (let i = 0; i < 26; i++) { const y = (i * 53 + B.cutin.t * 900 * (i % 3 + 1)) % H, x = ((i * 137) % W + B.cutin.t * 2600) % (W + 400) - 200;
      ctx.strokeStyle = i % 4 ? '#fff3c0' : '#ffb02e'; ctx.lineWidth = 1 + (i % 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 140 - (i % 5) * 30, y); ctx.stroke(); }
    ctx.restore();
    drawCutin();
  }
  if (B.banner) drawBanner();
  drawScene();
}

// Trang xem thử hoạt ảnh: #anim=ngokhong — 4 trạng thái cạnh nhau, cỡ lớn
let SHOW = null;
function renderShowcase() {
  if (!homeBg) homeBg = Art.background(W, H, 'forest', 7);
  ctx.drawImage(homeBg, 0, 0, W, H);
  ctx.fillStyle = 'rgba(255,248,225,0.55)'; ctx.fillRect(-W, -H, W * 3, H * 3);
  const a = ANIM[SHOW];
  if (hasRig(SHOW)) { // trang xem thử cho rig: 4 trạng thái
    const ph = (window.__showPhys = window.__showPhys || [0, 1, 2, 3].map(() => Rig.newPhys()));
    const cyc = homeT % 1.1, cyc2 = homeT % 1.6;
    const sts = [
      ['Đứng thở', { anim: 'idle', t: homeT }, 0],
      ['Chạy', { anim: 'walk', t: homeT }, 160],
      ['Đập gậy (lặp mỗi 1,1s)', cyc < 0.42 ? { anim: 'attack', p: cyc / 0.42, t: homeT } : { anim: 'idle', t: homeT }, 0],
      ['Đập gậy quay chậm x3', (homeT % 2.0) < 1.26 ? { anim: 'attack', p: (homeT % 2.0) / 1.26, t: homeT } : { anim: 'idle', t: homeT }, 0],
    ];
    ctx.textAlign = 'center'; ctx.font = '800 20px "Baloo 2",sans-serif';
    sts.forEach(([label, st, vx], i) => {
      const x = i % 2 ? W * 0.72 : W * 0.28, y = i < 2 ? 450 : 880;
      Rig.physics(ph[i], 1 / 60, vx, 0); st.phys = ph[i];
      Art.shadow(ctx, x, y, 2.2);
      const mems = (window.__showMem = window.__showMem || [{}, {}, {}, {}]);
      ctx.save(); ctx.translate(x, y); rigDraw(ctx, SHOW, st, 300, { mem: mems[i], dt: 1 / 60 }); ctx.restore();
      ctx.lineWidth = 5; ctx.strokeStyle = '#4a2a1c'; ctx.strokeText(label, x, y - 345);
      ctx.fillStyle = '#fff3b0'; ctx.fillText(label, x, y - 345);
    });
    return;
  }
  const cells = [
    ['Đứng thở', { walk: false, atkAnim: -1, castT: 0 }],
    ['Chạy', { walk: true, atkAnim: -1, castT: 0 }],
    ['Đánh (lặp mỗi 0,8s)', { walk: false, atkAnim: (homeT % 0.8) < 0.22 ? (homeT % 0.8) / 0.22 : -1, castT: 0 }],
    ['Tung chiêu (lặp mỗi 1,2s)', { walk: false, atkAnim: -1, castT: (homeT % 1.2) < 0.6 ? Math.max(0.001, 0.35 - (homeT % 1.2) * 0.6) : 0 }],
  ];
  ctx.textAlign = 'center'; ctx.font = '800 20px "Baloo 2",sans-serif';
  cells.forEach(([label, st], i) => {
    const x = i % 2 ? W * 0.74 : W * 0.26, y = i < 2 ? 470 : 880;
    Art.shadow(ctx, x, y, 2.2);
    ctx.save(); ctx.translate(x, y);
    if (a) drawAnimFrame(a, animFrame(a, { t: homeT, dead: false, ...st }), 330);
    else if (SPR[SHOW]) { const im = SPR[SHOW]; ctx.drawImage(im, -165 * im.width / im.height, -330, 330 * im.width / im.height, 330); }
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = '#4a2a1c'; ctx.strokeText(label, x, y - 350);
    ctx.fillStyle = '#fff3b0'; ctx.fillText(label, x, y - 350);
  });
  if (!a) { ctx.fillStyle = '#b52a22'; ctx.fillText('Tướng này chưa có rig, đang dùng ảnh tĩnh', W / 2, 40); }
}

// Màn hình chính: đội hình đứng trên bãi cỏ
let homeBg = null, homeT = 0;
function drawHomeHero(id, i, h, t) {
  const P = POSES[id], D = (window.HPOSE && HPOSE[id]) || (window.SKEL_DEFS && SKEL_DEFS[id]), fake = { id, hurt: 0 };   // mọi tướng có dáng (kể cả đợt 2) vẽ cùng một cách → cùng cỡ
  if (P && P.idle1 && P.idle2 && D) {
    const T = 3.6, ph = (t + i * 0.83) % T, a = ph < 1.8 ? 0 : 1;   // đổi dáng dứt khoát (chuyển mờ làm 2 vũ khí chồng lên nhau trông như bị gãy/cong)
    drawPose(fake, a ? 'idle2' : 'idle1', ph, h, 1); return true;
  }
  return false;
}
function renderHome() {
  if (SHOW) { renderShowcase(); return; }
  if (HOMEBG.complete && HOMEBG.naturalWidth) ctx.drawImage(HOMEBG, 0, 0, W, H);
  else { if (!homeBg) homeBg = Art.background(W, H, 'forest', 7); ctx.drawImage(homeBg, 0, 0, W, H); }
  const ids = S.lineup.filter(id => S.owned[id]);
  // sân đá phía dưới: đội trưởng giữa, hai bên lùi dần (đặt cao hơn thanh điều hướng)
  const spots = [[470, 440], [330, 418], [610, 418], [200, 452], [725, 452]];
  const order = ids.map((id, i) => ({ id, i, p: spots[i] })).sort((a, b) => a.p[1] - b.p[1]);
  for (const o of order) {
    const L = HEROES[o.id].look, hh = (o.i === 0 ? 235 : 195) * (L.size || 1);
    Art.shadow(ctx, o.p[0], o.p[1], (L.size || 1) * 1.5);
    ctx.save(); ctx.translate(o.p[0], o.p[1]);
    ctx.scale(o.p[0] > 480 ? -1 : 1, 1);
    if (!drawHomeHero(o.id, o.i, hh, homeT)) {
      const img = SPR[o.id];
      if (img) { const w = hh * img.width / img.height, bb = Math.sin((homeT + o.i) * 2.6) * 0.012; ctx.scale((FACE[o.id] || 1) * (1 - bb * 0.6), 1 + bb); ctx.drawImage(img, -w / 2, -hh, w, hh); }
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ LOOP
let lastT = performance.now();
let _fpsAcc = 0, _fpsN = 0, _fpsT = 0;
function gfxLow() { return S.gfx === 'low' || (S.gfx !== 'high' && window.__autoLow); }
function frame(now) {
  let dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  homeT += dt;
  if (B && !B.paused && !B.over && dt > 0) {   // đo FPS trong trận: dưới 40 suốt 3 giây → tự giảm hiệu ứng (chế độ Tự động)
    _fpsAcc += dt; _fpsN++; _fpsT += dt;
    if (_fpsT >= 3) { const fps = _fpsN / _fpsAcc; if (fps < 40 && !window.__autoLow) { window.__autoLow = true; if (S.gfx !== 'high') toast('Đã giảm hiệu ứng cho mượt hơn'); } _fpsAcc = _fpsN = _fpsT = 0; }
  }
  if (B && !B.paused) {
    if (B.hitstop > 0) { B.hitstop -= dt; dt = 0; } // đứng hình khi trúng đòn mạnh
    if (B.slowmo > 0) { B.slowmo -= dt; dt *= 0.35; }
    const steps = B.speed;
    for (let i = 0; i < steps; i++) update(dt);
    updateHUD();
  }
  render();
  requestAnimationFrame(frame);
}

// =====================================================================
// UI
// =====================================================================
function icon(k) { return `<i class="ic ic-${k}"></i>`; }
function resBar() {
  return `<div class="resbar"><span>${icon('ngoc')}${fmt(S.ngoc)}</span><span>${icon('vang')}${fmt(S.vang)}</span><span title="Mảnh vạn năng">${icon('univ')}${fmt(S.univ)}</span><span title="Tiên Khí (hồi 1 điểm / 6 phút)">⚡${tkNow()}/${TK_MAX}</span></div>`;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  ui.appendChild(t); setTimeout(() => t.remove(), 1600);
}
function starsHTML(n, max) {
  return `<span class="stars">${'<b>★</b>'.repeat(n)}${'<b class="off">★</b>'.repeat(Math.max(0, max - n))}</span>`;
}
function rarTag(r) { return `<span class="rar rar-${r}">${r}</span>`; }
function roleTag(r) { return `<span class="tag" style="--c:${ROLES[r].color}">${ROLES[r].name}</span>`; }
function elTag(e) { return `<span class="tag" style="--c:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span>`; }

function totalPower() { return Object.keys(S.owned).reduce((s, id) => s + power(id), 0); }

// ---- CÀI ĐẶT (bấm ảnh đại diện): tài khoản, âm thanh, đồ hoạ, dữ liệu
function showSettings() {
  const st = !window.Cloud || !Cloud.ok ? 'Chưa kết nối máy chủ lưu' : Cloud.user ? 'Đã đăng nhập: ' + esc(Cloud.user.displayName || '') + ' · tự lưu lên mạng' : 'Chưa đăng nhập: dữ liệu chỉ lưu trên máy này';
  const w = document.createElement('div'); w.className = 'modal set-modal';
  w.innerHTML = `<div class="buff-box"><div class="cp-title"><span>Cài Đặt</span></div><div class="buff-body">
    <section><h4>Tài khoản</h4><div class="bf"><b>Lưu trực tuyến</b><span>${st}</span></div>
      <div class="set-row"><button class="btn small gold" id="sAcc">${window.Cloud && Cloud.user ? 'Đăng xuất' : 'Đăng nhập Google'}</button><button class="btn small" id="sData">Mã chuyển dữ liệu</button></div></section>
    <section><h4>Âm thanh và hình ảnh</h4>
      <div class="set-row"><button class="btn small ${S.mute ? '' : 'gold'}" id="sSnd">Âm thanh: ${S.mute ? 'Tắt' : 'Bật'}</button>
      <button class="btn small ${S.ultScene === false ? '' : 'gold'}" id="sScene">Cảnh tuyệt kỹ SSR: ${S.ultScene === false ? 'Tắt' : 'Bật'}</button>
      <button class="btn small" id="sGfx">Đồ hoạ: ${S.gfx === 'low' ? 'Nhẹ' : S.gfx === 'high' ? 'Đẹp' : 'Tự động'}</button></div></section>
    <section><h4>Chơi thử</h4><div class="set-row"><button class="btn small" id="sTut">Xem lại hướng dẫn</button><button class="btn small red" id="sReset">Xoá dữ liệu chơi thử</button></div><small id="sResetMsg"></small></section>
  </div><div class="res-btns"><button class="btn gold" id="sClose">Đóng</button></div></div>`;
  ui.appendChild(w);
  const q = s => w.querySelector(s), close = () => { w.remove(); showHome(); };
  q('#sClose').onclick = close; w.addEventListener('click', e => { if (e.target === w) close(); });
  q('#sAcc').onclick = async () => { if (!(window.Cloud && Cloud.ok)) { toast('Không kết nối được máy chủ lưu'); return; }
    try { if (Cloud.user) await Cloud.signOut(); else await Cloud.signIn(); } catch (e) { toast('Lỗi: ' + (e.code || e.message)); } w.remove(); showSettings(); };
  q('#sData').onclick = () => { w.remove(); showSaveTransfer(); };
  q('#sSnd').onclick = () => { S.mute = !S.mute; save(); setTimeout(bgmApply, 0); audioOn(); w.remove(); showSettings(); };
  q('#sScene').onclick = () => { S.ultScene = S.ultScene === false ? true : false; save(); w.remove(); showSettings(); };
  q('#sGfx').onclick = () => { S.gfx = S.gfx === 'low' ? 'high' : S.gfx === 'high' ? 'auto' : 'low'; save(); w.remove(); showSettings(); };
  q('#sTut').onclick = () => { S.tut = {}; save(); toast('Hướng dẫn sẽ hiện lại ở trận tới'); };
  let armed = false; q('#sReset').onclick = () => { if (!armed) { armed = true; q('#sResetMsg').textContent = 'Bấm lần nữa để xoá toàn bộ tiến độ.'; q('#sReset').textContent = 'Xác nhận xoá'; return; }
    S = defaultSave(); save(); w.remove(); showHome(); };
}
// ---- THỬ LUYỆN: gom các chế độ phụ

// ---- PHÓ BẢN TÀI NGUYÊN (khung VLĐMT: PB Vàng / PB EXP / PB Đan Đột Phá — 4 độ khó, giới hạn lượt/ngày)
const PB = {
  gold: { name: 'Kim Khố', ico: 'ic_chest', bg: 'ch4', desc: 'Yêu quái canh giữ kho vàng. Diệt càng nhiều càng nhiều vàng.', rew: d => ({ vang: [4000, 9000, 16000, 28000][d] }), perKill: [15, 30, 55, 90] },
  univ: { name: 'Vạn Năng Bí Cảnh', ico: 'ic_tangkinh', bg: 'ch6', desc: 'Bí cảnh chứa mảnh vạn năng, dùng để tăng sao bất kỳ Thần Tướng.', rew: d => ({ univ: [3, 6, 10, 16][d], vang: [800, 1500, 2500, 4000][d] }) },
  equip: { name: 'Thần Binh Khố', ico: 'ic_battle', bg: 'ch8', desc: 'Kho binh khí của Thiên Đình. Chắc chắn rơi trang bị, độ khó cao rơi đồ quý hơn.', rew: d => ({ vang: [1000, 2000, 3500, 5500][d] }), items: [1, 1, 2, 3] },
};
const PB_DIFF = [{ n: 'Dễ', ch: 0, need: '1-3' }, { n: 'Thường', ch: 3, need: '3-10' }, { n: 'Khó', ch: 6, need: '6-10' }, { n: 'Ác Mộng', ch: 9, need: '9-10' }];
const PB_TRIES = 3;
function pbDay() { const k = dayKey(); if (!S.pb || S.pb.d !== k) S.pb = { d: k, n: {} }; return S.pb; }
function pbLeft(t) { return PB_TRIES - (pbDay().n[t] || 0); }
function pbStage(t, d) {
  const D = PB_DIFF[d], base = STAGES[D.ch * 10 + 6];
  return { ...base, id: 'PB-' + t + '-' + d, pb: t, pbD: d, kind: 'normal', name: PB[t].name + ' · ' + D.n, lvl: base.lvl + 1, par: 90, gate: 9e9,
    reward: { ngoc: 0, vang: 0 }, waves: base.waves.slice(0, 12), theme: base.theme, ehp: 1 + d * 0.1, eatk: 1 + d * 0.05 };
}
function showPB(t) {
  if (!t) {   // danh sách 3 phó bản
    ui.innerHTML = `<div class="screen panel-screen">${topBar('Phó Bản Tài Nguyên')}<p class="chap-story">Mỗi phó bản có <b>${PB_TRIES} lượt mỗi ngày</b>, không tốn Tiên Khí. Độ khó cao mở khi qua boss chương tương ứng, thưởng gấp nhiều lần.</p>
      <div class="tr-grid">${Object.keys(PB).map(k => `<button class="tr-card" data-pbt="${k}" style="--bg:url('art/bg/${PB[k].bg}.webp')"><span class="tr-ic">${IC2(PB[k].ico, 'ic_chest')}</span><b>${PB[k].name}</b><small>Còn ${pbLeft(k)}/${PB_TRIES} lượt hôm nay</small><em>${PB[k].desc}</em></button>`).join('')}</div></div>`;
    $('#bBack').onclick = showTrials; ui.querySelectorAll('[data-pbt]').forEach(b => b.onclick = () => showPB(b.dataset.pbt)); return;
  }
  const P = PB[t], left = pbLeft(t);
  ui.innerHTML = `<div class="screen panel-screen">${topBar(P.name)}<p class="chap-story">${P.desc} Còn <b>${left}/${PB_TRIES}</b> lượt hôm nay.</p>
    <div class="pb-list">${PB_DIFF.map((D, d) => { const open = !!S.cleared[D.need], r = P.rew(d);
      return `<div class="pb-row ${open ? '' : 'locked'}"><div><b>${D.n}</b><small>${open ? `Quái cấp ${pbStage(t, d).lvl}` : `Mở khi qua ải ${D.need}`}</small></div>
        <span class="rew">${rewTxt(r)}${P.perKill ? ` <small>+${P.perKill[d]} vàng/quái</small>` : ''}${P.items ? ` <small>+${P.items[d]} trang bị</small>` : ''}</span>
        <button class="btn ${open && left > 0 ? 'gold' : ''}" data-pbd="${d}" ${open && left > 0 ? '' : 'disabled'}>Khiêu chiến</button></div>`; }).join('')}</div></div>`;
  $('#bBack').onclick = () => showPB(); ui.querySelectorAll('[data-pbd]').forEach(b => b.onclick = () => enterStage(pbStage(t, +b.dataset.pbd)));
}
function showTrials() {
  const t = S.tower || 0, N = nanState(), rd = 3 - raidToday().n;
  const card = (id, ic, fb, bg, title, sub, note) => `<button class="tr-card" id="${id}" style="--bg:url('art/bg/${bg}.webp')"><span class="tr-ic">${IC2(ic, fb)}</span><b>${title}</b><small>${sub}</small>${note ? `<em>${note}</em>` : ''}</button>`;
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Thử Luyện')}<div class="tr-grid">
    ${card('trPB', 'ic_chest', 'ic_chest', 'ch4', 'Phó Bản Tài Nguyên', `Vàng · Mảnh vạn năng · Trang bị`, `Còn ${Object.keys(PB).reduce((s, k) => s + pbLeft(k), 0)} lượt hôm nay`)}
    ${card('trTower', 'ic_tower', 'ic_battle', 'ch7', 'Tháp Thập Tuyệt', `Đã qua ${t}/100 tầng`, 'Chọn lợi/hại mỗi tầng')}
    ${card('trNan', 'ic_nan', 'ic_book', 'ch12', 'Tám Mươi Mốt Nạn', `Kỷ lục ${N.best}/81`, N.run ? `Đang ở nạn ${N.run.n}` : 'Hành trình roguelike')}
    ${card('trRaid', 'ic_raid', 'ic_chest', 'ch9', 'Boss Xâm Lược', `Còn ${rd}/3 lượt hôm nay`, 'Thưởng theo sát thương')}
    ${card('trRank', 'ic_rank', 'ic_team', 'ch6', 'Bảng Xếp Hạng', 'Lực chiến · Tháp · 81 Nạn · Boss', '')}
  </div></div>`;
  $('#bBack').onclick = showHome; $('#trTower').onclick = showTower; $('#trPB').onclick = () => showPB(); $('#trNan').onclick = showNan; $('#trRaid').onclick = showRaid; $('#trRank').onclick = () => showRank();
}
function IC2(n, fb) { return `<img src="art/ui/${n}.webp" onerror="this.onerror=null;this.src='art/ui/${fb}.webp'" alt="">`; }
function showHome() {
  bgmSet('home');
  B = null;
  ensureHeroAssets(S.lineup.filter(id => S.owned[id]));   // nạp tư thế để tướng ở trang chủ có dáng đứng riêng
  const cap = S.lineup.find(id => S.owned[id]), nf = STAGES.findIndex(st => !S.cleared[st.id]), nx = STAGES[nf < 0 ? STAGES.length - 1 : nf];
  const dq0 = dq(), qDot = DAILY.some(q => (dq0.p[q.id] || 0) >= q.need && !dq0.c[q.id]), ir = idleReward();
  const L7 = loginState(), giftLeft = LOGIN7.some((r, i2) => !L7.got.includes(i2)), giftDot = LOGIN7.some((r, i2) => i2 < L7.d && !L7.got.includes(i2));
  const heroDot = Object.keys(S.owned).some(id => { const o = S.owned[id], h = HEROES[id]; return h && o.star < 5 && o.shard + S.univ >= STAR_COST[h.rar][o.star - 1]; });
  const nanRun = S.nan && S.nan.run, rdLeft = 3 - raidToday().n;
  const cloudSt = !window.Cloud || !Cloud.ok ? 'off' : Cloud.user ? 'ok' : 'warn';
  ui.innerHTML = `<div class="screen home2 home3">
    <div class="hm-top">
      <button class="hm-prof" id="hProf" title="Hồ sơ và cài đặt"><span class="hm-avatar">${cap ? `<img src="${por(cap, 60)}">` : ''}<i class="hm-cloud ${cloudSt}"></i></span>
        <span class="hm-who"><b>${window.Cloud && Cloud.user ? esc(Cloud.user.displayName || 'Chấp Bảng Sứ') : 'Chấp Bảng Sứ'}</b><small>⚔ ${fmt(totalPower())}</small></span></button>
      ${resBar()}
    </div>
    <div class="hm-logo"><span class="l1">THẦN TIÊN</span><span class="l2">ĐẠI CHIẾN</span></div>
    <div class="hm-left">
      <button class="hm-ic" id="hQuest"><img src="art/ui/ic_quest.webp" onerror="this.onerror=null;this.src='art/ui/ic_quest.webp'" alt="">${qDot ? '<i class="dot"></i>' : ''}<span>Nhiệm Vụ</span></button>
      <button class="hm-ic" id="hEv"><img src="art/ui/ic_event.webp" onerror="this.onerror=null;this.src='art/ui/ic_gift.webp'" alt="">${monthState().last !== dayKey() ? '<i class="dot"></i>' : ''}<span>Sự Kiện</span></button>
      ${giftLeft ? `<button class="hm-ic" id="hGift"><img src="art/ui/ic_gift.webp" onerror="this.onerror=null;this.src='art/ui/ic_gift.webp'" alt="">${giftDot ? '<i class="dot"></i>' : ''}<span>Tân Thủ</span></button>` : ''}
      <button class="hm-ic" id="hBt"><img src="art/ui/ic_tangkinh.webp" onerror="this.onerror=null;this.src='art/ui/ic_book.webp'" alt=""><span>Tàng Kinh</span></button>
    </div>
    <div class="hm-right">
      <button class="hm-ic" id="hRank"><img src="art/ui/ic_rank.webp" onerror="this.onerror=null;this.src='art/ui/ic_team.webp'" alt=""><span>Xếp Hạng</span></button>
      <button class="hm-ic hm-idle2" id="hIdle"><img src="art/ui/ic_chest.webp" onerror="this.onerror=null;this.src='art/ui/ic_chest.webp'" alt="">${ir.m >= 1 ? '<i class="dot"></i>' : ''}<span>Treo máy</span><small>${icon('vang')}${fmt(ir.vang)}</small></button>
    </div>
    <nav class="hm-nav5">
      <button id="hHeroes"><img src="art/ui/ic_hero.webp" onerror="this.onerror=null;this.src='art/ui/ic_hero.webp'" alt="">${heroDot ? '<i class="dot"></i>' : ''}<span>Thần Tướng</span></button>
      <button id="hLineup"><img src="art/ui/ic_team.webp" onerror="this.onerror=null;this.src='art/ui/ic_team.webp'" alt=""><span>Đội Hình</span></button>
      <button id="hFight" class="hm-main"><img src="art/ui/ic_battle.webp" onerror="this.onerror=null;this.src='art/ui/ic_battle.webp'" alt=""><span>Chiến Dịch</span><small>Ải ${nx.id}</small></button>
      <button id="hGacha"><img src="art/ui/ic_summon.webp" onerror="this.onerror=null;this.src='art/ui/ic_summon.webp'" alt=""><span>Chiêu Mộ</span></button>
      <button id="hTrial"><img src="art/ui/ic_trial.webp" onerror="this.onerror=null;this.src='art/ui/ic_battle.webp'" alt="">${rdLeft > 0 || nanRun ? '<i class="dot"></i>' : ''}<span>Thử Luyện</span></button>
    </nav>
    ${(!IS_APP && IS_IOS && !S.a2hs) ? '<div class="a2hs" id="a2hs">Để chơi full màn hình: bấm <b>Chia sẻ</b> ⬆ rồi <b>Thêm vào MH chính</b>. <u>Đóng</u></div>' : ''}
  </div>`;
  const ah = $('#a2hs'); if (ah) ah.onclick = () => { S.a2hs = 1; save(); ah.remove(); };
  $('#hFight').onclick = showStages; $('#hLineup').onclick = showLineup; $('#hGacha').onclick = showGacha; $('#hHeroes').onclick = showHeroes;
  $('#hQuest').onclick = showQuests; $('#hBt').onclick = showTangKinh; $('#hIdle').onclick = claimIdle; $('#hEv').onclick = showEvents;
  if ($('#hGift')) $('#hGift').onclick = showGift; $('#hRank').onclick = () => showRank(); $('#hTrial').onclick = showTrials; $('#hProf').onclick = showSettings;
}
function topBar(title) {
  return `<div class="topbar-menu"><button class="btn small back" id="bBack">‹ Về</button><h2>${title}</h2>${resBar()}</div>`;
}

let curChap = -1;

function giveRew(r) { for (const k in r) S[k] = (S[k] || 0) + r[k]; save(); }
function chapStars(c) { return STAGES.filter(st => st.chap === c).reduce((s, st) => s + (S.cleared[st.id] || 0), 0); }
function chBoxHTML(c) {
  const got = (S.chBox || {})[c] || [], s = chapStars(c);
  return `<div class="ch-box"><span>⭐ ${s}/30</span>${CH_BOX.map(([need, r], k) => { const ok = s >= need, done = got.includes(k);
    return `<button class="cb ${done ? 'done' : ok ? 'ready' : ''}" data-cb="${k}" ${ok && !done ? '' : 'disabled'} title="${need} sao: ${Object.keys(r).map(x => x + ' ' + r[x]).join(', ')}">🎁<b>${need}</b><small>${done ? 'Đã nhận' : rewTxt(r)}</small></button>`; }).join('')}</div>`;
}
function bindChBox(c) { ui.querySelectorAll('[data-cb]').forEach(b => b.onclick = () => { S.chBox = S.chBox || {}; S.chBox[c] = S.chBox[c] || []; const k = +b.dataset.cb; if (S.chBox[c].includes(k)) return; S.chBox[c].push(k); giveRew(CH_BOX[k][1]); toast('Nhận rương ' + CH_BOX[k][0] + ' sao'); showStages(); }); }
function pullBoxHTML() {
  const got = S.pullBox || [], p = S.pulls || 0;
  return `<div class="pull-box"><b>Quà tích luỹ chiêu mộ · đã quay ${p} lượt</b><div>${PULL_BOX.map(([need, r], k) => { const ok = p >= need, done = got.includes(k);
    return `<button class="pb ${done ? 'done' : ok ? 'ready' : ''}" data-pb="${k}" ${ok && !done ? '' : 'disabled'}><b>${need}</b><small>${done ? '✓' : rewTxt(r)}</small></button>`; }).join('')}</div></div>`;
}
function showStages() {
  if (curChap < 0) { const f = STAGES.findIndex(st => !S.cleared[st.id]); curChap = f < 0 ? CHAPTERS.length - 1 : STAGES[f].chap; }
  const done = c => STAGES.filter(st => st.chap === c && S.cleared[st.id]).length;
  const open = c => c === 0 || done(c - 1) >= 10;
  const ch = CHAPTERS[curChap];
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Chương ' + ch.id + ' · ' + ch.name)}
    <div class="chap-tabs">${CHAPTERS.map((c, i) => `<button class="btn small ${i === curChap ? 'gold' : ''}" data-ch="${i}" ${open(i) ? '' : 'disabled'}>${open(i) ? c.id : '🔒'} ${esc(c.name)} <small>${done(i)}/10</small></button>`).join('')}</div>
    <p class="chap-story">${esc(ch.story)} <b>Boss: ${esc(ch.boss)}</b> · <i>${esc(ch.mech)}</i></p>
    ${(() => { const el = chapElem(curChap); if (!el) return ''; const good = Object.keys(BEATS).find(k => BEATS[k] === el), bad = BEATS[el];
      return `<p class="chap-el">Quái chủ yếu hệ <b style="color:${ELEMENTS[el].color}">${ELEMENTS[el].name}</b> → nên dùng tướng hệ <b style="color:${ELEMENTS[good].color}">${ELEMENTS[good].name}</b> (+30% sát thương), tránh hệ <b style="color:${ELEMENTS[bad].color}">${ELEMENTS[bad].name}</b> (−20%).</p>`; })()}
    ${(() => { const tr = new Set(); for (const st of STAGES) if (st.chap === curChap) for (const w of st.waves) for (const [t] of w.list) if (ENEMIES[t] && ENEMIES[t].trait) tr.add(ENEMIES[t].trait);
      return tr.size ? `<div class="chap-traits">${[...tr].map(k => `<span class="ct" title="${esc(TRAIT_INFO[k].desc)}"><i>${TRAIT_INFO[k].ico}</i><b>${TRAIT_INFO[k].name}</b><small>${esc(TRAIT_INFO[k].desc)}</small></span>`).join('')}</div>` : ''; })()}
    ${chBoxHTML(curChap)}
    ${(() => { const cr = CH_ROLE[CHAPTERS[curChap].id]; return cr ? `<p class="chap-el">Khắc hệ phái: quái chương này <b style="color:#2a9a4a">yếu trước ${ROLES[cr[0]].name}</b> (+25% sát thương), <b style="color:#c0392b">kháng ${ROLES[cr[1]].name}</b> (−15%).</p>` : ''; })()}
    ${(() => { const id = CH_HERO[CHAPTERS[curChap].id]; return id && HEROES[id] ? `<div class="ch-rew"><img src="${por(id, 48)}" alt=""><span>Qua boss chương nhận <b>${esc(HEROES[id].name)}</b> ${rarTag(HEROES[id].rar)}${S.owned[id] ? ' <small>(đã có)</small>' : ''}</span></div>` : ''; })()}
    <div class="stage-list">${STAGES.map((st, i) => {
      if (st.chap !== curChap) return '';
      const locked = i > 0 && !S.cleared[STAGES[i - 1].id];
      const stars = S.cleared[st.id] || 0;
      const boss = st.waves.some(w => w.boss);
      return `<div class="stage-card ${locked ? 'locked' : ''} theme-${st.theme}">
        <div class="st-head"><b>${st.id}</b><h3>${esc(st.name)}</h3>${boss ? '<span class="tag" style="--c:#ff3d5a">BOSS</span>' : st.kind === 'elite' ? '<span class="tag" style="--c:#c25bff">TINH ANH</span>' : ''}</div>
        <p>${esc(st.desc)}</p>
        <div class="st-meta"><span>Cấp quái ${st.lvl}</span><span>${st.waves.length} đợt</span><span>3 sao: không ai ngã, dưới ${st.par}s</span></div>
        <div class="st-foot">${starsHTML(stars, 3)}
          <span class="rew">${icon('ngoc')}${st.reward.ngoc} ${icon('vang')}${st.reward.vang}</span>
          ${stars >= 3 && !locked ? `<button class="btn small" data-sw="${i}" data-n="1">Quét ×1</button><button class="btn small" data-sw="${i}" data-n="5">Quét ×5</button>` : ''}
          <button class="btn gold small" data-si="${i}" ${locked ? 'disabled' : ''}>${locked ? 'Khoá' : `Vào trận ⚡${tkCost(st)}`}</button></div>
      </div>`;
    }).join('')}</div>
  </div>`;
  bindChBox(curChap);
  $('#bBack').onclick = showHome;
  ui.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { curChap = +b.dataset.ch; showStages(); });
  ui.querySelectorAll('[data-si]').forEach(b => b.onclick = () => enterStage(+b.dataset.si));
  ui.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => doSweep(+b.dataset.sw, +b.dataset.n));
}

// ---------------- Lineup
function synergyHTML(ids) {
  const info = teamInfo(ids);
  const facs = info.facs.map(f => `<div class="syn ${f.pct ? 'on' : ''}"><b>${FACTIONS[f.f]}</b> ${f.n} người ${f.pct ? `<em>+${Math.round(f.pct * 100)}% máu, công</em>` : '<small>cần 3 người</small>'}</div>`).join('');
  const bonds = BONDS.map(b => {
    const on = info.bonds.includes(b);
    return `<div class="syn ${on ? 'on' : ''}"><b>${b.name}</b> <small>${b.members.map(m => HEROES[m].name).join(' + ')}</small>${on ? `<em>${b.desc}${bondLv(b) ? ` · Cấp ${bondLv(b)}: +${Math.round(BOND_LV[bondLv(b)] * 100)}% công, máu` : ''}</em>` : ''}</div>`;
  }).join('');
  const cs = ids[0] ? capSkill(ids[0]) : null;
  const cb = COMBOS.filter(c => ids.includes(c.a) && ids.includes(c.b)).map(c => `<div class="syn on"><b>${esc(c.name)}</b> <small>${HEROES[c.a].name} + ${HEROES[c.b].name}</small><em>Hai người tung tuyệt kỹ cách nhau ≤3 giây → hợp kích</em></div>`).join('');
  return `${cs ? `<h4>Kỹ năng đội trưởng</h4><div class="syn on"><b>${esc(cs.n)}</b> <em>${esc(cs.d)}</em></div>` : ''}<h4>Cộng hưởng phe</h4>${facs || '<small>Chưa có</small>'}<h4>Duyên phận</h4>${bonds}`;
}
function showLineup() {
  const lu = S.lineup.filter(id => S.owned[id]);
  const owned = Object.keys(HEROES).filter(id => S.owned[id]);
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Đội Hình')}
    <div class="lineup-slots">${[0, 1, 2, 3, 4].map(i => {
      const id = lu[i];
      return `<div class="slot ${id ? '' : 'empty'}" data-slot="${i}">
        <span class="slot-no">${i === 0 ? 'Đội trưởng' : 'Ra trận ' + (i + 1)}</span>
        ${id ? `<img src="${por(id)}"><b>${esc(HEROES[id].name)}</b>${roleTag(HEROES[id].role)}
          ${i > 0 ? `<button class="mini cap" data-cap="${i}" title="Đặt làm đội trưởng">♛</button>` : '<span class="crown">♛</span>'}
          <button class="mini rm" data-rm="${i}" title="Bỏ khỏi đội">×</button>` : '<i>+</i>'}
      </div>`;
    }).join('')}</div>
    <p class="hint">Đội trưởng ra trận đầu tiên, được <b>+20% tốc đánh</b>, <b>+10% sát thương chiêu</b> và kích hoạt <b>kỹ năng đội trưởng</b> cho cả đội. Các tướng khác ra trận theo thứ tự khi nhặt Linh Phù. · Lực chiến đội: <b>${fmt(lu.reduce((s, id) => s + power(id), 0))}</b></p>
    <div class="lineup-body">
      <div class="pick-grid2">${owned.sort((a, b) => power(b) - power(a)).map(id => `
        <button class="hc2 r-${HEROES[id].rar} ${lu.includes(id) ? 'in' : ''}" data-pick="${id}"><span class="hc2-img"><img src="${por(id, 80)}" loading="lazy"></span>
          <span class="hc2-rar">${HEROES[id].rar}</span>${lu.includes(id) ? `<span class="hc2-in">${lu.indexOf(id) === 0 ? '👑' : lu.indexOf(id) + 1}</span>` : ''}
          <b>${esc(HEROES[id].name)}</b><small>${ROLES[HEROES[id].role].name} · ⚔${fmt(power(id))}</small></button>`).join('')}</div>
      <div class="synergy">${synergyHTML(lu)}</div>
    </div>
  </div>`;
  $('#bBack').onclick = showHome;
  ui.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    const id = b.dataset.pick;
    if (S.lineup.includes(id)) S.lineup = S.lineup.filter(x => x !== id);
    else if (S.lineup.length >= 5) { toast('Đội hình tối đa 5 tướng'); return; }
    else S.lineup.push(id);
    save(); showLineup();
  });
  ui.querySelectorAll('[data-rm]').forEach(b => b.onclick = e => { e.stopPropagation(); S.lineup.splice(+b.dataset.rm, 1); save(); showLineup(); });
  ui.querySelectorAll('[data-cap]').forEach(b => b.onclick = e => {
    e.stopPropagation(); const i = +b.dataset.cap;
    const tmp = S.lineup[0]; S.lineup[0] = S.lineup[i]; S.lineup[i] = tmp; save(); showLineup();
  });
}

// ---------------- Heroes
const HF = { rar: 'all', role: 'all', sort: 'power' };
function canStarUp(id) { const o = S.owned[id], h = HEROES[id]; return !!(o && h && o.star < 5 && o.shard + S.univ >= STAR_COST[h.rar][o.star - 1]); }
function showHeroes() {
  const RK = { SSR: 3, SR: 2, R: 1 }, all = Object.keys(HEROES), own = all.filter(id => S.owned[id]);
  let ids = all.filter(id => (HF.rar === 'all' || HEROES[id].rar === HF.rar) && (HF.role === 'all' || HEROES[id].role === HF.role));
  const key = id => HF.sort === 'power' ? (S.owned[id] ? power(id) : -1) : HF.sort === 'lv' ? (S.owned[id] ? S.owned[id].lv * 10 + S.owned[id].star : -1) : RK[HEROES[id].rar] * 100 + (S.owned[id] ? 50 : 0);
  ids.sort((a, b) => (S.owned[b] ? 1 : 0) - (S.owned[a] ? 1 : 0) || key(b) - key(a));
  const chip = (grp, v, label) => `<button class="chip ${HF[grp] === v ? 'on' : ''}" data-f="${grp}:${v}">${label}</button>`;
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Thần Tướng')}
    <div class="hf-bar"><div class="hf-chips">${chip('rar', 'all', 'Tất cả')}${chip('rar', 'SSR', 'SSR')}${chip('rar', 'SR', 'SR')}${chip('rar', 'R', 'R')}</div>
      <div class="hf-chips">${chip('role', 'all', 'Mọi hệ')}${Object.keys(ROLES).map(r => chip('role', r, ROLES[r].name)).join('')}</div>
      <div class="hf-chips">${chip('sort', 'power', 'Lực chiến')}${chip('sort', 'rar', 'Phẩm chất')}${chip('sort', 'lv', 'Cấp')}<span class="hf-count">Đã có <b>${own.length}</b>/${all.length}</span></div></div>
    <div class="hero-grid2">${ids.map(id => { const h = HEROES[id], o = S.owned[id];
      return `<button class="hc2 r-${h.rar} ${o ? '' : 'locked'}" data-h="${id}"><span class="hc2-img"><img src="${por(id, 110)}" loading="lazy"></span>
        <span class="hc2-rar">${h.rar}</span><span class="hc2-el" style="background:${ELEMENTS[h.el].color}">${ELEMENTS[h.el].name}</span>${canStarUp(id) ? '<i class="dot"></i>' : ''}
        <b>${esc(h.name)}</b><small>${o ? `Lv${o.lv} <span class="hc2-st">${'★'.repeat(o.star)}<i>${'★'.repeat(5 - o.star)}</i></span>` : ROLES[h.role].name}</small></button>`; }).join('')}</div></div>`;
  $('#bBack').onclick = showHome;
  ui.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { const [g, v] = b.dataset.f.split(':'); HF[g] = v; showHeroes(); });
  ui.querySelectorAll('[data-h]').forEach(b => b.onclick = () => showHeroDetail(b.dataset.h));
}
function showHeroDetail(id) {
  const h = HEROES[id], o = S.owned[id];
  const st = heroStats(id);
  const lvCost = o ? 150 * o.lv : 0;
  const starNeed = o && o.star < 5 ? STAR_COST[h.rar][o.star - 1] : 0;
  const bonds = BONDS.filter(b => b.members.includes(id));
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Thần Tướng')}
    <div class="detail r-${h.rar}">
      <div class="det-art"><img src="${fullImg(id, 220)}"></div>
      <div class="det-head">${rarTag(h.rar)}<h3>${esc(h.name)}</h3><small>${esc(h.title)} · ${esc(h.src)}</small>
        <div class="tags">${roleTag(h.role)}${elTag(h.el)}<span class="tag" style="--c:#8a6a4a">${FACTIONS[h.fac]}</span></div>
        ${o ? `<div class="lvrow">Lv ${o.lv}/${MAX_LV} · ${starsHTML(o.star, 5)} · Lực chiến ${fmt(power(id))}</div>` : '<div class="lvrow">Chưa sở hữu, nhận qua Chiêu Mộ</div>'}
      </div>
      <div class="det-stats">
        <div><span>Máu</span><b>${fmt(st.hp)}</b></div><div><span>Công</span><b>${fmt(st.atk)}</b></div>
        <div><span>Thủ</span><b>${fmt(st.def)}</b></div><div><span>Tốc đánh</span><b>${st.aspd.toFixed(2)}/s</b></div>
      </div>
      <div class="skills-list">
        <div class="skill"><span class="sk-kind">Nội tại</span><b>${esc(h.passive.name)}</b><p>${esc(h.passive.desc)}</p></div>
        <div class="skill"><span class="sk-kind">Tiểu chiêu · 30 nội công</span><b>${esc(h.small.name)}</b><p>${esc(h.small.desc)}</p></div>
        <div class="skill ult"><span class="sk-kind">Tuyệt kỹ · 60 nội công</span><b>${esc(h.ult.name)}</b><p>${esc(h.ult.desc)}</p></div>
        ${h.rar === 'SR' ? `<div class="skill awaken ${o && o.star >= 5 ? 'on' : ''}"><span class="sk-kind">Thức tỉnh · 5★</span><b>${o && o.star >= 5 ? 'Đã thức tỉnh' : 'Chưa thức tỉnh'}</b><p>Đạt 5 sao để mở cảnh tuyệt kỹ toàn màn hình như tướng SSR.</p></div>` : ''}
        ${bonds.map(b => `<div class="skill bond"><span class="sk-kind">Duyên phận</span><b>${esc(b.name)}</b><p>${esc(b.desc)}</p></div>`).join('')}
      </div>
      ${o ? `<div class="det-actions">
        <button class="btn gold" id="bLv" ${o.lv >= MAX_LV ? 'disabled' : ''}>Nâng cấp<small>${icon('vang')}${fmt(lvCost)}</small></button>
        <button class="btn red" id="bStar" ${o.star >= 5 ? 'disabled' : ''}>Tăng sao<small>Mảnh ${o.shard}/${starNeed || '-'} · vạn năng ${S.univ}</small></button>
        <button class="btn" id="bEq">Trang bị<small>${Object.keys(o.eq || {}).length}/3</small></button>
        <button class="btn" id="bLore">Truyện Ký<small>${(o.lore || []).length}/3</small></button>
        ${o.star >= 5 && o.shard > 0 ? `<button class="btn" id="bDis">Phân giải mảnh<small>${o.shard} → ${o.shard} vạn năng</small></button>` : ''}
      </div>` : ''}
    </div></div>`;
  $('#bBack').onclick = showHeroes;
  if (!o) return;
  $('#bLv').onclick = () => {
    if (S.vang < lvCost) { toast('Không đủ vàng'); return; }
    S.vang -= lvCost; o.lv++; qAdd('lv'); save(); showHeroDetail(id);
  };
  $('#bEq').onclick = () => showEquip(id); $('#bLore').onclick = () => showLore(id);
  if ($('#bDis')) $('#bDis').onclick = () => { S.univ += o.shard; toast('Phân giải ' + o.shard + ' mảnh'); o.shard = 0; save(); showHeroDetail(id); };
  $('#bStar').onclick = () => {
    const have = o.shard + S.univ;
    if (have < starNeed) { toast('Chưa đủ mảnh'); return; }
    const useOwn = Math.min(o.shard, starNeed);
    o.shard -= useOwn; S.univ -= starNeed - useOwn; o.star++; save(); showHeroDetail(id);
    if (o.star >= 5 && h.rar === 'SR') toast('✦ THỨC TỈNH! ' + h.name + ' mở khoá cảnh tuyệt kỹ toàn màn hình');
  };
}

// ---------------- Gacha
function pullOne() {
  S.pity++; S.pity10++; S.pulls++;
  let pS = GACHA.ssr;
  if (S.pity >= GACHA.softFrom) pS += (S.pity - GACHA.softFrom + 1) * GACHA.softStep;
  if (S.pity >= GACHA.hard) pS = 1;
  const r = Math.random();
  let rar;
  if (r < pS) rar = 'SSR';
  else if (r < pS + GACHA.sr || S.pity10 >= 10) rar = 'SR';
  else rar = 'R';
  if (rar === 'SSR') { S.pity = 0; S.pity10 = 0; }
  if (rar === 'SR') S.pity10 = 0;
  const bn = BANNERS[S.gb || 0], feat = rar === 'SSR' && bn.feat.length && Math.random() < 0.5;
  const id = feat ? pick(bn.feat) : pick(rar === 'SSR' ? SSR_POOL : rar === 'SR' ? SR_POOL : R_POOL);
  if (S.owned[id]) { S.owned[id].shard += DUP_SHARDS[rar]; return { rar, id, dup: DUP_SHARDS[rar] }; }
  S.owned[id] = newRec();
  if (S.lineup.length < 5) S.lineup.push(id);
  return { rar, id, isNew: true };
}
function showGacha() {
  ui.innerHTML = `<div class="screen panel-screen gacha">${topBar('Chiêu Mộ Thần Tướng')}
    <div class="chap-tabs">${BANNERS.map((b, i) => `<button class="btn small ${i === (S.gb || 0) ? 'gold' : ''}" data-gb="${i}">${b.name}</button>`).join('')}</div>
    <div class="banner-art">
      ${(() => { const bn = BANNERS[S.gb || 0], f = bn.feat.length ? bn.feat : ['nata', 'datky', 'ngumavuong']; return `<img class="ba-main" src="${fullImg(f[0], 220)}"><img class="ba-l" src="${fullImg(f[1], 150)}"><img class="ba-r" src="${fullImg(f[2], 150)}"><div class="ba-text"><span>${bn.name}</span><small>${bn.desc} · bảo hiểm 80 lượt</small></div>`; })()}
    </div>
    <div class="pity">
      <div>Đã quay <b>${S.pity}</b>/${GACHA.hard} lượt kể từ SSR gần nhất${S.pity >= GACHA.softFrom ? ' · <em>tỉ lệ đang tăng</em>' : ''}</div>
      <div class="bar"><i style="width:${S.pity / GACHA.hard * 100}%"></i></div>
      ${pullBoxHTML()}
      <small>Từ lượt ${GACHA.softFrom} mỗi lượt +5% tỉ lệ SSR. Mỗi 10 lượt chắc chắn có SR trở lên. Ra tướng đã có thì đổi thành mảnh tướng.</small>
    </div>
    <div class="pool">${[...SSR_POOL, ...SR_POOL, ...R_POOL].map(id => `<div class="pool-i ${S.owned[id] ? 'own' : ''}"><img src="${por(id, 60)}">${rarTag(HEROES[id].rar)}</div>`).join('')}</div>
    <div class="gacha-btns">
      <button class="btn" id="g1">Quay 1<small>${icon('ngoc')}${GACHA.cost1}</small></button>
      <button class="btn gold" id="g10">Quay 10<small>${icon('ngoc')}${fmt(GACHA.cost10)}</small></button>
    </div>
    <button class="link" id="gFree">Nhận 1.500 Ngọc thử nghiệm</button>
  </div>`;
  $('#bBack').onclick = showHome;
  ui.querySelectorAll('[data-gb]').forEach(b => b.onclick = () => { S.gb = +b.dataset.gb; save(); showGacha(); });
  $('#g1').onclick = () => doPull(1);
  $('#g10').onclick = () => doPull(10);
  $('#gFree').onclick = () => { S.ngoc += 1500; save(); showGacha(); };
  ui.querySelectorAll('[data-pb]').forEach(b => b.onclick = () => { S.pullBox = S.pullBox || []; const k = +b.dataset.pb; if (S.pullBox.includes(k)) return; S.pullBox.push(k); giveRew(PULL_BOX[k][1]); toast('Đã nhận quà ' + PULL_BOX[k][0] + ' lượt'); showGacha(); });
}
function doPull(n) {
  const cost = n === 10 ? GACHA.cost10 : GACHA.cost1 * n;
  if (S.ngoc < cost) { toast('Không đủ Ngọc'); return; }
  S.ngoc -= cost; qAdd('pull', n);
  const res = [];
  for (let i = 0; i < n; i++) res.push(pullOne());
  save();
  const best = res.some(r => r.rar === 'SSR') ? 'SSR' : res.some(r => r.rar === 'SR') ? 'SR' : 'R';
  const wrap = document.createElement('div');
  wrap.className = 'modal pull-modal best-' + best;
  wrap.innerHTML = `<div class="pull-glow"></div><div class="pull-grid n${n}">${res.map((r, i) => `
    <div class="pcard r-${r.rar}" style="animation-delay:${0.25 + i * 0.12}s">
      <div class="pc-inner">
        ${r.id ? `<img src="${por(r.id, 90)}"><b>${esc(HEROES[r.id].name)}</b>` : `<i class="ic ic-univ big"></i><b>Mảnh vạn năng ×2</b>`}
        ${rarTag(r.rar)}
        ${r.isNew ? '<em class="new">MỚI</em>' : r.dup ? `<em>+${r.dup} mảnh</em>` : ''}
      </div></div>`).join('')}</div>
    <button class="btn gold" id="pullOk" style="animation-delay:${0.4 + n * 0.12}s">Xác nhận</button>`;
  ui.appendChild(wrap);
  $('#pullOk').onclick = () => { wrap.remove(); showGacha(); };
}

// ---------------- HUD

// ---- Bảng hiệu ứng đang có trong trận
const MOD_LABEL = { atkPct: ['Công', 1], crit: ['Bạo kích', 1], critDmg: ['ST bạo kích', 1], skillPct: ['ST chiêu thức', 1], kc: ['Giảm sát thương nhận', 1], mpRegen: ['Hồi nội công', 1], hpPct: ['Máu tối đa', 1], aspdPct: ['Tốc đánh', 1], ammo: ['Số đòn trước khi điều khí', 0], freeShot: ['Đòn không tốn lượt', 1], dkSpd: ['Tốc điều khí', 1], healPct: ['Hiệu quả hồi máu', 1] };
const MECH_TXT = { traps: 'Bẫy trận đồ: mặt đất có bẫy gây sát thương theo thời gian.', summon: 'Triệu hồi: quái gọi thêm đồng bọn.', multiphase: 'Vạn Tiên Trận: boss đổi giai đoạn sẽ bất tử 2 giây và giáng sấm.', speed: 'Đại náo Thiên Cung: quái nhanh hơn 35%.', fire: 'Hoả Diệm Sơn: lửa thiêu trên sân.', fog: 'Thuỷ tộc: nước đục che tầm nhìn phía xa.' };
function showBuffs() {
  if (!B || B.over) return; const wasPaused = B.paused; B.paused = true;
  const ids = [...B.heroes, ...B.deploy].filter(h => !h.clone).map(h => h.id), info = teamInfo(ids), cap = B.cap, cs = cap ? capSkill(cap.id) : null;
  const pct = v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  const sec = (t, body) => body ? `<section><h4>${t}</h4>${body}</section>` : '';
  const row = (b, d, cls) => `<div class="bf ${cls || ''}"><b>${b}</b><span>${d}</span></div>`;
  const capH = cap ? row('👑 ' + esc(cap.name) + ' · ' + esc(cs.n), esc(cs.d) + ' (cả đội)') + row('Riêng đội trưởng', '+20% tốc đánh · +10% sát thương chiêu và tuyệt kỹ · chạm quái để nhắm mục tiêu') : '';
  const facH = info.facs.filter(f => f.pct).map(f => row(FACTIONS[f.f] + ' × ' + f.n, pct(f.pct) + ' máu và công')).join('');
  const bondH = info.bonds.map(b => row(esc(b.name), esc(b.desc))).join('');
  const cpH = B.slots.map(sl => { const c = cpOf(sl.id); return c ? row(esc(c.name) + (sl.lv > 1 ? ' · Cấp ' + sl.lv : '') + (sl.e2 ? ' · Tiến bậc 2' : ''), esc((c.desc || '').replace(/ ?\[VLĐMT\]/g, ''))) : ''; }).join('');
  const modH = Object.keys(MOD_LABEL).filter(k => B.mods[k]).map(k => row(MOD_LABEL[k][0], MOD_LABEL[k][1] ? pct(B.mods[k]) : '+' + B.mods[k], 'num')).join('');
  const tierH = [...B.heroes, ...B.deploy].filter(h => !h.clone && trongOf(h) > 1).map(h => row(esc(h.name) + ' · ' + (trongOf(h) >= 5 ? 'Đại thành' : 'Tầng ' + trongOf(h)), (h.d.tang || []).slice(0, trongOf(h) - 1).map(t => esc(t.d)).join(' · '))).join('');
  const tr = new Set(); for (const w of B.st.waves || []) for (const [t] of w.list || []) if (ENEMIES[t] && ENEMIES[t].trait) tr.add(ENEMIES[t].trait);
  const stH = (B.mech && MECH_TXT[B.mech] ? row('Cơ chế ải', MECH_TXT[B.mech]) : '') + [...tr].map(k => row(TRAIT_INFO[k].ico + ' ' + TRAIT_INFO[k].name, esc(TRAIT_INFO[k].desc))).join('');
  const wrap = document.createElement('div'); wrap.className = 'modal buff-modal';
  wrap.innerHTML = `<div class="buff-box"><div class="cp-title"><span>Hiệu ứng đang có</span><small>Trận đang tạm dừng</small></div><div class="buff-body">
    ${sec('Đội trưởng', capH)}${sec('Cộng hưởng phe', facH)}${sec('Duyên phận', bondH)}${sec('Công pháp đã học', cpH || '<small>Chưa học công pháp nào. Nhặt Thiên Thư hoặc lên cấp để chọn.</small>')}
    ${sec('Tổng chỉ số cộng thêm', modH)}${sec('Tầng tướng', tierH)}${sec('Ải này', stH)}</div>
    <div class="res-btns"><button class="btn gold" id="bfClose">Tiếp tục</button></div></div>`;
  ui.appendChild(wrap);
  const close = () => { wrap.remove(); if (B) B.paused = wasPaused; };
  $('#bfClose').onclick = close; wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
}
function showHUD() {
  ui.innerHTML = `<div class="hud">
    <div id="pad"></div>
    <div class="hud-top hud2">
      <button class="hud-round" id="bPause" title="Tạm dừng (P)">❚❚</button>
      <div class="h2-stage"><div class="h2-name"><b>${B.st.id}</b> ${esc(B.st.name)} <span class="ht-wave" id="hWave"></span></div>
        <div class="h2-waves" id="hWaves">${B.st.waves.map(w => `<i class="${w.boss ? 'boss' : ''}"></i>`).join('')}</div></div>
      <div class="h2-prog" id="hProg"><div class="h2-ptrack"><i id="hPfill"></i>${(() => { const n = B.st.waves.length; return B.st.waves.map((w, k) => (w.boss || w.strong || w.horde) ? `<span data-w="${k}" class="pm ${w.boss ? 'boss' : w.horde ? 'horde' : 'strong'}" style="left:${(k + 0.5) / n * 100}%">${w.boss ? '☠' : w.horde ? '👹' : '⚔'}</span>` : '').join(''); })()}<b class="h2-pcur" id="hPcur"></b></div><em id="hPnext"></em></div>
      <div class="h2-mini"><span class="ht-time" id="hTime">0:00</span><span class="h2-lv"><b id="hLv">Cấp 1</b><span class="bar"><i id="hXp"></i></span></span></div>
      <button class="ic-btn" id="bBuff" title="Hiệu ứng đang có"><svg viewBox="0 0 24 24"><path d="M12 2l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 15.6 6.6 18.5l1.2-6L3.3 8.3l6.1-.7z" fill="currentColor"/></svg><small>Hiệu ứng</small></button>
      <button class="ic-btn" id="bAuto" title="Tự động"><svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 0 1 7.4 5H17l3.5 4 3.5-4h-2.1A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm0 16a8 8 0 0 1-7.4-5H7l-3.5-4L0 15h2.1A10 10 0 0 0 22 12h-2a8 8 0 0 1-8 8z" fill="currentColor"/></svg><small>Tự động</small></button>
      <button class="ic-btn sp" id="bSpeed" title="Tốc độ">x1</button>
      <button class="ic-btn" id="bMute" title="Âm thanh">${S.mute ? `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>` : `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`}</button>
    </div>
    <div class="cp-owned" id="cpOwned"></div>
    <div class="hint-tap2" id="hintTap"><span class="hand">👆</span><span>Chạm quái để đội trưởng nhắm · Chạm thẻ tướng để tung <b>tuyệt kỹ</b></span></div>
    <div class="team" id="teamBar"></div>
  </div>`;
  const pad = $('#pad');
  pad.addEventListener('pointerdown', e => { const l = logical(e); tapTarget({ x: GATE_X + (l.x - GATE_X) / VIEW_Z, y: H * VIEW_PY + (l.y - H * VIEW_PY) / VIEW_Z }); const h = $('#hintTap'); if (h) h.remove(); });
  $('#bPause').onclick = openPause;
  $('#bBuff').onclick = showBuffs;
  $('#bMute').onclick = () => { S.mute = !S.mute; save(); setTimeout(bgmApply, 0); $('#bMute').innerHTML = S.mute ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'; audioOn(); };
  setTimeout(() => { const h = $('#hintTap'); if (h) h.classList.add('gone'); }, 6000);
  $('#bAuto').onclick = () => { B.auto = !B.auto; $('#bAuto').classList.toggle('on', B.auto); };
  $('#bSpeed').onclick = () => { B.speed = B.speed === 1 ? 2 : (B.speed === 2 && S.cleared[B.st.id] ? 3 : 1);   // x3 chỉ cho ải đã qua
 $('#bSpeed').textContent = 'x' + B.speed; $('#bSpeed').classList.toggle('on', B.speed > 1); };
  buildTeamBar();
  renderCpList();
}
let hudCap = null;
function buildTeamBar() {
  const bar = $('#teamBar');
  if (!bar || !B) return;
  const deployed = B.heroes.filter(h => !h.clone);
  const list = [...deployed, ...B.deploy];
  bar.innerHTML = list.map((u, i) => `<button class="tm r-${(HEROES[u.id] && HEROES[u.id].rar) || 'R'}" data-tm="${i}" title="${esc(u.d.ult.name)} (phím ${i + 1})">
      <span class="tm-ring"></span><span class="tm-fire"></span><img src="${porB(u.id, 64)}"><span class="tm-key">${i + 1}</span><span class="tm-trong"></span><span class="tm-ammo"></span><span class="tm-hp"><i></i></span><span class="tm-mp"><i></i></span>
      <span class="tm-state"></span><span class="tm-ult">${esc(u.d.ult.name)}</span></button>`).join('');
  B.teamList = list;
  bar.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); heroUlt(+b.dataset.tm); });
  hudCap = null;
}
function renderCpList() {
  const el = $('#cpOwned');
  if (!el) return;
  el.innerHTML = B.slots.map(sl => slotIcon(sl).replace('pf-c', 'cpo')).join('');
}
function updateHUD() {
  if (!B || !$('#hWave')) return;
  $('#hWave').textContent = `Đợt ${Math.min(B.wave + 1, B.st.waves.length)}/${B.st.waves.length}`;
  document.querySelectorAll('#hWaves i').forEach((el, i) => { el.className = (B.st.waves[i] && B.st.waves[i].boss ? 'boss ' : '') + (i < B.wave ? 'done' : i === B.wave ? 'cur' : ''); });
  { const n = B.st.waves.length, w = Math.max(0, B.wave), gap = (B.waveDef && B.waveDef.gap) || 4, fr = B.wave < 0 ? 0 : Math.min(1, (B.time - (B.waveStart || 0)) / gap);
    document.querySelectorAll('#hProg .pm').forEach(el => el.classList.toggle('done', +el.dataset.w < B.wave));
    const pr = Math.min(1, (w + (B.wave >= n - 1 ? 1 : fr)) / n), pf = $('#hPfill'), pc = $('#hPcur'); if (pf) pf.style.width = pr * 100 + '%'; if (pc) pc.style.left = pr * 100 + '%';
    const nx = B.st.waves.findIndex((x, k) => k > B.wave && (x.boss || x.strong || x.horde)), np = $('#hPnext');
    if (np) { if (nx < 0) np.textContent = B.st.waves[n - 1] && B.st.waves[n - 1].boss && B.wave >= n - 1 ? 'BOSS!' : 'Đợt cuối'; else { const x = B.st.waves[nx], d = nx - B.wave; np.textContent = (x.boss ? '☠ Boss' : x.horde ? '👹 Quái đông' : '⚔ Địch mạnh') + (d <= 1 ? ' sắp tới!' : ` sau ${d} đợt`); np.className = d <= 1 ? 'warn' : ''; } } }
  const t = Math.floor(B.time);
  $('#hTime').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  $('#hTime').classList.toggle('over', B.time > B.st.par);
  $('#hLv').textContent = 'Cấp ' + B.lv; $('#hXp').style.width = (B.xp / xpNeed() * 100) + '%';
  const ht = $('#hintTap'); if (ht && B.time > 8) ht.remove();
  const els = document.querySelectorAll('#teamBar .tm');
  (B.teamList || []).forEach((u, i) => {
    const el = els[i]; if (!el) return;
    const waiting = !B.heroes.includes(u);
    el.classList.toggle('wait', waiting);
    el.classList.toggle('dead', u.dead);
    el.classList.toggle('cap', u === B.cap);
    el.querySelector('.tm-hp i').style.width = (waiting ? 100 : u.hp / maxHp(u) * 100) + '%';
    el.querySelector('.tm-mp i').style.width = u.mp + '%'; el.style.setProperty('--mp', waiting ? 0 : u.mp);
    el.querySelector('.tm-state').textContent = u.dead ? 'Ngã' : waiting ? 'Chờ' : u.sealT > B.time ? '🔒 Phong ấn' : u.dk > 0 ? 'Điều khí' : '';
    el.classList.toggle('ready', !waiting && canCast(u, 'ult'));
    el.querySelector('.tm-ammo').textContent = waiting || u.dead || u.dk > 0 ? '' : (u.ammo == null ? ammoMax(u) : u.ammo);
    el.querySelector('.tm-trong').textContent = trongOf(u) >= 5 ? '★' : trongOf(u); el.classList.toggle('dthanh', trongOf(u) >= 5);
  });
  updateComboBtn();
}
function setCd(sel, p, ready, mpOk) {
  const b = $(sel); if (!b) return;
  b.style.setProperty('--p', clamp(p, 0, 1));
  b.classList.toggle('ready', ready);
  b.classList.toggle('nomp', !mpOk);
}
function openPause() {
  if (!B || B.over || B.paused) return;
  B.paused = true;
  const wrap = document.createElement('div');
  wrap.className = 'modal pause-modal';
  wrap.innerHTML = `<h3>Tạm dừng</h3>
    <div class="cp-mini">${B.slots.length ? B.slots.map(sl => { const c = cpOf(sl.id); return `<div><b>${esc(sl.tier === 3 ? c.evo.name : c.name)}</b> <i>${SYS_NAME[c.sys]} · ${CP_RAR[sl.tier].name}${c.lp ? ' · ' + LUUPHAI[c.lp].name : ''}</i><small>${dsc(c.desc)}${sl.tier === 3 ? ' · ' + dsc(c.evo.desc) : ''}</small></div>`; }).join('') : '<small>Chưa có công pháp</small>'}</div>
    <button class="btn gold" id="pRes">Tiếp tục</button>
    <button class="btn" id="pGfx">Đồ hoạ: ${{ auto: 'Tự động', high: 'Cao', low: 'Thấp' }[S.gfx || 'auto']}</button>
    <button class="btn" id="pRetry">Đánh lại</button>
    <button class="btn red" id="pQuit">Rời trận</button>`;
  ui.appendChild(wrap);
  $('#pRes').onclick = () => { wrap.remove(); B.paused = false; lastT = performance.now(); };
  $('#pRetry').onclick = () => { const si = B.si; wrap.remove(); enterStage(si); };
  $('#pGfx').onclick = () => { S.gfx = { auto: 'high', high: 'low', low: 'auto' }[S.gfx || 'auto']; save(); $('#pGfx').textContent = 'Đồ hoạ: ' + { auto: 'Tự động', high: 'Cao', low: 'Thấp' }[S.gfx]; };
  $('#pQuit').onclick = () => { wrap.remove(); showStages(); B = null; };
}
function showResult() {
  const win = B.win;
  const wrap = document.createElement('div');
  wrap.className = 'modal result-modal ' + (win ? 'win' : 'lose');
  const t = Math.floor(B.time);
  const next = win && typeof B.si === 'number' && B.si < STAGES.length - 1;
  wrap.innerHTML = `<div class="res-title">${B.st.raid ? 'Kết Thúc' : win ? 'Chiến Thắng' : 'Thất Bại'}</div>
    ${win ? `<div class="res-stars">${[0, 1, 2].map(i => `<span class="${i < B.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">★</span>`).join('')}</div>
      <ul class="res-cond"><li class="on">Qua ải</li><li class="${B.deaths === 0 ? 'on' : ''}">Không tướng nào ngã</li><li class="${B.time <= B.st.par ? 'on' : ''}">Dưới ${B.st.par} giây (${t}s)</li></ul>`
      : `<p class="res-reason">${esc(B.reason)}</p><p class="hint">Gợi ý: nâng cấp tướng, đổi đội trưởng, hoặc nhặt Linh Phù sớm để gọi đủ đội.</p>`}
    ${(() => {   // bảng thống kê: sát thương / chịu đòn / hồi máu, MVP
      const ids = Object.keys(B.stat).filter(id => HEROES[id]); if (!ids.length) return `<div class="res-team">${B.ids.map(id => `<img src="${por(id, 56)}">`).join('')}</div>`;
      const mx = k => Math.max(1, ...ids.map(id => B.stat[id][k])), md = mx('d'), mt = mx('t'), mh = mx('h');
      const mvp = ids.reduce((a, b) => (B.stat[b].d + B.stat[b].h * 0.8 + B.stat[b].t * 0.3 > B.stat[a].d + B.stat[a].h * 0.8 + B.stat[a].t * 0.3 ? b : a));
      return `<div class="res-stat">${ids.sort((a, b) => B.stat[b].d - B.stat[a].d).map(id => { const r = B.stat[id];
        return `<div class="rs-row ${id === mvp ? 'mvp' : ''}"><img src="${por(id, 40)}"><b>${esc(HEROES[id].name)}${id === mvp ? ' <em>MVP</em>' : ''}</b>
          <span class="rs-b d"><i style="width:${r.d / md * 100}%"></i><small>${fmt(r.d)}</small></span>
          <span class="rs-b t"><i style="width:${r.t / mt * 100}%"></i><small>${fmt(r.t)}</small></span>
          <span class="rs-b h"><i style="width:${r.h / mh * 100}%"></i><small>${fmt(r.h)}</small></span></div>`; }).join('')}
        <div class="rs-leg"><span class="d">Sát thương</span><span class="t">Chịu đòn</span><span class="h">Hồi máu</span></div></div>`;
    })()}
    ${B.raidScore != null ? `<p class="res-reason">Sát thương lên boss: <b>${fmt(B.raidScore)}</b></p>` : ''}
    <div class="res-rew">${B.reward.ngoc ? `<span>${icon('ngoc')}+${fmt(B.reward.ngoc)}</span>` : ''}<span>${icon('vang')}+${fmt(B.reward.vang)}</span><span>Hạ ${B.kills} quái</span>${B.reward.univ ? `<span>${icon('univ')}+${B.reward.univ}</span>` : ''}${B.reward.items && B.reward.items.length > 1 ? `<span>+${B.reward.items.length} trang bị</span>` : ''}${B.reward.item ? `<span style="color:${EQ_RAR[B.reward.item.r].c}">+ ${esc(B.reward.item.n)}</span>` : ''}</div>
    ${B.chRew ? `<div class="res-hero"><img src="${fullImg(B.chRew.id, 160)}" alt=""><div><small>Thưởng qua chương</small><b>${esc(HEROES[B.chRew.id].name)}</b> ${rarTag(HEROES[B.chRew.id].rar)}${B.chRew.dup ? '<em>Đã có → +mảnh</em>' : '<em>Gia nhập đội!</em>'}</div></div>` : ''}
    <div class="res-btns">
      <button class="btn" id="rHome">Về sảnh</button>
      <button class="btn red" id="rRetry">Đánh lại</button>
      ${next ? '<button class="btn gold" id="rNext">Ải tiếp</button>' : ''}
    </div>`;
  ui.appendChild(wrap);
  const si = B.si;
  $('#rHome').onclick = () => { const nan = B.st.nan, pb = B.st.pb; B = null; nan ? showNan() : pb ? showPB(pb) : showHome(); };
  $('#rRetry').onclick = () => { if (B && B.st.nan) { const nan = true; B = null; showNan(); return; } enterStage(si); };
  if (B.st.nan) { $('#rRetry').textContent = B.win ? 'Nạn tiếp' : 'Hành trình mới'; if (!B.win) wrap.querySelector('.res-title').insertAdjacentHTML('afterend', `<p class="res-reason">Hành trình kết thúc ở nạn ${B.st.nanN}. Đã vượt ${B.nanEnd || 0} nạn.</p>`); }
  if (next) $('#rNext').onclick = () => enterStage(si + 1);
}

// ------------------------------------------------------------------ NGOÀI TRẬN (GDD §7, §9; Bí Tịch theo VLĐMT)
// Tiên Khí (thể lực): tối đa 120, hồi 1 điểm / 6 phút; ải thường 6, tinh anh 8, boss 10 (GDD 7.2).
const TK_MAX = 120, TK_SEC = 360, TK_COST = { normal: 6, elite: 8, boss: 10 };
function nowS() { return Date.now() / 1000; }
function tkNow() {
  const t = nowS(); let r = S.tk; if (!r) r = S.tk = { v: TK_MAX, t };
  if (r.v >= TK_MAX) { r.t = t; return r.v; }
  const gain = Math.floor((t - r.t) / TK_SEC);
  if (gain > 0) { r.v = Math.min(TK_MAX, r.v + gain); r.t = r.v >= TK_MAX ? t : r.t + gain * TK_SEC; }
  return r.v;
}
const tkCost = st => TK_COST[st.kind || 'normal'];
function tkSpend(n) {
  if (tkNow() < n) { toast('Không đủ Tiên Khí (' + tkNow() + '/' + n + ')'); return false; }
  if (S.tk.v >= TK_MAX) S.tk.t = nowS();
  S.tk.v -= n; save(); return true;
}

// ---- CỐT TRUYỆN đầu mỗi chương (hiện một lần khi vào ải đầu chương)
const CH_STORY = {
  1: [['narr', 'Cuối đời nhà Thương, Trụ Vương say mê Đát Kỷ. Hồ yêu ngàn năm nhập vào nàng, hại trung thần, dựng Lộc Đài.'], ['khuongtanha', 'Thiên mệnh đã đổi. Ta phụng lệnh sư tôn xuống núi, lập Phong Thần Bảng, diệt yêu trừ ma.'], ['datkyboss', 'Một lão già câu cá cũng đòi phá giấc mộng của bổn cung sao? Hồ Tinh, ra tay!']],
  2: [['narr', 'Tây Kỳ dựng cờ khởi binh. Văn Trọng, Thái Sư ba đời nhà Thương, kéo đại quân tới chặn đường.'], ['vantrong', 'Ba con mắt của lão phu đã thấy hết. Kẻ phản nghịch phải đền tội!'], ['nata', 'Lão già, để xem Hoả Tiêm Thương của ta nhanh hơn hay mắt ông nhanh hơn!']],
  3: [['narr', 'Mười vị đạo sĩ Triệt Giáo bày Thập Tuyệt Trận, mỗi trận một cạm bẫy chết người.'], ['congminhboss', 'Định Hải Châu của ta có thể làm biển lặng, thì cũng làm các ngươi tan xương.'], ['khuongtanha', 'Cẩn thận bẫy trận dưới chân. Phá từng trận một!']],
  4: [['narr', 'Huynh trưởng Triệu Công Minh tử trận. Tam Tiêu nương nương ở Kim Ngao Đảo thề báo thù.'], ['vantieuboss', 'Cửu Khúc Hoàng Hà Trận, thần tiên vào cũng mất hết đạo hạnh!'], ['duongtien', 'Trận pháp nào cũng có chỗ hở. Thiên Nhãn của ta sẽ tìm ra.']],
  5: [['narr', 'Thông Thiên Giáo Chủ đích thân bày Vạn Tiên Trận, bốn thanh Tru Tiên Kiếm treo giữa trời.'], ['thongthien', 'Vạn tiên quy về một trận. Hôm nay Xiển Giáo sẽ không còn ai!'], ['thailaoquan', 'Đạo vốn không tranh. Nhưng ngươi đã cố chấp, lão phu đành ra tay.']],
  6: [['narr', 'Đại chiến kết thúc, hồn phách tử sĩ tụ về Phong Thần Đài. Oán khí nhập vào Phong Thần Bảng.'], ['honbang', 'Ta là oán hận của vạn hồn... không ai được phong thần!'], ['khuongtanha', 'Bảng này ta lập, ta phải tự tay trấn áp.']],
  7: [['narr', 'Năm trăm năm sau, con khỉ đá ở Hoa Quả Sơn tự xưng Tề Thiên Đại Thánh, đại náo Thiên Cung.'], ['ngokhong', 'Hoàng đế thay nhau làm, năm nay tới nhà ta! Thiên binh thiên tướng, xông lên hết đi!'], ['nhilangboss', 'Con khỉ ngông cuồng. Để Nhị Lang ta thu phục ngươi.']],
  8: [['narr', 'Ngộ Không bị Như Lai đè dưới Ngũ Hành Sơn. Đường Tăng phụng chỉ đi thỉnh kinh, đi ngang qua núi.'], ['duongtang', 'Thí chủ dưới núi, nếu chịu theo bần tăng sang Tây Thiên, bần tăng sẽ gỡ lá bùa.'], ['nguumaboss', 'Đại ca đi theo hoà thượng à? Vậy để Ngưu Ma ta xem huynh còn mấy phần bản lĩnh!']],
  9: [['narr', 'Hoả Diệm Sơn chắn đường, lửa cháy tám trăm dặm. Chỉ quạt Ba Tiêu mới dập được.'], ['honghainhi', 'Muốn qua núi? Nếm thử Tam Muội Chân Hoả của ta trước đã!'], ['thietphien', 'Các ngươi hại con ta, còn muốn mượn quạt? Đừng mơ!']],
  10: [['narr', 'Bạch Hổ Lĩnh âm khí nặng nề. Bạch Cốt Tinh ba lần hoá thân để lừa thầy trò Đường Tăng.'], ['bachcotboss', 'Thịt Đường Tăng ăn vào trường sinh bất lão... Hì hì, để ta biến thành thôn nữ.'], ['ngokhong', 'Yêu tinh, đổi bao nhiêu lốt cũng không qua được Hoả Nhãn Kim Tinh!']],
  11: [['narr', 'Thuỷ tộc nổi dậy dưới đáy sông, nước đục mịt mù, yêu vương đá vàng trấn giữ long cung.'], ['longnu', 'Long cung bị chiếm rồi. Xin các vị giúp ta đoạt lại!'], ['kimthach', 'Kim thân bất hoại của ta, thần binh cũng chém không đứt!']],
  12: [['narr', 'Linh Sơn đã ở trước mắt. Nhưng ma khí phá pháp đã len vào cõi Phật.'], ['phatphapboss', 'Kinh thư sẽ hoá tro. Đường tới Tây Thiên kết thúc ở đây!'], ['quanam', 'Tám mươi mốt nạn chỉ còn nạn cuối. Đồng lòng vượt qua, chân kinh sẽ về tay các con.']],
};
function storyPortrait(who) { return HEROES[who] ? fullImg(who, 260) : ENEMIES[who] ? 'art/enemies/' + who + '/master.webp' : ''; }
function storyName(who) { return HEROES[who] ? HEROES[who].name : ENEMIES[who] ? ENEMIES[who].name : ''; }
function showStory(chId, done) {
  const L = CH_STORY[chId]; if (!L) { done(); return; } let i = 0; const c = CHAPTERS.find(x => x.id === chId);
  const wrap = document.createElement('div'); wrap.className = 'story-ov';
  const draw = () => { const [who, text] = L[i], narr = who === 'narr', side = HEROES[who] ? 'L' : 'R';
    wrap.innerHTML = `<div class="story-head"><small>Chương ${chId}</small><b>${esc(c ? c.name : '')}</b></div>
      ${narr ? '' : `<img class="story-por ${side}" src="${storyPortrait(who)}" alt="">`}
      <div class="story-box ${narr ? 'narr' : side}">${narr ? '' : `<div class="story-name">${esc(storyName(who))}</div>`}<p>${esc(text)}</p><span class="story-next">${i < L.length - 1 ? 'Chạm để tiếp ▸' : 'Chạm để vào trận ▸'}</span></div>
      <button class="story-skip" id="stSkip">Bỏ qua</button>`;
    wrap.querySelector('#stSkip').onclick = e => { e.stopPropagation(); finish(); }; };
  const finish = () => { wrap.remove(); S.story = S.story || {}; S.story[chId] = 1; save(); done(); };
  wrap.onclick = () => { i++; if (i >= L.length) finish(); else draw(); };
  draw(); ui.appendChild(wrap);
}
function enterStage(si) {
  if (typeof si === 'object') { if (si.pb) { if (pbLeft(si.pb) <= 0) { toast('Hết lượt hôm nay'); return; } pbDay().n[si.pb] = (pbDay().n[si.pb] || 0) + 1; save(); startBattle(si); return; } if (si.raid) { if (!raidUse()) return; } else if (si.tower && si.floor !== (S.tower || 0) + 1) { showTower(); return; } startBattle(si); return; }
  const st = STAGES[si], ch = CHAPTERS[st.chap];
  const go = () => { if (tkSpend(tkCost(st))) startBattle(si); };
  if (ch && !(S.story || {})[ch.id] && st === STAGES.find(x => x.chap === st.chap)) showStory(ch.id, go); else go();
}

// ---- Nhiệm vụ ngày
const DAILY = [
  { id: 'fight', name: 'Chiến đấu 3 ải', need: 3, rew: { ngoc: 60 } },
  { id: 'win', name: 'Thắng 1 ải', need: 1, rew: { vang: 1500 } },
  { id: 'kill', name: 'Hạ 100 quái', need: 100, rew: { ngoc: 60 } },
  { id: 'pull', name: 'Chiêu mộ 1 lần', need: 1, rew: { tk: 30 } },
  { id: 'lv', name: 'Nâng cấp tướng 1 lần', need: 1, rew: { vang: 1000 } },
  { id: 'sweep', name: 'Quét nhanh 2 lần', need: 2, rew: { univ: 2 } },
  { id: 'bt', name: 'Tìm Kinh 1 lần', need: 1, rew: { vang: 800 } },
];
function dayKey() { return new Date().toLocaleDateString('sv'); }
function dq() { const k = dayKey(); if (!S.daily || S.daily.d !== k) S.daily = { d: k, p: {}, c: {} }; return S.daily; }
function qAdd(id, n) { const d = dq(); d.p[id] = Math.min(999, (d.p[id] || 0) + (n == null ? 1 : n)); save(); }
function grant(r) { if (r.ngoc) S.ngoc += r.ngoc; if (r.vang) S.vang += r.vang; if (r.univ) S.univ += r.univ; if (r.tk) { tkNow(); S.tk.v = Math.min(TK_MAX + 60, S.tk.v + r.tk); } }
const rewTxt = r => [r.ngoc && `${icon('ngoc')}${fmt(r.ngoc)}`, r.vang && `${icon('vang')}${fmt(r.vang)}`, r.univ && `${icon('univ')}${r.univ}`, r.tk && `⚡${r.tk}`].filter(Boolean).join(' ');
function showQuests() {
  const d = dq();
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Nhiệm Vụ Ngày')}<div class="meta-list">${DAILY.map(q => {
    const p = Math.min(q.need, d.p[q.id] || 0), done = p >= q.need, got = d.c[q.id];
    return `<div class="meta-row"><div><b>${q.name}</b><small>${p}/${q.need}</small><div class="bar"><i style="width:${p / q.need * 100}%"></i></div></div>
      <span class="rew">${rewTxt(q.rew)}</span><button class="btn small ${done && !got ? 'gold' : ''}" data-q="${q.id}" ${done && !got ? '' : 'disabled'}>${got ? 'Đã nhận' : done ? 'Nhận' : 'Chưa xong'}</button></div>`;
  }).join('')}</div><div class="hint">Nhiệm vụ làm mới mỗi ngày.</div></div>`;
  $('#bBack').onclick = showHome;
  ui.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = DAILY.find(x => x.id === b.dataset.q); d.c[q.id] = 1; grant(q.rew); save(); showQuests(); });
}

// ---- Treo máy: thu vàng khi không chơi, tối đa 12 giờ
function idleRate() { const n = STAGES.filter(st => S.cleared[st.id]).length; return { vang: 30 + 6 * n, ngoc: 1 + Math.floor(n / 5) }; }   // mỗi phút / mỗi giờ
function idleMins() { if (!S.idle) S.idle = nowS(); return Math.min(720, Math.floor((nowS() - S.idle) / 60)); }
function idleReward() { const m = idleMins(), r = idleRate(); return { vang: m * r.vang, ngoc: Math.floor(m / 60) * r.ngoc, m }; }
function claimIdle() { const r = idleReward(); if (r.m < 1) { toast('Chưa có gì để nhận'); return; } grant(r); S.idle = nowS(); save(); toast('Treo máy: +' + fmt(r.vang) + ' vàng' + (r.ngoc ? ' +' + r.ngoc + ' ngọc' : '')); showHome(); }

// ---- Quét nhanh (ải 3 sao)
function doSweep(si, n) {
  const st = STAGES[si]; if (!tkSpend(tkCost(st) * n)) return;
  const r = { ngoc: Math.round(st.reward.ngoc * 0.2) * n, vang: Math.round(st.reward.vang * 0.5) * n, univ: (st.kind === 'boss' ? 3 : st.kind === 'elite' ? 1 : 0) * n };
  grant(r); qAdd('sweep', n); qAdd('fight', n); save();
  toast('Quét ×' + n + ': ' + rewTxt(r).replace(/<[^>]+>/g, '')); showStages();
}

// ---- Tàng Kinh Các: Bí Tịch (mỗi công pháp bậc 2 là 1 thẻ sưu tầm, VLĐMT). Sao thẻ cộng chỉ số tướng cùng hệ; đủ 5 thẻ của 1 hệ → Hợp Nhất.
const BT_COST = 350, BT_MAXSTAR = 10;
const btCards = () => CONGPHAP.filter(c => c.tier === 2);
const btStars = id => (S.bt && S.bt[id]) || 0;
function btBonus(sys) {
  const cs = btCards().filter(c => c.sys === sys); let tot = 0, all = true;
  for (const c of cs) { const s = btStars(c.id); tot += s; if (!s) all = false; }
  let hp = 1 + 0.015 * tot, atk = 1 + 0.015 * tot, def = 1 + 0.015 * tot;
  if (all) { if (tot >= 5) { hp += 0.03; def += 0.03; } if (tot >= 15) { hp += 0.05; def += 0.05; } if (tot >= 25) { atk += 0.10; } }   // Hợp Nhất (mốc tổng sao 5/15/25)
  return { hp, atk, def, tot, all };
}
function btPull(n) {
  const cards = btCards(), got = [];
  for (let i = 0; i < n; i++) { const c = pick(cards); S.bt = S.bt || {}; if (btStars(c.id) < BT_MAXSTAR) S.bt[c.id] = btStars(c.id) + 1; else S.univ += 1; got.push(c); }
  return got;
}
function showTangKinh() {
  const SYS = Object.keys(SYS_NAME);
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Tàng Kinh Các · Bí Tịch')}
    <div class="meta-top"><span>Tìm Kinh: ${icon('vang')}${BT_COST}/lần</span>
      <button class="btn" id="btP1">Tìm ×1</button><button class="btn gold" id="btP10">Tìm ×10 <small>${icon('vang')}${fmt(BT_COST * 10)}</small></button></div>
    <div class="meta-list">${SYS.map(sy => {
      const b = btBonus(sy), cs = btCards().filter(c => c.sys === sy);
      return `<div class="bt-sys"><h4>Hệ ${SYS_NAME[sy]} <small>Tổng ${b.tot}★ · tướng hệ này +${Math.round((b.atk - 1) * 100)}% công, +${Math.round((b.hp - 1) * 100)}% máu${b.all ? ' · <em>Hợp Nhất</em>' : ' · cần đủ 5 thẻ'}</small></h4>
        <div class="bt-cards">${cs.map(c => `<div class="bt-card ${btStars(c.id) ? 'own' : ''}" title="${esc(c.desc.replace(/ ?\[VLĐMT\]/g, ''))}"><b>${esc(c.name)}</b>${c.lp ? `<span class="lp-tag" style="--c:${LUUPHAI[c.lp].color}">${LUUPHAI[c.lp].name}</span>` : ''}${starsHTML(Math.min(5, btStars(c.id)), 5)}<small>${btStars(c.id)}★</small></div>`).join('')}</div></div>`;
    }).join('')}</div><div class="hint">Mốc Hợp Nhất (đủ 5 thẻ): tổng 5★ → +3% máu/thủ; 15★ → +5% nữa; 25★ → +10% công.</div></div>`;
  $('#bBack').onclick = showHome;
  const pull = n => { if (S.vang < BT_COST * n) { toast('Không đủ vàng'); return; } S.vang -= BT_COST * n; const g = btPull(n); qAdd('bt', n); save(); toast('Nhận: ' + [...new Set(g.map(c => c.name))].slice(0, 3).join(', ') + (g.length > 3 ? '…' : '')); showTangKinh(); };
  $('#btP1').onclick = () => pull(1); $('#btP10').onclick = () => pull(10);
}

// ---- Banner Chiêu Mộ
const BANNERS = [
  { name: 'Thiên Thư Khai Quang', feat: [], desc: 'Toàn bộ tướng, SSR 2,5% · SR 15%' },
  { name: 'Tân Binh Hạ Giới', feat: ['duongtien', 'khuongtanha', 'thailaoquan'], desc: 'Tăng 50% tỉ lệ khi ra SSR: Dương Tiễn · Khương Tử Nha · Thái Thượng Lão Quân' },
];
(function weeklyBanner() {   // banner tuần: xoay vòng 1 SSR nổi bật mỗi tuần
  const pool = SSR_POOL.filter(id => HEROES[id]), w = parseInt(String(new Date().getTime() / 6048e5), 10), f = pool[w % pool.length];
  BANNERS.push({ name: 'Tướng Tuần · ' + HEROES[f].name, feat: [f, pool[(w + 1) % pool.length], pool[(w + 2) % pool.length]].filter((x, i, a) => a.indexOf(x) === i), desc: 'Tuần này: ' + HEROES[f].name + ' tỉ lệ cao (50% khi ra SSR)' });
})();


// ---- Chuyển dữ liệu giữa các máy: mã lưu (chưa có máy chủ — chép mã rồi dán ở máy kia)
function saveCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function grantAllHeroes() {   // (thử nghiệm) nhận toàn bộ Thần Tướng
  let n = 0; for (const id of Object.keys(HEROES)) if (!S.owned[id]) { S.owned[id] = newRec(); n++; }
  for (const id of ['ngokhong', 'duongtien', 'tieubachlong', 'quanam', 'nata']) if (S.lineup.length < 5 && !S.lineup.includes(id)) S.lineup.push(id);   // đội đủ 5 để thử ngay
  save(); if (window.Cloud && Cloud.user) Cloud.pushNow(S).catch(() => {});
  if (location.hash) history.replaceState(null, '', location.pathname); B = null; showHome(); toast('Đã nhận ' + n + ' Thần Tướng (tổng ' + Object.keys(S.owned).length + ')');
}
window.addEventListener('hashchange', () => { if (location.hash === '#full') grantAllHeroes(); });
function showSaveTransfer() {
  const w = document.createElement('div'); w.className = 'modal';
  w.innerHTML = `<div class="xfer"><h3>Chuyển dữ liệu</h3><p>Máy này: bấm <b>Sao chép mã</b>, gửi mã sang máy kia (Zalo, ghi chú…). Máy kia: dán mã rồi bấm <b>Nhập mã</b>.</p>
    <textarea id="xCode" spellcheck="false">${saveCode()}</textarea>
    <div class="res-btns"><button class="btn" id="xFull">Nhận full tướng (thử)</button><button class="btn gold" id="xCopy">Sao chép mã</button><button class="btn red" id="xLoad">Nhập mã</button><button class="btn" id="xClose">Đóng</button></div>
    <small>Lưu trực tuyến (tự đồng bộ) cần tài khoản máy chủ — sẽ bổ sung sau.</small></div>`;
  ui.appendChild(w);
  $('#xClose').onclick = () => w.remove();
  $('#xFull').onclick = () => { w.remove(); grantAllHeroes(); };
  $('#xCopy').onclick = () => { const t = $('#xCode'); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand('copy'); } toast('Đã sao chép mã'); };
  $('#xLoad').onclick = () => {
    try { const s = JSON.parse(decodeURIComponent(escape(atob($('#xCode').value.trim())))); if (!s || !s.owned) throw 0;
      if (!confirm('Thay toàn bộ dữ liệu máy này bằng mã vừa dán?')) return; S = Object.assign(defaultSave(), s); save(); w.remove(); toast('Đã nhập dữ liệu'); showHome();
    } catch (e) { toast('Mã không hợp lệ'); }
  };
}
// ---- Quà tân thủ: đăng nhập 7 ngày
const LOGIN7 = [{ ngoc: 300 }, { vang: 5000 }, { ngoc: 500 }, { univ: 10 }, { ngoc: 800 }, { vang: 15000 }, { ngoc: 1500, univ: 20 }];
function loginState() {
  const k = dayKey(); if (!S.login) S.login = { d: 0, last: null, got: [] };
  if (S.login.last !== k) { S.login.last = k; S.login.d = Math.min(7, S.login.d + 1); save(); }
  return S.login;
}
function showGift() {
  const L = loginState(), w = document.createElement('div'); w.className = 'modal';
  w.innerHTML = `<div class="xfer"><h3>Quà Tân Thủ · 7 ngày</h3><div class="g7">${LOGIN7.map((r, i) => {
      const ok = i < L.d, got = L.got.includes(i);
      return `<button class="g7d ${got ? 'got' : ok ? 'ok' : ''}" data-g="${i}" ${ok && !got ? '' : 'disabled'}><b>Ngày ${i + 1}</b><span>${rewTxt(r)}</span><i>${got ? 'Đã nhận' : ok ? 'Nhận' : 'Chưa tới'}</i></button>`; }).join('')}</div>
    <div class="res-btns"><button class="btn" id="gClose">Đóng</button></div></div>`;
  ui.appendChild(w); $('#gClose').onclick = () => { w.remove(); showHome(); };
  w.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const i = +b.dataset.g; L.got.push(i); grant(LOGIN7[i]); save(); w.remove(); showGift(); });
}
// ---- Nhạc nền tổng hợp (ngũ cung, nhẹ, lặp) — tắt cùng nút Âm thanh
let BGM = null, bgmCur = null, bgmWant = 'home', _bgmGest = false;
const BGM_SRC = { home: 'audio/bgm_home.mp3', battle: 'audio/bgm_battle.mp3', boss: 'audio/bgm_boss.mp3' }, BGM_VOL = 0.32;
function bgmFade(a, to, ms, done) { const from = a.volume, t0 = performance.now(); const tk = () => { const k = Math.min(1, (performance.now() - t0) / ms); try { a.volume = from + (to - from) * k; } catch (e) {} if (k < 1) requestAnimationFrame(tk); else if (done) done(); }; tk(); }
function bgmApply() {
  if (S && S.mute) { if (BGM) BGM.pause(); return; }
  if (!_bgmGest) return;
  if (bgmCur === bgmWant && BGM) { if (BGM.paused) BGM.play().catch(() => {}); return; }
  const old = BGM; BGM = new Audio(BGM_SRC[bgmWant]); BGM.loop = true; BGM.volume = 0; bgmCur = bgmWant;
  BGM.play().then(() => bgmFade(BGM, BGM_VOL, 1200)).catch(() => {});
  if (old) bgmFade(old, 0, 800, () => old.pause());
}
function bgmSet(k) { bgmWant = k; bgmApply(); }
function bgmStart() { _bgmGest = true; bgmApply(); }
document.addEventListener('pointerdown', () => setTimeout(bgmStart, 50));


// ---- Lưu trực tuyến (js/cloud.js): khi đăng nhập, so bản trên mạng với bản trên máy
const isFresh = s => !Object.keys(s.cleared || {}).length && !(s.pulls > 0) && Object.keys(s.owned || {}).length <= 3;
function initCloud() { if (window.Cloud && Cloud.ok) Cloud.onUser(async u => {
  if (!u) { if (!B && ui.querySelector('.home2')) showHome(); return; }
  try {
    const r = await Cloud.pull();
    if (r && r.save) {
      const remote = JSON.parse(r.save);
      if (JSON.stringify(remote) !== JSON.stringify(S)) {
        const useRemote = isFresh(S) || (remote.ts || 0) >= (S.ts || 0)
          ? (isFresh(S) || confirm('Có dữ liệu trên mạng (' + new Date(remote.ts || 0).toLocaleString('vi-VN') + '). Dùng bản trên mạng?\nBấm Huỷ để giữ bản trên máy này và ghi đè lên mạng.'))
          : !confirm('Bản trên máy này mới hơn bản trên mạng. Giữ bản trên máy và ghi đè lên mạng?\nBấm Huỷ để dùng bản trên mạng.');
        if (useRemote) { const keep = S.owned; S = Object.assign(defaultSave(), remote); for (const id in keep) if (!S.owned[id]) S.owned[id] = keep[id];   // giữ tướng có trên máy mà bản mạng chưa có
          try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} toast('Đã tải dữ liệu từ mạng'); }
        else await Cloud.pushNow(S);
      }
    } else await Cloud.pushNow(S);
  } catch (e) { toast('Lỗi đồng bộ: ' + (e.code || e.message)); console.warn(e); }
  if (!B && ui.querySelector('.home2')) showHome();
}); if (!B && ui.querySelector('.home2')) showHome(); }
function loadCloud() {   // tải Firebase sau khi game đã hiện (không chặn lúc mở game)
  const L = ['https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js', 'js/cloud.js'];
  const next = () => { const u = L.shift(); if (!u) { initCloud(); return; } const s = document.createElement('script'); s.src = u; s.onload = next; s.onerror = () => { window.Cloud = window.Cloud || { ok: false }; if (!B && ui.querySelector('.home2')) showHome(); }; document.head.appendChild(s); };
  next();
}

// ---- Trang bị (rơi từ ải; 3 ô mỗi tướng)
function rollEquip(st) {
  const sl = pick(Object.keys(EQ_SLOT)), q = Math.random(), boss = st.kind === 'boss';
  const r = q < (boss ? 0.15 : 0.04) ? 'SSR' : q < (boss ? 0.55 : 0.3) ? 'SR' : 'R';
  return { id: Date.now().toString(36) + Math.floor(Math.random() * 1e4), s: sl, r, n: EQ_NAMES[sl][r === 'SSR' ? 2 : r === 'SR' ? 1 : 0], v: EQ_RAR[r].v * (1 + st.chap * 0.15) };
}
function eqBonus(id) {
  const o = { atkPct: 0, hpPct: 0, crit: 0 }, e = (S.owned[id] || {}).eq || {};
  const pl = (S.owned[id] || {}).eqLv || {};
  for (const sl in e) { const it = (S.items || []).find(x => x.id === e[sl]); if (it) o[EQ_SLOT[sl].stat] += eqVal(it) * (1 + EQ_POS_PCT * (pl[sl] || 0)); }
  return o;
}
function eqVal(it) { return (EQ_SLOT[it.s].stat === 'crit' ? it.v * 0.5 : it.v) * (1 + EQ_STAR_PCT * (it.st || 0)); }
function eqTxt(it) { return `${esc(it.n)}${it.st ? ' ' + '★'.repeat(it.st) : ''} (${EQ_RAR[it.r].name}) +${(eqVal(it) * 100).toFixed(1).replace('.0', '')}% ${EQ_SLOT[it.s].label}`; }
function showEquip(hid) {
  const o = S.owned[hid]; o.eq = o.eq || {};
  const used = new Set(); for (const k in S.owned) for (const s2 in (S.owned[k].eq || {})) used.add(S.owned[k].eq[s2]);
  const w = document.createElement('div'); w.className = 'modal';
  w.innerHTML = `<div class="xfer"><h3>Trang bị · ${esc(HEROES[hid].name)}</h3>${Object.keys(EQ_SLOT).map(sl => {
      const cur = (S.items || []).find(x => x.id === o.eq[sl]);
      const cand = (S.items || []).filter(x => x.s === sl && !used.has(x.id)).sort((a, b) => b.v - a.v).slice(0, 6);
      const pl = (o.eqLv || {})[sl] || 0;
      return `<div class="eq-row"><b>${EQ_SLOT[sl].name} <em class="eq-pl">+${pl}</em>:</b> <span>${cur ? eqTxt(cur) + (pl ? ` <small>(ô +${pl * 5}%)</small>` : '') : '<i>Trống</i>'}</span>${cur ? `<button class="btn small" data-un="${sl}">Tháo</button>` : ''}
        <div class="eq-up"><button class="btn small gold" data-pl="${sl}" ${pl >= EQ_POS_MAX ? 'disabled' : ''}>Cường hoá ô +${pl + 1} ${icon('vang')}${fmt(eqPosCost(pl))}</button>${cur ? `<button class="btn small" data-st="${cur.id}" ${(cur.st || 0) >= EQ_STAR_MAX ? 'disabled' : ''}>Tăng sao ★${(cur.st || 0) + 1} ${icon('vang')}${fmt(eqStarCost(cur.st || 0))}</button>` : ''}</div>
        <div class="eq-cand">${cand.map(it => `<button class="btn small" data-eq="${it.id}" style="color:${EQ_RAR[it.r].c}">${eqTxt(it)}</button>`).join('') || '<small>Chưa có trang bị trống (đánh ải tinh anh / boss để rơi)</small>'}</div></div>`; }).join('')}
    <div class="res-btns"><button class="btn" id="eqC">Đóng</button></div></div>`;
  ui.appendChild(w);
  $('#eqC').onclick = () => { w.remove(); showHeroDetail(hid); };
  w.querySelectorAll('[data-un]').forEach(b => b.onclick = () => { delete o.eq[b.dataset.un]; save(); w.remove(); showEquip(hid); });
  w.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { const sl = b.dataset.pl; o.eqLv = o.eqLv || {}; const lv = o.eqLv[sl] || 0, c = eqPosCost(lv); if (S.vang < c) { toast('Không đủ vàng'); return; } S.vang -= c; o.eqLv[sl] = lv + 1; save(); w.remove(); showEquip(hid); });
  w.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const it = S.items.find(x => x.id === b.dataset.st), c = eqStarCost(it.st || 0); if (S.vang < c) { toast('Không đủ vàng'); return; } S.vang -= c; it.st = (it.st || 0) + 1; save(); w.remove(); showEquip(hid); });
  w.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const it = S.items.find(x => x.id === b.dataset.eq); o.eq[it.s] = it.id; save(); w.remove(); showEquip(hid); });
}
// ---- Truyện Ký (mở theo cấp tướng)
function loreText(h, i) {
  return [`${h.name}, hiệu ${h.title}, vốn là nhân vật trong ${h.src}. Khi Phong Thần Bảng vỡ, hồn ${h.name} tản mác giữa trần thế, chờ Chấp Bảng Sứ gọi về.`,
          `Trên đường hội quân, ${h.name} dùng ${h.small.name} giải vây cho dân lành. Người đời bắt đầu truyền tai danh hiệu ${h.passive.name}.`,
          `Trước trận quyết chiến, ${h.name} tung tuyệt học ${h.ult.name}, khiến yêu ma khiếp vía. Hồn tướng đã hợp nhất trở lại với Bảng.`][i];
}
function showLore(hid) {
  const h = HEROES[hid], o = S.owned[hid]; o.lore = o.lore || [];
  const w = document.createElement('div'); w.className = 'modal';
  w.innerHTML = `<div class="xfer"><h3>Truyện Ký · ${esc(h.name)}</h3>${LORE_LV.map((lv, i) => {
      const open = o.lv >= lv, got = o.lore.includes(i);
      return `<div class="eq-row"><b>Chương ${i + 1}</b> ${open ? `<p>${esc(loreText(h, i))}</p>` : `<i>Mở khi đạt cấp ${lv}</i>`}
        ${open ? `<button class="btn small ${got ? '' : 'gold'}" data-lo="${i}" ${got ? 'disabled' : ''}>${got ? 'Đã nhận' : `Nhận ${icon('ngoc')}${LORE_REW[i]}`}</button>` : ''}</div>`; }).join('')}
    <div class="res-btns"><button class="btn" id="loC">Đóng</button></div></div>`;
  ui.appendChild(w);
  $('#loC').onclick = () => { w.remove(); showHeroDetail(hid); };
  w.querySelectorAll('[data-lo]').forEach(b => b.onclick = () => { const i = +b.dataset.lo; o.lore.push(i); S.ngoc += LORE_REW[i]; save(); w.remove(); showLore(hid); });
}


// =====================================================================
// CHẾ ĐỘ PHỤ: Tháp Thập Tuyệt (100 tầng, chọn cặp lợi/hại) · Boss xâm lược hằng ngày · Bảng xếp hạng
// =====================================================================
const BOON = [   // lợi cho đội
  { t: 'Thần Tướng công +30%', m: { atkPct: 0.30 } }, { t: 'Tốc đánh +25%', m: { aspdPct: 0.25 } }, { t: 'Bạo kích +15%', m: { crit: 0.15 } },
  { t: 'ST chiêu thức +40%', m: { skillPct: 0.40 } }, { t: 'Nhận thêm 2 Thiên Thư đầu trận', book: 2 }, { t: 'ST cuối +20%', m: { dmgPct: 0.20 } }];
const BANE = [   // hại (quái mạnh lên)
  { t: 'Quái máu +40%', ehp: 1.4 }, { t: 'Quái công +40%', eatk: 1.4 }, { t: 'Quái chạy nhanh +30%', espd: 1.3 }, { t: 'Thần Tướng −25% máu', hhp: 0.75 },
  { t: 'Quái máu +25%, công +25%', ehp: 1.25, eatk: 1.25 }];
const TOWER_MECH = [null, 'traps', 'speed', 'fire', 'fog', 'summon'];
function towerStage(f, pair) {
  const c = Math.min(11, Math.floor((f - 1) / 9)), ch = CHAPTERS[c], boss = f % 10 === 0;
  const base = STAGES[c * 10 + (boss ? 9 : Math.min(8, (f - 1) % 10))];
  const st = { ...base, id: 'T' + f, tower: true, floor: f, kind: boss ? 'boss' : 'normal', lvl: 2 + Math.floor(f * 0.6), name: 'Tháp Thập Tuyệt · Tầng ' + f,
    reward: { ngoc: 40 + f * 4 + (boss ? 150 : 0), vang: 500 + f * 80 }, mech: TOWER_MECH[(f / 10 | 0) % TOWER_MECH.length], gate: 3000 + f * 60, par: 150 };
  st.waves = base.waves.slice(0, boss ? base.waves.length : 10);
  st.ehp = (pair.bane.ehp || 1) * (1 + f * 0.02); st.eatk = (pair.bane.eatk || 1) * (1 + f * 0.015); st.espd = pair.bane.espd || 1; st.hhp = pair.bane.hhp || 0;
  st.hmods = pair.boon.m || null; st.bookN = pair.boon.book || 0;
  return st;
}
function towerPairs(f) {   // 2 lựa chọn cố định theo tầng
  const r = i => { const x = Math.sin(f * 91.7 + i * 13.3) * 10000; return x - Math.floor(x); };
  return [0, 1].map(i => ({ boon: BOON[Math.floor(r(i) * BOON.length)], bane: BANE[(Math.floor(r(5) * BANE.length) + i * 2) % BANE.length] }));
}

// ---- TÁM MƯƠI MỐT NẠN: hành trình 81 trận liên tiếp; mỗi nạn một điều bất lợi, thắng thì chọn 1 phúc duyên giữ suốt hành trình; thua là kết thúc
const NAN = ['Kim Thiền bị đày', 'Vừa sinh suýt bị giết', 'Trăng tròn thả sông', 'Tìm mẹ báo thù', 'Ra thành gặp hổ', 'Sa hố mất tuỳ tùng', 'Núi Song Xoa', 'Núi Lưỡng Giới', 'Khe sâu đổi ngựa',
  'Đêm bị đốt chùa', 'Mất áo cà sa', 'Thu phục Bát Giới', 'Hoàng Phong cản đường', 'Cầu cứu Linh Cát', 'Lưu Sa khó qua', 'Thu phục Sa Tăng', 'Bốn thánh thử lòng', 'Ngũ Trang Quán',
  'Khó cứu cây sâm', 'Đuổi Tâm Viên', 'Lạc rừng Hắc Tùng', 'Đưa thư Bảo Tượng', 'Điện vàng hoá hổ', 'Núi Bình Đỉnh gặp ma', 'Động Liên Hoa treo ngược', 'Cứu vua Ô Kê', 'Yêu quái biến hoá',
  'Núi Hiệu gặp ma', 'Gió cuốn sư phụ', 'Tâm Viên bị hại', 'Mời thánh hàng yêu', 'Sông Hắc Thuỷ', 'Xa Trì kéo xe', 'Đấu phép thắng thua', 'Trừ đạo hưng tăng', 'Sông Thông Thiên',
  'Rơi xuống sông băng', 'Giỏ cá hiện thân', 'Núi Kim Đâu', 'Thiên thần khó thắng', 'Hỏi Phật gốc yêu', 'Uống nước mang thai', 'Tây Lương giữ hôn', 'Động Tỳ Bà', 'Lại đuổi Tâm Viên',
  'Thật giả khó phân', 'Hoả Diệm Sơn chặn lối', 'Cầu quạt Ba Tiêu', 'Bắt Ngưu Ma Vương', 'Tế Trại quét tháp', 'Lấy báu cứu tăng', 'Rừng Kinh Cức', 'Tiểu Lôi Âm', 'Chư thần bị khốn',
  'Ngõ Hy Thị', 'Chu Tử chữa bệnh', 'Cứu hoàng hậu', 'Bảy nhện tinh', 'Đa Mục thương tổn', 'Sư Đà chặn đường', 'Ba ma hoá rết', 'Thành Sư Đà', 'Mời Phật thu ma', 'Tỉ Khâu cứu trẻ',
  'Phân biệt tà chính', 'Rừng thông cứu yêu', 'Ốm nằm tăng phòng', 'Động Không Đáy', 'Diệt Pháp khó đi', 'Núi Ẩn Vụ', 'Phụng Tiên cầu mưa', 'Mất binh khí', 'Hội Đinh Ba',
  'Núi Trúc Tiết', 'Động Huyền Anh', 'Bắt tê giác', 'Thiên Trúc cầu hôn', 'Ngục Đồng Đài', 'Lăng Vân thoát xác', 'Mười vạn tám nghìn dặm', 'Nạn cuối sông Thông Thiên'];
const NAN_BOON = [...BOON, { t: 'Máu tối đa +30%', m: { hpPct: 0.30 } }, { t: 'Nhận ít hơn 15% sát thương', m: { kc: 0.15 } }, { t: 'Nội công hồi nhanh hơn 30%', m: { mpRegen: 0.30 } }, { t: 'Thêm 1 Thiên Thư đầu trận', book: 1 }];
function nanState() { S.nan = S.nan || { best: 0, run: null }; return S.nan; }
function nanStage(n, run) {
  const c = Math.min(11, Math.floor((n - 1) / 7)), boss = n % 9 === 0, bane = BANE[run.banes[n - 1] % BANE.length];
  const base = STAGES[c * 10 + (boss ? 9 : Math.min(8, (n - 1) % 9))];
  const st = { ...base, id: 'N' + n, nan: true, nanN: n, kind: boss ? 'boss' : 'normal', lvl: 2 + Math.floor(n * 0.55), name: 'Nạn ' + n + ' · ' + NAN[n - 1],
    reward: { ngoc: 15 + n * 2 + (boss ? 60 : 0), vang: 300 + n * 50 }, mech: TOWER_MECH[(n / 9 | 0) % TOWER_MECH.length], gate: 3000 + n * 50, par: 120 };
  st.waves = base.waves.slice(0, boss ? base.waves.length : 6);
  st.ehp = (bane.ehp || 1) * (1 + n * 0.025); st.eatk = (bane.eatk || 1) * (1 + n * 0.018); st.espd = bane.espd || 1; st.hhp = bane.hhp || 0;
  const hm = {}; let bk = 0; for (const bi of run.boons) { const b = NAN_BOON[bi]; for (const k in (b.m || {})) hm[k] = (hm[k] || 0) + b.m[k]; bk += b.book || 0; }
  st.hmods = hm; st.bookN = bk; st.baneT = bane.t; return st;
}
function nanPick3() { const a = [...NAN_BOON.keys()]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 3); }
function showNan() {
  const N = nanState(), run = N.run;
  if (run && run.pick) {   // chọn phúc duyên sau khi vượt nạn
    ui.innerHTML = `<div class="screen panel-screen">${topBar('Tám Mươi Mốt Nạn')}<h3 style="margin:6px 4px">Vượt nạn ${run.n - 1}! Chọn 1 phúc duyên (giữ đến hết hành trình)</h3>
      <div class="tw-pairs">${run.pick.map(bi => `<button class="tw-pair" data-nb="${bi}"><span class="boon">＋ ${esc(NAN_BOON[bi].t)}</span><em>Nhận</em></button>`).join('')}</div></div>`;
    $('#bBack').onclick = showTrials; ui.querySelectorAll('[data-nb]').forEach(b => b.onclick = () => { run.boons.push(+b.dataset.nb); run.pick = null; save(); showNan(); }); return;
  }
  if (!run) {
    ui.innerHTML = `<div class="screen panel-screen">${topBar('Tám Mươi Mốt Nạn')}
      <p class="chap-story">Thầy trò Đường Tăng phải vượt <b>81 kiếp nạn</b> mới tới Tây Thiên. Hành trình gồm 81 trận ngắn liên tiếp, mỗi 9 nạn có một boss. Mỗi nạn mang một <b style="color:#c0392b">điều bất lợi</b>. Vượt nạn thì chọn 1 <b style="color:#2a9a4a">phúc duyên</b>, cộng dồn suốt hành trình. <b>Thua một nạn là hành trình kết thúc</b>, phải đi lại từ đầu. Không tốn Tiên Khí.</p>
      <div class="hint">Kỷ lục: vượt <b>${N.best}</b>/81 nạn</div>
      <div style="text-align:center"><button class="btn gold big" id="nanGo">Bắt đầu hành trình</button></div></div>`;
    $('#bBack').onclick = showTrials; $('#nanGo').onclick = () => { N.run = { n: 1, boons: [], banes: Array.from({ length: 81 }, () => Math.floor(Math.random() * 1000)) }; save(); showNan(); }; return;
  }
  if (run.n > 81) { ui.innerHTML = `<div class="screen panel-screen">${topBar('Tám Mươi Mốt Nạn')}<h3 style="text-align:center">Viên mãn! Đã vượt đủ 81 nạn, thỉnh được chân kinh.</h3><div style="text-align:center"><button class="btn gold" id="nanEnd">Kết thúc hành trình</button></div></div>`;
    $('#bBack').onclick = showTrials; $('#nanEnd').onclick = () => { N.run = null; save(); showNan(); }; return; }
  const st = nanStage(run.n, run);
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Tám Mươi Mốt Nạn')}
    <div class="nan-track">${Array.from({ length: 9 }, (_, k) => { const i = Math.floor((run.n - 1) / 9) * 9 + k + 1; return `<span class="${i < run.n ? 'done' : i === run.n ? 'cur' : ''} ${i % 9 === 0 ? 'boss' : ''}">${i}</span>`; }).join('')}</div>
    <h3 style="margin:6px 4px">${esc(st.name)}${st.kind === 'boss' ? ' · BOSS' : ''}</h3>
    <div class="tw-pairs"><div class="tw-pair"><span class="bane">－ ${esc(st.baneT)}</span><em>Điều bất lợi của nạn này</em></div>
      <div class="tw-pair"><span class="boon">Phúc duyên đang có (${run.boons.length})</span><em>${run.boons.map(bi => esc(NAN_BOON[bi].t)).join(' · ') || 'Chưa có'}</em></div></div>
    <div class="hint">Thưởng: ${icon('ngoc')}${st.reward.ngoc} ${icon('vang')}${fmt(st.reward.vang)} · Kỷ lục ${N.best}/81</div>
    <div style="text-align:center;display:flex;gap:10px;justify-content:center"><button class="btn red" id="nanQuit">Bỏ hành trình</button><button class="btn gold big" id="nanFight">Vượt nạn</button></div></div>`;
  $('#bBack').onclick = showTrials; $('#nanFight').onclick = () => enterStage(nanStage(run.n, run));
  $('#nanQuit').onclick = () => { N.run = null; save(); showNan(); };
}
function showTower() {
  const f = (S.tower || 0) + 1, P = towerPairs(f);
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Tháp Thập Tuyệt')}
    <p class="chap-story">Đã qua <b>${S.tower || 0}</b>/100 tầng. Mỗi tầng chọn 1 cặp <b style="color:#2a9a4a">lợi</b> / <b style="color:#c0392b">hại</b>. Mỗi 10 tầng là trận tuyệt có boss. Không tốn Tiên Khí.</p>
    ${f > 100 ? '<h3 style="text-align:center">Đã chinh phục toàn bộ Tháp!</h3>' : `<h3 style="margin:6px 4px">Tầng ${f}${f % 10 === 0 ? ' · TRẬN TUYỆT (Boss)' : ''}</h3>
    <div class="tw-pairs">${P.map((p, i) => `<button class="tw-pair" data-tp="${i}"><span class="boon">＋ ${esc(p.boon.t)}</span><span class="bane">－ ${esc(p.bane.t)}</span><em>Chọn & vào trận</em></button>`).join('')}</div>`}
    <div class="hint">Thưởng tầng ${f}: ${icon('ngoc')}${40 + f * 4 + (f % 10 === 0 ? 150 : 0)} ${icon('vang')}${fmt(500 + f * 80)}</div></div>`;
  $('#bBack').onclick = showTrials;
  ui.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => enterStage(towerStage(f, P[+b.dataset.tp])));
}
// ---- Boss xâm lược hằng ngày: 3 lượt/ngày, 90 giây, thưởng theo sát thương
const RAID_TIER = [[20000, 60], [80000, 120], [200000, 200], [500000, 320], [1000000, 500]];
const RAID_BOSS = ['datkyboss', 'vantrong', 'congminhboss', 'vantieuboss', 'thongthien', 'nguumaboss', 'bachcotboss'];
function weekKey() { const d = new Date(), j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + 'W' + Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7); }
function raidToday() { const k = dayKey(); if (!S.raid || S.raid.d !== k) S.raid = { d: k, n: 0 }; return S.raid; }
function raidUse() { const r = raidToday(); if (r.n >= 3) { toast('Hết lượt hôm nay'); return false; } r.n++; save(); return true; }
function raidStage() {
  const b = RAID_BOSS[new Date().getDay() % RAID_BOSS.length], lv = 8 + Math.floor(STAGES.filter(s => S.cleared[s.id]).length / 4);
  return { id: 'RAID', raid: 90, eatk: 0.6, kind: 'boss', name: 'Boss Xâm Lược · ' + ENEMIES[b].name, lvl: lv, par: 90, gate: 999999, theme: 'heaven', seed: 5, chap: 0,
    reward: { ngoc: 0, vang: 0 }, waves: [{ list: [[b, 1], ['tieuyeu', 6]], boss: true }, { list: [['tieuyeu', 10]], gap: 20 }, { list: [['tieuyeu', 12]], gap: 20 }] };
}
function showRaid() {
  const r = raidToday(), st = raidStage(), best = (S.raidBest || {})[weekKey()] || 0;
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Boss Xâm Lược')}
    <h3 style="margin:6px 4px">${esc(st.name)}</h3>
    <p class="chap-story">Boss đổi mỗi ngày, máu cực lớn. Gây càng nhiều sát thương trong <b>90 giây</b> càng nhiều thưởng. Còn <b>${3 - r.n}</b>/3 lượt hôm nay. Kỷ lục tuần: <b>${fmt(best)}</b></p>
    <div class="meta-list">${RAID_TIER.map(t => `<div class="meta-row"><div><b>≥ ${fmt(t[0])} sát thương</b></div><span class="rew">${icon('ngoc')}${t[1]}</span></div>`).join('')}</div>
    <div style="text-align:center"><button class="btn gold big" id="rdGo" ${r.n >= 3 ? 'disabled' : ''}>Khiêu chiến</button></div></div>`;
  $('#bBack').onclick = showTrials; $('#rdGo').onclick = () => enterStage(raidStage());
}
// ---- Bảng xếp hạng (Firestore, cần đăng nhập Google)
function lbPush() {
  if (!(window.Cloud && Cloud.user && Cloud.lbSet)) return;
  const row = { name: (Cloud.user.displayName || 'Chấp Bảng Sứ').slice(0, 24), power: totalPower(), tower: S.tower || 0, raid: (S.raidBest || {})[weekKey()] || 0, wk: weekKey(), ts: Date.now(), nan: Math.min(81, (S.nan && S.nan.best) || 0) };
  Cloud.lbSet(row).catch(e => { delete row.nan; Cloud.lbSet(row).catch(e2 => console.warn(e2)); });   // quy tắc cũ chưa có 'nan' → gửi lại không kèm
}
async function showRank(tab) {
  tab = tab || 'power';
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Bảng Xếp Hạng')}
    <div class="chap-tabs">${[['power', 'Lực chiến'], ['tower', 'Tháp'], ['nan', '81 Nạn'], ['raid', 'Boss tuần']].map(([k, n]) => `<button class="btn small ${k === tab ? 'gold' : ''}" data-rk="${k}">${n}</button>`).join('')}</div>
    <div class="meta-list" id="rkL"><div class="hint">Đang tải…</div></div></div>`;
  $('#bBack').onclick = showTrials; ui.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => showRank(b.dataset.rk));
  if (!(window.Cloud && Cloud.ok && Cloud.lbTop)) { $('#rkL').innerHTML = '<div class="hint">Chưa kết nối máy chủ.</div>'; return; }
  if (!Cloud.user) { $('#rkL').innerHTML = '<div class="hint">Đăng nhập Google ở trang chủ để xem và có tên trên bảng.</div>'; return; }
  lbPush();
  try {
    const rows = (await Cloud.lbTop(tab, 50)).filter(r => tab !== 'raid' || r.wk === weekKey());
    const el = $('#rkL'); if (!el) return;
    el.innerHTML = rows.length ? rows.map((r, i) => `<div class="meta-row ${r.uid === Cloud.user.uid ? 'me' : ''}"><div><b>${i + 1}. ${esc(r.name || '?')}</b></div><span class="rew">${fmt(r[tab] || 0)}</span></div>`).join('') : '<div class="hint">Chưa có ai.</div>';
  } catch (e) { const el = $('#rkL'); if (el) el.innerHTML = `<div class="hint">Lỗi tải bảng: ${esc(e.code || e.message)} (cần cập nhật quy tắc Firestore)</div>`; }
}
// ---- Nhiệm vụ tuần + điểm danh tháng
const WEEKLY = [
  { id: 'fight', name: 'Chiến đấu 25 trận', need: 25, rew: { ngoc: 300 } }, { id: 'win', name: 'Thắng 15 trận', need: 15, rew: { vang: 20000 } },
  { id: 'tower', name: 'Leo 5 tầng Tháp', need: 5, rew: { ngoc: 400 } }, { id: 'raid', name: 'Đánh Boss Xâm Lược 10 lần', need: 10, rew: { ngoc: 300, univ: 10 } }];
function wq() { const k = weekKey(); if (!S.weekly || S.weekly.w !== k) S.weekly = { w: k, p: {}, c: {} }; return S.weekly; }
function wqAdd(id, n) { const w = wq(); w.p[id] = (w.p[id] || 0) + (n == null ? 1 : n); save(); }
const MONTH_REW = i => (i + 1) % 7 === 0 ? { ngoc: 200 } : (i + 1) % 5 === 0 ? { univ: 5 } : i % 2 ? { vang: 3000 } : { ngoc: 50 };
function monthState() { const d = new Date(), k = d.getFullYear() + '-' + (d.getMonth() + 1); if (!S.month || S.month.m !== k) S.month = { m: k, n: 0, last: null }; return S.month; }
function showEvents() {
  const w = wq(), mo = monthState(), today = dayKey(), canSign = mo.last !== today && mo.n < 30;
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Sự Kiện')}
    <h4 style="margin:6px 4px">Điểm danh tháng (${mo.n}/30)</h4>
    <div class="m30">${Array.from({ length: 30 }, (_, i) => `<div class="m30d ${i < mo.n ? 'got' : i === mo.n && canSign ? 'ok' : ''}"><b>${i + 1}</b><small>${rewTxt(MONTH_REW(i))}</small></div>`).join('')}</div>
    <div style="text-align:center;margin:6px"><button class="btn gold" id="evSign" ${canSign ? '' : 'disabled'}>${canSign ? 'Điểm danh hôm nay' : 'Đã điểm danh'}</button></div>
    <h4 style="margin:6px 4px">Nhiệm vụ tuần</h4>
    <div class="meta-list">${WEEKLY.map(q => { const p = Math.min(q.need, w.p[q.id] || 0), done = p >= q.need, got = w.c[q.id];
      return `<div class="meta-row"><div><b>${q.name}</b><small>${p}/${q.need}</small><div class="bar"><i style="width:${p / q.need * 100}%"></i></div></div><span class="rew">${rewTxt(q.rew)}</span>
        <button class="btn small ${done && !got ? 'gold' : ''}" data-wq="${q.id}" ${done && !got ? '' : 'disabled'}>${got ? 'Đã nhận' : done ? 'Nhận' : 'Chưa xong'}</button></div>`; }).join('')}</div></div>`;
  $('#bBack').onclick = showHome;
  $('#evSign').onclick = () => { grant(MONTH_REW(mo.n)); mo.n++; mo.last = today; save(); showEvents(); };
  ui.querySelectorAll('[data-wq]').forEach(b => b.onclick = () => { const q = WEEKLY.find(x => x.id === b.dataset.wq); w.c[q.id] = 1; grant(q.rew); save(); showEvents(); });
}

// ------------------------------------------------------------------ BOOT
// Đường dẫn nhanh: #battle=1 (vào ải 1, bật tự động), #gacha, #heroes, #lineup, #stages, #hero=nata
function route() {
  const h = (location.hash || '').slice(1);
  window.__chibi = !/(^|&)anime(&|$)/.test(h);   // trong trận mặc định dùng chibi; thêm &anime để xem bản anime
  const [main, simPart] = h.split('&').filter(x => x !== 'chibi').concat([undefined]);
  const [k, v] = main.split('=');
  if (k === 'towertest' || k === 'raidtest') {   // (chụp thử) vào trận Tháp tầng 1 / Boss ngày
    const tm = h.match(/(?:^|&)team=([\w,]+)/); if (tm) { const ids = tm[1].split(',').filter(id => HEROES[id]); ids.forEach(id => { if (!S.owned[id]) S.owned[id] = newRec(); }); S.lineup = ids; }
    const st = k === 'towertest' ? towerStage(1, towerPairs(1)[0]) : raidStage();
    ensureHeroAssets(S.lineup).then(() => ensureEnemyAssets(stageEnemyIds(st))).then(() => { startBattleNow(st); B.auto = true;
      const secs = simPart && simPart.startsWith('sim=') ? +simPart.slice(4) : 0;
      for (let i = 0; i < secs * 60 && !B.over; i++) { update(1 / 60); if (B.paused) { const mm = ui.querySelector('.cp-modal'); const bb = mm && mm.querySelector('.cp-card'); if (bb) bb.click(); else B.paused = false; } }
      if (B.over && B.endT != null) { B.endT = null; showResult(); } });
  }
  else if (k === 'battle') {
    const tm = h.match(/(?:^|&)team=([\w,]+)/); // &team=nata,quanam (chụp thử): đội hình tạm
    if (tm) { const ids = tm[1].split(',').filter(id => HEROES[id]); ids.forEach(id => { if (!S.owned[id]) S.owned[id] = newRec(); }); S.lineup = ids; }
    Promise.all([ensureHeroAssets(S.lineup), ensureEnemyAssets(stageEnemyIds(STAGES[clamp((+v || 1) - 1, 0, STAGES.length - 1)]))]).then(() => {
    startBattleNow(clamp((+v || 1) - 1, 0, STAGES.length - 1));
    if (B) {
      if (/notut/.test(h)) S.tut = { all: 1 };
      if (/dbgprog/.test(h)) setTimeout(() => { const q = s => { const e = document.querySelector(s); if (!e) return s + ':none'; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return s + ':' + [r.x, r.y, r.width, r.height].map(Math.round) + ' d=' + c.display + ' pos=' + c.position + ' bg=' + c.backgroundImage.slice(0, 40); }; const pre = document.createElement('pre'); pre.id = 'dbg'; pre.textContent = ['#hProg', '.h2-ptrack', '#hPfill', '.pm.boss', '#hPcur'].map(q).join(' | '); document.body.appendChild(pre); }, 500);
      B.auto = true; const b = $('#bAuto'); if (b) b.classList.add('on');
      // &sim=20: tua nhanh 20 giây (dùng để chụp ảnh thử)
      const secs = simPart && simPart.startsWith('sim=') ? +simPart.slice(4) : 0;
      for (let i = 0; i < secs * 60 && !B.over; i++) {
        update(1 / 60);
        if (B.paused) { const m = ui.querySelector('.cp-modal'); const b = m && m.querySelector('.cp-card'); if (b) b.click(); else B.paused = false; }
      }
      if (secs) { B.banner = null; B.cutin = null; updateHUD(); }
      if (/(^|&)end(&|$)/.test(h) && !B.over) { ui.querySelectorAll(".modal").forEach(x => x.remove()); endBattle(true); B.endT = null; B.paused = false; showResult(); }   // (chụp thử) kết thúc trận để xem bảng thống kê
      // &ult=ngokhong:0.9 — (chụp thử) cho tướng tung tuyệt kỹ rồi tua thêm 0.9 giây
      if (/(^|&)cp(&|$)/.test(h)) openCongPhap();
      if (/(^|&)cpbg(&|$)/.test(h)) { openCongPhap(); openBachGiam(); }   // (chụp thử) mở Thiên Thư
      const rm = h.match(/(?:^|&)rec=(\d+)/);   // (quay thử) &rec=20: xuất 20 giây khung hình (24 fps) vào <pre id="frames"> để ghép video
      if (rm) {
        const cv = document.querySelector('canvas'), out = [];
        for (let f = 0; f < +rm[1] * 24 && !B.over; f++) {
          for (let k = 0; k < 2; k++) {
            update(1 / 48);
            if (B.paused) { const mm = ui.querySelector('.cp-modal'); const bb = mm && mm.querySelector('.cp-card'); if (bb) bb.click(); else B.paused = false; }
          }
          updateHUD(); render(); out.push(cv.toDataURL('image/jpeg', 0.8).slice(23));
        }
        const pre = document.createElement('pre'); pre.id = 'frames'; pre.textContent = out.join(String.fromCharCode(10)); document.body.appendChild(pre);
      }
      const cm = h.match(/(?:^|&)combo=(\w+),(\w+)/);   // (chụp thử) 2 tướng tung tuyệt kỹ liền nhau
      if (cm) for (const id of [cm[1], cm[2]]) { const u = B.heroes.find(x => x.id === id && !x.dead) || B.deploy.find(x => x.id === id); if (u) { if (!B.heroes.includes(u)) { takeSlot(u); B.heroes.push(u); B.deploy = B.deploy.filter(x => x !== u); } u.mp = 100; u.cdU = 0; u.stun = 0; u.dk = 0; cast(u, 'ult'); for (let i = 0; i < 30; i++) update(1 / 60); } }
      if (cm) for (let i = 0; i < 90; i++) update(1 / 60);
      const um = h.match(/(?:^|&)ult=(\w+):([\d.]+)/);
      if (um) {
        const u = B.heroes.find(x => x.id === um[1] && !x.dead);
        if (u) { u.mp = 100; u.cdU = 0; u.stun = 0; u.dk = 0; cast(u, 'ult'); for (let i = 0; i < +um[2] * 60; i++) update(1 / 60); }
      }
      if (/(?:^|&)buffs(?:&|$)/.test(h)) setTimeout(showBuffs, 300);   // (chụp thử) mở bảng hiệu ứng
      const tm = h.match(/(?:^|&)tier=(\d)/);   // (chụp thử) đặt tầng cho cả đội
      if (tm) for (const u of [...B.heroes, ...B.deploy]) { u.trong = +tm[1]; rebuildTang(u); }
      const fm = h.match(/(?:^|&)spawn=(\w+)/);   // (chụp thử) gọi 3 quái loại này
      if (fm && ENEMIES[fm[1]]) { ensureEnemyAssets([fm[1]]); for (let i = 0; i < 3; i++) spawnEnemy({ type: fm[1] }); for (let i = 0; i < 90; i++) update(1 / 60); B.capTgt = B.enemies.find(e => !e.dead && e.id === fm[1]) || null; }
      const bm = h.match(/(?:^|&)boss=(\w+)/);   // (chụp thử) gọi boss ngay
      if (bm && ENEMIES[bm[1]]) { spawnEnemy({ type: bm[1] }); const e = B.enemies[B.enemies.length - 1]; e.x = W * 0.7; e.hp = maxHp(e) * 0.55; e.hpLag = 0.8; e.phase = 2; e.phaseT = performance.now(); if (/(?:^|&)form/.test(h)) { e.form = true; formImg(e.id); if (/sceneA=/.test(h)) { window.__sceneA = +h.match(/sceneA=([\d.]+)/)[1]; setTimeout(() => startBossScene(e, 'Ngưu Ma hoá thân!'), 1500); } } for (let i = 0; i < 60; i++) update(1 / 60); }
      const sm = h.match(/(?:^|&)scene=(\w+):([\d.]+)/);   // (chụp thử) đứng hình cảnh cắt SSR ở giây thứ N
      if (sm) { const u = B.heroes.find(x => x.id === sm[1]) || B.deploy.find(x => x.id === sm[1]); if (u) { window.__sceneA = +sm[2]; startScene(u, u.d.ult); } }
      const xm = h.match(/(?:^|&)cx=(\w+),(\w+):([\d.]+)/);   // (chụp thử) hợp kích chủ động: &cx=ngokhong,duongtien:1.2
      if (xm) { for (const id of [xm[1], xm[2]]) { const u = B.heroes.find(x => x.id === id) || B.deploy.find(x => x.id === id); if (u) { if (!B.heroes.includes(u)) { takeSlot(u); B.heroes.push(u); B.deploy = B.deploy.filter(x => x !== u); } u.mp = 100; u.cdU = 0; u.dk = 0; u.dead = false; } }
        const c = COMBOS.find(c => c.a === xm[1] && c.b === xm[2]); if (c) { castCombo(c); for (let i = 0; i < +xm[3] * 60; i++) update(1 / 60); } }
    }
    });
  }
  else if (k === 'anim') {
    SHOW = (HEROES[v] || ENEMIES[v]) ? v : 'ngokhong';
    window.__noMesh = simPart === 'old'; // #anim=ngokhong&old → xem bản cũ (khung nướng) để so sánh
    ui.innerHTML = '<div class="screen"><button class="btn small back" style="position:absolute;top:12px;left:12px" id="bBack">‹ Về</button></div>';
    $('#bBack').onclick = () => { SHOW = null; location.hash = ''; showHome(); };
  }
  else if (k === 'gacha') showGacha();
  else if (k === 'full') grantAllHeroes();
  else if (k === 'quests') showQuests();
  else if (k === 'tower') showTower();
  else if (k === 'nan') showNan();
  else if (k === 'trials') showTrials();
  else if (k === 'pb') showPB(v || '');
  else if (k === 'pbtest') { S.lineup = S.lineup.length ? S.lineup : ['culinhthan']; startBattleNow(pbStage(v || 'equip', 0)); B.auto = true; for (let i = 0; i < 60 * 95 && !B.over; i++) { update(1 / 60); if (B.paused) { const c = ui.querySelector('.cp-modal .cp-card'); if (c) c.click(); else B.paused = false; } } if (!B.over) endBattle(true); B.endT = null; showResult(); }
  else if (k === 'settings') { showHome(); setTimeout(showSettings, 600); }
  else if (k === 'balance') { window.__dmgBy = {}; const eg = (location.hash.match(/eg=([\d.]+)/) || [])[1]; if (eg) window.__eg = +eg;   // (đo cân bằng) máy tự đánh: #balance=1-12 → kết quả trong <pre id="bal">
    const [c0, c1] = (v || '1-12').split('-').map(Number), out = [], RANK = { SSR: 3, SR: 2, R: 1 };
    for (let c = c0; c <= (c1 || c0); c++) {
      const lv = Math.min(MAX_LV, Math.round(3 + (c - 1) * 2.5)), star = 1 + Math.floor((c - 1) / 4);
      const pool = ['culinhthan', 'hoangphongquai', 'longnu', ...Object.keys(CH_HERO).filter(k2 => +k2 < c).map(k2 => CH_HERO[k2])];
      S.owned = {}; for (const id of pool) { S.owned[id] = newRec(); S.owned[id].lv = lv; S.owned[id].star = star; }
      const roles = {}; S.lineup = pool.slice().sort((a2, b2) => RANK[HEROES[b2].rar] - RANK[HEROES[a2].rar] || pool.indexOf(b2) - pool.indexOf(a2)).filter(id => { const r = HEROES[id].role; if ((roles[r] || 0) >= 2) return false; roles[r] = (roles[r] || 0) + 1; return true; }).slice(0, 5);
      const tq = (location.hash.match(/team=([a-z,]+)/) || [])[1]; if (tq) { S.lineup = tq.split(','); for (const id of S.lineup) { S.owned[id] = newRec(); S.owned[id].lv = lv; S.owned[id].star = star; } }
      for (const kk of [1, 5, 10]) {
        const si = (c - 1) * 10 + kk - 1; ui.querySelectorAll('.modal,.cp-modal').forEach(x => x.remove());
        startBattleNow(si); B.auto = true; let t = 0;
        while (!B.over && t < 420) { update(1 / 30); t += 1 / 30;
          if (B.paused) { const mm = ui.querySelector('.cp-modal'); const bb = mm && mm.querySelector('.cp-card'); if (bb) bb.click(); else { if (ui.querySelector('.revive-modal,.modal')) { ui.querySelectorAll('.modal').forEach(x => x.remove()); endBattle(false, 'wipe'); } B.paused = false; } } }
        out.push({ st: STAGES[si].id, lv, star, team: S.lineup.join(','), win: !!B.win, time: Math.round(B.time), gate: Math.round(B.gate.hp / B.gate.max * 100), wave: B.wave + 1 + '/' + B.st.waves.length, alive: B.heroes.filter(h => !h.dead && !h.clone).length, by: Object.entries(window.__dmgBy).sort((a3, b3) => b3[1] - a3[1]).slice(0, 4).map(x => x[0] + ':' + Math.round(x[1])).join(' ') }); window.__dmgBy = {};
        B = null;
      }
    }
    const pre = document.createElement('pre'); pre.id = 'bal'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  }
  else if (k === 'nantest') { const N = nanState(); N.run = { n: 9, boons: [0, 7], banes: Array.from({ length: 81 }, (_, i) => i) }; enterStage(nanStage(9, N.run)); }
  else if (k === 'story') { showHome(); setTimeout(() => showStory(+v || 1, () => showHome()), 800); }
  else if (k === 'raid') showRaid();
  else if (k === 'rank') showRank();
  else if (k === 'events') showEvents();
  else if (k === 'tangkinh') showTangKinh();
  else if (k === 'heroes') showHeroes();
  else if (k === 'hero' && HEROES[v]) showHeroDetail(v);
  else if (k === 'lineup') showLineup();
  else if (k === 'stages') showStages();
  else showHome();
}
loadArt().then(() => {
  route();
  setTimeout(loadCloud, 300);
  requestAnimationFrame(t => { lastT = t; frame(t); });
});

// Cho phép chạy thử tự động (không ảnh hưởng game)
window.__TTDC = { startBattle, update, get B() { return B; }, get S() { return S; }, pullOne, cast, openCongPhap, applyPick, CONGPHAP };
})();
