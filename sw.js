// Bộ nhớ đệm: ảnh/âm thanh lấy từ máy ngay (cập nhật ngầm để lần sau có bản mới); html luôn lấy mạng trước.
const C = 'ttdc-v10';   // tăng số này mỗi khi sửa hàng loạt ảnh: máy người chơi bỏ bản ảnh cũ trong bộ nhớ đệm, tải bản mới ngay lần mở đầu
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/art\/|\/audio\/|\/js\/|\/css\//.test(u.pathname)) {
    e.respondWith(caches.open(C).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;   // có sẵn thì trả ngay, đồng thời tải bản mới cho lần sau
    }));
  } else e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
