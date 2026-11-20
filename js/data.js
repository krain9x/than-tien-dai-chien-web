'use strict';
// =====================================================================
// Dữ liệu game — lấy từ GDD "Game thẻ tướng Tây Du x Phong Thần".
// Mọi con số là giá trị khởi điểm để cân bằng lại khi thử nghiệm.
// =====================================================================

const ELEMENTS = {
  kim:  { name: 'Kim',  color: '#f2b705' },
  moc:  { name: 'Mộc',  color: '#3fb950' },
  thuy: { name: 'Thủy', color: '#3d9bff' },
  hoa:  { name: 'Hỏa',  color: '#ff5a36' },
  tho:  { name: 'Thổ',  color: '#c0843d' },
};
// Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim
const BEATS = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' };

const ROLES = {
  the:  { name: 'Thể',  color: '#e0a526', desc: 'Đỡ đòn' },
  phap: { name: 'Pháp', color: '#4f7cff', desc: 'Sát thương diện rộng' },
  dan:  { name: 'Đan',  color: '#2fbf71', desc: 'Hồi máu' },
  sat:  { name: 'Sát',  color: '#ff3d5a', desc: 'Sát thương đơn mục tiêu' },
  tran: { name: 'Trận', color: '#a35cff', desc: 'Hỗ trợ, khống chế' },
};

const FACTIONS = {
  xien: 'Xiển giáo', triet: 'Triệt giáo', thien: 'Thiên đình',
  phat: 'Phật môn', yeu: 'Yêu giới', nhan: 'Nhân gian',
  dao: 'Đạo môn', nguyet: 'Nguyệt cung', quy: 'Quỷ giới',
};
// Cộng hưởng phe: [số người, % chỉ số]
const FACTION_TIERS = [[5, 0.25], [4, 0.15], [3, 0.08]];

const STAR_MUL = [1, 1.15, 1.3225, 1.587, 1.984];
const STAR_COST = { SSR: [10, 20, 30, 50], SR: [5, 10, 20, 40] };
const DUP_SHARDS = { SSR: 10, SR: 5 };
const MAX_LV = 30;

