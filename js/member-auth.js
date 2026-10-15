/* =========================================================
   會員登入共用模組（Firebase Google 登入）
   - 首頁、包車頁共用同一套登入與會員資料建立邏輯，不要在頁面裡另外寫一份。
   - 需先載入：firebase-app-compat、firebase-auth-compat、firebase-firestore-compat、js/firebase-config.js
   - 對外介面：window.SLMember
       .available                是否可用（Firebase 已設定且 auth 已載入）
       .msg(key)                 取得目前語言的提示文字（unavailable / failed）
       .signIn()                 開啟 Google 登入彈窗（需由使用者點擊觸發）
       .signOut()
       .saveNationality(value)   儲存國籍／地區
       .onChange(cb)             cb(user, info)；user 為 null 代表未登入；
                                 info = { isNew, hasNationality }
       .user                     目前登入者（未登入為 null）
   ========================================================= */
(function (w) {
  var isHans = (document.documentElement.lang || '').toLowerCase().indexOf('hans') > -1;
  var MSG = {
    unavailable: isHans
      ? '会员系统尚未设置完成，请直接私讯右下角客服，我们帮您手动开通会员优惠。'
      : '會員系統尚未設定完成，請直接私訊右下角客服，我們幫您手動開通會員優惠。',
    failed: isHans
      ? '登录失败，请再试一次，或直接私讯右下角客服注册会员。'
      : '登入失敗，請再試一次，或直接私訊右下角客服註冊會員。'
  };

  var available = typeof FIREBASE_READY !== 'undefined' && FIREBASE_READY &&
    typeof firebase !== 'undefined' && !!firebase.auth &&
    typeof auth !== 'undefined' && !!auth && typeof db !== 'undefined' && !!db;

  var SLMember = {
    available: available,
    user: null,
    msg: function (key) { return MSG[key] || ''; }
  };
  w.SLMember = SLMember;
  if (!available) {
    SLMember.onChange = function () {};
    return;
  }

  var provider = new firebase.auth.GoogleAuthProvider();
  var listeners = [];

  SLMember.signIn = function () {
    return auth.signInWithPopup(provider).catch(function (err) {
      alert(MSG.failed);
      console.error(err);
    });
  };
  SLMember.signOut = function () { return auth.signOut(); };
  SLMember.saveNationality = function (value) {
    var user = auth.currentUser;
    if (!user) return Promise.resolve();
    return db.collection('members').doc(user.uid).set({ nationality: value || null }, { merge: true });
  };
  SLMember.onChange = function (cb) {
    listeners.push(cb);
    if (lastState) cb(lastState.user, lastState.info);
  };

  var lastState = null;
  function emit(user, info) {
    lastState = { user: user, info: info };
    SLMember.user = user;
    listeners.slice().forEach(function (cb) { cb(user, info); });
  }

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      try { localStorage.removeItem('slMemberEmail'); } catch (e) {}
      emit(null, { isNew: false, hasNationality: false });
      return;
    }
    try { localStorage.setItem('slMemberEmail', user.email || ''); } catch (e) {}
    // 先通知「已登入」（UI 立刻更新），會員資料建立完成後再補一次帶有 isNew 等資訊
    emit(user, { isNew: false, hasNationality: true });

    var ref = db.collection('members').doc(user.uid);
    ref.get().then(function (doc) {
      if (!doc.exists) {
        return ref.set({
          email: user.email || null,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          nationality: null,
          points: 0,
          discountTier: '9折',
          registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () { emit(user, { isNew: true, hasNationality: false }); });
      }
      return ref.set({ lastLoginAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .then(function () { emit(user, { isNew: false, hasNationality: !!doc.data().nationality }); });
    }).catch(function (err) { console.error(err); });
  });
})(window);
