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
  C.onUser = cb => { C._cbs.push(cb); if (C.user !== null) cb(C.user); };
  auth.onAuthStateChanged(u => { C.user = u || false; C._cbs.forEach(cb => { try { cb(C.user); } catch (e) { console.error(e); } }); });
  auth.getRedirectResult().catch(e => { C.err = e.message; });
  C.signIn = async () => {
    const p = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(p); }
    catch (e) { if (/popup|cancelled|operation-not-supported/i.test(e.code || e.message)) return auth.signInWithRedirect(p); throw e; }
  };
  C.signOut = () => auth.signOut();
  C.pull = async () => { if (!C.user) return null; const d = await db.collection('users').doc(C.user.uid).get(); return d.exists ? d.data() : null; };
  C.pushNow = async S => {
    if (!C.user) return;
    const data = JSON.parse(JSON.stringify(S));
    await db.collection('users').doc(C.user.uid).set({ save: JSON.stringify(data), ts: data.ts || Date.now(), name: C.user.displayName || '', v: 1 });
    C.lastPush = Date.now();
  };
  C.push = S => { if (!C.user) return; clearTimeout(C._t); C._t = setTimeout(() => C.pushNow(S).catch(e => { C.err = e.message; console.warn('cloud', e); }), 3000); };
})();