// ---------------------------------------------------------------------
// Tướng. fx: danh sách hiệu ứng mà chiêu thức tạo ra (xem runFx trong main.js)
// ---------------------------------------------------------------------
const HEROES = {
  ngokhong: {
    name: 'Tôn Ngộ Không', title: 'Tề Thiên Đại Thánh', src: 'Tây Du Ký',
    role: 'sat', el: 'kim', fac: 'yeu', rar: 'SSR',
    hp: 1500, atk: 160, def: 60, aspd: 1.3, range: 52, move: 165,
    look: { style: 'monkey', skin: '#ffe0bd', hair: '#c8782f', outfit: '#e8473c', outfit2: '#ffd34d',
            belt: '#ffd34d', pants: '#f2a33a', weapon: 'staff', wcolor: '#ffcf3f', tail: true },
    tang: [{ d: 'Sóng gậy ST +25%, rộng hơn', m: { atk: 0.25, size: 0.3 } }, { d: 'Kim Cô Bổng (chiêu nhỏ) ST +40%', m: { skill: 0.40 } }, { d: 'Sóng gậy bắn 2 luồng', m: { proj: 1 } }, { d: 'Thất Thập Nhị Biến ST +60%, phân thân +3 giây', m: { ult: 0.60, cloneDur: 3 } }],
    passive: { name: 'Hỏa Nhãn Kim Tinh', desc: '+15% tỉ lệ bạo kích.', crit: 0.15 },
    small: { name: 'Kim Cô Bổng', desc: 'Phóng gậy đập xuống chỗ quái đông nhất, 200% công.',
             fx: [{ t: 'aoe', at: 'cluster', r: 95, mult: 2.0, color: '#ffd34d' }] },
    ult: { name: 'Thất Thập Nhị Biến', desc: 'Kim Cô Bổng khổng lồ giáng xuống chỗ quái đông nhất 520% công, tạo 2 phân thân 7 giây.',
           fx: [{ t: 'aoe', at: 'cluster', r: 150, mult: 5.2, color: '#ffd34d' }, { t: 'clone', n: 2, dur: 7 }] },
  },
  nata: {
    name: 'Na Tra', title: 'Tam Thái Tử', src: 'Phong Thần / Tây Du',
    role: 'sat', el: 'hoa', fac: 'xien', rar: 'SSR',
    hp: 1400, atk: 165, def: 55, aspd: 1.0, range: 150, move: 160, ranged: true, proj: 'ring',
    look: { style: 'buns', skin: '#ffe3c8', hair: '#2b2230', outfit: '#ff5a5f', outfit2: '#ffe08a',
            belt: '#ffd34d', pants: '#ffb3a7', weapon: 'spear', wcolor: '#ffb02e', sash: true },
    tang: [{ d: 'Vòng Càn Khôn ST +25%', m: { atk: 0.25 } }, { d: 'Càn Khôn Quyển ném thêm 2 vòng', m: { skillN: 2 } }, { d: 'Vòng Càn Khôn xuyên thấu', m: { pierce: 1 } }, { d: 'Tam Đầu Lục Tý ST +60%', m: { ult: 0.60 } }],
    passive: { name: 'Liên Hoa Thân', desc: 'Dưới 50% máu được +15% công.', lowHpAtk: 0.15 },
    small: { name: 'Càn Khôn Quyển', desc: 'Ném 3 vòng xuyên thấu, mỗi vòng 160% công.',
             fx: [{ t: 'proj', n: 3, spread: 0.18, mult: 1.6, pierce: true, type: 'ring' }] },
    ult: { name: 'Tam Đầu Lục Tý', desc: 'Phóng Hỏa Tiêm Thương thành đường lửa xuyên sân 600% công, cháy thêm 200%.',
           fx: [{ t: 'line', len: 760, w: 90, mult: 6.0, burn: true, color: '#ff7a2e' }] },
  },
  ngumavuong: {
    name: 'Ngưu Ma Vương', title: 'Bình Thiên Đại Thánh', src: 'Tây Du Ký',
    role: 'the', el: 'tho', fac: 'yeu', rar: 'SSR',
    hp: 3200, atk: 95, def: 130, aspd: 0.8, range: 50, move: 135,
    look: { style: 'bull', skin: '#b08068', hair: '#2d2420', outfit: '#4b3a55', outfit2: '#c9a227',
            belt: '#c9a227', pants: '#3a2c3a', weapon: 'club', cape: '#a3262a', size: 1.12 },
    tang: [{ d: 'Tảng đá ST +25%, nổ lan nhỏ', m: { atk: 0.25, splash: 50 } }, { d: 'Xung Phá choáng +0,5 giây, khiên +10%', m: { skill: 0.30, stunPlus: 0.5 } }, { d: 'Máu +30%', m: { hp: 0.30 } }, { d: 'Hỗn Thế Ma Vương ST +60%, khiên đội +8%', m: { ult: 0.60 } }],
    passive: { name: 'Ma Vương Giáp', desc: 'Giảm 10% sát thương nhận.', dr: 0.10 },
    small: { name: 'Thần Ngưu Xung Phá', desc: 'Ném tảng đá vào chỗ quái đông nhất 140% công, choáng 1 giây; bản thân nhận khiên 15% máu.',
             fx: [{ t: 'aoe', at: 'cluster', r: 110, mult: 1.4, stun: 1.0, color: '#e0a526' },
                  { t: 'shield', who: 'self', pct: 0.15, dur: 5 }] },
    ult: { name: 'Hỗn Thế Ma Vương', desc: 'Hồn trâu gầm: 380% công vùng lớn, quái gần bị khiêu khích 4 giây, cả đội nhận khiên 12% máu.',
           fx: [{ t: 'aoe', at: 'cluster', r: 170, mult: 3.8, color: '#e0a526' }, { t: 'taunt', r: 260, dur: 4 },
                { t: 'shield', who: 'team', pct: 0.12, dur: 6 }] },
  },
  quanam: {
    name: 'Quan Âm', title: 'Nam Hải Bồ Tát', src: 'Tây Du Ký',
    role: 'dan', el: 'thuy', fac: 'phat', rar: 'SSR',
    hp: 1700, atk: 120, def: 70, aspd: 0.9, range: 175, move: 145, ranged: true, proj: 'light',
    look: { style: 'veil', skin: '#fff1e6', hair: '#2b2230', outfit: '#ffffff', outfit2: '#b6e3ff',
            belt: '#ffd34d', weapon: 'vase', halo: true, robe: true, eyes: 'closed' },
    tang: [{ d: 'Hồi máu +25%', m: { heal: 0.25 } }, { d: 'Cam Lộ hồi thêm 3% máu cổng', m: { gateHeal: 0.03 } }, { d: 'Chưởng Tịnh Quang hồi 2% máu đồng đội yếu nhất', m: { hitHeal: 0.02 } }, { d: 'Tịnh Bình Dương Liễu hồi +60%', m: { ult: 0.60, heal: 0.20 } }],
    passive: { name: 'Từ Bi', desc: '+15% lượng hồi máu.', healPct: 0.15 },
    small: { name: 'Cam Lộ', desc: 'Rưới nước cam lộ hồi máu cả đội bằng 200% công.',
             fx: [{ t: 'heal', mult: 2.0 }] },
    ult: { name: 'Tịnh Bình Dương Liễu', desc: 'Hồi máu cả đội 500% công, giải khống chế, thêm khiên 10% máu.',
           fx: [{ t: 'heal', mult: 5.0, cleanse: true }, { t: 'shield', who: 'team', pct: 0.10, dur: 5 }] },
  },
  datky: {
    name: 'Đát Kỷ', title: 'Cửu Vĩ Hồ Ly', src: 'Phong Thần Diễn Nghĩa',
    role: 'phap', el: 'hoa', fac: 'yeu', rar: 'SSR',
    hp: 1300, atk: 170, def: 50, aspd: 0.85, range: 200, move: 150, ranged: true, proj: 'foxfire',
    look: { style: 'fox', skin: '#ffe6dc', hair: '#c86bff', outfit: '#ff7ac4', outfit2: '#ffd1ec',
            belt: '#ffd34d', weapon: 'orb', wcolor: '#ff5fd2', tails: 3, robe: true },
    tang: [{ d: 'Hồ hỏa ST +25%', m: { atk: 0.25 } }, { d: 'Hồ Hỏa bắn thêm 2 ngọn', m: { skillN: 2 } }, { d: 'Chưởng hồ hỏa 20% mê hoặc 1 giây', m: { stunHit: 0.20 } }, { d: 'Mị Hoặc Thiên Hạ ST +60%, vùng lớn hơn', m: { ult: 0.60, size: 0.3 } }],
    passive: { name: 'Hồ Mị', desc: '+15% sát thương chiêu thức.', skillPct: 0.15 },
    small: { name: 'Hồ Hỏa', desc: 'Bắn 5 ngọn hồ hỏa hình quạt, mỗi ngọn 160% công.',
             fx: [{ t: 'proj', n: 5, spread: 0.4, mult: 1.6, type: 'foxfire' }] },
    ult: { name: 'Mị Hoặc Thiên Hạ', desc: 'Mê hoặc chỗ quái đông nhất: 400% công, đứng yên 2 giây.',
           fx: [{ t: 'aoe', at: 'cluster', r: 170, mult: 4.0, stun: 2.0, color: '#ff5fd2' }] },
  },
  batgioi: {
    name: 'Trư Bát Giới', title: 'Thiên Bồng Nguyên Soái', src: 'Tây Du Ký',
    role: 'the', el: 'tho', fac: 'phat', rar: 'SR',
    hp: 2800, atk: 100, def: 110, aspd: 0.9, range: 55, move: 135,
    look: { style: 'pig', skin: '#ffb7c5', hair: '#3a2a2a', outfit: '#3b7dd8', outfit2: '#ffd34d',
            belt: '#ffd34d', pants: '#2b5fa8', weapon: 'rake', size: 1.08 },
    tang: [{ d: 'Sóng đinh ba ST +25%', m: { atk: 0.25 } }, { d: 'Cửu Xỉ Đinh Ba ST +40%, đẩy lùi xa hơn', m: { skill: 0.40 } }, { d: 'Hồi máu mỗi giây gấp đôi', m: { regen: 0.01 } }, { d: 'Thiên Bồng Giáng Thế ST +60%', m: { ult: 0.60 } }],
    passive: { name: 'Da Dày Thịt Béo', desc: 'Hồi 1% máu mỗi giây.', regen: 0.01 },
    small: { name: 'Cửu Xỉ Đinh Ba', desc: 'Sóng đinh ba đánh chỗ quái đông nhất 170% công, đẩy lùi kẻ địch.',
             fx: [{ t: 'aoe', at: 'cluster', r: 100, mult: 1.7, knock: 45, color: '#7fb3ff' }] },
    ult: { name: 'Thiên Bồng Giáng Thế', desc: 'Đinh ba Thiên Hà đập trước mặt 320% công, khiêu khích 3 giây, nhận khiên 25% máu.',
           fx: [{ t: 'aoe', at: 'front', r: 150, mult: 3.2, color: '#7fb3ff' }, { t: 'taunt', r: 240, dur: 3 },
                { t: 'shield', who: 'self', pct: 0.25, dur: 6 }] },
  },
  duongtang: {
    name: 'Đường Tăng', title: 'Kim Thiền Tử', src: 'Tây Du Ký',
    role: 'tran', el: 'tho', fac: 'phat', rar: 'SR',
    hp: 1500, atk: 100, def: 70, aspd: 0.8, range: 170, move: 140, ranged: true, proj: 'bead',
    look: { style: 'bald', skin: '#ffe6cf', hair: '#2b2230', outfit: '#ffcf4a', outfit2: '#e8473c',
            belt: '#e8473c', pants: '#f3e3c0', weapon: 'khakkhara', wcolor: '#e6b422', robe: true },
    tang: [{ d: 'Tràng hạt ST +25%', m: { atk: 0.25 } }, { d: 'Tụng Kinh +10 nội công, tốc đánh +10%', m: { skill: 0.30, mpPlus: 10 } }, { d: 'Tràng hạt nảy sang 1 mục tiêu', m: { bounce: 1 } }, { d: 'Khẩn Cô Chú ST +60%, choáng +0,5 giây', m: { ult: 0.60, stunPlus: 0.5 } }],
    passive: { name: 'Kim Thiền Tử', desc: 'Khi còn sống, cả đội +10% hồi nội công.', teamMp: 0.10 },
    small: { name: 'Tụng Kinh', desc: 'Cả đội +20 nội công và +20% tốc đánh trong 5 giây.',
             fx: [{ t: 'mp', v: 20 }, { t: 'buff', k: 'aspd', v: 0.20, dur: 5 }] },
    ult: { name: 'Khẩn Cô Chú', desc: 'Niệm chú: 200% công, choáng vùng lớn 2 giây; cả đội +25% công 6 giây.',
           fx: [{ t: 'aoe', at: 'cluster', r: 180, mult: 2.0, stun: 2.0, color: '#ffd34d' },
                { t: 'buff', k: 'atk', v: 0.25, dur: 6 }] },
  },
  honghainhi: {
    name: 'Hồng Hài Nhi', title: 'Thánh Anh Đại Vương', src: 'Tây Du Ký',
    role: 'phap', el: 'hoa', fac: 'yeu', rar: 'SR',
    hp: 1250, atk: 150, def: 50, aspd: 0.9, range: 190, move: 155, ranged: true, proj: 'fire',
    look: { style: 'kid', skin: '#ffd9c2', hair: '#ff4a3d', outfit: '#ff3b30', outfit2: '#ffd34d',
            belt: '#ffd34d', pants: '#ffe7c2', weapon: 'firespear', wcolor: '#ff7a2e', size: 0.92 },
    tang: [{ d: 'Hỏa cầu ST +25%', m: { atk: 0.25 } }, { d: 'Tam Muội Chân Hỏa vùng rộng +30%, kéo dài +1 giây', m: { skill: 0.30, size: 0.3 } }, { d: 'Đòn thường luôn gây cháy', m: { burnAll: 1 } }, { d: 'Hỏa Vân Động ST +60%', m: { ult: 0.60 } }],
    passive: { name: 'Hỏa Hài Nhi', desc: 'Đòn đánh thường 50% gây cháy 2 giây (20% công/giây).', burnHit: 0.5 },
    small: { name: 'Tam Muội Chân Hỏa', desc: 'Vùng lửa 3 giây ở chỗ quái đông nhất, mỗi giây 55% công (vùng mới thay vùng cũ).',
             fx: [{ t: 'zone', at: 'cluster', r: 90, dps: 0.55, dur: 3, color: '#ff6a2a' }] },
    ult: { name: 'Hỏa Vân Động', desc: 'Biển lửa 200% công rồi cháy 4 giây, mỗi giây 65% công.',
           fx: [{ t: 'aoe', at: 'cluster', r: 150, mult: 2.0, color: '#ff6a2a' },
                { t: 'zone', at: 'cluster', r: 150, dps: 0.65, dur: 4, color: '#ff6a2a' }] },
  },
  duongtien: {
    name: 'Dương Tiễn', title: 'Nhị Lang Chân Quân', src: 'Phong Thần / Tây Du',
    role: 'sat', el: 'kim', fac: 'xien', rar: 'SSR',
    hp: 1450, atk: 165, def: 58, aspd: 1.1, range: 52, move: 150,
    look: { style: 'buns', skin: '#ffe0c8', hair: '#1f1f2b', outfit: '#e8eef7', outfit2: '#4a6fd8', belt: '#ffd34d', pants: '#cfd8ea', weapon: 'spear', wcolor: '#c8d8f0' },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Tam Tiêm Đao +40% sát thương', m: { skill: 0.40 } }, { d: 'Đòn thường bắn thêm 1 luồng', m: { proj: 1 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Thiên Nhãn', desc: '+12% tỉ lệ bạo kích.', crit: 0.12 },
    small: { name: 'Tam Tiêm Đao', desc: 'Phóng 3 mũi thương xuyên thấu, mỗi mũi 170% công.',
             fx: [{ t: 'proj', n: 3, spread: 0.14, mult: 1.7, pierce: true, type: 'light' }] },
    ult: { name: 'Hao Thiên Khuyển', desc: 'Triệu Hao Thiên Khuyển lao vào chỗ quái đông nhất 320% công, tạo 1 phân thân 8 giây.',
           fx: [{ t: 'aoe', at: 'cluster', r: 150, mult: 3.2, color: '#9ad0ff' }, { t: 'clone', n: 1, dur: 8 }] },
  },
  khuongtanha: {
    name: 'Khương Tử Nha', title: 'Thái Công Vọng', src: 'Phong Thần Diễn Nghĩa',
    role: 'tran', el: 'thuy', fac: 'xien', rar: 'SR',
    hp: 1550, atk: 100, def: 72, aspd: 0.8, range: 190, move: 150, ranged: true, proj: 'light',
    look: { style: 'bald', skin: '#ffe6cf', hair: '#e8e8e8', outfit: '#6f8fb0', outfit2: '#e8eef5', belt: '#4aa88a', pants: '#cfd8ea', weapon: 'staff', wcolor: '#e6b422', robe: true },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Đả Thần Tiên +40% sát thương', m: { skill: 0.40 } }, { d: 'Đòn thường xuyên thấu', m: { pierce: 1 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Phong Thần Bảng', desc: '+12% sát thương chiêu thức.', skillPct: 0.12 },
    small: { name: 'Đả Thần Tiên', desc: 'Giáng roi vào chỗ quái đông nhất 170% công, choáng 0,8 giây.',
             fx: [{ t: 'aoe', at: 'cluster', r: 100, mult: 1.7, stun: 0.8, color: '#7fb3ff' }] },
    ult: { name: 'Phong Thần', desc: 'Hạ Phong Thần Bảng: 200% công vùng lớn, choáng 2 giây; cả đội +20% công 6 giây.',
           fx: [{ t: 'aoe', at: 'cluster', r: 180, mult: 2.0, stun: 2.0, color: '#7fb3ff' }, { t: 'buff', k: 'atk', v: 0.20, dur: 6 }] },
  },
  vantieu: {
    name: 'Vân Tiêu', title: 'Tam Tiêu Nương Nương', src: 'Phong Thần Diễn Nghĩa',
    role: 'phap', el: 'moc', fac: 'triet', rar: 'SSR',
    hp: 1300, atk: 170, def: 50, aspd: 0.85, range: 190, move: 150, ranged: true, proj: 'light',
    look: { style: 'veil', skin: '#fff1e6', hair: '#2b2230', outfit: '#3fb6a8', outfit2: '#ffffff', belt: '#ffd34d', weapon: 'orb', wcolor: '#ffd34d', robe: true },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Kim Đấu Thần Quang rộng hơn, +40% sát thương', m: { skill: 0.40, size: 0.3 } }, { d: 'Đòn thường xuyên thấu', m: { pierce: 1 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Hỗn Nguyên Kim Đấu', desc: '+15% sát thương chiêu thức.', skillPct: 0.15 },
    small: { name: 'Kim Đấu Thần Quang', desc: 'Bắn 5 luồng kim quang hình quạt, mỗi luồng 160% công.',
             fx: [{ t: 'proj', n: 5, spread: 0.4, mult: 1.6, type: 'light' }] },
    ult: { name: 'Cửu Khúc Hoàng Hà Trận', desc: 'Hạ trận đồ chỗ quái đông nhất: 250% công rồi vùng trận 4 giây, mỗi giây 75% công.',
           fx: [{ t: 'aoe', at: 'cluster', r: 170, mult: 2.5, color: '#ffd34d' }, { t: 'zone', at: 'cluster', r: 170, dps: 0.75, dur: 4, color: '#ffd34d' }] },
  },
  trieucongminh: {
    name: 'Triệu Công Minh', title: 'Tài Thần Chân Quân', src: 'Phong Thần Diễn Nghĩa',
    role: 'sat', el: 'kim', fac: 'triet', rar: 'SR',
    hp: 1500, atk: 150, def: 65, aspd: 1.0, range: 52, move: 150,
    look: { style: 'bull', skin: '#e8b890', hair: '#1c1c1c', outfit: '#d8b13a', outfit2: '#a82a22', belt: '#ffd34d', pants: '#3a2c3a', weapon: 'club', wcolor: '#ffd34d' },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Kim Tiên +40% sát thương', m: { skill: 0.40 } }, { d: 'Đòn thường bắn thêm 1 luồng', m: { proj: 1 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Tài Thần', desc: '+10% tỉ lệ bạo kích.', crit: 0.10 },
    small: { name: 'Kim Tiên', desc: 'Quất roi vàng vào chỗ quái đông nhất 170% công, đẩy lùi.',
             fx: [{ t: 'aoe', at: 'cluster', r: 100, mult: 1.7, knock: 45, color: '#ffd34d' }] },
    ult: { name: 'Định Hải Châu', desc: 'Ném Định Hải Châu nổ 450% công vùng lớn.',
           fx: [{ t: 'aoe', at: 'cluster', r: 160, mult: 4.5, color: '#ffd34d' }] },
  },
  thailaoquan: {
    name: 'Thái Thượng Lão Quân', title: 'Thái Thanh Đạo Đức', src: 'Tây Du / Phong Thần',
    role: 'dan', el: 'moc', fac: 'dao', rar: 'SSR',
    hp: 1700, atk: 120, def: 70, aspd: 0.9, range: 190, move: 150, ranged: true, proj: 'light',
    look: { style: 'bald', skin: '#ffe6cf', hair: '#f0f0f0', outfit: '#8fcf9a', outfit2: '#ffffff', belt: '#c9a227', weapon: 'vase', wcolor: '#d94a2e', robe: true },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Kim Đan +40% hiệu quả', m: { skill: 0.40 } }, { d: 'Máu tối đa +30%', m: { hp: 0.30 } }, { d: 'Tuyệt kỹ +60% hiệu quả', m: { ult: 0.60 } }],
    passive: { name: 'Bát Quái Lô', desc: '+20% lượng hồi máu.', healPct: 0.20 },
    small: { name: 'Kim Đan', desc: 'Ban kim đan hồi máu cả đội bằng 200% công.',
             fx: [{ t: 'heal', mult: 2.0 }] },
    ult: { name: 'Thái Thượng Cảm Ứng', desc: 'Hồi máu cả đội 500% công, giải khống chế, thêm khiên 10% máu.',
           fx: [{ t: 'heal', mult: 5.0, cleanse: true }, { t: 'shield', who: 'team', pct: 0.10, dur: 5 }] },
  },
  satang: {
    name: 'Sa Tăng', title: 'Quyển Liêm Đại Tướng', src: 'Tây Du Ký',
    role: 'the', el: 'thuy', fac: 'phat', rar: 'SR',
    hp: 2800, atk: 100, def: 110, aspd: 0.9, range: 52, move: 150,
    look: { style: 'bull', skin: '#8ea8c0', hair: '#2a2a38', outfit: '#6f8a72', outfit2: '#3a3a48', belt: '#8a5a36', pants: '#3a3a48', weapon: 'rake', wcolor: '#c8d0d8' },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Nguyệt Nha Sản +40% sát thương', m: { skill: 0.40 } }, { d: 'Máu tối đa +30%', m: { hp: 0.30 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Lưu Sa Hà Vệ', desc: 'Giảm 12% sát thương nhận.', dr: 0.12 },
    small: { name: 'Nguyệt Nha Sản', desc: 'Chém sóng liềm vào chỗ quái đông nhất 170% công, đẩy lùi.',
             fx: [{ t: 'aoe', at: 'cluster', r: 100, mult: 1.7, knock: 45, color: '#9ad0e8' }] },
    ult: { name: 'Lưu Sa Hà', desc: 'Cuốn cát chặn trước mặt 320% công, khiêu khích 3 giây, nhận khiên 25% máu.',
           fx: [{ t: 'aoe', at: 'front', r: 150, mult: 3.2, color: '#9ad0e8' }, { t: 'taunt', r: 240, dur: 3 }, { t: 'shield', who: 'self', pct: 0.25, dur: 6 }] },
  },
  thietphien: {
    name: 'Thiết Phiến Công Chúa', title: 'La Sát Nữ', src: 'Tây Du Ký',
    role: 'phap', el: 'moc', fac: 'yeu', rar: 'SR',
    hp: 1250, atk: 150, def: 50, aspd: 0.9, range: 190, move: 150, ranged: true, proj: 'light',
    look: { style: 'fox', skin: '#ffe6dc', hair: '#2b2230', outfit: '#3fa86a', outfit2: '#ffd34d', belt: '#ffd34d', weapon: 'orb', wcolor: '#6fd88a', robe: true },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Phiến Phong rộng hơn, +40% sát thương', m: { skill: 0.40, size: 0.3 } }, { d: 'Đòn thường xuyên thấu', m: { pierce: 1 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Ba Tiêu Phiến', desc: '+12% sát thương chiêu thức.', skillPct: 0.12 },
    small: { name: 'Phiến Phong', desc: 'Quạt ra 5 luồng gió hình quạt, mỗi luồng 150% công.',
             fx: [{ t: 'proj', n: 5, spread: 0.5, mult: 1.5, type: 'light' }] },
    ult: { name: 'Cuồng Phong Chấn Địa', desc: 'Một cú quạt bão: 420% công chỗ quái đông nhất, hất tung xa.',
           fx: [{ t: 'aoe', at: 'cluster', r: 180, mult: 4.2, knock: 90, color: '#7fe8a0' }] },
  },
  litinh: {
    name: 'Lý Tịnh', title: 'Thác Tháp Thiên Vương', src: 'Phong Thần / Tây Du',
    role: 'the', el: 'kim', fac: 'thien', rar: 'SR',
    hp: 2900, atk: 95, def: 115, aspd: 0.85, range: 52, move: 150,
    look: { style: 'bull', skin: '#e8b890', hair: '#2a2218', outfit: '#d8b13a', outfit2: '#a82a22', belt: '#ffd34d', pants: '#5a4a2a', weapon: 'club', wcolor: '#ffd34d' },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Linh Lung Tháp +40% sát thương', m: { skill: 0.40 } }, { d: 'Máu tối đa +30%', m: { hp: 0.30 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Thác Tháp', desc: 'Giảm 10% sát thương nhận.', dr: 0.10 },
    small: { name: 'Linh Lung Tháp', desc: 'Ném tháp xuống chỗ quái đông nhất 150% công, choáng 1 giây; nhận khiên 15% máu.',
             fx: [{ t: 'aoe', at: 'cluster', r: 110, mult: 1.5, stun: 1.0, color: '#ffd34d' }, { t: 'shield', who: 'self', pct: 0.15, dur: 5 }] },
    ult: { name: 'Thác Tháp Trấn Yêu', desc: 'Trấn tháp 360% công, choáng 1,5 giây, khiêu khích 3 giây, cả đội nhận khiên 10%.',
           fx: [{ t: 'aoe', at: 'cluster', r: 160, mult: 3.6, stun: 1.5, color: '#ffd34d' }, { t: 'taunt', r: 260, dur: 3 }, { t: 'shield', who: 'team', pct: 0.10, dur: 6 }] },
  },
  hangnga: {
    name: 'Hằng Nga', title: 'Quảng Hàn Tiên Tử', src: 'Truyền thuyết / Tây Du',
    role: 'dan', el: 'thuy', fac: 'nguyet', rar: 'SR',
    hp: 1650, atk: 115, def: 65, aspd: 0.9, range: 190, move: 150, ranged: true, proj: 'light',
    look: { style: 'veil', skin: '#fff1e6', hair: '#1c1c28', outfit: '#f3f0ff', outfit2: '#ffc4de', belt: '#c8c8e8', weapon: 'orb', wcolor: '#e8f0ff', robe: true },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Nguyệt Quang +40% hiệu quả', m: { skill: 0.40 } }, { d: 'Máu tối đa +30%', m: { hp: 0.30 } }, { d: 'Tuyệt kỹ +60% hiệu quả', m: { ult: 0.60 } }],
    passive: { name: 'Nguyệt Quang', desc: '+15% lượng hồi máu.', healPct: 0.15 },
    small: { name: 'Nguyệt Quang', desc: 'Rải ánh trăng hồi máu cả đội bằng 200% công.',
             fx: [{ t: 'heal', mult: 2.0 }] },
    ult: { name: 'Nguyệt Cung Thanh Huy', desc: 'Hồi máu cả đội 450% công, giải khống chế, cả đội +20% tốc đánh 6 giây.',
           fx: [{ t: 'heal', mult: 4.5, cleanse: true }, { t: 'buff', k: 'aspd', v: 0.20, dur: 6 }] },
  },
  bachcot: {
    name: 'Bạch Cốt Phu Nhân', title: 'Thi Ma Bạch Cốt', src: 'Tây Du Ký',
    role: 'tran', el: 'tho', fac: 'quy', rar: 'SR',
    hp: 1450, atk: 105, def: 68, aspd: 0.85, range: 190, move: 150, ranged: true, proj: 'bead',
    look: { style: 'fox', skin: '#f0e8f8', hair: '#e8e0f0', outfit: '#e8e0f0', outfit2: '#8a5ac8', belt: '#8a5ac8', weapon: 'khakkhara', wcolor: '#e8e0d0', robe: true, evil: true },
    tang: [{ d: 'Đòn đánh thường +25% sát thương', m: { atk: 0.25 } }, { d: 'Cốt Trảo +40% sát thương', m: { skill: 0.40 } }, { d: 'Đòn thường xuyên thấu', m: { pierce: 1 } }, { d: 'Tuyệt kỹ +60% sát thương', m: { ult: 0.60 } }],
    passive: { name: 'Thi Ma', desc: '+12% sát thương chiêu thức.', skillPct: 0.12 },
    small: { name: 'Cốt Trảo', desc: 'Bắn 3 móng xương xuyên thấu, mỗi móng 160% công.',
             fx: [{ t: 'proj', n: 3, spread: 0.3, mult: 1.6, pierce: true, type: 'bead' }] },
    ult: { name: 'Bạch Cốt Ma Âm', desc: 'Thét ma âm chỗ quái đông nhất 260% công, choáng 1,5 giây, rồi vùng tử khí 4 giây (60% công/giây).',
           fx: [{ t: 'aoe', at: 'cluster', r: 190, mult: 2.6, stun: 1.5, color: '#b88aff' }, { t: 'zone', at: 'cluster', r: 160, dps: 0.6, dur: 4, color: '#b88aff' }] },
  },
};

