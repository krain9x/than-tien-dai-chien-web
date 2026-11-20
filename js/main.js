(() => {
'use strict';
// =====================================================================
// Thần Tiên Đại Chiến — bản prototype giai đoạn 1 (GDD mục 12.1)
// =====================================================================
const W = 960, H = 540, TAU = Math.PI * 2;   // màn NGANG (kiểu Võ Lâm Đại Minh Tinh)
const GATE_X = 112;          // quái tới cột này thì đánh cổng thành (tường thành dọc bên trái)
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
  ['ngokhong', 'batgioi', 'quanam', 'duongtang', 'honghainhi'].forEach(id => { owned[id] = newRec(); });
  return { ngoc: 1500, vang: 3000, univ: 0, owned,
           lineup: ['ngokhong', 'batgioi', 'quanam', 'duongtang', 'honghainhi'],
           cleared: {}, pity: 0, pity10: 0, pulls: 0 };
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.owned) return Object.assign(defaultSave(), s); }
  } catch (e) { /* bỏ qua */ }
  return defaultSave();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* bỏ qua */ } }
let S = loadSave();
// Tặng 10 tướng mới vào kho hiện có (một lần cho mỗi bản save) để thử ngay, không cần quay gacha
(function grantNewHeroes() {
  const NEW = ['duongtien', 'khuongtanha', 'vantieu', 'trieucongminh', 'thailaoquan', 'satang', 'thietphien', 'litinh', 'hangnga', 'bachcot'];
  if (S.grantNew1) return;
  for (const id of NEW) if (HEROES[id] && !S.owned[id]) S.owned[id] = newRec();
  S.grantNew1 = 1; save();
})();

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
const POSE_NAMES = ['windup', 'strike', 'skill', 'ult', 'idle1', 'idle2', 'hit'];
const POSE_IDS = ['ngokhong','batgioi','nata','ngumavuong','honghainhi','quanam','datky','duongtang','duongtien','khuongtanha','vantieu','trieucongminh','thailaoquan','satang','thietphien','litinh','hangnga','bachcot'];   // tướng đã có tư thế chính (thêm id khi đã vẽ xong game/art/poses/<id>/)
const _heroLoaded = {};   // id → Promise: rig xương + tư thế của tướng, chỉ nạp khi tướng ra trận (tiết kiệm ~30 MB lúc khởi động)
function ensureHeroAssets(ids) {
  return Promise.all([...new Set(ids)].map(id => {
    if (_heroLoaded[id]) return _heroLoaded[id];
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
const FACE = {};
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
  if (typeof MeshRig !== 'undefined') for (const id of (window.MESH_IDS || [])) jobs.push(new Promise(res => {
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
  const m = (1 + 0.06 * (o.lv - 1)) * STAR_MUL[o.star - 1], bt = btBonus(h.role);
  return { hp: h.hp * m * bt.hp, atk: h.atk * m * bt.atk, def: h.def * m * bt.def, aspd: h.aspd };
}
function power(id) { const s = heroStats(id); return Math.round(s.hp * 0.25 + s.atk * 4 + s.def * 2); }
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
const coreBonus = u => RM(u, 'core') ? 0.20 * Math.min(5, sysTang(u.role)) : 0;   // Cốt Lõi: +20%/lần bồi dưỡng, tối đa 5
const AMMO = 8;
const ammoMax = u => AMMO + M('ammo');

function makeHero(id, isCap) {
  const h = HEROES[id], o = S.owned[id] || newRec();
  const m = (1 + 0.06 * (o.lv - 1)) * STAR_MUL[o.star - 1];
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
  const d = ENEMIES[type], m = 1 + 0.32 * (lvl - 1);
  const e = {
    side: 'e', id: type, d, look: d.look, name: d.name, el: d.el, level: lvl,
    base: { hp: d.hp * m, atk: d.atk * m, def: d.def * (1 + 0.1 * (lvl - 1)) },
    bonus: { hpPct: 0, atkPct: 0, crit: 0, dmgTaken: 0 },
    aspd: d.aspd, range: d.range, move: d.move, ranged: !!d.ranged, proj: d.proj,
    x, y, hp: d.hp * m, cdA: rand(0.3, 1.2), buffs: [], stun: 0, slow: 0, burn: 0, burnDps: 0,
    shield: 0, shieldT: 0, inv: 0,
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
    if (M('ad1') && B.amMode === 'am') p += 0.20 + M('ad1Evo');   // Âm Dương: trạng thái Âm
    if (u.dhT > 0) p += 0.40;                                        // Điều Hòa Âm Dương
    if (M('tuthan') && trongOf(u) >= 5) p += M('tuthan');                                     // Tu Thần
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
    if (b.id === 'phutu') {
      if (u.id === 'ngumavuong') u.bonus.hpPct += 0.20;
      if (u.id === 'honghainhi') u.bonus.dmgTaken += 0.15;
    }
  }
  const pa = u.d.passive || {};
  if (pa.crit) u.bonus.crit += pa.crit;
  if (pa.dr) u.bonus.dmgTaken += pa.dr;
}

function startBattle(si) {   // nạp rig + tư thế của đội trước khi vào trận
  const need = S.lineup.filter(id => S.owned[id]);
  if (need.every(id => _heroLoaded[id] && _heroLoaded[id].done)) { startBattleNow(si); return; }
  let ov = document.getElementById('loadov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'loadov'; ov.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(40,24,12,.72);color:#ffe9b0;font:800 22px Baloo 2,sans-serif;z-index:99'; ov.textContent = 'Đang tải tướng…'; document.body.appendChild(ov); }
  ensureHeroAssets(need).then(() => { need.forEach(id => { _heroLoaded[id].done = true; }); ov.remove(); startBattleNow(si); });
}
function startBattleNow(si) {
  const st = STAGES[si];
  const ids = S.lineup.filter(id => S.owned[id]);
  if (!ids.length) { toast('Cần ít nhất 1 tướng trong đội hình'); return; }
  B = {
    st, si, time: 0, wave: -1, waveStart: 0, nextT: null, spawnQ: [], waveDef: null, waveDropped: false,
    heroes: [], enemies: [], projs: [], fx: [], parts: [], floaters: [], drops: [], zones: [], warns: [],
    mods: {}, cp: {}, gate: { hp: st.gate, max: st.gate }, gateHurt: 0,
    ghosts: [], hits: { n: 0, t: 0, id: null }, sparks: [], deploy: [], cap: null, paused: false, over: false, auto: false, speed: 1, shake: 0, slowmo: 0, later: [], flash: 0,
    cutin: null, rerolls: 2, soul: 0, amMode: 'duong', amT: 5, gateT: 10, field: {}, slots: [], kcT: 12, lv: 1, xp: 0, pickQ: [], dodgeCd: 0, deaths: 0, kills: 0, banner: null, endT: null, win: false, joy: null,
    bg: (BGIMG[st.theme] && BGIMG[st.theme].complete && BGIMG[st.theme].naturalWidth) ? BGIMG[st.theme] : Art.backgroundH(W, H, st.theme, st.seed), ids, capTgt: null,
  };
  const info = teamInfo(ids);
  ids.forEach((id, i) => {
    const u = makeHero(id, i === 0);
    applyBonuses(u, info);
    u.hp = maxHp(u);
    if (i < 2) { takeSlot(u); B.heroes.push(u); if (i === 0) B.cap = u; } else B.deploy.push(u);   // mở trận: đội trưởng + 1 tướng; còn lại ra bằng Linh Phù
  });
  showHUD();
  nextWave();
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
    delay += 0.42;
  });
  const last = B.wave === B.st.waves.length - 1;
  B.banner = { text: wd.boss ? 'BOSS XUẤT HIỆN' : `Đợt ${B.wave + 1}/${B.st.waves.length}`, sub: last && !wd.boss ? 'Đợt cuối' : '', t: 0, boss: !!wd.boss };
  if (M('waveMp')) for (const h of B.heroes) if (!h.dead) h.mp = Math.min(100, h.mp + M('waveMp'));
}
function spawnEnemy(q) {
  let x = W + rand(20, 60), y = rand(LANE_Y0, LANE_Y1);
  if (q.side && Math.random() < 0.4 && !ENEMIES[q.type].boss) { x = rand(W * 0.55, W - 40); y = Math.random() < 0.5 ? LANE_Y0 - 30 : LANE_Y1 + 30; }
  if (ENEMIES[q.type].boss) { x = W + 60; y = H * 0.56; }
  const e = makeEnemy(q.type, B.st.lvl, x, y);
  e.drop = q.drop || null;
  if (e.boss && B.st.bossName) e.name = B.st.bossName;
  B.enemies.push(e);
  if (e.boss) { B.shake = 0.5; floater(W / 2, 150, e.name, '#ff6a6a', 28); }
}
function aliveEnemies() { return B.enemies.filter(e => !e.dead); }

// ------------------------------------------------------------------ DAMAGE
function floater(x, y, txt, color, size, crit) {
  B.floaters.push({ x: x + rand(-6, 6), y, txt: String(txt), color: color || '#fff', size: size || 16, t: 0, crit: !!crit });
}
function particles(x, y, color, n, spd, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(0.3, 1) * (spd || 160);
    B.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.35, 0.7), max: 0.7, color, size: rand(2, size || 4.5) });
  }
}
function dealDmg(src, tgt, mult, kind) {
  if (!tgt || tgt.dead) return 0;
  if (tgt.inv > 0) { if (kind !== 'dot') floater(tgt.x, tgt.y - 60, 'Né', '#bff3ff', 14); return 0; }
  let a = getAtk(src) * mult;
  if (src.side === 'h') {
    const sp = M('skillPct') + RM(src, 'skillPct') + ((src.d.passive && src.d.passive.skillPct) || 0);
    if (kind === 'skill' || kind === 'dot') a *= 1 + sp + TG(src, 'skill');
    if (kind === 'ult') a *= 1 + M('ultPct') + sp + TG(src, 'ult');
    if (kind === 'atk' || kind === 'ht') a *= 1 + TG(src, 'atk');
    a *= 1 + M('dmgPct') + RM(src, 'final');
    if (kind === 'atk' || kind === 'ht') {
      if (M('tp')) a *= 1 + 0.05 * (src.tp || 0);                       // Tật Phong
      if (M('vn')) a *= 1 + (src.vn || 0) * (M('vn') + (M('vnFinal') || 0));                     // Vô Ngã
      if (M('vk')) a *= Math.random() < 0.5 ? 0.8 : (M('vkEvo') ? 2.2 * rand(0.8, 1.4) : 1.6);   // Viên Khuyết: Khuyết −20% / Viên +60%
      if (M('bn')) {   // Bại Nhứ: đánh liên tục cùng mục tiêu
        if (src.bnTgt === tgt) src.bn = Math.min(M('bnEvo') ? 37 : 50, (src.bn || 0) + 1); else { src.bnTgt = tgt; src.bn = 0; }
        a *= 1 + src.bn * (M('bnEvo') ? 0.02 : 0.01);
      }
    }
    if (kind === 'ht' && M('htHp')) a *= 1 + M('htHp') * (tgt.hp / maxHp(tgt));
    if (M('tear2') && tgt.tear) a *= 1 + M('tear2') * tgt.tear;          // Xé Toạc 2
    if (tgt.side === 'e' && M('soul')) a *= 1 + 0.01 * B.soul;          // Quy Nhất: Linh Hồn
    if (src.isCap && (kind === 'skill' || kind === 'ult')) a *= 1.10;
  }
  const K = 500 + 50 * (tgt.level || 1);
  a *= K / (K + getDef(tgt) * (src.side === 'h' && M('vnSee') ? 1 - Math.min(5, src.vn || 0) * M('vnSee') : 1));   // Lạc Anh: Nhìn Thấu bỏ qua phòng thủ
  if (BEATS[src.el] === tgt.el) a *= 1.15; else if (BEATS[tgt.el] === src.el) a *= 0.85;
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
  tgt.hp -= rem; tgt.hurt = 0.1; if (rem > maxHp(tgt) * 0.04) tgt.hitT = 0.35;
  if (tgt.side === 'h' && M('ad2')) adLose(tgt, rem);
  const col = tgt.side === 'h' ? '#ff6b6b' : crit ? '#ffe14d' : kind === 'ult' ? '#ffb347' : '#ffffff';
  floater(tgt.x, tgt.y - 50 * sizeOf(tgt), crit ? a + '!' : a, col, crit ? 22 : (kind === 'ult' ? 19 : 15), crit);
  if (src.side === 'h') {
    if (M('lifesteal') && !src.dead) healU(src, a * M('lifesteal'), true);
    if (kind === 'atk') {
      const htc = M('htChance') + RM(src, 'htChance');
      if (htc && !tgt.dead && Math.random() < htc) {   // Một Đòn Hội Tâm
        dealDmg(src, tgt, 1.5 * (1 + M('htDmg')), 'ht'); floater(tgt.x, tgt.y - 78 * sizeOf(tgt), 'Hội Tâm!', '#ffb347', 15);
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
  while (u.adLost >= maxHp(u) * 0.08) { u.adLost -= maxHp(u) * 0.08; if (!(u.dhT > 0)) floater(u.x, u.y - 80, 'Điều Hòa Âm Dương', '#7dffb0', 13); u.dhT = M('ad2Evo') ? 5 : 3; }
}
function healAmD(src, u, amt) {   // hồi máu của tướng; Âm Dương: gây sát thương quái gần; hồi thừa → khiên
  if (!u || u.dead) return;
  const room = maxHp(u) - u.hp;
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
    B.kills++;
    if (M('soul') && Math.random() < 0.10 && B.soul < 40 + M('soulMax')) { B.soul++; floater(t.x, t.y - 60, 'Linh Hồn ' + B.soul, '#9ad0ff', 12); }
    B.xp += t.boss ? 30 : t.elite ? 5 : 1;
    while (B.xp >= xpNeed()) { B.xp -= xpNeed(); B.lv++; floater(W / 2, 120, 'Lên cấp ' + B.lv + '!', '#ffe14d', 24); queuePick(openCongPhap); }
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
function xpNeed() { return 8 + 5 * B.lv; }
// các khung chọn (Thiên Thư, Linh Phù) xếp hàng, không mở chồng lên nhau
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
  B.paused = true;
  const opts = B.deploy.slice(0, 4);
  const wrap = document.createElement('div');
  wrap.className = 'modal cp-modal';
  wrap.innerHTML = `<div class="cp-title"><span>Linh Phù</span><small>Chọn 1 hiệp khách xuất trận</small></div>
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
  B.paused = true;
  let opts = rollCongPhap();
  const wrap = document.createElement('div');
  wrap.className = 'modal cp-modal';
  const draw = () => {
    wrap.innerHTML = `<div class="cp-title"><span>Chọn Công Pháp</span><small>Chọn 1 để tu luyện · ${cpCount()}/${CP_MAX} ô công pháp</small></div>
      <div class="cp-list">${opts.map(cardHTML).join('')}</div>
      <div class="cp-side"><button class="btn small" id="cpBG">Bách Giám</button>
        <button class="btn small cp-reroll" ${B.rerolls > 0 ? '' : 'disabled'}>Đổi thẻ (còn ${B.rerolls})</button></div>
      ${pickFooter()}`;
    wrap.querySelectorAll('.cp-card').forEach(btn => btn.addEventListener('click', () => { applyPick(opts[+btn.dataset.i]); closePick(wrap); }));
    wrap.querySelector('.cp-reroll').onclick = () => { if (B.rerolls > 0) { B.rerolls--; opts = rollCongPhap(); draw(); } };
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
    B.banner = { text: u.name + ' · Tầng ' + u.trong, sub: u.d.tang[u.trong - 2].d, t: 0, small: true };
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
  const live = B.enemies.filter(e => !e.dead && e.x < W - 10);
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
  for (const e of B.enemies) { if (e.dead) continue; const d = dist(p, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
function enemiesIn(p, r) { return B.enemies.filter(e => !e.dead && dist(p, e) <= r + unitR(e)); }
function alliesAlive() { return B.heroes.filter(h => !h.dead && !h.clone); }
function canCast(u, w) {
  if (!u || u.dead || u.clone || u.stun > 0 || u.dk > 0) return false;
  const cost = w === 'ult' ? 60 : 30;
  if (u.mp < cost) return false;
  return w === 'ult' ? u.cdU <= 0 : u.cdS <= 0;
}
function cast(u, w) {
  if (!canCast(u, w)) return false;
  const sk = u.d[w];
  u.mp -= w === 'ult' ? 60 : 30;
  if (w === 'ult') u.cdU = 12; else u.cdS = 4;
  const sk_ = typeof Skel !== 'undefined' && Skel.has(u.id);
  u.castDur = sk_ ? (w === 'ult' ? 1.0 : 0.6) : 0.35; u.castT = u.castDur; u.castUlt = w === 'ult'; u.atkAnim = sk_ ? -1 : 0;
  const tgt = findTarget(u) || nearestEnemy(u, 400);
  if (tgt) u.f = tgt.x >= u.x ? 1 : -1;
  if (w === 'ult' && typeof VFX !== 'undefined' && VFX.has(u.id)) {
    // tuyệt kỹ có hiệu ứng riêng: hiệu ứng chạy sau cut-in, sát thương nổ đúng lúc hiệu ứng chạm đất
    const self = sk.fx.every(f => f.at === 'self' || f.t === 'heal' || f.t === 'shield' || f.t === 'taunt' || f.t === 'buff' || f.t === 'clone');
    const f0 = sk.fx.find(f => f.at === 'cluster' || f.at === 'front' || f.at === 'target');
    const P = self || (!tgt && !f0) ? { x: u.x, y: u.y } : f0 ? skillPoint(u, f0, tgt) : { x: tgt.x, y: tgt.y };
    const lead = 0.45, hit = lead + VFX.dur * 0.26;
    B.fx.push({ k: 'sig', id: u.id, x: u.x, y: u.y, tx: P.x, ty: P.y, f: u.f, t: -lead, dur: VFX.dur });
    B.later.push({ t: hit, fn: () => {
      if (u.dead) return;
      const t2 = tgt && !tgt.dead ? tgt : findTarget(u) || nearestEnemy(u, 400);
      for (const f of sk.fx) runFx(u, (f.at === 'cluster' || f.at === 'front' || f.at === 'target') ? { ...f, P } : f, t2, 'ult');
      B.shake = Math.max(B.shake, 0.6); B.flash = 0.22;
    } });
  } else for (const f of sk.fx) runFx(u, f, tgt, w === 'ult' ? 'ult' : 'skill');
  if (w === 'small' && RM(u, 'skillZone')) {
    const P = bestCluster(70) || (tgt ? { x: tgt.x, y: tgt.y } : null);
    if (P) { B.zones = B.zones.filter(z => !(z.src === u && z.tag === 'pz')); B.zones.push({ x: P.x, y: P.y, r: 70, mult: 0.4, t: 3, dur: 3, src: u, tick: 0, color: '#ff8a3a', tag: 'pz' }); }
  }
  if (w === 'ult') { B.cutin = { id: u.id, name: sk.name, hero: u.name, t: 0 }; B.slowmo = 0.35; }
  else floater(u.x, u.y - 82, sk.name, '#fff3b0', 15);
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
      if (TG(u, 'gateHeal')) B.gate.hp = Math.min(B.gate.max, B.gate.hp + B.gate.max * TG(u, 'gateHeal'));
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
  });
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
    const edge = p.pat === 'boomerang' ? (p.x < -80 || p.x > W + 120) && p.ret : (p.x < -60 || p.x > W + 60);
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
  if (u.atkAnim >= 0) { u.atkAnim += dt * (hasRig(u.id) ? 2.4 : 4.5); if (u.atkAnim > 1) u.atkAnim = -1; }
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
    if (e.dead || e.x > W + 5) continue;
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
    u.ammo = (u.ammo == null ? ammoMax(u) : u.ammo) - (M('freeShot') && Math.random() < M('freeShot') ? 0 : 1);   // Tiểu Vô Tướng Công: 15% không tốn lượt
    if (M('tp') && Math.random() < 0.5) u.tp = Math.min(10 + M('tpMax'), (u.tp || 0) + 1);
    if (M('vn')) u.vn = (u.vn || 0) >= 5 + M('vnMax') ? 1 : (u.vn || 0) + 1;
    u.qnHit = 1;
    if (u.ammo <= 0) {   // hết chưởng → điều khí; Tật Phong / Vô Ngã mất hết
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
    if (B.gateT <= 0) { B.gateT = 10; B.gate.hp = Math.min(B.gate.max, B.gate.hp + B.gate.max * gc); floater(60, H * 0.4, '+cổng', '#5dff8f', 14); }
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
    if (!u.clone) autoSkills(u, tgt, B.auto || u !== B.cap);
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
    } else if (e.x > GATE_X) {
      moveTo(e, GATE_X - 2, clamp(e.y, LANE_Y0, LANE_Y1), sp * dt);
    } else {
      e.walk = false;
      if (e.cdA <= 0) {
        e.cdA = 1 / getAspd(e); e.atkAnim = 0;
        B.gate.hp -= getAtk(e) * 0.7 * (e.boss ? 3 : 1);
        B.gateHurt = 0.15;
        particles(e.x - 20, e.y - 20, '#d9c6a0', 4, 90, 3);
      }
    }
  }
  separate(B.enemies.filter(e => !e.dead), 0);
  for (const e of B.enemies) { if (!e.dead) e.y = clamp(e.y, LANE_Y0 - 40, LANE_Y1 + 20); }   // giữ quái trong dải đường
  B.enemies = B.enemies.filter(e => !e.gone);
}
function bossSpecial(e, dt) {
  e.special -= dt;
  if (e.phase === 1 && e.hp < maxHp(e) * 0.5) {
    e.phase = 2;
    e.buffs.push({ k: 'aspd', v: 0.3, t: 9999 });
    B.banner = { text: 'Cửu Vĩ hiện nguyên hình!', sub: 'Boss mạnh hơn, gọi thêm tiểu yêu', t: 0, boss: true };
    for (let i = 0; i < 4; i++) B.enemies.push(makeEnemy('tieuyeu', B.st.lvl, clamp(e.x + rand(-120, 120), 30, W - 30), e.y + rand(-30, 30)));
    B.shake = 0.5;
  }
  if (e.special <= 0) {
    e.special = e.phase === 2 ? 4 : 5.5;
    e.castT = 0.6;
    const live = B.heroes.filter(h => !h.dead);
    if (!live.length) return;
    if (Math.random() < 0.5) {
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

function update(dt) {
  if (B.over) { updateFx(dt); if (B.endT != null && (B.endT -= dt) <= 0) { B.endT = null; showResult(); } return; }
  B.time += dt;
  while (B.spawnQ.length && B.spawnQ[0].at <= B.time) spawnEnemy(B.spawnQ.shift());
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
  } else if (!last && B.spawnQ.length === 0 && B.nextT == null && B.time - B.waveStart > 30) {
    B.nextT = B.time; // áp lực: đợt sau tới dù chưa dọn xong
  }
  if (B.nextT != null && B.time >= B.nextT && !B.over) nextWave();
  if (B.gate.hp <= 0) { B.gate.hp = 0; endBattle(false, 'Cổng thành đã vỡ'); }
  else if (!B.heroes.some(h => !h.dead && !h.clone)) endBattle(false, 'Cả đội đã trọng thương');
}

function endBattle(win, reason) {
  if (B.over) return;
  B.over = true; B.win = win; B.reason = reason || '';
  B.endT = win ? 1.2 : 1.0;
  B.stars = win ? 1 + (B.deaths === 0 ? 1 : 0) + (B.time <= B.st.par ? 1 : 0) : 0;
  B.reward = { ngoc: 0, vang: 0 };
  qAdd('fight'); if (win) qAdd('win'); qAdd('kill', B.kills || 0);
  if (win) {
    const first = !S.cleared[B.st.id];
    B.reward.ngoc = first ? B.st.reward.ngoc : Math.round(B.st.reward.ngoc * 0.2);
    B.reward.vang = first ? B.st.reward.vang : Math.round(B.st.reward.vang * 0.5);
    S.ngoc += B.reward.ngoc; S.vang += B.reward.vang;
    S.cleared[B.st.id] = Math.max(S.cleared[B.st.id] || 0, B.stars);
  } else {
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
      B.ghosts.push({ id: u.id, x: u.x + u.f * lunge, y: u.y, f: u.f, t: 0, st: rigState(u) });
    }
  }
  if (u.side === 'h' && u.dead && !hasSkel(u.id)) ctx.rotate(-1.35);   // rig xương có động tác ngã riêng
  if (u.side === 'h' && u.dead && hasSkel(u.id)) alpha = Math.max(0.35, 1 - (u.deathT || 0) * 0.8);
  const img = SPR[u.id];
  if (img) drawSprite(u, img, alpha);
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
    const T = 3.6, ph = ((u.t + (u.id.length * 0.37)) % T), a = ph < 1.6 ? 0 : ph < 1.9 ? (ph - 1.6) / 0.3 : ph < 3.3 ? 1 : 1 - (ph - 3.3) / 0.3;
    return ['idle', ph, a];
  }
  return null;
}
function drawPose(u, name, t, h, alpha) {
  const img = POSES[u.id][name], D = window.SKEL_DEFS && SKEL_DEFS[u.id]; if (!img || !D) return false;
  const k = h / D.H / 0.5, gx = D.gnd[0] * 0.5 * k, gy = D.gnd[1] * 0.5 * k;   // ảnh tư thế = hình gốc giảm nửa, đặt chân tại gốc xương root
  let sx = 1, sy = 1, rot = 0, ox = 0;
  if (name === 'windup') { sy = 1 - 0.04 * t; sx = 1 + 0.03 * t; ox = -6 * t; }
  else if (name === 'strike') { sx = 1.07 - 0.05 * t; sy = 0.97 + 0.02 * t; ox = 10 * (1 - t); }
  else if (name === 'skill') { rot = Math.sin(t * Math.PI * 6) * 0.05; sy = 1 + 0.02 * Math.sin(t * Math.PI * 2); }
  else if (name === 'ult') { sy = 1 + 0.012 * Math.sin(t * 9); }
  else if (name.startsWith('idle')) { sy = 1 + 0.014 * Math.sin(t * 2.6); sx = 1 - 0.006 * Math.sin(t * 2.6); }   // thở
  else if (name === 'hit') { ox = -9 * (1 - t); rot = -0.05 * (1 - t); }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(ox, 0); ctx.rotate(rot); ctx.scale(sx, sy);
  if (u.hurt > 0) ctx.filter = 'brightness(1.8) saturate(0.7)';
  ctx.drawImage(img, -gx, -gy, img.width * k, img.height * k);
  ctx.filter = 'none'; ctx.restore();
  return true;
}
function drawRigUnit(u, h, alpha) {
  const pz = poseFor(u);
  if (pz) {
    ctx.save(); ctx.scale(u.f * (FACE[u.id] || 1), 1); let ok;
    if (pz[0] === 'idle') {   // xen kẽ idle1 ↔ idle2 bằng chuyển mờ
      ok = drawPose(u, 'idle1', pz[1], h, alpha * (1 - pz[2] * 0.999)); drawPose(u, 'idle2', pz[1], h, alpha * pz[2]);
    } else ok = drawPose(u, pz[0], pz[1], h, alpha);
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
const hasSkel = id => typeof Skel !== 'undefined' && Skel.has(id) && !window.__noSkel;
const hasRig = id => hasSkel(id) || hasMesh(id) || hasLayered(id) || (typeof Rig !== 'undefined' && Rig.has(id));
// ưu tiên nhân vật tách lớp (Live2D) → rig bộ phận
// &chibi trên đường dẫn: nhân vật nào có bản chibi (art/mesh/<id>_chibi.js) thì dùng bản đó để so sánh
const meshId = id => (window.__chibi && typeof MeshRig !== 'undefined' && MeshRig.has(id + '_chibi')) ? id + '_chibi' : id;
function rigDraw(c, id, st, h, opt) {
  if (typeof Skel !== 'undefined' && Skel.has(id) && !window.__noSkel) return Skel.draw(c, id, st, h, opt);
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
  if (h.t > 0 && h.n >= 3) {   // "N Hits!" như Epic Seven
    ctx.save(); const k = Math.min(1, h.t / 1.4), pop = 1 + Math.max(0, (h.t - 1.25)) * 4;
    ctx.globalAlpha = Math.min(1, k * 2); ctx.translate(W - 112, 118); ctx.rotate(-0.06); ctx.scale(pop, pop);
    ctx.font = '800 30px Baloo 2, sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 6; ctx.strokeStyle = '#5a1a08'; ctx.fillStyle = '#ffc23a';
    const txt = h.n + ' Hits!'; ctx.strokeText(txt, 0, 0); ctx.fillText(txt, 0, 0); ctx.restore();
  }
}
function drawProj(p) {
  if (p.side === 'h' && !p.child && p.kind !== 'sword') {   // vệt đuôi sáng sau đạn (theo vận tốc), màu theo loại đạn
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
    case 'bone': { // móng xương
      ctx.rotate(a); ctx.fillStyle = '#f4ecd8'; ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(0, -5); ctx.lineTo(-14, -3); ctx.lineTo(-14, 3); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-15, -4, 3.5, 0, TAU); ctx.arc(-15, 4, 3.5, 0, TAU); ctx.fill(); break;
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
  if (f.k === 'sig') { if (f.t >= 0) VFX.draw(ctx, f); return; }
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
function drawDrop(d) {
  const y = d.y - 18 + Math.sin(d.t * 5) * 4;
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
  ctx.save(); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(e.x, y, r, r * 0.5, 0, a + k * TAU / 4, a + k * TAU / 4 + 0.9); ctx.stroke(); }
  ctx.restore();
}
const imgCache = {};
function imgOf(url) { if (!imgCache[url]) { const i = new Image(); i.src = url; imgCache[url] = i; } return imgCache[url]; }
function drawCutin() {
  const c = B.cutin, p = c.t;
  const a = p < 0.12 ? p / 0.12 : p > 0.6 ? Math.max(0, (0.8 - p) / 0.2) : 1;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(20,10,30,0.45)'; ctx.fillRect(0, 0, W, H);
  const y = 170;
  const g = ctx.createLinearGradient(0, y, W, y);
  g.addColorStop(0, '#ffcf3f'); g.addColorStop(0.5, '#ff7a2e'); g.addColorStop(1, '#c2185b');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, y + 20); ctx.lineTo(W, y - 20); ctx.lineTo(W, y + 150); ctx.lineTo(0, y + 190); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 8; i++) { const yy = y + 10 + i * 22; ctx.fillRect(((p * 900 + i * 130) % (W + 200)) - 200, yy, 160, 3); }
  const img = imgOf(fullImg(c.id, 200));
  const slide = Math.min(1, p / 0.18);
  if (img.complete && img.width) {
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
function drawBanner() {
  const b = B.banner, p = b.t;
  const a = p < 0.2 ? p / 0.2 : p > 1.4 ? Math.max(0, (1.8 - p) / 0.4) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const y = b.small ? 150 : 200;
  const sc = 1 + Math.max(0, 0.2 - p) * 2;
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  if (!b.small) {
    ctx.fillStyle = b.boss ? 'rgba(120,10,20,0.6)' : 'rgba(60,30,10,0.45)';
    ctx.fillRect(-W / 2, -38, W, 76);
  }
  ctx.font = `800 ${b.small ? 26 : 40}px "Baloo 2",sans-serif`;
  ctx.lineWidth = 7; ctx.strokeStyle = b.boss ? '#5a0a10' : '#5a2a10';
  ctx.strokeText(b.text, 0, b.sub ? -8 : 0);
  ctx.fillStyle = b.boss ? '#ffd0d0' : '#fff3b0'; ctx.fillText(b.text, 0, b.sub ? -8 : 0);
  if (b.sub) {
    ctx.font = '700 16px "Baloo 2",sans-serif'; ctx.lineWidth = 4; ctx.strokeText(b.sub, 0, 24);
    ctx.fillStyle = '#ffffff'; ctx.fillText(b.sub, 0, 24);
  }
  ctx.restore();
}
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  if (!B) { renderHome(); return; }
  ctx.save();
  if (B.shake > 0) ctx.translate(rand(-1, 1) * B.shake * 10, rand(-1, 1) * B.shake * 10);
  ctx.drawImage(B.bg, 0, 0, W, H);
  drawGateDamage();
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
  drawGhosts();
  for (const u of all) drawUnit(u);
  if (cap && !cap.dead) {
    const y = cap.y - 82 * sizeOf(cap) + Math.sin(B.time * 6) * 3;
    ctx.save(); ctx.beginPath(); ctx.moveTo(cap.x - 7, y - 9); ctx.lineTo(cap.x + 7, y - 9); ctx.lineTo(cap.x, y);
    ctx.closePath(); Art.fs(ctx, '#ffd34d', 2); ctx.restore();
  }
  for (const p of B.projs) drawProj(p);
  for (const f of B.fx) drawFx(f);
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
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(50,20,10,0.9)'; ctx.strokeText(f.txt, 0, 0);
    ctx.fillStyle = f.color; ctx.fillText(f.txt, 0, 0); ctx.restore();
  }
  ctx.restore();
  // boss bar
  const boss = B.enemies.find(e => e.boss && !e.dead);
  if (boss) {
    const w = W * 0.42, x = (W - w) / 2, y = 92;
    ctx.save(); ctx.font = '800 15px "Baloo 2",sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#3a0a10'; ctx.strokeText(boss.name + (boss.phase === 2 ? ' (Cuồng nộ)' : ''), W / 2, y - 6);
    ctx.fillStyle = '#ffd0d0'; ctx.fillText(boss.name + (boss.phase === 2 ? ' (Cuồng nộ)' : ''), W / 2, y - 6); ctx.restore();
    hpBar(x, y, w, 12, boss.hp / maxHp(boss), boss.phase === 2 ? '#ff2a5a' : '#ff5a2a', 0);
  }
  if (B.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, B.flash / 0.22) * 0.38; ctx.fillStyle = '#fff8e0'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  drawTargetMark();
  if (B.cutin) drawCutin();
  if (B.banner) drawBanner();
}

// Trang xem thử hoạt ảnh: #anim=ngokhong — 4 trạng thái cạnh nhau, cỡ lớn
let SHOW = null;
function renderShowcase() {
  if (!homeBg) homeBg = Art.background(W, H, 'forest', 7);
  ctx.drawImage(homeBg, 0, 0, W, H);
  ctx.fillStyle = 'rgba(255,248,225,0.55)'; ctx.fillRect(0, 0, W, H);
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
  const P = POSES[id], D = window.SKEL_DEFS && SKEL_DEFS[id], fake = { id, hurt: 0 };
  if (P && P.idle1 && P.idle2 && D) {
    const T = 3.6, ph = (t + i * 0.83) % T, a = ph < 1.6 ? 0 : ph < 1.9 ? (ph - 1.6) / 0.3 : ph < 3.3 ? 1 : 1 - (ph - 3.3) / 0.3;
    drawPose(fake, 'idle1', ph, h, 1 - a * 0.999); drawPose(fake, 'idle2', ph, h, a); return true;
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
function frame(now) {
  let dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  homeT += dt;
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
function showHome() {
  B = null;
  ensureHeroAssets(S.lineup.filter(id => S.owned[id]));   // nạp tư thế để tướng ở trang chủ có dáng đứng riêng
  const cap = S.lineup.find(id => S.owned[id]), nf = STAGES.findIndex(st => !S.cleared[st.id]), nx = STAGES[nf < 0 ? STAGES.length - 1 : nf];
  const dq0 = dq(), qDot = DAILY.some(q => (dq0.p[q.id] || 0) >= q.need && !dq0.c[q.id]), ir = idleReward();
  ui.innerHTML = `<div class="screen home2">
    <div class="hm-top">
      <div class="hm-avatar">${cap ? `<img src="${por(cap, 60)}">` : ''}</div>
      <div class="hm-who"><b>Chấp Bảng Sứ</b><small>Lực chiến ${fmt(totalPower())}</small></div>
      ${resBar()}
    </div>
    <div class="hm-logo"><span class="l1">THẦN TIÊN</span><span class="l2">ĐẠI CHIẾN</span></div>
    <div class="hm-left">
      <button class="hm-ic" id="hQuest"><img src="art/ui/ic_quest.webp">${qDot ? '<i class="dot"></i>' : ''}<span>Nhiệm Vụ</span></button>
      <button class="hm-ic" id="hGift"><img src="art/ui/ic_gift.webp"><span>Tân Thủ</span></button>
    </div>
    <button class="hm-idle" id="hIdle"><img src="art/ui/ic_chest.webp">${ir.m >= 1 ? '<i class="dot"></i>' : ''}<b>Treo máy</b><small>${icon('vang')}${fmt(ir.vang)}</small></button>
    <button class="hm-battle" id="hFight"><img src="art/ui/ic_battle.webp"><b>Chiến Dịch</b><small>Ải ${nx.id} · ${esc(nx.name)}</small></button>
    <nav class="hm-nav">
      <button id="hHeroes"><img src="art/ui/ic_hero.webp"><span>Hiệp Khách</span></button>
      <button id="hLineup"><img src="art/ui/ic_team.webp"><span>Đội Hình</span></button>
      <button id="hGacha"><img src="art/ui/ic_summon.webp"><span>Chiêu Mộ</span></button>
      <button id="hBt"><img src="art/ui/ic_book.webp"><span>Tàng Kinh</span></button>
    </nav>
    <button class="link hm-reset" id="hReset">Xoá dữ liệu chơi thử</button>
    ${(!IS_APP && IS_IOS && !S.a2hs) ? '<div class="a2hs" id="a2hs">Để chơi full màn hình: bấm <b>Chia sẻ</b> ⬆ rồi <b>Thêm vào MH chính</b>. <u>Đóng</u></div>' : ''}
  </div>`;
  const ah = $('#a2hs'); if (ah) ah.onclick = () => { S.a2hs = 1; save(); ah.remove(); };
  $('#hFight').onclick = showStages;
  $('#hLineup').onclick = showLineup;
  $('#hGacha').onclick = showGacha;
  $('#hHeroes').onclick = showHeroes;
  $('#hQuest').onclick = showQuests; $('#hBt').onclick = showTangKinh; $('#hIdle').onclick = claimIdle;
  $('#hGift').onclick = () => toast('Quà tân thủ: sắp có');
  $('#hReset').onclick = () => {
    if (confirm('Xoá toàn bộ tiến độ chơi thử?')) { S = defaultSave(); save(); showHome(); }
  };
}
function topBar(title) {
  return `<div class="topbar-menu"><button class="btn small back" id="bBack">‹ Về</button><h2>${title}</h2>${resBar()}</div>`;
}

let curChap = -1;
function showStages() {
  if (curChap < 0) { const f = STAGES.findIndex(st => !S.cleared[st.id]); curChap = f < 0 ? CHAPTERS.length - 1 : STAGES[f].chap; }
  const done = c => STAGES.filter(st => st.chap === c && S.cleared[st.id]).length;
  const open = c => c === 0 || done(c - 1) >= 10;
  const ch = CHAPTERS[curChap];
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Chương ' + ch.id + ' · ' + ch.name)}
    <div class="chap-tabs">${CHAPTERS.map((c, i) => `<button class="btn small ${i === curChap ? 'gold' : ''}" data-ch="${i}" ${open(i) ? '' : 'disabled'}>${open(i) ? c.id : '🔒'} ${esc(c.name)} <small>${done(i)}/10</small></button>`).join('')}</div>
    <p class="chap-story">${esc(ch.story)} <b>Boss: ${esc(ch.boss)}</b> · <i>${esc(ch.mech)}</i></p>
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
    return `<div class="syn ${on ? 'on' : ''}"><b>${b.name}</b> <small>${b.members.map(m => HEROES[m].name).join(' + ')}</small>${on ? `<em>${b.desc}</em>` : ''}</div>`;
  }).join('');
  return `<h4>Cộng hưởng phe</h4>${facs || '<small>Chưa có</small>'}<h4>Duyên phận</h4>${bonds}`;
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
    <p class="hint">Đội trưởng ra trận đầu tiên và được +15% tốc đánh, +15% hồi nội công. Các tướng khác ra trận theo thứ tự khi nhặt Linh Phù.</p>
    <div class="lineup-body">
      <div class="pick-grid">${owned.map(id => `
        <button class="pick ${lu.includes(id) ? 'in' : ''}" data-pick="${id}">
          <img src="${por(id, 80)}">${rarTag(HEROES[id].rar)}<b>${esc(HEROES[id].name)}</b>
          <small>${ROLES[HEROES[id].role].name} · ${FACTIONS[HEROES[id].fac]}</small></button>`).join('')}</div>
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
function showHeroes() {
  const ids = Object.keys(HEROES).sort((a, b) => (S.owned[b] ? 1 : 0) - (S.owned[a] ? 1 : 0) || (HEROES[a].rar < HEROES[b].rar ? 1 : -1));
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Hiệp Khách')}
    <div class="hero-grid">${ids.map(id => {
      const h = HEROES[id], o = S.owned[id];
      return `<button class="hcard ${o ? '' : 'locked'} r-${h.rar}" data-h="${id}">
        <img src="${por(id, 110)}">${rarTag(h.rar)}
        <div class="hc-info"><b>${esc(h.name)}</b><small>${ROLES[h.role].name} · ${ELEMENTS[h.el].name}</small>
        ${o ? `<span class="lv">Lv${o.lv} ${starsHTML(o.star, 5)}</span>` : '<span class="lv">Chưa có</span>'}</div></button>`;
    }).join('')}</div></div>`;
  $('#bBack').onclick = showHome;
  ui.querySelectorAll('[data-h]').forEach(b => b.onclick = () => showHeroDetail(b.dataset.h));
}
function showHeroDetail(id) {
  const h = HEROES[id], o = S.owned[id];
  const st = heroStats(id);
  const lvCost = o ? 150 * o.lv : 0;
  const starNeed = o && o.star < 5 ? STAR_COST[h.rar][o.star - 1] : 0;
  const bonds = BONDS.filter(b => b.members.includes(id));
  ui.innerHTML = `<div class="screen panel-screen">${topBar('Hiệp Khách')}
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
        ${bonds.map(b => `<div class="skill bond"><span class="sk-kind">Duyên phận</span><b>${esc(b.name)}</b><p>${esc(b.desc)}</p></div>`).join('')}
      </div>
      ${o ? `<div class="det-actions">
        <button class="btn gold" id="bLv" ${o.lv >= MAX_LV ? 'disabled' : ''}>Nâng cấp<small>${icon('vang')}${fmt(lvCost)}</small></button>
        <button class="btn red" id="bStar" ${o.star >= 5 ? 'disabled' : ''}>Tăng sao<small>Mảnh ${o.shard}/${starNeed || '-'} · vạn năng ${S.univ}</small></button>
      </div>` : ''}
    </div></div>`;
  $('#bBack').onclick = showHeroes;
  if (!o) return;
  $('#bLv').onclick = () => {
    if (S.vang < lvCost) { toast('Không đủ vàng'); return; }
    S.vang -= lvCost; o.lv++; qAdd('lv'); save(); showHeroDetail(id);
  };
  $('#bStar').onclick = () => {
    const have = o.shard + S.univ;
    if (have < starNeed) { toast('Chưa đủ mảnh'); return; }
    const useOwn = Math.min(o.shard, starNeed);
    o.shard -= useOwn; S.univ -= starNeed - useOwn; o.star++; save(); showHeroDetail(id);
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
  if (rar === 'R') { S.univ += 2; return { rar, id: null }; }
  const bn = BANNERS[S.gb || 0], feat = rar === 'SSR' && bn.feat.length && Math.random() < 0.5;
  const id = feat ? pick(bn.feat) : pick(rar === 'SSR' ? SSR_POOL : SR_POOL);
  if (S.owned[id]) { S.owned[id].shard += DUP_SHARDS[rar]; return { rar, id, dup: DUP_SHARDS[rar] }; }
  S.owned[id] = newRec();
  if (S.lineup.length < 5) S.lineup.push(id);
  return { rar, id, isNew: true };
}
function showGacha() {
  ui.innerHTML = `<div class="screen panel-screen gacha">${topBar('Chiêu Mộ Hiệp Khách')}
    <div class="chap-tabs">${BANNERS.map((b, i) => `<button class="btn small ${i === (S.gb || 0) ? 'gold' : ''}" data-gb="${i}">${b.name}</button>`).join('')}</div>
    <div class="banner-art">
      ${(() => { const bn = BANNERS[S.gb || 0], f = bn.feat.length ? bn.feat : ['nata', 'datky', 'ngumavuong']; return `<img class="ba-main" src="${fullImg(f[0], 220)}"><img class="ba-l" src="${fullImg(f[1], 150)}"><img class="ba-r" src="${fullImg(f[2], 150)}"><div class="ba-text"><span>${bn.name}</span><small>${bn.desc} · bảo hiểm 80 lượt</small></div>`; })()}
    </div>
    <div class="pity">
      <div>Đã quay <b>${S.pity}</b>/${GACHA.hard} lượt kể từ SSR gần nhất${S.pity >= GACHA.softFrom ? ' · <em>tỉ lệ đang tăng</em>' : ''}</div>
      <div class="bar"><i style="width:${S.pity / GACHA.hard * 100}%"></i></div>
      <small>Từ lượt ${GACHA.softFrom} mỗi lượt +5% tỉ lệ SSR. Mỗi 10 lượt chắc chắn có SR trở lên. R đổi thành 2 mảnh vạn năng.</small>
    </div>
    <div class="pool">${[...SSR_POOL, ...SR_POOL].map(id => `<div class="pool-i ${S.owned[id] ? 'own' : ''}"><img src="${por(id, 60)}">${rarTag(HEROES[id].rar)}</div>`).join('')}</div>
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
function showHUD() {
  ui.innerHTML = `<div class="hud">
    <div id="pad"></div>
    <div class="hud-top">
      <div class="ht-stage"><b>${B.st.id}</b> ${esc(B.st.name)}</div>
      <div class="ht-wave" id="hWave"></div>
      <div class="ht-time" id="hTime">0:00</div>
      <div class="ht-lv"><b id="hLv">Cấp 1</b><span class="bar"><i id="hXp"></i></span></div>
      <div class="gate-bar"><span>Cổng Tây Kỳ</span><div class="bar"><i id="hGate"></i></div></div>
      <button class="tool" id="bAuto">Tự động</button>
      <button class="tool" id="bSpeed">x1</button>
      <button class="btn-icon" id="bPause" title="Tạm dừng (P)">❚❚</button>
    </div>
    <div class="cp-owned" id="cpOwned"></div>
    <div class="hint-tap" id="hintTap">Chạm vào quái để đội trưởng nhắm đánh · Chạm thẻ tướng để tung tuyệt kỹ</div>
    <div class="team" id="teamBar"></div>
  </div>`;
  const pad = $('#pad');
  pad.addEventListener('pointerdown', e => { tapTarget(logical(e)); const h = $('#hintTap'); if (h) h.remove(); });
  $('#bPause').onclick = openPause;
  $('#bAuto').onclick = () => { B.auto = !B.auto; $('#bAuto').classList.toggle('on', B.auto); };
  $('#bSpeed').onclick = () => { B.speed = B.speed === 1 ? 2 : 1; $('#bSpeed').textContent = 'x' + B.speed; $('#bSpeed').classList.toggle('on', B.speed > 1); };
  buildTeamBar();
  renderCpList();
}
let hudCap = null;
function buildTeamBar() {
  const bar = $('#teamBar');
  if (!bar || !B) return;
  const deployed = B.heroes.filter(h => !h.clone);
  const list = [...deployed, ...B.deploy];
  bar.innerHTML = list.map((u, i) => `<button class="tm" data-tm="${i}" title="${esc(u.d.ult.name)} (phím ${i + 1})">
      <img src="${porB(u.id, 64)}"><span class="tm-key">${i + 1}</span><span class="tm-trong"></span><span class="tm-ammo"></span><span class="tm-hp"><i></i></span><span class="tm-mp"><i></i></span>
      <span class="tm-state"></span><span class="tm-ult">${esc(u.d.ult.name)}</span></button>`).join('');
  B.teamList = list;
  bar.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => heroUlt(+b.dataset.tm));
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
  const t = Math.floor(B.time);
  $('#hTime').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  $('#hTime').classList.toggle('over', B.time > B.st.par);
  $('#hGate').style.width = (B.gate.hp / B.gate.max * 100) + '%';
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
    el.querySelector('.tm-mp i').style.width = u.mp + '%';
    el.querySelector('.tm-state').textContent = u.dead ? 'Ngã' : waiting ? 'Chờ' : u.dk > 0 ? 'Điều khí' : '';
    el.classList.toggle('ready', !waiting && canCast(u, 'ult'));
    el.querySelector('.tm-ammo').textContent = waiting || u.dead || u.dk > 0 ? '' : (u.ammo == null ? ammoMax(u) : u.ammo);
    el.querySelector('.tm-trong').textContent = 'Tầng ' + trongOf(u);
  });
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
    <button class="btn" id="pRetry">Đánh lại</button>
    <button class="btn red" id="pQuit">Rời trận</button>`;
  ui.appendChild(wrap);
  $('#pRes').onclick = () => { wrap.remove(); B.paused = false; lastT = performance.now(); };
  $('#pRetry').onclick = () => { const si = B.si; wrap.remove(); enterStage(si); };
  $('#pQuit').onclick = () => { wrap.remove(); showStages(); B = null; };
}
function showResult() {
  const win = B.win;
  const wrap = document.createElement('div');
  wrap.className = 'modal result-modal ' + (win ? 'win' : 'lose');
  const t = Math.floor(B.time);
  const next = win && B.si < STAGES.length - 1;
  wrap.innerHTML = `<div class="res-title">${win ? 'Chiến Thắng' : 'Thất Bại'}</div>
    ${win ? `<div class="res-stars">${[0, 1, 2].map(i => `<span class="${i < B.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">★</span>`).join('')}</div>
      <ul class="res-cond"><li class="on">Qua ải</li><li class="${B.deaths === 0 ? 'on' : ''}">Không tướng nào ngã</li><li class="${B.time <= B.st.par ? 'on' : ''}">Dưới ${B.st.par} giây (${t}s)</li></ul>`
      : `<p class="res-reason">${esc(B.reason)}</p><p class="hint">Gợi ý: nâng cấp tướng, đổi đội trưởng, hoặc nhặt Linh Phù sớm để gọi đủ đội.</p>`}
    <div class="res-team">${B.ids.map(id => `<img src="${por(id, 56)}">`).join('')}</div>
    <div class="res-rew">${B.reward.ngoc ? `<span>${icon('ngoc')}+${fmt(B.reward.ngoc)}</span>` : ''}<span>${icon('vang')}+${fmt(B.reward.vang)}</span><span>Hạ ${B.kills} quái</span></div>
    <div class="res-btns">
      <button class="btn" id="rHome">Về sảnh</button>
      <button class="btn red" id="rRetry">Đánh lại</button>
      ${next ? '<button class="btn gold" id="rNext">Ải tiếp</button>' : ''}
    </div>`;
  ui.appendChild(wrap);
  const si = B.si;
  $('#rHome').onclick = () => { B = null; showHome(); };
  $('#rRetry').onclick = () => enterStage(si);
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
function enterStage(si) { if (tkSpend(tkCost(STAGES[si]))) startBattle(si); }

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
  { name: 'Tân Binh Hạ Giới', feat: ['duongtien', 'vantieu', 'thailaoquan'], desc: 'Tăng 50% tỉ lệ khi ra SSR: Dương Tiễn · Vân Tiêu · Thái Thượng Lão Quân' },
];

// ------------------------------------------------------------------ BOOT
// Đường dẫn nhanh: #battle=1 (vào ải 1, bật tự động), #gacha, #heroes, #lineup, #stages, #hero=nata
function route() {
  const h = (location.hash || '').slice(1);
  window.__chibi = !/(^|&)anime(&|$)/.test(h);   // trong trận mặc định dùng chibi; thêm &anime để xem bản anime
  const [main, simPart] = h.split('&').filter(x => x !== 'chibi').concat([undefined]);
  const [k, v] = main.split('=');
  if (k === 'battle') {
    const tm = h.match(/(?:^|&)team=([\w,]+)/); // &team=nata,quanam (chụp thử): đội hình tạm
    if (tm) { const ids = tm[1].split(',').filter(id => HEROES[id]); ids.forEach(id => { if (!S.owned[id]) S.owned[id] = newRec(); }); S.lineup = ids; }
    ensureHeroAssets(S.lineup).then(() => {
    startBattleNow(clamp((+v || 1) - 1, 0, STAGES.length - 1));
    if (B) {
      B.auto = true; const b = $('#bAuto'); if (b) b.classList.add('on');
      // &sim=20: tua nhanh 20 giây (dùng để chụp ảnh thử)
      const secs = simPart && simPart.startsWith('sim=') ? +simPart.slice(4) : 0;
      for (let i = 0; i < secs * 60 && !B.over; i++) {
        update(1 / 60);
        if (B.paused) { const m = ui.querySelector('.cp-modal'); const b = m && m.querySelector('.cp-card'); if (b) b.click(); else B.paused = false; }
      }
      if (secs) { B.banner = null; B.cutin = null; updateHUD(); }
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
      const um = h.match(/(?:^|&)ult=(\w+):([\d.]+)/);
      if (um) {
        const u = B.heroes.find(x => x.id === um[1] && !x.dead);
        if (u) { u.mp = 100; u.cdU = 0; u.stun = 0; u.dk = 0; cast(u, 'ult'); for (let i = 0; i < +um[2] * 60; i++) update(1 / 60); }
      }
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
  else if (k === 'quests') showQuests();
  else if (k === 'tangkinh') showTangKinh();
  else if (k === 'heroes') showHeroes();
  else if (k === 'hero' && HEROES[v]) showHeroDetail(v);
  else if (k === 'lineup') showLineup();
  else if (k === 'stages') showStages();
  else showHome();
}
loadArt().then(() => {
  route();
  requestAnimationFrame(t => { lastT = t; frame(t); });
});

// Cho phép chạy thử tự động (không ảnh hưởng game)
window.__TTDC = { startBattle, update, get B() { return B; }, get S() { return S; }, pullOne, cast, openCongPhap, applyPick, CONGPHAP };
})();
