/* =========================================================
   會員登入共用模組（Firebase Google 登入）
   - 首頁、包車頁、會員中心、優惠券頁共用這一套，不要在頁面裡另外寫一份。
   - 需先載入：firebase-app-compat、firebase-auth-compat、firebase-firestore-compat、js/firebase-config.js
   - 正式站（shenlongtravel.com／www.shenlongtravel.com）用同視窗 Google OAuth 2.0
     OIDC（response_type=id_token）導向同源 /auth-callback.html，再以
     signInWithCredential 登入。這樣不會開 GIS initTokenClient 的
     storagerelay:// 彈窗，也不會經過 shenlong-travel.firebaseapp.com，
     可避開 Safari／iOS／手機瀏覽器弄丟 window.opener 或擋住跨網域回傳而停在空白頁。
   - localhost、預覽站等非正式網域仍用 GIS initTokenClient，載入失敗才退回
     signInWithPopup，本機與預覽環境不用登記 redirect URI 也能登入。
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
   - state 只放同源相對路徑。路徑規則與 auth-callback.html 相同：
     單一「/」開頭、不是「//」、不含反斜線與「://」。
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
  var NONCE_KEY = 'slAuthNonce';
  var tokenClient = null;
  var pendingResolve = null;

  function gisLoaded() {
    return !!(w.google && w.google.accounts && w.google.accounts.oauth2 &&
      typeof w.google.accounts.oauth2.initTokenClient === 'function');
  }

  function isProductionHost() {
    var host = (w.location && w.location.hostname ? String(w.location.hostname) : '').toLowerCase();
    return host === 'shenlongtravel.com' || host === 'www.shenlongtravel.com';
  }

  // 只接受站內相對路徑，擋掉 //evil、/\evil、https://evil 這類開放重導向。
  function safeReturnPath(input) {
    if (typeof input !== 'string') return '';
    var value = input;
    if (!value || value.charAt(0) !== '/') return '';
    if (value.charAt(1) === '/' || value.charAt(1) === '\\') return '';
    if (value.indexOf('\\') !== -1) return '';
    if (value.indexOf('://') !== -1) return '';
    if (/[\u0000-\u001F\u007F\s]/.test(value)) return '';
    if (value.length > 2048) return '';
    if (/\/auth-callback\.html(?:$|[?#])/i.test(value)) return '';
    return value;
  }

  function currentReturnPath() {
    var path = (w.location.pathname || '/') + (w.location.search || '');
    var hash = w.location.hash || '';
    if (hash.length > 1) path += hash;
    return safeReturnPath(path) || '/member.html';
  }

  function randomNonce() {
    var bytes = new Uint8Array(16);
    if (w.crypto && typeof w.crypto.getRandomValues === 'function') {
      w.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var hex = '';
    for (var j = 0; j < bytes.length; j++) hex += ('0' + bytes[j].toString(16)).slice(-2);
    return hex;
  }

  function startSameWindowOidc() {
    var nonce = randomNonce();
    // 嚴格模式若清掉 sessionStorage，回呼頁仍會用 id_token 完成登入，不在這裡中斷。
    try { w.sessionStorage.setItem(NONCE_KEY, nonce); } catch (e) {}
    var back = currentReturnPath();
    var redirectUri = w.location.origin + '/auth-callback.html';
    var url = 'https://accounts.google.com/o/oauth2/v2/auth'
      + '?client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&response_type=id_token'
      + '&scope=' + encodeURIComponent('openid email profile')
      + '&nonce=' + encodeURIComponent(nonce)
      + '&state=' + encodeURIComponent(back)
      + '&prompt=select_account';
    w.location.assign(url);
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

  // 非正式網域才補上 GIS。正式站改走同視窗導向，不再載入會開 storagerelay 彈窗的腳本。
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

  // 正式站必須在點擊當下同步 location.assign，瀏覽器才會當成使用者手勢。
  // 非正式站則在點擊當下同步呼叫 requestAccessToken，Safari 才不會把授權視窗當成非使用者手勢而擋住。
  SLMember.signIn = function () {
    if (isProductionHost()) {
      return new Promise(function (resolve) {
        try {
          startSameWindowOidc();
        } catch (err) {
          console.error(err);
          alert(MSG.failed);
          resolve();
        }
      });
    }
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

  if (!isProductionHost()) ensureGisScript();
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

  // ===== 導覽列主 CTA（id="nav-member-cta"）：未登入 → 點擊開 Google 登入；已登入 → 「會員中心」連到會員中心 =====
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