// ---------------------------------------------------------------------
// KIỂU ĐÁNH THƯỜNG riêng của từng tướng (học cách VLĐMT chia tướng theo kiểu đạn):
//  pierce   – xuyên N quái trên đường           boomerang – xuyên rồi quay về, trúng thêm lần nữa
//  bounce   – nảy lan từng quái (mỗi lần −12%)  split     – trúng quái đầu thì tách thành n đạn con
//  spin     – trúng rồi xoay tại chỗ cắt nhiều nhịp  lob   – ném cung, nổ lan vùng nhỏ
//  fan      – toả n đạn hình quạt                 heal: N  – cứ N đòn đánh hồi máu đồng đội yếu nhất
// ---------------------------------------------------------------------
const ATK_STYLE = {
  ngokhong:      { pat: 'boomerang', proj: 'staff',    name: 'Ném Kim Cô Bổng', desc: 'Ném gậy xoay xuyên mọi quái trên đường, bay đến cuối rồi quay về, trúng thêm lần nữa.' },
  satang:        { pat: 'boomerang', proj: 'crescent', name: 'Phi Nguyệt Nha',  desc: 'Ném lưỡi liềm xuyên quái rồi quay về tay.' },
  batgioi:       { pat: 'lob',       proj: 'rake',     name: 'Ném Cào Giáng Đất', desc: 'Ném bồ cào theo vòng cung, đập đất nổ lan quanh điểm rơi.', boom: 85 },
  ngumavuong:    { pat: 'lob',       proj: 'boulder',  name: 'Ném Tảng Đá',      desc: 'Ném tảng đá nổ lan vùng rộng.', boom: 95 },
  litinh:        { pat: 'lob',       proj: 'pagoda',   name: 'Trấn Tháp',        desc: 'Ném tháp nhỏ nổ lan, choáng ngắn.', boom: 80, stun: 0.35 },
  thailaoquan:   { pat: 'lob',       proj: 'pill',     name: 'Bắn Kim Đan',      desc: 'Bắn viên kim đan nổ lan; cứ 5 đòn hồi máu 1 đồng đội yếu nhất.', boom: 70, heal: 5 },
  nata:          { pat: 'split',     proj: 'ring',     name: 'Càn Khôn Quyển',   desc: 'Vòng trúng quái đầu thì tách thành 2 vòng con bay chéo.', n: 2 },
  vantieu:       { pat: 'split',     proj: 'light',    name: 'Kim Đấu Quang',    desc: 'Luồng kim quang trúng quái đầu tách thành 3 tia.', n: 3 },
  thietphien:    { pat: 'bounce',    proj: 'fan',      name: 'Quạt Nảy',         desc: 'Ném quạt nảy lan sang 4 quái gần nhau, mỗi lần giảm 12% sát thương.', bounces: 4 },
  trieucongminh: { pat: 'bounce',    proj: 'pearl',    name: 'Châu Nảy',         desc: 'Ném châu nảy lan sang 3 quái.', bounces: 3 },
  khuongtanha:   { pat: 'bounce',    proj: 'bolt',     name: 'Lôi Tiên',         desc: 'Roi sét nhảy nhanh qua 4 quái.', bounces: 4, speed: 950 },
  honghainhi:    { pat: 'pierce',    proj: 'spear',    name: 'Hoả Tiêm Thương',  desc: 'Phóng thương lửa xuyên 4 quái.', pierceN: 4 },
  duongtien:     { pat: 'pierce',    proj: 'spear',    name: 'Tam Tiêm Đao',     desc: 'Phóng đinh ba xuyên 3 quái trên đường.', pierceN: 3 },
  duongtang:     { pat: 'spin',      proj: 'bead',     name: 'Tràng Hạt Xoay',   desc: 'Tràng hạt trúng quái thì xoay quanh cắt 4 nhịp quanh điểm đó.' },
  hangnga:       { pat: 'spin',      proj: 'moon',     name: 'Nguyệt Luân',      desc: 'Vầng trăng xoay cắt 4 nhịp; cứ 4 đòn hồi máu 1 đồng đội yếu nhất.', heal: 4 },
  quanam:        { pat: 'fan',       proj: 'drop',     name: 'Rưới Cam Lộ',      desc: 'Rưới 3 giọt cam lộ hình quạt; cứ 3 đòn hồi máu 1 đồng đội yếu nhất.', n: 3, heal: 3 },
  datky:         { pat: 'fan',       proj: 'foxfire',  name: 'Hồ Hoả',           desc: 'Toả 3 hồ hoả hình quạt, đuổi theo mục tiêu.', n: 3, homing: true },
  bachcot:       { pat: 'fan',       proj: 'bone',     name: 'Cốt Trảo',         desc: 'Bắn 3 móng xương hình quạt, mỗi móng xuyên 2 quái.', n: 3, pierceN: 2 },
};

