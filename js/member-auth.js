/* =========================================================
   會員登入共用模組（Firebase Google 登入）
   - 首頁、包車頁共用同一套登入與會員資料建立邏輯，不要在頁面裡另外寫一份。
   - 需先載入：firebase-app-compat、firebase-auth-compat、firebase-firestore-compat、js/firebase-config.js
   - 本檔會自行載入 Google Identity Services（https://accounts.google.com/gsi/client）。
     使用者點擊登入時，優先用 GIS 在 accounts.google.com 取得 access token，
     再以 Firebase signInWithCredential 登入。這樣不會開啟
     shenlong-travel.firebaseapp.com 的跨網域登入頁，可避開 Safari／iOS Safari／
     嚴格隱私瀏覽器擋住該網域 sessionStorage（Unable to save initial state）的問題。
     GIS 還沒載入或被擋住時，才退回原本的 signInWithPopup。
   - 對外介面：window.SLMember
       .available                是否可用（Firebase 已設定且 auth 已載入）
       .msg(key)                 取得目前語言的提示文字（unavailable / failed / restricted）
       .signIn()                 開啟 Google 登入（需由使用者點擊觸發）；回傳 Promise
       .signOut()
       .saveNationality(value)   儲存國籍／地區
       .onChange(cb)             cb(user, info)；user 為 null 代表未登入；
                                 info = { isNew, hasNationality }
       .user                     目前登入者（未登入為 null）
   - 另會自動接管頁面上 id="nav-member-cta" 的導覽列按鈕（見下方 wireNavCta）。
   ========================================================= */
