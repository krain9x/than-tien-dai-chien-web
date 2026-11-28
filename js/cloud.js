/* Lưu trực tuyến bằng Firebase (đăng nhập Google + Firestore). Mỗi người chỉ đọc/ghi users/<uid> của mình (quy tắc bảo mật phía máy chủ).
   main.js gọi: Cloud.ready(), Cloud.user, Cloud.signIn(), Cloud.signOut(), Cloud.push(S) (tự gom 3 giây), Cloud.onUser(cb). */
(function () {
  const CFG = {
    apiKey: 'AIzaSyC4vLIy5lI-Rpb1qk09UaTPfuo98Q_YRx0', authDomain: 'than-ma-chien.firebaseapp.com', projectId: 'than-ma-chien',
    storageBucket: 'than-ma-chien.firebasestorage.app', messagingSenderId: '426424932823', appId: '1:426424932823:web:16a940aef1124dcfbd5392',
  };
  const C = window.Cloud = { ok: false, user: null, err: null, _cbs: [], _t: null, lastPush: 0 };
  if (typeof firebase === 'undefined') { C.err = 'Không tải được Firebase'; return; }
  try { firebase.initializeApp(CFG); C.ok = true; } catch (e) { C.err = String(e); return; }
  const auth = firebase.auth(), db = firebase.firestore();
  const did = () => C.user.uid + ((window.SV_ID || 1) > 1 ? '_s' + window.SV_ID : '');   // mỗi máy chủ một bản lưu (S1 giữ id cũ)
  C.onUser = cb => { C._cbs.push(cb); if (C.user !== null) cb(C.user); };
  auth.onAuthStateChanged(u => { C.user = u || false; C._cbs.forEach(cb => { try { cb(C.user); } catch (e) { console.error(e); } }); });
  auth.getRedirectResult().catch(e => { C.err = e.message; });
  C.signIn = async () => {
    const p = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(p); }
    catch (e) { if (/popup|cancelled|operation-not-supported/i.test(e.code || e.message)) return auth.signInWithRedirect(p); throw e; }
  };
  C.signOut = () => auth.signOut();
  C.pull = async () => { if (!C.user) return null; const d = await db.collection('users').doc(did()).get(); return d.exists ? d.data() : null; };
  C.pushNow = async S => {
    if (!C.user) return;
    const data = JSON.parse(JSON.stringify(S));
    await db.collection('users').doc(did()).set({ save: JSON.stringify(data), ts: data.ts || Date.now(), name: C.user.displayName || '', v: 1 });
    C.lastPush = Date.now();
  };
  C.lbSet = d => C.user ? db.collection('lb').doc(did()).set(d) : Promise.resolve();
  C.lbTop = async (field, n) => { const q = await db.collection('lb').orderBy(field, 'desc').limit(n).get(); return q.docs.map(d => ({ uid: d.id, ...d.data() })); };
  // Luận Kiếm: arena/{uid} = đội thủ + điểm (cần quy tắc arena trong firestore.rules)
  C.arenaSet = d => C.user ? db.collection('arena').doc(did()).set(d) : Promise.resolve();
  C.arenaList = async n => { const q = await db.collection('arena').orderBy('ts', 'desc').limit(n).get(); return q.docs.map(d => ({ uid: d.id, ...d.data() })); };
  C.arenaTop = async n => { const q = await db.collection('arena').orderBy('rating', 'desc').limit(n).get(); return q.docs.map(d => ({ uid: d.id, ...d.data() })); };
  // 29/11: gom ghi — tối đa 1 lần/phút (gói miễn phí 20.000 lượt ghi/ngày), rời game thì ghi ngay (flush)
  C.push = S => { if (!C.user) return; C._pend = S; if (C._t) return; const wait = Math.max(3000, 60000 - (Date.now() - C.lastPush));
    C._t = setTimeout(() => { C._t = null; const d = C._pend; C._pend = null; if (d) C.pushNow(d).catch(e => { C.err = e.message; console.warn('cloud', e); }); }, wait); };
  C.flush = () => { if (!C.user || !C._pend) return; clearTimeout(C._t); C._t = null; const d = C._pend; C._pend = null; C.pushNow(d).catch(e => { C.err = e.message; }); };
})();