const SSR_POOL = ['ngokhong', 'nata', 'ngumavuong', 'quanam', 'datky', 'duongtien', 'vantieu', 'thailaoquan'];
const SR_POOL = ['batgioi', 'duongtang', 'honghainhi', 'khuongtanha', 'trieucongminh', 'satang', 'thietphien', 'litinh', 'hangnga', 'bachcot'];

// Duyên phận (lấy từ mục 6.2 của GDD; chỉ những duyên có đủ tướng trong bản thử)
const BONDS = [
  { id: 'ketnghia', name: 'Kết Nghĩa Huynh Đệ', members: ['ngokhong', 'ngumavuong'],
    desc: 'Cả hai +10% công. Khi một người ngã, người còn lại +30% công trong 8 giây.' },
  { id: 'phutu', name: 'Phụ Tử Ngưu Ma', members: ['ngumavuong', 'honghainhi'],
    desc: 'Ngưu Ma Vương +20% máu. Hồng Hài Nhi nhận ít hơn 15% sát thương.' },
];

// ---------------------------------------------------------------------
// Quái
// ---------------------------------------------------------------------
const ENEMIES = {
  tieuyeu: { name: 'Tiểu Yêu', hp: 260, atk: 28, def: 20, aspd: 0.9, range: 34, move: 72, el: 'moc',
    look: { style: 'goblin', skin: '#86d16a', hair: '#3c2a1a', outfit: '#8a5a3a', outfit2: '#6b4529',
            belt: '#5a3a22', weapon: 'blade', evil: true, size: 0.82 } },
  cungyeu: { name: 'Cung Yêu', hp: 200, atk: 30, def: 15, aspd: 0.7, range: 230, move: 62, el: 'hoa',
    ranged: true, proj: 'arrow',
    look: { style: 'goblin', skin: '#f0a35e', hair: '#3c2a1a', outfit: '#5a6ed1', outfit2: '#3d4ea8',
            belt: '#2d3a80', weapon: 'bow', evil: true, size: 0.82 } },
  dauda: { name: 'Đầu Đà Yêu', hp: 750, atk: 45, def: 50, aspd: 0.6, range: 40, move: 52, el: 'tho',
    look: { style: 'brute', skin: '#8ea3c9', hair: '#2d2440', outfit: '#7a4b9c', outfit2: '#5a3375',
            belt: '#c9a227', weapon: 'club', evil: true, size: 1.15 } },
  tinhanh: { name: 'Hắc Phong Tướng', hp: 2400, atk: 70, def: 70, aspd: 0.8, range: 48, move: 66, el: 'thuy',
    elite: true,
    look: { style: 'general', skin: '#6b6f86', hair: '#1d1d2b', outfit: '#2f3f6b', outfit2: '#c9a227',
            belt: '#c9a227', weapon: 'halberd', evil: true, size: 1.32 } },
  hoyeu: { name: 'Cửu Vĩ Hồ Yêu', hp: 20000, atk: 115, def: 90, aspd: 0.75, range: 70, move: 50, el: 'hoa',
    boss: true,
    look: { style: 'fox', skin: '#ffe1cf', hair: '#ff7a45', outfit: '#c2185b', outfit2: '#ffcc33',
            belt: '#ffcc33', weapon: 'orb', wcolor: '#ff5a36', tails: 9, crown: true, evil: true,
            robe: true, size: 2.0 } },
};