(function (w) {
  var isHans = (document.documentElement.lang || '').toLowerCase().indexOf('hans') > -1;
  var MSG = {
    unavailable: isHans
      ? '会员系统尚未设置完成，请直接私讯右下角客服，我们帮您手动开通会员优惠。'
      : '會員系統尚未設定完成，請直接私訊右下角客服，我們幫您手動開通會員優惠。',
    failed: isHans
      ? '登录失败，请再试一次，或直接私讯右下角客服注册会员。'
      : '登入失敗，請再試一次，或直接私訊右下角客服註冊會員。',
    restricted: isHans
      ? '这个浏览器限制了登录所需的存储空间，无法完成弹出窗口登录。请改用 Chrome，或用 Safari 普通模式（不要用无痕模式）打开本站后再试一次。'
      : '這個瀏覽器限制了登入所需的儲存空間，無法完成彈出視窗登入。請改用 Chrome，或用 Safari 一般模式（不要用無痕模式）開啟本站後再試一次。'
  };

  var available = typeof FIREBASE_READY !== 'undefined' && FIREBASE_READY &&
    typeof firebase !== 'undefined' && !!firebase.auth &&
    typeof auth !== 'undefined' && !!auth && typeof db !== 'undefined' && !!db;

  var CTA_TEXT = isHans ? { out: '我也要成龙', in: '会员中心' } : { out: '我也要成龍', in: '會員中心' };

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

  // 公開的 OAuth Web Client ID（與 Firebase 專案 shenlong-travel 同一個 GCP 專案）。沒有 client secret。
  var GOOGLE_CLIENT_ID = '153795209778-bkg26uninjkb913cf56p9b40difs9fno.apps.googleusercontent.com';
  var GIS_SRC = 'https://accounts.google.com/gsi/client';
  var tokenClient = null;
  var pendingResolve = null;

  function gisLoaded() {
    return !!(w.google && w.google.accounts && w.google.accounts.oauth2 &&
      typeof w.google.accounts.oauth2.initTokenClient === 'function');
  }

  function settleSignIn(value) {
    var resolve = pendingResolve;
    pendingResolve = null;
    if (resolve) resolve(value);
  }

  function beginSignIn() {
    // 上一輪若還掛著（例如連點），先放開，避免按鈕一直停在等待。
    if (pendingResolve) pendingResolve();
    return new Promise(function (resolve) { pendingResolve = resolve; });
  }

  function onGisToken(resp) {
    if (resp && resp.access_token) {
      var cred;
      try {
        cred = firebase.auth.GoogleAuthProvider.credential(null, resp.access_token);
      } catch (err) {
        console.error(err);
        alert(MSG.failed);
        settleSignIn();
        return;
      }
      auth.signInWithCredential(cred).then(function (result) {
        settleSignIn(result);
      }).catch(function (err) {
        console.error(err);
        alert(MSG.failed);
        settleSignIn();
      });
      return;
    }
    // 使用者關掉視窗或拒絕授權時，callback 可能帶 error 而沒有 access_token；不要當成系統失敗。
    var dismissed = resp && (resp.error === 'popup_closed' || resp.error === 'popup_closed_by_user' || resp.error === 'access_denied');
    if (resp && resp.error && !dismissed) {
      console.error(resp);
      alert(MSG.failed);
    }
    settleSignIn();
  }

  function onGisError(err) {
    var type = err && err.type ? String(err.type) : '';
    if (type.indexOf('popup_closed') !== -1) {
      settleSignIn();
      return;
    }
    console.error(err);
    alert(MSG.failed);
    settleSignIn();
  }

  function initTokenClient() {
    if (tokenClient || !gisLoaded()) return;
    try {
      tokenClient = w.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: onGisToken,
        error_callback: onGisError
      });
    } catch (err) {
      // GIS 有載入但初始化失敗時不要炸掉頁面；signIn() 會改走 popup。
      tokenClient = null;
      console.error(err);
    }
  }

  // 每個有載入本檔的頁面都自動補上 GIS，不用逐一改 HTML。
  function ensureGisScript() {
    if (gisLoaded()) {
      initTokenClient();
      return;
    }
    var existing = document.querySelector('script[src="' + GIS_SRC + '"]');
    if (!existing) {
      existing = document.createElement('script');
      existing.src = GIS_SRC;
      existing.async = true;
      existing.defer = true;
      (document.head || document.documentElement).appendChild(existing);
    }
    existing.addEventListener('load', initTokenClient);
    if (gisLoaded()) initTokenClient();
  }

  function isStorageRestriction(err) {
    var code = err && err.code ? String(err.code) : '';
    if (code === 'auth/web-storage-unsupported' || code === 'auth/operation-not-supported-in-this-environment') return true;
    var text = '';
    try {
      text = [err && err.message, err && err.code, err && err.customData ? JSON.stringify(err.customData) : ''].join(' ');
    } catch (e) {
      text = err && err.message ? String(err.message) : '';
    }
    return /sessionStorage|Unable to save initial state|storage is inaccessible|3rd party cookies|third-party cookies/i.test(text);
  }

  function signInWithPopupFallback() {
    return auth.signInWithPopup(provider).catch(function (err) {
      console.error(err);
      alert(isStorageRestriction(err) ? MSG.restricted : MSG.failed);
    });
  }

  // 必須在點擊當下同步呼叫 requestAccessToken，Safari 才不會把授權視窗當成非使用者手勢而擋住。
  SLMember.signIn = function () {
    if (gisLoaded()) {
      try {
        if (!tokenClient) initTokenClient();
        if (tokenClient) {
          var promise = beginSignIn();
          tokenClient.requestAccessToken({ prompt: 'select_account' });
          return promise;
        }
      } catch (err) {
        console.error(err);
        settleSignIn();
      }
    }
    return signInWithPopupFallback();
  };

  ensureGisScript();
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

  // ===== 導覽列主 CTA（id="nav-member-cta"）：未登入 → 點擊開 Google 登入彈窗；已登入 → 「會員中心」連到會員中心 =====
  // 會員系統不可用時不接手，按鈕維持頁面上原本的連結（fleet.html#member）。
  // href 用相對路徑：繁體頁在網站根目錄、簡體頁在 zh-cn/，各自連到同目錄的 member.html。
  function wireNavCta() {
    var btn = document.getElementById('nav-member-cta');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      if (SLMember.user) return;
      e.preventDefault();
      SLMember.signIn();
    });
    SLMember.onChange(function (user) {
      if (user) { btn.textContent = CTA_TEXT['in']; btn.href = 'member.html'; }
      else { btn.textContent = CTA_TEXT.out; btn.href = 'fleet.html#member'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireNavCta);
  else wireNavCta();

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