// ---------------------------------------------------------------------
// Ải (3 ải đầu của chương 1 cho bản thử)
// list: [loại quái, số lượng]; dropLast: rơi gì khi hạ con cuối của đợt
// ---------------------------------------------------------------------
// 12 chương × 10 ải — đúng GDD §2 "Khung chương" và §4.6 "Loại ải". Mỗi chương MỘT vùng, đi từ ngoài vào trong, ải 10 là boss cuối chương.
//  Loại ải (GDD 4.6): thường 6–8 đợt (ải 1-4, 6-9), tinh anh 8–10 đợt (ải 5), boss 10–12 đợt (ải 10).
//  'theme' = nền có sẵn gần nhất (chưa có nền riêng cho mọi chương). 'mech' = điểm cơ chế nổi bật theo GDD (chưa cài hết).
const CHAPTERS = [
  { id: 1, name: 'Thương triều suy tàn', region: 'Triều Ca', boss: 'Đát Kỷ', theme: 'pass', mech: 'Giới thiệu điều khiển đội trưởng và nội công', story: 'Cuối đời Thương, yêu khí tràn vào thành Triều Ca. Tiến vào hoàng cung để hạ Đát Kỷ.' },
  { id: 2, name: 'Tây Kỳ khởi binh', region: 'Tây Kỳ', boss: 'Văn Trọng', theme: 'forest', mech: 'Giới thiệu Linh Phù gọi đồng đội', story: 'Chu Vũ khởi binh phạt Trụ. Giữ Tây Kỳ trước đại quân Thương của Văn Trọng.' },
  { id: 3, name: 'Thập Tuyệt Trận', region: 'Thập Tuyệt Trận', boss: 'Triệu Công Minh', theme: 'tomb', mech: 'Ải có bẫy và cơ quan', story: 'Mười trận tuyệt của Triệt giáo chặn đường. Phá trận, hạ Triệu Công Minh.' },
  { id: 4, name: 'Kim Ngâu và Tam Tiêu', region: 'Kim Ngao Đảo', boss: 'Vân Tiêu', theme: 'sea', mech: 'Boss gọi quái theo đợt', story: 'Ba chị em Tam Tiêu bày Cửu Khúc Hoàng Hà Trận trên Kim Ngao Đảo.' },
  { id: 5, name: 'Vạn Tiên Trận', region: 'Vạn Tiên Trận', boss: 'Thông Thiên Giáo Chủ', theme: 'snow', mech: 'Boss nhiều giai đoạn', story: 'Triệt giáo dốc toàn lực bày Vạn Tiên Trận. Hạ Thông Thiên Giáo Chủ.' },
  { id: 6, name: 'Phong Thần Bảng', region: 'Phong Thần Đài', boss: 'Hồn Bảng hợp nhất', theme: 'heaven', mech: 'Kết thúc phần I, mở phần II', story: 'Phong Thần Bảng vỡ, hồn tướng tản mác. Hợp nhất hồn Bảng để kết thúc phần I.' },
  { id: 7, name: 'Đại náo Thiên Cung', region: 'Thiên Cung', boss: 'Nhị Lang Thần (Dương Tiễn)', theme: 'heaven', mech: 'Ải tốc độ, né đòn', story: 'Tề Thiên Đại Thánh làm loạn Thiên Cung. Nhị Lang Thần ra tay bắt yêu hầu.' },
  { id: 8, name: 'Năm Trăm Năm Dưới Ngũ Hành Sơn', region: 'Ngũ Hành Sơn', boss: 'Ngưu Ma Vương', theme: 'pass', mech: 'Boss tank, mở Thần binh', story: 'Năm trăm năm dưới núi đá. Vượt núi, đối mặt Ngưu Ma Vương, kết nghĩa huynh đệ cũ.' },
  { id: 9, name: 'Hoả Diệm Sơn và Ba Tiu Quạt', region: 'Hoả Diệm Sơn', boss: 'Hồng Hài Nhi', theme: 'fire', mech: 'Ải lửa, mở Linh thú', story: 'Lửa cháy chặn đường thỉnh kinh. Mượn quạt Ba Tiêu, hạ Hồng Hài Nhi.' },
  { id: 10, name: 'Yêu cốt Bạch Cốt Tịnh', region: 'Bạch Hổ Lĩnh', boss: 'Bạch Cốt Tinh', theme: 'cave', mech: 'Boss biến hình 3 lần', story: 'Yêu cốt ba lần hoá hình lừa thầy trò. Vạch mặt Bạch Cốt Tinh.' },
  { id: 11, name: 'Ngọc Thỏ và Thủy tộc', region: 'Thủy tộc', boss: 'Kim Thạch Yêu Vương', theme: 'river', mech: 'Ải dưới nước, giảm tầm nhìn', story: 'Dòng nước đục che mờ tầm nhìn. Vượt thuỷ tộc, hạ Kim Thạch Yêu Vương.' },
  { id: 12, name: 'Tây Thiên lấy kinh', region: 'Tây Thiên', boss: 'Phạt Pháp hồn Ma', theme: 'heaven', mech: 'Kết thúc, mở chế độ Tám Mươi Mốt Nạn', story: 'Chặng cuối tới Tây Thiên. Đối mặt Phạt Pháp hồn Ma, hoàn thành thỉnh kinh.' },
];
const STAGE_PHASE = ['Vùng ngoài', 'Vùng ngoài', 'Vùng ngoài', 'Vùng giữa', 'Tinh anh', 'Vùng giữa', 'Vùng trong', 'Vùng trong', 'Vùng trong', 'Sào huyệt boss'];
const STAGES = [];
(function buildStages() {
  CHAPTERS.forEach((ch, c) => {
    for (let k = 1; k <= 10; k++) {
      const idx = c * 10 + k - 1, kind = k === 10 ? 'boss' : k === 5 ? 'elite' : 'normal';
      const lvl = 1 + c * 3 + Math.floor((k - 1) * 0.4);
      // số đợt theo GDD: thường 6-8, tinh anh 8-10, boss 10-12 (đợt boss tính vào tổng)
      const total = kind === 'normal' ? 6 + (k >= 7 ? 1 : 0) + (k >= 9 ? 1 : 0) : kind === 'elite' ? 8 + (c >= 4 ? 1 : 0) + (c >= 8 ? 1 : 0) : 10 + (c >= 4 ? 1 : 0) + (c >= 8 ? 1 : 0);
      const n = kind === 'boss' ? total - 1 : total, waves = [];
      for (let w = 0; w < n; w++) {
        const tie = 4 + Math.floor(c * 0.8) + k + w, cung = Math.floor((k + w) / 2) + Math.floor(c / 3), dau = Math.floor((k + w - 1) / 3), tinh = (kind !== 'normal' ? w >= 1 : (w >= 2 && k >= 3)) ? Math.floor((k + w) / 4) + (kind === 'elite' ? 1 : 0) : 0;
        const list = [['tieuyeu', Math.min(tie, 26)]];
        if (cung > 0) list.push(['cungyeu', Math.min(cung, 9)]);
        if (dau > 0) list.push(['dauda', Math.min(dau, 8)]);
        if (tinh > 0) list.push(['tinhanh', Math.min(tinh, 5)]);
        const o = { list };
        if (w >= 1) o.side = true;
        o.dropLast = kind === 'elite' && w % 2 === 1 ? 'phu' : w % 3 === 0 ? 'phu' : w % 3 === 1 ? 'both' : 'thu';   // tinh anh rơi Linh Phù nhiều hơn (GDD 4.6)
        waves.push(o);
      }
      if (kind === 'boss') waves.push({ list: [['hoyeu', 1 + (c >= 6 ? 1 : 0)], ['tieuyeu', 4 + c]], boss: true });
      const par = kind === 'normal' ? 90 : kind === 'elite' ? 120 : 150 + Math.min(30, c * 3);
      STAGES.push({
        id: ch.id + '-' + k, chap: c, kind, name: ch.region + ' · ' + STAGE_PHASE[k - 1] + (k === 10 ? '' : ' ' + k), lvl, par, gate: 2500 + idx * 45, theme: ch.theme, seed: 7 + idx * 13,
        bossName: kind === 'boss' ? ch.boss : null,
        desc: kind === 'boss' ? 'BOSS cuối chương: ' + ch.boss + '. Boss nhiều giai đoạn — hạ boss để qua chương.' : kind === 'elite' ? 'Ải tinh anh: nhiều quái tinh anh, rơi nhiều Linh Phù.' : (k === 1 ? ch.story : ch.region + ' — tiến sâu vào trong, giữ vững cổng!'),
        reward: { ngoc: 300 + idx * 8 + (kind === 'boss' ? 250 : kind === 'elite' ? 100 : 0), vang: 800 + idx * 40 + (kind === 'boss' ? 800 : kind === 'elite' ? 300 : 0) }, waves,
      });
    }
  });
})();

// ---------------------------------------------------------------------
// Công pháp (nâng cấp trong trận, chọn 1 trong 3 khi nhặt Thiên Thư)
// ---------------------------------------------------------------------
// THIÊN THƯ v3 — soi thẻ Bí Tịch / Chọn Công Pháp thật của Võ Lâm Đại Minh Tinh (video VN + TQ):
//  • Cơ bản theo hệ: ST hệ +10%, chiếm 1 ô. Có cơ bản hệ X thì mới ra công pháp cao cấp hệ X;
//    chọn cao cấp = cơ bản đó "tiến bậc" thành công pháp cao cấp (cùng ô).
//  • Cao cấp mang nhãn lưu phái. Đã có cao cấp thì có thể ra thẻ "tiến bậc" (bậc 3) cộng thêm hiệu ứng.
//  • Cặp lưu phái (… 1 rồi mới có … 2): Phong Thế, Phệ Huyết, Thần Kích, Lưỡng Nghi, Kiếm Ý.
//  • Tối đa 6 ô công pháp. Tầng tướng (bồi dưỡng) tối đa 5.
//  Số có chú thích [VLĐMT] = đọc đúng trên thẻ game gốc; còn lại là thiết kế của mình cùng khung.
const CP_MAX = 6;
const LUUPHAI = {
  cotloi: { name: 'Bản Mệnh', color: '#e0503a', desc: 'Hệ đó +40% ST; mỗi lần bồi dưỡng tầng cho tướng cùng hệ: +20% ST (tối đa 5 lần)' },
  chieuthuc: { name: 'Thần Thông', color: '#3a9be0', desc: 'Thêm 1 chiêu tự đánh trên bản đồ, cường hoá theo tầng tướng cùng hệ' },
  xetoac: { name: 'Phệ Huyết', color: '#c04ad8', desc: 'Gắn tầng Phệ Huyết: mỗi tầng 60% ST/giây, tối đa 5 tầng' },
  hoitam: { name: 'Thần Kích', color: '#e8a93a', desc: 'Đòn đánh có tỉ lệ kích hoạt Một Đòn Thần Kích 150%' },
  tatphong: { name: 'Phong Thế', color: '#38c0b0', desc: 'Đánh tích tầng Phong Thế (+ST, +tốc đánh); mất hết khi điều khí' },
  vienkhuyet: { name: 'Nguyệt Tướng', color: '#d86a9a', desc: 'Mỗi đòn ngẫu nhiên Tàn Nguyệt (−20%) hoặc Mãn Nguyệt (+60%)' },
  tuthan: { name: 'Đắc Đạo', color: '#c8a020', desc: 'Tướng đạt tầng 5 được tăng mạnh' },
  amduong: { name: 'Lưỡng Nghi', color: '#3ac08a', desc: 'Luân phiên Âm (tăng công, mất máu) / Dương (hồi máu); mất máu thì bùng công' },
  vonga: { name: 'Kiếm Ý', color: '#7a6ae0', desc: 'Mỗi đòn tích 1 tầng: ST tăng mạnh, tốc đánh giảm; đủ 5 tầng thì xoá' },
  baino: { name: 'Triền Đấu', color: '#8a8a8a', desc: 'Đánh liên tục cùng 1 kẻ địch thì ST tăng dần' },
  quynhat: { name: 'Thu Hồn', color: '#4a7ae0', desc: 'Giết địch thu tầng Hồn Phách, mỗi tầng +1% ST toàn thể' },
  thaison: { name: 'Kim Thân', color: '#d0a030', desc: 'Kim Thân hộ thể: giảm sát thương phải chịu' },
};
// field: chiêu tự đánh (Thần Thông). evo: bản tiến bậc (bậc 3).
const CONGPHAP = [
  // ======== CƠ BẢN ========
  { id: 'the0', sys: 'the', tier: 1, name: 'Thể Thuật Cơ Bản', desc: 'ST tướng hệ Thể +10% [VLĐMT]', mod: { 'the.atkPct': 0.10 } },
  { id: 'phap0', sys: 'phap', tier: 1, name: 'Pháp Thuật Cơ Bản', desc: 'ST tướng hệ Pháp +10% [VLĐMT]', mod: { 'phap.atkPct': 0.10 } },
  { id: 'dan0', sys: 'dan', tier: 1, name: 'Đan Đạo Cơ Bản', desc: 'ST tướng hệ Đan +10% [VLĐMT]', mod: { 'dan.atkPct': 0.10 } },
  { id: 'sat0', sys: 'sat', tier: 1, name: 'Kiếm Quyết Cơ Bản', desc: 'ST tướng hệ Sát +10% [VLĐMT]', mod: { 'sat.atkPct': 0.10 } },
  { id: 'tran0', sys: 'tran', tier: 1, name: 'Trận Pháp Cơ Bản', desc: 'ST tướng hệ Trận +10% [VLĐMT]', mod: { 'tran.atkPct': 0.10 } },
  // ======== THỂ (đỡ đòn, hàng trước) ========
  { id: 'the_core', sys: 'the', tier: 2, lp: 'cotloi', name: 'Bàn Cổ Quyết', desc: 'ST tướng Hệ Thể +40%. Bản Mệnh Hệ Thể: mỗi bồi dưỡng 1 cấp, ST tướng Thể +20% (tối đa 5) [VLĐMT]', mod: { 'the.atkPct': 0.40, 'the.core': 1 },
    evo: { name: 'Hỗn Độn Bàn Cổ Thân', desc: 'ST cuối cùng hệ Thể +3%; mỗi bồi dưỡng 1 cấp, thời gian điều khí −3,5%, tối đa −17,5% [VLĐMT]', mod: { 'the.final': 0.03, 'the.coreEvo': 1 } } },
  { id: 'the_ht1', sys: 'the', tier: 2, lp: 'hoitam', name: 'Phiên Thiên Ấn', desc: 'ST toàn thể +20%. Đánh có 15% kích hoạt Một Đòn Thần Kích, ST 150% [VLĐMT]', mod: { atkPct: 0.20, htChance: 0.15 },
    evo: { name: 'Phiên Thiên Đại Ấn', desc: 'Thần Kích: HP còn lại của mục tiêu càng nhiều, ST càng cao, tối đa +35% [VLĐMT]', mod: { htHp: 0.35 } } },
  { id: 'the_ht2', sys: 'the', tier: 2, lp: 'hoitam', req: 'the_ht1', name: 'Khai Sơn Phủ', desc: 'ST toàn thể +20%. Một Đòn Thần Kích ST +100% [VLĐMT]', mod: { atkPct: 0.20, htDmg: 1.0 },
    evo: { name: 'Lực Phách Hoa Sơn', desc: 'Xác suất Thần Kích +3,5% [VLĐMT]', mod: { htChance: 0.035 } } },
  { id: 'the_ts', sys: 'the', tier: 2, lp: 'thaison', name: 'Kim Cương Bất Hoại', desc: 'ST toàn thể +20%. Kim Thân hộ thể: ST phải chịu giảm 10% [VLĐMT]', mod: { atkPct: 0.20, kc: 0.10 },
    evo: { name: 'Bát Bảo Kim Thân', desc: 'Khi chịu 1 đòn lớn hơn 10% HP tối đa, ST đó giảm 7,5% (cài gần đúng: giảm đều 4% ST phải chịu) [VLĐMT]', mod: { kc: 0.04 } } },
  { id: 'the_ct', sys: 'the', tier: 2, lp: 'chieuthuc', name: 'Thiên Lôi Hống', field: 'thachpha', desc: 'ST tướng Hệ Thể +40%. Thần thông mới Chấn Thiên Hống: mỗi 5 giây tiếng gầm đẩy lùi quái tiến sâu nhất 160%; mỗi tầng tướng Thể +30% [VLĐMT]', mod: { 'the.atkPct': 0.40 },
    evo: { name: 'Cửu Thiên Lôi Hống', desc: 'ST Chấn Thiên Hống +50% [VLĐMT]', mod: { 'fev.thachpha': 0.50 } } },
  // ======== PHÁP (sát thương diện rộng) ========
  { id: 'phap_core', sys: 'phap', tier: 2, lp: 'cotloi', name: 'Ngũ Lôi Chính Pháp', desc: 'ST tướng Hệ Pháp +40%. Bản Mệnh Hệ Pháp: mỗi bồi dưỡng 1 cấp, ST hệ Pháp +20% (tối đa 5) [VLĐMT]', mod: { 'phap.atkPct': 0.40, 'phap.core': 1 },
    evo: { name: 'Cửu Thiên Ứng Nguyên', desc: 'ST cuối cùng hệ Pháp +3%; mỗi bồi dưỡng 1 cấp, thời gian điều khí −3,5%, tối đa −17,5% [VLĐMT]', mod: { 'phap.final': 0.03, 'phap.coreEvo': 1 } } },
  { id: 'phap_tp1', sys: 'phap', tier: 2, lp: 'tatphong', name: 'Ngự Phong Thuật', desc: 'ST toàn thể +20%. Đánh có 50% nhận 1 tầng Phong Thế, mỗi tầng ST +5%, tối đa 10 tầng; mất khi điều khí [VLĐMT]', mod: { atkPct: 0.20, tp: 1 },
    evo: { name: 'Đằng Vân Giá Vũ', desc: 'Số lần tấn công toàn thể +3 [VLĐMT]', mod: { ammo: 3 } } },
  { id: 'phap_tp2', sys: 'phap', tier: 2, lp: 'tatphong', req: 'phap_tp1', name: 'Thần Hành Thuật', desc: 'ST toàn thể +20%. Mỗi tầng Phong Thế, tốc đánh +8% [VLĐMT]', mod: { atkPct: 0.20, tpAspd: 0.08 },
    evo: { name: 'Thuấn Di Độn Pháp', desc: 'Khi đánh có 15% không tốn số lần tấn công; mỗi tầng Phong Thế, ST phải chịu giảm 0,5% [VLĐMT]', mod: { freeShot: 0.15, tpDr: 0.005 } } },
  { id: 'phap_ct', sys: 'phap', tier: 2, lp: 'chieuthuc', name: 'Thuỷ Long Ngâm', field: 'hoavu', desc: 'ST tướng Hệ Pháp +40%. Thần thông mới Thuỷ Long Ngâm: mỗi 5 giây xoáy nước dưới chỗ quái đông 150%; mỗi tầng tướng Pháp +30% [VLĐMT]', mod: { 'phap.atkPct': 0.40 },
    evo: { name: 'Hám Hải Long Trảo', desc: 'ST Thuỷ Long Ngâm +50% [VLĐMT]', mod: { 'fev.hoavu': 0.50 } } },
  { id: 'phap_qn', sys: 'phap', tier: 2, lp: 'quynhat', name: 'Vạn Hồn Quy Nguyên', desc: 'ST toàn thể +20%. Thu Hồn: giết địch có 10% thu 1 tầng Hồn Phách, mỗi tầng ST toàn thể +1%, tối đa 40 tầng [VLĐMT]', mod: { atkPct: 0.20, soul: 1 },
    evo: { name: 'Hỗn Nguyên Thu Hồn', desc: 'Số tầng Hồn Phách tối đa +20, nhận ngay 20 tầng [VLĐMT]', mod: { soulMax: 20, soulNow: 20 } } },
  // ======== ĐAN (hồi máu) ========
  { id: 'dan_core', sys: 'dan', tier: 2, lp: 'cotloi', name: 'Dương Chi Cam Lộ', desc: 'ST tướng Hệ Đan +40%. Bản Mệnh Hệ Đan: mỗi bồi dưỡng 1 cấp, ST và hồi máu hệ Đan +20% (tối đa 5) [VLĐMT]', mod: { 'dan.atkPct': 0.40, 'dan.core': 1 },
    evo: { name: 'Tịnh Bình Cam Lộ', desc: 'ST cuối cùng hệ Đan +3%; mỗi bồi dưỡng 1 cấp, thời gian điều khí −3,5%, tối đa −17,5% [VLĐMT]', mod: { 'dan.final': 0.03, 'dan.coreEvo': 1 } } },
  { id: 'dan_ad1', sys: 'dan', tier: 2, lp: 'amduong', name: 'Thái Cực Sinh Hoá', desc: 'ST toàn thể +20%. Mỗi 5 giây đổi trạng thái — Âm: Tấn Công +20%, mỗi giây mất 4% HP hiện tại; Dương: mỗi giây hồi 2,5% HP tối đa [VLĐMT]', mod: { atkPct: 0.20, ad1: 1 },
    evo: { name: 'Lưỡng Nghi Tuần Hoàn', desc: 'Hiệu quả Lưỡng Nghi tăng cường: trạng thái Âm Tấn Công +5% nữa [VLĐMT]', mod: { ad1Evo: 0.05 } } },
  { id: 'dan_ad2', sys: 'dan', tier: 2, lp: 'amduong', req: 'dan_ad1', name: 'Hồi Xuân Thuật', desc: 'ST toàn thể +20%. Mỗi khi tích luỹ mất 8% HP tối đa, vào Lưỡng Nghi Giao Hoà: Tấn Công +40% trong 3 giây [VLĐMT]', mod: { atkPct: 0.20, ad2: 1 },
    evo: { name: 'Cải Tử Hoàn Sinh', desc: 'Lưỡng Nghi Giao Hoà kéo dài thêm (cài: 5 giây) [VLĐMT]', mod: { ad2Evo: 1 } } },
  { id: 'dan_tt', sys: 'dan', tier: 2, lp: 'tuthan', name: 'Tu Chân Quyết', desc: 'ST toàn thể +20%. Đắc Đạo: tướng có công lực từ tầng 5 trở lên, ST +40% [VLĐMT]', mod: { atkPct: 0.20, tuthan: 0.40 },
    evo: { name: 'Đắc Đạo Chân Kinh', desc: 'tướng công lực từ tầng 6 trở lên: ST +20%, thời gian điều khí −5% [VLĐMT]', mod: { tuthan: 0.20, tuthanEvo: 1 } } },
  { id: 'dan_ct', sys: 'dan', tier: 2, lp: 'chieuthuc', name: 'Hoa Vũ Nghênh Xuân', field: 'lachoa', desc: 'ST tướng Hệ Đan +40%. Thần thông mới Hoa Vũ Nghênh Xuân: mỗi 6 giây hoa rơi hồi 4% HP cả đội + 100% ST chỗ quái đông; mỗi tầng tướng Đan +30% [VLĐMT]', mod: { 'dan.atkPct': 0.40 },
    evo: { name: 'Bách Hoa Tề Phóng', desc: 'ST Hoa Vũ Nghênh Xuân +50% [VLĐMT]', mod: { 'fev.lachoa': 0.50 } } },
  // ======== SÁT (sát thương đơn) ========
  { id: 'sat_core', sys: 'sat', tier: 2, lp: 'cotloi', name: 'Tru Tiên Kiếm Quyết', desc: 'ST tướng Hệ Sát +40%. Bản Mệnh Hệ Sát: mỗi bồi dưỡng 1 cấp, ST hệ Sát +20% (tối đa 5) [VLĐMT]', mod: { 'sat.atkPct': 0.40, 'sat.core': 1 },
    evo: { name: 'Tru Tiên Kiếm Trận', desc: 'ST cuối cùng hệ Sát +3%; mỗi bồi dưỡng 1 cấp, thời gian điều khí −3,5%, tối đa −17,5% [VLĐMT]', mod: { 'sat.final': 0.03, 'sat.coreEvo': 1 } } },
  { id: 'sat_ct', sys: 'sat', tier: 2, lp: 'chieuthuc', name: 'Ngự Kiếm Phi Hành', field: 'phikiem', desc: 'ST tướng Hệ Sát +40%. Thần thông mới Phi Kiếm Lăng Không: mỗi 4 giây 5 phi kiếm xuyên hàng, mỗi kiếm 80%; mỗi tầng tướng Sát +30% [VLĐMT]', mod: { 'sat.atkPct': 0.40 },
    evo: { name: 'Vạn Kiếm Đăng Thiên', desc: 'ST Phi Kiếm Lăng Không +50% [VLĐMT]', mod: { 'fev.phikiem': 0.50 } } },
  { id: 'sat_vk', sys: 'sat', tier: 2, lp: 'vienkhuyet', name: 'Nguyệt Doanh Kiếm', desc: 'ST toàn thể +20%. Nguyệt Hữu Âm Tình: đòn đánh ngẫu nhiên — Tàn Nguyệt: ST −20%; Mãn Nguyệt: ST +60% [VLĐMT]', mod: { atkPct: 0.20, vk: 1 },
    evo: { name: 'Hằng Nga Bôn Nguyệt', desc: 'Khi kích hoạt Mãn Nguyệt, ST dao động lại trong khoảng 80%–140% [VLĐMT]', mod: { vkEvo: 1 } } },
  { id: 'sat_vn1', sys: 'sat', tier: 2, lp: 'vonga', name: 'Nhập Định Kiếm Pháp', desc: 'ST toàn thể +20%. Mỗi đòn nhận 1 tầng Kiếm Ý: mỗi tầng tốc đánh −10%, ST +30%; đạt tầng 5 thì xoá [VLĐMT]', mod: { atkPct: 0.20, vn: 0.30, vnSlow: 0.10 },
    evo: { name: 'Xuất Thần Kiếm Pháp', desc: 'Mỗi tầng Kiếm Ý: ST cuối +3,5%, ST phải chịu −1% [VLĐMT]', mod: { vnFinal: 0.035, vnDr: 0.01 } } },
  { id: 'sat_vn2', sys: 'sat', tier: 2, lp: 'vonga', req: 'sat_vn1', name: 'Thiên Địa Nhất Kiếm', desc: 'ST toàn thể +20%. Kiếm Ý tăng cường: mỗi tầng tốc đánh −15%, ST +48% [VLĐMT]', mod: { atkPct: 0.20, vn: 0.18, vnSlow: 0.05 },
    evo: { name: 'Kiếm Tâm Thông Minh', desc: 'Mỗi tầng Kiếm Ý nhận 1 tầng Thấu Thị: bỏ qua 4% phòng thủ của mục tiêu, tối đa 5 tầng [VLĐMT]', mod: { vnSee: 0.04 } } },
  // ======== TRẬN (khống chế, hỗ trợ) ========
  { id: 'tran_core', sys: 'tran', tier: 2, lp: 'cotloi', name: 'Kỳ Môn Độn Giáp', desc: 'ST tướng Hệ Trận +40%. Bản Mệnh Hệ Trận: mỗi bồi dưỡng 1 cấp, ST hệ Trận +20% (tối đa 5) [VLĐMT]', mod: { 'tran.atkPct': 0.40, 'tran.core': 1 },
    evo: { name: 'Cửu Cung Bát Quái', desc: 'ST cuối cùng hệ Trận +3%; mỗi bồi dưỡng 1 cấp, thời gian điều khí −3,5%, tối đa −17,5% [VLĐMT]', mod: { 'tran.final': 0.03, 'tran.coreEvo': 1 } } },
  { id: 'tran_xt1', sys: 'tran', tier: 2, lp: 'xetoac', name: 'Phược Yêu Tỏa', desc: 'ST toàn thể +20%. Khi gây ST, ST +10%, 25% gắn 1 tầng Phệ Huyết (60% ST/giây, tối đa 5 tầng) [VLĐMT]', mod: { atkPct: 0.20, dmgPct: 0.10, tear: 0.25 },
    evo: { name: 'Khốn Tiên Thằng', desc: 'Lực công toàn thể +5%, ST Phệ Huyết +25% [VLĐMT]', mod: { atkPct: 0.05, tearDmg: 0.25 } } },
  { id: 'tran_xt2', sys: 'tran', tier: 2, lp: 'xetoac', req: 'tran_xt1', name: 'Phá Giáp Chú', desc: 'ST toàn thể +20%. Đánh kẻ địch có Phệ Huyết: mỗi tầng ST +8% [VLĐMT]', mod: { atkPct: 0.20, tear2: 0.08 },
    evo: { name: 'Hàng Long Phá Giáp Chú', desc: 'Lực công toàn thể +5%; khi gây ST Phệ Huyết, phòng thủ mục tiêu −4%, tối đa −20% [VLĐMT]', mod: { atkPct: 0.05, tearDef: 1 } } },
  { id: 'tran_bn', sys: 'tran', tier: 2, lp: 'baino', name: 'Triền Hồn Ti', desc: 'ST toàn thể +20%. Triền Đấu Bất Hưu: đánh liên tục cùng 1 kẻ địch, mỗi lần ST +1%, tối đa +50% [VLĐMT]', mod: { atkPct: 0.20, bn: 1 },
    evo: { name: 'Thiên La Địa Võng', desc: 'Triền Đấu: mỗi lần ST +2%, giới hạn tăng thêm 25%, tối đa +75% [VLĐMT]', mod: { bnEvo: 1 } } },
  { id: 'tran_ct', sys: 'tran', tier: 2, lp: 'chieuthuc', name: 'Tử Kim Châm Vũ', field: 'batquai', desc: 'ST tướng Hệ Trận +40%. Thần thông mới Tử Kim Châm Vũ: mỗi 6 giây mưa kim châm chỗ quái đông 120% + choáng 0,8 giây; mỗi tầng tướng Trận +30% [VLĐMT]', mod: { 'tran.atkPct': 0.40 },
    evo: { name: 'Vạn Châm Xuyên Tâm', desc: 'ST Tử Kim Châm Vũ +50% [VLĐMT]', mod: { 'fev.batquai': 0.50 } } },
];
const SYS_NAME = { the: 'Thể', phap: 'Pháp', dan: 'Đan', sat: 'Sát', tran: 'Trận' };
const CP_RAR = { 1: { name: 'Cơ bản', cls: 'r1' }, 2: { name: 'Cao cấp', cls: 'r2' }, 3: { name: 'Tiến bậc', cls: 'r3' } };

// Gacha (mục 8 của GDD)
const GACHA = { cost1: 150, cost10: 1350, ssr: 0.025, sr: 0.15, softFrom: 60, softStep: 0.05, hard: 80 };
