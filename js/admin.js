/* =========================================================
   後台管理邏輯
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {

  if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY) {
    document.getElementById('login-screen').innerHTML =
      '<div class="login-box"><h1>尚未設定 Firebase</h1>' +
      '<p class="sub">請先在 js/firebase-config.js 貼上你的 Firebase 專案金鑰，才能使用後台。</p></div>';
    return;
  }

  var loginScreen = document.getElementById('login-screen');
  var adminShell = document.getElementById('admin-shell');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var userEmailEl = document.getElementById('user-email');
  var toast = document.getElementById('save-toast');

  // ===== 全域錯誤攔截：任何Firestore操作失敗都會跳出明確錯誤訊息，不再靜默失敗 =====
  window.addEventListener('unhandledrejection', function (event) {
    console.error('Firestore 操作失敗：', event.reason);
    var msg = (event.reason && event.reason.message) ? event.reason.message : String(event.reason);
    alert('操作失敗，請截圖這個訊息給開發者：\n\n' + msg);
    event.preventDefault();
  });

  function showToast(msg) {
    toast.textContent = msg || '已儲存';
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  // ===== 登入狀態監聽 =====
  auth.onAuthStateChanged(function (user) {
    if (user) {
      loginScreen.style.display = 'none';
      adminShell.classList.add('show');
      userEmailEl.textContent = user.email;
      loadRates();
      loadVisaPrices();
      loadTeamMembers();
      loadGuides();
      loadGuideRequests();
      loadFleetRoutes();
      loadFasttrackServices();
      loadFasttrackRequests();
      loadItineraryRequests();
      loadSiteContent();
      loadFleetRequests();
      loadRoutes2();
      loadSlides();
    } else {
      loginScreen.style.display = 'flex';
      adminShell.classList.remove('show');
    }
  });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.classList.remove('show');
    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(function () {
      loginError.classList.add('show');
    });
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    auth.signOut();
  });

  // ===== 分頁切換 =====
  document.querySelectorAll('.nav-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel).classList.add('active');
    });
  });

  /* =========================================================
     匯率設定
     ========================================================= */
  function loadRates() {
    db.collection('siteSettings').doc('exchangeRates').get().then(function (doc) {
      if (doc.exists) {
        var d = doc.data();
        document.getElementById('rate-usd').value = d.cnyToUsd || '';
        document.getElementById('rate-vnd').value = d.cnyToVnd || '';
      }
    });
  }

  document.getElementById('fill-default-rates').addEventListener('click', function () {
    document.getElementById('rate-usd').value = (1 / 6.7716).toFixed(4);
    document.getElementById('rate-vnd').value = 3868;
  });

  document.getElementById('save-rates').addEventListener('click', function () {
    var usd = parseFloat(document.getElementById('rate-usd').value);
    var vnd = parseFloat(document.getElementById('rate-vnd').value);
    if (!usd || !vnd) { alert('請輸入正確的匯率數字'); return; }
    db.collection('siteSettings').doc('exchangeRates').set({
      cnyToUsd: usd,
      cnyToVnd: vnd,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () { showToast('匯率已更新'); });
  });

  /* =========================================================
     簽證價目表
     ========================================================= */
  var visaListEl = document.getElementById('visa-list');
  var CATEGORY_LABELS = { arrival: '落地簽證', embassy: '使館貼紙簽', evisa: '電子簽證加急' };

  function visaRowHTML(id, d) {
    d = d || {};
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>類型</label><select class="f-category">' +
          Object.keys(CATEGORY_LABELS).map(function (k) {
            return '<option value="' + k + '"' + (d.category === k ? ' selected' : '') + '>' + CATEGORY_LABELS[k] + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="admin-field"><label>停留天數</label><input class="f-stay" value="' + (d.stay || '') + '" placeholder="例：15"></div>' +
        '<div class="admin-field"><label>入境次數（繁）</label><input class="f-entryHant" value="' + (d.entryHant || '') + '" placeholder="單次／多次"></div>' +
        '<div class="admin-field"><label>入境次數（簡）</label><input class="f-entrySimp" value="' + (d.entrySimp || '') + '" placeholder="单次／多次"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>辦理時效（繁）</label><input class="f-speedHant" value="' + (d.speedHant || '') + '" placeholder="例：3–4個工作日"></div>' +
        '<div class="admin-field"><label>辦理時效（簡）</label><input class="f-speedSimp" value="' + (d.speedSimp || '') + '" placeholder="例：3–4个工作日"></div>' +
        '<div class="admin-field"><label>價格（人民幣，留空＝詳詢）</label><input class="f-priceCNY" type="number" value="' + (d.priceCNY != null ? d.priceCNY : '') + '"></div>' +
        '<div class="admin-field"><label>排序</label><input class="f-order" type="number" value="' + (d.order != null ? d.order : 0) + '"></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-visa">儲存</button>' +
        '<button class="btn-delete delete-visa">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function loadVisaPrices() {
    visaListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('visaPrices').orderBy('order').get().then(function (snap) {
      if (snap.empty) {
        visaListEl.innerHTML = '<p class="desc">目前沒有資料，點下方「新增一筆價目」開始建立。</p>';
        return;
      }
      var html = '';
      snap.forEach(function (doc) { html += visaRowHTML(doc.id, doc.data()); });
      visaListEl.innerHTML = html;
      bindVisaRowEvents();
    });
  }

  function readVisaRow(card) {
    var price = card.querySelector('.f-priceCNY').value;
    return {
      category: card.querySelector('.f-category').value,
      stay: card.querySelector('.f-stay').value.trim(),
      entryHant: card.querySelector('.f-entryHant').value.trim(),
      entrySimp: card.querySelector('.f-entrySimp').value.trim(),
      speedHant: card.querySelector('.f-speedHant').value.trim(),
      speedSimp: card.querySelector('.f-speedSimp').value.trim(),
      priceCNY: price === '' ? null : parseFloat(price),
      order: parseInt(card.querySelector('.f-order').value, 10) || 0
    };
  }

  function bindVisaRowEvents() {
    visaListEl.querySelectorAll('.save-visa').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        var data = readVisaRow(card);
        var ref = id.indexOf('new-') === 0 ? db.collection('visaPrices').doc() : db.collection('visaPrices').doc(id);
        ref.set(data).then(function () { showToast('已儲存這筆價目'); loadVisaPrices(); });
      });
    });
    visaListEl.querySelectorAll('.delete-visa').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        if (id.indexOf('new-') === 0) { card.remove(); return; }
        if (!confirm('確定要刪除這筆價目嗎？')) return;
        db.collection('visaPrices').doc(id).delete().then(function () { showToast('已刪除'); loadVisaPrices(); });
      });
    });
  }

  document.getElementById('add-visa-row').addEventListener('click', function () {
    var tempId = 'new-' + Date.now();
    visaListEl.insertAdjacentHTML('beforeend', visaRowHTML(tempId, { order: 0 }));
    bindVisaRowEvents();
  });

  document.getElementById('seed-visa').addEventListener('click', function () {
    db.collection('visaPrices').limit(1).get().then(function (snap) {
      if (!snap.empty && !confirm('資料庫已經有簽證價目資料了，確定要再匯入一次嗎？（會產生重複資料，建議只在資料庫全空時使用）')) return;
      var SEED = [
        ['arrival','15','單次','单次','3–4個工作日','3–4个工作日',25],
        ['arrival','15','單次','单次','1個工作日','1个工作日',40],
        ['arrival','15','單次','单次','當天出簽（11:00前送件）','当天出签（11:00前送件）',120],
        ['arrival','30','單次','单次','3–4個工作日','3–4个工作日',35],
        ['arrival','30','單次','单次','1個工作日','1个工作日',50],
        ['arrival','30','單次','单次','當天出簽（11:00前送件）','当天出签（11:00前送件）',140],
        ['arrival','30','多次','多次','5個工作日','5个工作日',null],
        ['arrival','30','多次','多次','3–4個工作日','3–4个工作日',null],
        ['arrival','30','多次','多次','1個工作日','1个工作日',120],
        ['embassy','15','單次','单次','3–4個工作日（4工後生效）','3–4个工作日（4工后生效）',240],
        ['embassy','15','單次','单次','1個工作日（1工後生效）','1个工作日（1工后生效）',280],
        ['embassy','15','單次','单次','當天出簽','当天出签',null],
        ['embassy','15','單次','单次','4小時加急','4小时加急',null],
        ['embassy','30','單次','单次','3–4個工作日（4工後生效）','3–4个工作日（4工后生效）',260],
        ['embassy','30','單次','单次','1個工作日（1工後生效）','1个工作日（1工后生效）',300],
        ['embassy','30','單次','单次','當天出簽','当天出签',null],
        ['embassy','30','單次','单次','4小時加急','4小时加急',null],
        ['embassy','30','多次','多次','1–2個工作日','1–2个工作日',550],
        ['evisa','90','單次','单次','4個工作日','4个工作日',250],
        ['evisa','90','多次','多次','4個工作日','4个工作日',450],
        ['evisa','90','單次','单次','3個工作日','3个工作日',240],
        ['evisa','90','多次','多次','3個工作日','3个工作日',430],
        ['evisa','90','單次','单次','2個工作日（截止15:30）','2个工作日（截止15:30）',300],
        ['evisa','90','多次','多次','2個工作日（截止15:30）','2个工作日（截止15:30）',500],
        ['evisa','90','單次','单次','1個工作日（截止15:30）','1个工作日（截止15:30）',350],
        ['evisa','90','多次','多次','1個工作日（截止15:30）','1个工作日（截止15:30）',550],
        ['evisa','90','單次','单次','特急件・當天出簽（截止9:30）','特急件・当天出签（截止9:30）',450],
        ['evisa','90','多次','多次','特急件・當天出簽（截止9:30）','特急件・当天出签（截止9:30）',650],
        ['evisa','90','單次','单次','4小時加急（截止14:30）','4小时加急（截止14:30）',550],
        ['evisa','90','多次','多次','4小時加急（截止14:30）','4小时加急（截止14:30）',750],
      ];
      var batch = db.batch();
      SEED.forEach(function (row, i) {
        var ref = db.collection('visaPrices').doc();
        batch.set(ref, {
          category: row[0], stay: row[1], entryHant: row[2], entrySimp: row[3],
          speedHant: row[4], speedSimp: row[5], priceCNY: row[6], order: i
        });
      });
      batch.commit().then(function () { showToast('已匯入30筆簽證價目'); loadVisaPrices(); });
    });
  });

  /* =========================================================
     團隊成員
     ========================================================= */
  var teamListEl = document.getElementById('team-list');

  function teamRowHTML(id, d) {
    d = d || {};
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>頭像字母</label><input class="f-initial" value="' + (d.initial || '') + '" maxlength="2"></div>' +
        '<div class="admin-field"><label>姓名（英文顯示）</label><input class="f-nameEn" value="' + (d.nameEn || '') + '"></div>' +
        '<div class="admin-field"><label>排序</label><input class="f-order" type="number" value="' + (d.order != null ? d.order : 0) + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>職稱（繁）</label><input class="f-roleHant" value="' + (d.roleHant || '') + '"></div>' +
        '<div class="admin-field"><label>職稱（簡）</label><input class="f-roleSimp" value="' + (d.roleSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>簡介（繁）</label><input class="f-bioHant" value="' + (d.bioHant || '') + '"></div>' +
        '<div class="admin-field"><label>簡介（簡）</label><input class="f-bioSimp" value="' + (d.bioSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>導引語（繁）</label><input class="f-hintHant" value="' + (d.hintHant || '') + '"></div>' +
        '<div class="admin-field"><label>導引語（簡）</label><input class="f-hintSimp" value="' + (d.hintSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-team">儲存</button>' +
        '<button class="btn-delete delete-team">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function loadTeamMembers() {
    teamListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('teamMembers').orderBy('order').get().then(function (snap) {
      if (snap.empty) {
        teamListEl.innerHTML = '<p class="desc">目前沒有資料，點下方「新增一位成員」開始建立。</p>';
        return;
      }
      var html = '';
      snap.forEach(function (doc) { html += teamRowHTML(doc.id, doc.data()); });
      teamListEl.innerHTML = html;
      bindTeamRowEvents();
    });
  }

  function readTeamRow(card) {
    return {
      initial: card.querySelector('.f-initial').value.trim(),
      nameEn: card.querySelector('.f-nameEn').value.trim(),
      roleHant: card.querySelector('.f-roleHant').value.trim(),
      roleSimp: card.querySelector('.f-roleSimp').value.trim(),
      bioHant: card.querySelector('.f-bioHant').value.trim(),
      bioSimp: card.querySelector('.f-bioSimp').value.trim(),
      hintHant: card.querySelector('.f-hintHant').value.trim(),
      hintSimp: card.querySelector('.f-hintSimp').value.trim(),
      order: parseInt(card.querySelector('.f-order').value, 10) || 0
    };
  }

  function bindTeamRowEvents() {
    teamListEl.querySelectorAll('.save-team').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        var data = readTeamRow(card);
        var ref = id.indexOf('new-') === 0 ? db.collection('teamMembers').doc() : db.collection('teamMembers').doc(id);
        ref.set(data).then(function () { showToast('已儲存這位成員'); loadTeamMembers(); });
      });
    });
    teamListEl.querySelectorAll('.delete-team').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        if (id.indexOf('new-') === 0) { card.remove(); return; }
        if (!confirm('確定要刪除這位成員嗎？')) return;
        db.collection('teamMembers').doc(id).delete().then(function () { showToast('已刪除'); loadTeamMembers(); });
      });
    });
  }

  document.getElementById('add-team-row').addEventListener('click', function () {
    var tempId = 'new-' + Date.now();
    teamListEl.insertAdjacentHTML('beforeend', teamRowHTML(tempId, { order: 0 }));
    bindTeamRowEvents();
  });

  document.getElementById('seed-team').addEventListener('click', function () {
    db.collection('teamMembers').limit(1).get().then(function (snap) {
      if (!snap.empty && !confirm('資料庫已經有團隊成員資料了，確定要再匯入一次嗎？（會產生重複資料，建議只在資料庫全空時使用）')) return;
      var SEED = [
        {
          initial: 'J', nameEn: 'Joey Cheng', order: 0,
          roleHant: '共同創辦人．營運統籌', roleSimp: '共同创始人．运营统筹',
          bioHant: '負責整體統籌、業務分派與商務合作，是團隊裡拍板定案、也扛得住壓力的人。中英越三語，深耕越南6年以上。',
          bioSimp: '负责整体统筹、业务分派与商务合作，是团队里拍板定案、也扛得住压力的人。中英越三语，深耕越南6年以上。',
          hintHant: '私訊右下角諮詢按鈕，找Joey談商務合作或整體行程統籌，我們會直接幫你對接窗口。',
          hintSimp: '私信右下角咨询按钮，找Joey谈商务合作或整体行程统筹，我们会直接帮你对接窗口。'
        },
        {
          initial: 'Y', nameEn: 'Yang Peng', order: 1,
          roleHant: '共同創辦人．在地資源統籌', roleSimp: '共同创始人．在地资源统筹',
          bioHant: '包車、簽證、導遊與行程安排的全能擔當，手上握著最扎實、最多樣的越南在地資源，什麼問題都能秒回。中越雙語，深耕越南6年以上。',
          bioSimp: '包车、签证、导游与行程安排的全能担当，手上握着最扎实、最多样的越南在地资源，什么问题都能秒回。中越双语，深耕越南6年以上。',
          hintHant: '私訊右下角諮詢按鈕，找Yang辦包車或簽證，我們會直接幫你對接窗口。',
          hintSimp: '私信右下角咨询按钮，找Yang办包车或签证，我们会直接帮你对接窗口。'
        },
        {
          initial: 'C', nameEn: 'Joe Chou', order: 2,
          roleHant: '共同創辦人．內容主持人', roleSimp: '共同创始人．内容主持人',
          bioHant: '負責地陪導遊、行程安排與內容引流，也是升龍YouTube頻道的主持人——越南的KTV和按摩會館，他大概比誰都清楚該去哪家不踩雷。中越雙語，深耕越南6年以上。',
          bioSimp: '负责地陪导游、行程安排与内容引流，也是升龙YouTube频道的主持人——越南的KTV和按摩会所，他大概比谁都清楚该去哪家不踩雷。中越双语，深耕越南6年以上。',
          hintHant: '私訊右下角諮詢按鈕，找Joe辦地陪導遊或內容合作，我們會直接幫你對接窗口。',
          hintSimp: '私信右下角咨询按钮，找Joe办地陪导游或内容合作，我们会直接帮你对接窗口。'
        },
        {
          initial: 'W', nameEn: 'Wendy Qin', order: 3,
          roleHant: '留學顧問．客服窗口', roleSimp: '留学顾问．客服窗口',
          bioHant: '負責留學諮詢與客服對接，同時是教越南人中文的講師。最擅長在你還沒開口之前，就先猜到你需要什麼。中英越三語，深耕越南6年以上。',
          bioSimp: '负责留学咨询与客服对接，同时是教越南人中文的讲师。最擅长在你还没开口之前，就先猜到你需要什么。中英越三语，深耕越南6年以上。',
          hintHant: '私訊右下角諮詢按鈕，找Wendy辦留學諮詢，我們會直接幫你對接窗口。',
          hintSimp: '私信右下角咨询按钮，找Wendy办留学咨询，我们会直接帮你对接窗口。'
        }
      ];
      var batch = db.batch();
      SEED.forEach(function (member) {
        var ref = db.collection('teamMembers').doc();
        batch.set(ref, member);
      });
      batch.commit().then(function () { showToast('已匯入4位團隊成員'); loadTeamMembers(); });
    });
  });

  /* =========================================================
     地陪導遊管理
     ========================================================= */
  var SPECIALTY_LABELS = {
    business: '商務陪同', culture: '歷史文化深度遊', food: '在地美食探店',
    family: '親子家庭包團', photo: '攝影打卡跟拍', unsure: '不確定／推薦'
  };

  function guideCardHTML(id, d, mode) {
    d = d || {};
    var approveBtn = mode === 'pending'
      ? '<button class="btn-save approve-guide">核准，加入名單</button>'
      : '<button class="btn-save save-guide">儲存</button>';
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>姓名</label><input class="f-name" value="' + (d.name || '') + '"></div>' +
        '<div class="admin-field"><label>語言</label><input class="f-languages" value="' + (d.languages || '') + '"></div>' +
        '<div class="admin-field"><label>擅長類型</label><select class="f-specialty">' +
          Object.keys(SPECIALTY_LABELS).map(function (k) {
            return '<option value="' + k + '"' + (d.specialty === k ? ' selected' : '') + '>' + SPECIALTY_LABELS[k] + '</option>';
          }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>帶團經驗（年）</label><input class="f-years" value="' + (d.years || '') + '"></div>' +
        '<div class="admin-field"><label>聯絡方式（平台）</label><input class="f-contactMethod" value="' + (d.contactMethod || '') + '"></div>' +
        '<div class="admin-field"><label>聯絡帳號／號碼</label><input class="f-contactId" value="' + (d.contactId || '') + '"></div>' +
      '</div>' +
      '<div class="admin-field" style="margin-bottom:14px"><label>自我介紹</label><input class="f-bio" value="' + (d.bio || '') + '"></div>' +
      '<div class="admin-actions">' +
        approveBtn +
        '<button class="btn-delete delete-guide">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function readGuideCard(card) {
    return {
      name: card.querySelector('.f-name').value.trim(),
      languages: card.querySelector('.f-languages').value.trim(),
      specialty: card.querySelector('.f-specialty').value,
      specialtyLabel: SPECIALTY_LABELS[card.querySelector('.f-specialty').value],
      years: card.querySelector('.f-years').value.trim(),
      contactMethod: card.querySelector('.f-contactMethod').value.trim(),
      contactId: card.querySelector('.f-contactId').value.trim(),
      bio: card.querySelector('.f-bio').value.trim()
    };
  }

  var pendingListEl = document.getElementById('guides-pending-list');
  var approvedListEl = document.getElementById('guides-approved-list');

  function loadGuides() {
    pendingListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    approvedListEl.innerHTML = '<div class="admin-loading">載入中…</div>';

    db.collection('guides').where('approved', '==', false).get().then(function (snap) {
      if (snap.empty) { pendingListEl.innerHTML = '<p class="desc">目前沒有待審核的申請。</p>'; return; }
      var html = '';
      snap.forEach(function (doc) { html += guideCardHTML(doc.id, doc.data(), 'pending'); });
      pendingListEl.innerHTML = html;
      pendingListEl.querySelectorAll('.approve-guide').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.admin-card');
          var data = readGuideCard(card);
          data.approved = true;
          db.collection('guides').doc(card.dataset.id).set(data, { merge: true }).then(function () {
            showToast('已核准，加入導遊名單'); loadGuides();
          });
        });
      });
      pendingListEl.querySelectorAll('.delete-guide').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('確定要刪除這筆申請嗎？')) return;
          var card = btn.closest('.admin-card');
          db.collection('guides').doc(card.dataset.id).delete().then(function () { showToast('已刪除'); loadGuides(); });
        });
      });
    });

    db.collection('guides').where('approved', '==', true).get().then(function (snap) {
      if (snap.empty) { approvedListEl.innerHTML = '<p class="desc">目前沒有已核准的導遊。</p>'; return; }
      var html = '';
      snap.forEach(function (doc) { html += guideCardHTML(doc.id, doc.data(), 'approved'); });
      approvedListEl.innerHTML = html;
      approvedListEl.querySelectorAll('.save-guide').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.admin-card');
          var data = readGuideCard(card);
          data.approved = true;
          db.collection('guides').doc(card.dataset.id).set(data, { merge: true }).then(function () {
            showToast('已儲存'); loadGuides();
          });
        });
      });
      approvedListEl.querySelectorAll('.delete-guide').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('確定要把這位導遊從名單移除嗎？')) return;
          var card = btn.closest('.admin-card');
          db.collection('guides').doc(card.dataset.id).delete().then(function () { showToast('已刪除'); loadGuides(); });
        });
      });
    });
  }

  var requestsListEl = document.getElementById('guide-requests-list');
  var STATUS_OPTIONS = ['待配對', '已配對', '已完成'];

  function requestCardHTML(id, d) {
    d = d || {};
    var created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString('zh-TW') : '—';
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>需求編號</label><input value="' + (d.requestId || '') + '" disabled></div>' +
        '<div class="admin-field"><label style="color:var(--accent);font-weight:700">📞 聯絡方式</label><input value="' + (d.contact || '（未留下，舊資料）') + '" disabled style="font-weight:700;color:var(--accent)"></div>' +
        '<div class="admin-field"><label>想要的類型</label><input value="' + (d.guideTypeLabel || '') + '" disabled></div>' +
        '<div class="admin-field"><label>語言需求</label><input value="' + (d.language || '') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>天數</label><input value="' + (d.days || '') + '" disabled></div>' +
        '<div class="admin-field"><label>備註</label><input value="' + (d.note || '') + '" disabled></div>' +
        '<div class="admin-field"><label>送出時間</label><input value="' + created + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>處理狀態</label><select class="f-status">' +
          STATUS_OPTIONS.map(function (s) { return '<option' + (d.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="admin-field"><label>配對的導遊（手動填寫）</label><input class="f-matchedGuide" value="' + (d.matchedGuide || '') + '"></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-request">儲存</button>' +
        '<button class="btn-delete delete-request">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function loadGuideRequests() {
    requestsListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('guideRequests').orderBy('createdAt', 'desc').get().then(function (snap) {
      if (snap.empty) { requestsListEl.innerHTML = '<p class="desc">目前沒有客戶配對需求。</p>'; return; }
      var html = '';
      snap.forEach(function (doc) { html += requestCardHTML(doc.id, doc.data()); });
      requestsListEl.innerHTML = html;
      requestsListEl.querySelectorAll('.save-request').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.admin-card');
          db.collection('guideRequests').doc(card.dataset.id).set({
            status: card.querySelector('.f-status').value,
            matchedGuide: card.querySelector('.f-matchedGuide').value.trim()
          }, { merge: true }).then(function () { showToast('已更新'); loadGuideRequests(); });
        });
      });
      requestsListEl.querySelectorAll('.delete-request').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('確定要刪除這筆需求嗎？')) return;
          var card = btn.closest('.admin-card');
          db.collection('guideRequests').doc(card.dataset.id).delete().then(function () { showToast('已刪除'); loadGuideRequests(); });
        });
      });
    });
  }

  /* =========================================================
     包車與派車管理
     ========================================================= */
  var fleetListEl = document.getElementById('fleet-list');

  function fleetCardHTML(id, p, c) {
    p = p || {}; c = c || {};
    var mode = p.mode || 'point';
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>模式</label><select class="f-mode">' +
          '<option value="point"' + (mode === 'point' ? ' selected' : '') + '>point（點到點）</option>' +
          '<option value="hourly"' + (mode === 'hourly' ? ' selected' : '') + '>hourly（論時數）</option>' +
        '</select></div>' +
        '<div class="admin-field"><label>路線（僅point模式用）</label><input class="f-route" value="' + (p.route || '') + '" placeholder="例：芒街-河內"></div>' +
        '<div class="admin-field"><label>時數（僅hourly模式用）</label><input class="f-hours" value="' + (p.hours || '') + '" placeholder="例：8 或 10"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>車型</label><input class="f-vehicleType" value="' + (p.vehicleType || '') + '" placeholder="例：普通5-7座"></div>' +
        '<div class="admin-field"><label>備註（繁）</label><input class="f-note" value="' + (p.note || '') + '"></div>' +
        '<div class="admin-field"><label>備註（簡）</label><input class="f-noteSimp" value="' + (p.noteSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>售價下限（人民幣）</label><input class="f-priceMin calc-num" type="number" value="' + (p.priceCNYMin != null ? p.priceCNYMin : '') + '"></div>' +
        '<div class="admin-field"><label>售價上限（人民幣，同下限則單一價）</label><input class="f-priceMax calc-num" type="number" value="' + (p.priceCNYMax != null ? p.priceCNYMax : '') + '"></div>' +
        '<div class="admin-field"><label>成本下限（人民幣，客戶端看不到）</label><input class="f-costMin calc-num" type="number" value="' + (c.costCNYMin != null ? c.costCNYMin : '') + '"></div>' +
        '<div class="admin-field"><label>成本上限（人民幣，客戶端看不到）</label><input class="f-costMax calc-num" type="number" value="' + (c.costCNYMax != null ? c.costCNYMax : '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>中文司機加價後總價（人民幣，留空＝不提供）</label><input class="f-driverSurcharge" type="number" value="' + (p.driverZhSurchargeCNY != null ? p.driverZhSurchargeCNY : '') + '"></div>' +
        '<div class="admin-field"><label>中文司機備註（繁）</label><input class="f-driverNote" value="' + (p.driverZhNote || '') + '"></div>' +
        '<div class="admin-field"><label>中文司機備註（簡）</label><input class="f-driverNoteSimp" value="' + (p.driverZhNoteSimp || '') + '"></div>' +
        '<div class="admin-field"><label>排序</label><input class="f-order" type="number" value="' + (p.order != null ? p.order : 0) + '"></div>' +
      '</div>' +
      '<div class="admin-row" style="grid-template-columns:auto 1fr">' +
        '<div class="admin-field"><label>＊價格待複核</label><input class="f-needsReview" type="checkbox"' + (p.needsReview ? ' checked' : '') + ' style="width:20px;height:20px;margin-top:6px"></div>' +
        '<div class="admin-field"><label>預估毛利（自動計算，僅供參考）</label><div class="fleet-profit-preview" style="padding:9px 2px;font-size:14px;color:var(--accent)">—</div></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-fleet">儲存</button>' +
        '<button class="btn-delete delete-fleet">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function readFleetCard(card) {
    var priceMin = parseFloat(card.querySelector('.f-priceMin').value);
    var priceMax = parseFloat(card.querySelector('.f-priceMax').value);
    var costMin = parseFloat(card.querySelector('.f-costMin').value);
    var costMax = parseFloat(card.querySelector('.f-costMax').value);
    var surcharge = card.querySelector('.f-driverSurcharge').value;
    return {
      pub: {
        mode: card.querySelector('.f-mode').value,
        route: card.querySelector('.f-route').value.trim(),
        hours: card.querySelector('.f-hours').value.trim(),
        vehicleType: card.querySelector('.f-vehicleType').value.trim(),
        note: card.querySelector('.f-note').value.trim(),
        noteSimp: card.querySelector('.f-noteSimp').value.trim(),
        priceCNYMin: isNaN(priceMin) ? null : priceMin,
        priceCNYMax: isNaN(priceMax) ? (isNaN(priceMin) ? null : priceMin) : priceMax,
        driverZhSurchargeCNY: surcharge === '' ? null : parseFloat(surcharge),
        driverZhNote: card.querySelector('.f-driverNote').value.trim(),
        driverZhNoteSimp: card.querySelector('.f-driverNoteSimp').value.trim(),
        needsReview: card.querySelector('.f-needsReview').checked,
        order: parseInt(card.querySelector('.f-order').value, 10) || 0
      },
      cost: {
        costCNYMin: isNaN(costMin) ? null : costMin,
        costCNYMax: isNaN(costMax) ? (isNaN(costMin) ? null : costMin) : costMax
      }
    };
  }

  function updateProfitPreview(card) {
    var d = readFleetCard(card);
    var el = card.querySelector('.fleet-profit-preview');
    if (d.pub.priceCNYMin == null || d.cost.costCNYMin == null) { el.textContent = '—（請填售價與成本）'; return; }
    var profitMin = d.pub.priceCNYMin - d.cost.costCNYMin;
    var profitMax = d.pub.priceCNYMax - d.cost.costCNYMax;
    var marginMin = d.cost.costCNYMin ? (profitMin / d.pub.priceCNYMin * 100).toFixed(1) : '—';
    var marginMax = d.cost.costCNYMax ? (profitMax / d.pub.priceCNYMax * 100).toFixed(1) : '—';
    el.textContent = '¥' + profitMin.toFixed(0) + '–' + profitMax.toFixed(0) + '（毛利率約 ' + marginMin + '–' + marginMax + '%）';
  }

  function loadFleetRoutes() {
    fleetListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    Promise.all([
      db.collection('fleetRoutesPublic').get(),
      db.collection('fleetRoutesCost').get()
    ]).then(function (results) {
      var pubSnap = results[0], costSnap = results[1];
      var costMap = {};
      costSnap.forEach(function (doc) { costMap[doc.id] = doc.data(); });

      var rows = [];
      pubSnap.forEach(function (doc) { rows.push({ id: doc.id, pub: doc.data(), cost: costMap[doc.id] || {} }); });
      rows.sort(function (a, b) { return (a.pub.order || 0) - (b.pub.order || 0); });

      if (!rows.length) { fleetListEl.innerHTML = '<p class="desc">目前沒有資料，點下方按鈕新增或一鍵匯入。</p>'; return; }
      fleetListEl.innerHTML = rows.map(function (r) { return fleetCardHTML(r.id, r.pub, r.cost); }).join('');
      bindFleetRowEvents();
    });
  }

  function bindFleetRowEvents() {
    fleetListEl.querySelectorAll('.admin-card').forEach(function (card) {
      updateProfitPreview(card);
      card.querySelectorAll('.calc-num').forEach(function (input) {
        input.addEventListener('input', function () { updateProfitPreview(card); });
      });
    });
    fleetListEl.querySelectorAll('.save-fleet').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        var data = readFleetCard(card);
        var ref = id.indexOf('new-') === 0 ? db.collection('fleetRoutesPublic').doc() : db.collection('fleetRoutesPublic').doc(id);
        var finalId = ref.id;
        Promise.all([
          ref.set(data.pub),
          db.collection('fleetRoutesCost').doc(finalId).set(data.cost)
        ]).then(function () { showToast('已儲存這筆資料'); loadFleetRoutes(); });
      });
    });
    fleetListEl.querySelectorAll('.delete-fleet').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        if (id.indexOf('new-') === 0) { card.remove(); return; }
        if (!confirm('確定要刪除這筆資料嗎？（售價與成本會一起刪除）')) return;
        Promise.all([
          db.collection('fleetRoutesPublic').doc(id).delete(),
          db.collection('fleetRoutesCost').doc(id).delete()
        ]).then(function () { showToast('已刪除'); loadFleetRoutes(); });
      });
    });
  }

  document.getElementById('add-fleet-row').addEventListener('click', function () {
    var tempId = 'new-' + Date.now();
    fleetListEl.insertAdjacentHTML('beforeend', fleetCardHTML(tempId, { mode: 'point', order: 0 }, {}));
    bindFleetRowEvents();
  });

  document.getElementById('seed-fleet').addEventListener('click', function () {
    db.collection('fleetRoutesPublic').limit(1).get().then(function (snap) {
      if (!snap.empty && !confirm('資料庫已經有包車資料了，確定要再匯入一次嗎？（會產生重複資料）')) return;

      // [mode, route, hours, vehicleType, note, noteSimp, priceMin, priceMax, costMin, costMax, driverSurcharge, driverNote, driverNoteSimp, needsReview]
      var SEED = [
        ['point','芒街-河內','','普通5-7座','','',850,920,680,710,null,'',''  ,false],
        ['point','芒街-河內','','商務7座','','',1200,1250,760,760,null,'','',false],
        ['point','芒街-河內','','商務9-11座','','',1350,1350,1100,1100,null,'','',false],
        ['point','芒街-下龍灣','','普通5-7座','','',460,520,350,370,null,'','',false],
        ['point','芒街-下龍灣','','商務7座','','',750,750,575,575,null,'','',false],
        ['point','芒街-下龍灣','','商務9-11座','','',900,950,800,850,null,'','',false],
        ['point','下龍灣-河內','','普通5-7座','','',520,520,350,370,null,'','',false],
        ['point','下龍灣-河內','','商務7座','','',750,750,575,575,null,'','',false],
        ['point','下龍灣-河內','','商務9-11座','','',900,900,800,850,null,'','',false],
        ['point','河內-寧平','當日往返','普通5-7座','當日往返','当日往返',1050,1050,680,680,null,'','',false],
        ['point','河內-寧平','','商務7座','當日往返','当日往返',1350,1350,760,760,null,'','',false],
        ['point','河內-寧平','','商務9-11座','當日往返','当日往返',1450,1450,1200,1200,null,'','',false],
        ['point','機場-河內','','普通5-7座','接機/送機　＊金額待確認','接机/送机　＊金额待确认',120,120,100,100,null,'','',true],
        ['point','機場-河內','','商務7座','接機/送機　＊金額待確認','接机/送机　＊金额待确认',450,450,250,250,null,'','',true],
        ['point','機場-河內','','商務9-11座','接機/送機　＊金額待確認','接机/送机　＊金额待确认',500,500,320,320,null,'','',true],
        ['point','河內-北寧','','普通5-7座','＊金額待確認','＊金额待确认',160,200,null,null,null,'','',true],
        ['point','河內-北寧','','商務7座','＊金額待確認','＊金额待确认',450,450,250,250,null,'','',true],
        ['point','河內-北寧','','商務9-11座','＊金額待確認','＊金额待确认',550,550,320,320,null,'','',true],
        ['hourly','','8','普通5-7座','100km以內，超公里數135k越南盾/公里','100km以内，超公里数135k越南盾/公里',550,550,450,450,860,'指定中文司機／8小時100km／需提前預約，臨時恐難找','指定中文司机／8小时100km／需提前预约，临时恐难找',false],
        ['hourly','','8','商務7座','100km以內，超公里數135k越南盾/公里','100km以内，超公里数135k越南盾/公里',1150,1150,750,750,null,'','',false],
        ['hourly','','8','商務9-11座','100km以內，超公里數135k越南盾/公里','100km以内，超公里数135k越南盾/公里',1250,1250,850,850,null,'','',false],
        ['hourly','','10','商務7座','100km以內，超公里數135k越南盾/公里','100km以内，超公里数135k越南盾/公里',null,null,null,null,1550,'指定中文司機／10小時100km／需提前預約，臨時恐難找','指定中文司机／10小时100km／需提前预约，临时恐难找',false],
      ];

      var batch = db.batch();
      SEED.forEach(function (row, i) {
        var ref = db.collection('fleetRoutesPublic').doc();
        batch.set(ref, {
          mode: row[0], route: row[1], hours: row[2], vehicleType: row[3],
          note: row[4], noteSimp: row[5],
          priceCNYMin: row[6], priceCNYMax: row[7],
          driverZhSurchargeCNY: row[10], driverZhNote: row[11], driverZhNoteSimp: row[12],
          needsReview: row[13], order: i
        });
        batch.set(db.collection('fleetRoutesCost').doc(ref.id), {
          costCNYMin: row[8], costCNYMax: row[9]
        });
      });
      batch.commit().then(function () { showToast('已匯入包車與時數資料'); loadFleetRoutes(); });
    });
  });

  /* =========================================================
     快速通關管理
     ========================================================= */
  var fasttrackListEl = document.getElementById('fasttrack-list');

  function fasttrackCardHTML(id, d) {
    d = d || {};
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>機場名稱（繁）</label><input class="f-nameHant" value="' + (d.nameHant || '') + '"></div>' +
        '<div class="admin-field"><label>機場名稱（簡）</label><input class="f-nameSimp" value="' + (d.nameSimp || '') + '"></div>' +
        '<div class="admin-field"><label>機場代碼</label><input class="f-code" value="' + (d.code || '') + '" placeholder="例：HAN"></div>' +
        '<div class="admin-field"><label>排序</label><input class="f-order" type="number" value="' + (d.order != null ? d.order : 0) + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>日間價格（人民幣，留空＝詳詢）</label><input class="f-day" type="number" value="' + (d.dayPriceCNY != null ? d.dayPriceCNY : '') + '"></div>' +
        '<div class="admin-field"><label>夜間價格（人民幣，留空＝詳詢）</label><input class="f-night" type="number" value="' + (d.nightPriceCNY != null ? d.nightPriceCNY : '') + '"></div>' +
        '<div class="admin-field"><label>舉牌加價（人民幣）</label><input class="f-board" type="number" value="' + (d.boardSurchargeCNY != null ? d.boardSurchargeCNY : 100) + '"></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-fasttrack">儲存</button>' +
        '<button class="btn-delete delete-fasttrack">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function readFasttrackCard(card) {
    var day = card.querySelector('.f-day').value;
    var night = card.querySelector('.f-night').value;
    return {
      nameHant: card.querySelector('.f-nameHant').value.trim(),
      nameSimp: card.querySelector('.f-nameSimp').value.trim(),
      code: card.querySelector('.f-code').value.trim().toUpperCase(),
      dayPriceCNY: day === '' ? null : parseFloat(day),
      nightPriceCNY: night === '' ? null : parseFloat(night),
      boardSurchargeCNY: parseFloat(card.querySelector('.f-board').value) || 100,
      order: parseInt(card.querySelector('.f-order').value, 10) || 0
    };
  }

  function loadFasttrackServices() {
    fasttrackListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('fastTrackServices').get().then(function (snap) {
      if (snap.empty) { fasttrackListEl.innerHTML = '<p class="desc">目前沒有機場資料，點下方按鈕新增或一鍵匯入。</p>'; return; }
      var rows = [];
      snap.forEach(function (doc) { rows.push({ id: doc.id, data: doc.data() }); });
      rows.sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
      fasttrackListEl.innerHTML = rows.map(function (r) { return fasttrackCardHTML(r.id, r.data); }).join('');
      bindFasttrackRowEvents();
    });
  }

  function bindFasttrackRowEvents() {
    fasttrackListEl.querySelectorAll('.save-fasttrack').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        var data = readFasttrackCard(card);
        var ref = id.indexOf('new-') === 0 ? db.collection('fastTrackServices').doc() : db.collection('fastTrackServices').doc(id);
        ref.set(data).then(function () { showToast('已儲存'); loadFasttrackServices(); });
      });
    });
    fasttrackListEl.querySelectorAll('.delete-fasttrack').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        if (id.indexOf('new-') === 0) { card.remove(); return; }
        if (!confirm('確定要刪除這個機場嗎？')) return;
        db.collection('fastTrackServices').doc(id).delete().then(function () { showToast('已刪除'); loadFasttrackServices(); });
      });
    });
  }

  document.getElementById('add-fasttrack-row').addEventListener('click', function () {
    var tempId = 'new-' + Date.now();
    fasttrackListEl.insertAdjacentHTML('beforeend', fasttrackCardHTML(tempId, { order: 0, boardSurchargeCNY: 100 }));
    bindFasttrackRowEvents();
  });

  document.getElementById('seed-fasttrack').addEventListener('click', function () {
    db.collection('fastTrackServices').limit(1).get().then(function (snap) {
      if (!snap.empty && !confirm('資料庫已經有機場資料了，確定要再匯入一次嗎？（會產生重複資料）')) return;

      // [繁, 簡, 代碼]，全部先套用統一價格：日間200／夜間250／舉牌+100（人民幣）
      var AIRPORTS = [
        ['河內內排機場','河内内排机场','HAN'],
        ['胡志明新山一機場','胡志明新山一机场','SGN'],
        ['峴港機場','岘港机场','DAD'],
        ['金蘭機場（芽莊）','金兰机场（芽庄）','CXR'],
        ['富國島機場','富国岛机场','PQC'],
        ['海防吉埠機場','海防吉埠机场','HPH'],
        ['順化富牌機場','顺化富牌机场','HUI'],
        ['大叻蓮香機場','大叻莲香机场','DLI'],
        ['芹苴機場','芹苴机场','VCA'],
        ['雲屯機場（下龍）','云屯机场（下龙）','VDO'],
        ['榮市機場','荣市机场','VII'],
        ['朱萊機場（廣南）','朱莱机场（广南）','VCL'],
        ['波萊古機場','波莱古机场','PXU'],
        ['邦美蜀機場','邦美蜀机场','BMV'],
        ['歸仁機場','归仁机场','UIH'],
        ['綏和機場','绥和机场','TBB'],
        ['崑島機場','昆岛机场','VCS'],
        ['迪石機場','迪石机场','VKG'],
        ['洞海機場','洞海机场','VDH'],
        ['奠邊府機場','奠边府机场','DIN']
      ];

      var batch = db.batch();
      AIRPORTS.forEach(function (a, i) {
        var ref = db.collection('fastTrackServices').doc();
        batch.set(ref, {
          nameHant: a[0], nameSimp: a[1], code: a[2],
          dayPriceCNY: 200, nightPriceCNY: 250, boardSurchargeCNY: 100,
          order: i
        });
      });
      batch.commit().then(function () { showToast('已匯入20個機場'); loadFasttrackServices(); });
    });
  });

  var fasttrackRequestsListEl = document.getElementById('fasttrack-requests-list');
  function ftRequestCardHTML(id, d) {
    d = d || {};
    var created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString('zh-TW') : '—';
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      (d.isRush ? '<p style="color:var(--accent);font-size:12.5px;font-weight:700;margin-bottom:10px">⚡ 急件（預約不足24小時，已加收加急費）</p>' : '') +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>需求編號</label><input value="' + (d.requestId || '') + '" disabled></div>' +
        '<div class="admin-field"><label style="color:var(--accent);font-weight:700">📞 聯絡方式</label><input value="' + (d.contact || '（未留下，舊資料）') + '" disabled style="font-weight:700;color:var(--accent)"></div>' +
        '<div class="admin-field"><label>機場</label><input value="' + (d.airportName || '') + '" disabled></div>' +
        '<div class="admin-field"><label>時段</label><input value="' + (d.time === 'night' ? '夜間' : '日間') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>預計服務日期</label><input value="' + (d.serviceDate || '未填寫') + '" disabled></div>' +
        '<div class="admin-field"><label>出行人數</label><input value="' + (d.people || '未填寫') + '" disabled></div>' +
        '<div class="admin-field"><label>加購舉牌</label><input value="' + (d.board ? '是' : '否') + '" disabled></div>' +
        '<div class="admin-field"><label>電子簽/落地批文快速換證</label><input value="' + (d.queueHelp ? '是' : '否') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>送出時間</label><input value="' + created + '" disabled></div>' +
      '</div>' +
      '<div class="admin-actions"><button class="btn-delete delete-ftrequest">刪除</button></div>' +
      '</div>'
    );
  }
  function loadFasttrackRequests() {
    fasttrackRequestsListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('fastTrackRequests').orderBy('createdAt', 'desc').get().then(function (snap) {
      if (snap.empty) { fasttrackRequestsListEl.innerHTML = '<p class="desc">目前沒有客戶預約需求。</p>'; return; }
      var html = '';
      snap.forEach(function (doc) { html += ftRequestCardHTML(doc.id, doc.data()); });
      fasttrackRequestsListEl.innerHTML = html;
      fasttrackRequestsListEl.querySelectorAll('.delete-ftrequest').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('確定要刪除這筆需求嗎？')) return;
          var card = btn.closest('.admin-card');
          db.collection('fastTrackRequests').doc(card.dataset.id).delete().then(function () { showToast('已刪除'); loadFasttrackRequests(); });
        });
      });
    });
  }

  /* =========================================================
     定制行程需求管理
     ========================================================= */
  var itineraryListEl = document.getElementById('itinerary-requests-list');
  var ITIN_STATUS_OPTIONS = ['待報價', '已報價', '已成交', '已結束'];

  function arr(v) { return (v && v.length) ? v.join('、') : '—'; }

  function itineraryCardHTML(id, d) {
    d = d || {};
    var created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString('zh-TW') : '—';
    var ratio = d.diningRatio || {};
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>需求編號</label><input value="' + (d.requestId || '') + '" disabled></div>' +
        '<div class="admin-field"><label style="color:var(--accent);font-weight:700">📞 聯絡方式</label><input value="' + (d.contact || '') + '" disabled style="font-weight:700;color:var(--accent)"></div>' +
        '<div class="admin-field"><label>送出時間</label><input value="' + created + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>抵達</label><input value="' + (d.arriveNotBooked ? '機票未訂，預計 ' + (d.arriveMonth || '未填') : [d.arriveDate, d.arriveTime, d.arriveAirport].filter(Boolean).join(' ') || '—') + '" disabled></div>' +
        '<div class="admin-field"><label>離境</label><input value="' + (d.departNotBooked ? '機票未訂，預計 ' + (d.departMonth || '未填') : [d.departDate, d.departTime, d.departAirport].filter(Boolean).join(' ') || '—') + '" disabled></div>' +
        '<div class="admin-field"><label>天數</label><input value="' + (d.days || '—') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>出行目的</label><input value="' + arr(d.purposes) + '" disabled></div>' +
        '<div class="admin-field"><label>酒店預算</label><input value="' + (d.hotelBudget || '—') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>餐飲比例</label><input value="頂級' + (ratio.top || 0) + '%／高端' + (ratio.mid || 0) + '%／地道' + (ratio.low || 0) + '%" disabled></div>' +
        '<div class="admin-field"><label>成人／兒童／長輩</label><input value="' + [d.adults, d.children, d.seniors].filter(Boolean).join('／') + '" disabled></div>' +
        '<div class="admin-field"><label>國籍</label><input value="' + (d.nationality || '—') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>語言</label><input value="' + arr(d.languages) + '" disabled></div>' +
        '<div class="admin-field"><label>行李</label><input value="' + [d.luggage, d.specialLuggage].filter(Boolean).join('，') + '" disabled></div>' +
        '<div class="admin-field"><label>意向區域</label><input value="' + arr(d.regions) + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>行程節奏</label><input value="' + (d.pace || '—') + '" disabled></div>' +
        '<div class="admin-field"><label>加值服務</label><input value="' + arr(d.addons) + '" disabled></div>' +
        '<div class="admin-field"><label>飲食禁忌</label><input value="' + (arr(d.dietary) + (d.dietaryNote ? '（' + d.dietaryNote + '）' : '')) + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>特別安排</label><input value="' + arr(d.special) + '" disabled></div>' +
        '<div class="admin-field"><label>開票需求</label><input value="' + (d.invoice || '—') + '" disabled></div>' +
        '<div class="admin-field"><label>處理狀態</label><select class="f-status">' +
          ITIN_STATUS_OPTIONS.map(function (s) { return '<option' + (d.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      (d.note ? '<div class="admin-field" style="margin-bottom:14px"><label>其他備註</label><input value="' + d.note + '" disabled></div>' : '') +
      '<div class="admin-actions">' +
        '<button class="btn-save save-itinerary">儲存狀態</button>' +
        '<button class="btn-delete delete-itinerary">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function loadItineraryRequests() {
    itineraryListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('itineraryRequests').orderBy('createdAt', 'desc').get().then(function (snap) {
      if (snap.empty) { itineraryListEl.innerHTML = '<p class="desc">目前沒有客戶定制行程需求。</p>'; return; }
      var html = '';
      snap.forEach(function (doc) { html += itineraryCardHTML(doc.id, doc.data()); });
      itineraryListEl.innerHTML = html;
      itineraryListEl.querySelectorAll('.save-itinerary').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.admin-card');
          db.collection('itineraryRequests').doc(card.dataset.id).set({
            status: card.querySelector('.f-status').value
          }, { merge: true }).then(function () { showToast('已更新狀態'); loadItineraryRequests(); });
        });
      });
      itineraryListEl.querySelectorAll('.delete-itinerary').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('確定要刪除這筆定制行程需求嗎？')) return;
          var card = btn.closest('.admin-card');
          db.collection('itineraryRequests').doc(card.dataset.id).delete().then(function () { showToast('已刪除'); loadItineraryRequests(); });
        });
      });
    });
  }

  /* =========================================================
     頁面文字內容管理
     ========================================================= */
  function loadSiteContent() {
    db.collection('siteContent').doc('studyMaterials').get().then(function (doc) {
      var d = doc.exists ? doc.data() : {};
      document.getElementById('content-materials-hant').value = d.textHant || '';
      document.getElementById('content-materials-simp').value = d.textSimp || '';
    });
    db.collection('siteContent').doc('studyDeadlines').get().then(function (doc) {
      var d = doc.exists ? doc.data() : {};
      document.getElementById('content-deadlines-hant').value = d.textHant || '';
      document.getElementById('content-deadlines-simp').value = d.textSimp || '';
    });
  }

  document.getElementById('save-materials').addEventListener('click', function () {
    db.collection('siteContent').doc('studyMaterials').set({
      textHant: document.getElementById('content-materials-hant').value,
      textSimp: document.getElementById('content-materials-simp').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () { showToast('已儲存短期班材料內容'); });
  });

  document.getElementById('save-deadlines').addEventListener('click', function () {
    db.collection('siteContent').doc('studyDeadlines').set({
      textHant: document.getElementById('content-deadlines-hant').value,
      textSimp: document.getElementById('content-deadlines-simp').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () { showToast('已儲存長期班截止日期內容'); });
  });

  /* =========================================================
     包車需求管理
     ========================================================= */
  var fleetReqListEl = document.getElementById('fleet-requests-list');
  var FLEET_STATUS_OPTIONS = ['待處理', '已報價', '已成交', '已結束'];

  function fleetReqCardHTML(id, d) {
    d = d || {};
    var created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString('zh-TW') : '—';
    var priceStr = d.priceCNYMin == null ? '詳詢' : ('¥' + d.priceCNYMin + (d.priceCNYMax !== d.priceCNYMin ? '–' + d.priceCNYMax : ''));
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      (d.needsReview ? '<p style="color:var(--accent);font-size:12.5px;font-weight:700;margin-bottom:10px">＊此路線價格尚待確認</p>' : '') +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>需求編號</label><input value="' + (d.requestId || '') + '" disabled></div>' +
        '<div class="admin-field"><label style="color:var(--accent);font-weight:700">📞 聯絡方式</label><input value="' + (d.contact || '') + '" disabled style="font-weight:700;color:var(--accent)"></div>' +
        '<div class="admin-field"><label>送出時間</label><input value="' + created + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>模式</label><input value="' + (d.mode === 'point' ? '點到點' : '論時數') + '" disabled></div>' +
        '<div class="admin-field"><label>路線／時數</label><input value="' + (d.route || (d.hours ? d.hours + '小時' : '—')) + '" disabled></div>' +
        '<div class="admin-field"><label>車型</label><input value="' + (d.vehicleType || '') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>指定中文司機</label><input value="' + (d.driver ? '是' : '否') + '" disabled></div>' +
        '<div class="admin-field"><label>人民幣報價</label><input value="' + priceStr + '" disabled></div>' +
        '<div class="admin-field"><label>處理狀態</label><select class="f-status">' +
          FLEET_STATUS_OPTIONS.map(function (s) { return '<option' + (d.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-fleetreq">儲存狀態</button>' +
        '<button class="btn-delete delete-fleetreq">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function loadFleetRequests() {
    fleetReqListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('fleetRequests').orderBy('createdAt', 'desc').get().then(function (snap) {
      if (snap.empty) { fleetReqListEl.innerHTML = '<p class="desc">目前沒有客戶包車需求。</p>'; return; }
      var html = '';
      snap.forEach(function (doc) { html += fleetReqCardHTML(doc.id, doc.data()); });
      fleetReqListEl.innerHTML = html;
      fleetReqListEl.querySelectorAll('.save-fleetreq').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.admin-card');
          db.collection('fleetRequests').doc(card.dataset.id).set({
            status: card.querySelector('.f-status').value
          }, { merge: true }).then(function () { showToast('已更新'); loadFleetRequests(); });
        });
      });
      fleetReqListEl.querySelectorAll('.delete-fleetreq').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('確定要刪除這筆需求嗎？')) return;
          var card = btn.closest('.admin-card');
          db.collection('fleetRequests').doc(card.dataset.id).delete().then(function () { showToast('已刪除'); loadFleetRequests(); });
        });
      });
    });
  }

  /* =========================================================
     熱門路線管理
     ========================================================= */
  var routesListEl = document.getElementById('routes-list');

  function routeCardHTML(id, d) {
    d = d || {};
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>路線名稱（繁）</label><input class="f-titleHant" value="' + (d.titleHant || '') + '"></div>' +
        '<div class="admin-field"><label>路線名稱（簡）</label><input class="f-titleSimp" value="' + (d.titleSimp || '') + '"></div>' +
        '<div class="admin-field"><label>天數</label><input class="f-days" value="' + (d.days || '') + '" placeholder="例：4天3夜"></div>' +
        '<div class="admin-field"><label>排序</label><input class="f-order" type="number" value="' + (d.order != null ? d.order : 0) + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>簡介（繁）</label><input class="f-descHant" value="' + (d.descHant || '') + '"></div>' +
        '<div class="admin-field"><label>簡介（簡）</label><input class="f-descSimp" value="' + (d.descSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>標籤（繁，逗號分隔）</label><input class="f-tagsHant" value="' + ((d.tagsHant || []).join('，')) + '" placeholder="例：4星酒店，雙語導遊"></div>' +
        '<div class="admin-field"><label>標籤（簡，逗號分隔）</label><input class="f-tagsSimp" value="' + ((d.tagsSimp || []).join('，')) + '" placeholder="例：4星酒店，双语导游"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>人民幣價格（留空則不用）</label><input class="f-priceCNY" type="number" value="' + (d.priceCNY != null ? d.priceCNY : '') + '"></div>' +
        '<div class="admin-field"><label>越南盾價格（留空則不用，跟人民幣擇一）</label><input class="f-priceVND" type="number" value="' + (d.priceVND != null ? d.priceVND : '') + '"></div>' +
        '<div class="admin-field"><label>價格備註（繁）</label><input class="f-priceNoteHant" value="' + (d.priceNoteHant || '') + '" placeholder="例：10人成團／每人含稅"></div>' +
        '<div class="admin-field"><label>價格備註（簡）</label><input class="f-priceNoteSimp" value="' + (d.priceNoteSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-field" style="margin-bottom:14px"><label>照片網址（選填，留空則不顯示圖片）</label><input class="f-photoUrl" value="' + (d.photoUrl || '') + '" placeholder="https://..."></div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>詳細行程（繁，換行照原樣顯示）</label><textarea class="f-detailHant" rows="5" style="width:100%;font-family:inherit;font-size:13px;padding:8px;border:1px solid var(--line-strong);border-radius:var(--radius)">' + (d.detailHant || '') + '</textarea></div>' +
        '<div class="admin-field"><label>詳細行程（簡）</label><textarea class="f-detailSimp" rows="5" style="width:100%;font-family:inherit;font-size:13px;padding:8px;border:1px solid var(--line-strong);border-radius:var(--radius)">' + (d.detailSimp || '') + '</textarea></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-route">儲存</button>' +
        '<button class="btn-delete delete-route">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function readRouteCard(card) {
    var cny = card.querySelector('.f-priceCNY').value;
    var vnd = card.querySelector('.f-priceVND').value;
    return {
      titleHant: card.querySelector('.f-titleHant').value.trim(),
      titleSimp: card.querySelector('.f-titleSimp').value.trim(),
      days: card.querySelector('.f-days').value.trim(),
      descHant: card.querySelector('.f-descHant').value.trim(),
      descSimp: card.querySelector('.f-descSimp').value.trim(),
      tagsHant: card.querySelector('.f-tagsHant').value.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean),
      tagsSimp: card.querySelector('.f-tagsSimp').value.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean),
      priceCNY: cny === '' ? null : parseFloat(cny),
      priceVND: vnd === '' ? null : parseFloat(vnd),
      priceNoteHant: card.querySelector('.f-priceNoteHant').value.trim(),
      priceNoteSimp: card.querySelector('.f-priceNoteSimp').value.trim(),
      photoUrl: card.querySelector('.f-photoUrl').value.trim(),
      detailHant: card.querySelector('.f-detailHant').value,
      detailSimp: card.querySelector('.f-detailSimp').value,
      order: parseInt(card.querySelector('.f-order').value, 10) || 0
    };
  }

  function loadRoutes2() {
    routesListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('popularRoutes').get().then(function (snap) {
      if (snap.empty) { routesListEl.innerHTML = '<p class="desc">目前沒有路線資料，點下方按鈕新增。</p>'; return; }
      var rows = [];
      snap.forEach(function (doc) { rows.push({ id: doc.id, data: doc.data() }); });
      rows.sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
      routesListEl.innerHTML = rows.map(function (r) { return routeCardHTML(r.id, r.data); }).join('');
      bindRouteRowEvents();
    });
  }

  function bindRouteRowEvents() {
    routesListEl.querySelectorAll('.save-route').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        var data = readRouteCard(card);
        var ref = id.indexOf('new-') === 0 ? db.collection('popularRoutes').doc() : db.collection('popularRoutes').doc(id);
        ref.set(data).then(function () { showToast('已儲存這條路線'); loadRoutes2(); });
      });
    });
    routesListEl.querySelectorAll('.delete-route').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        if (id.indexOf('new-') === 0) { card.remove(); return; }
        if (!confirm('確定要刪除這條路線嗎？')) return;
        db.collection('popularRoutes').doc(id).delete().then(function () { showToast('已刪除'); loadRoutes2(); });
      });
    });
  }

  document.getElementById('add-route-row').addEventListener('click', function () {
    var tempId = 'new-' + Date.now();
    routesListEl.insertAdjacentHTML('beforeend', routeCardHTML(tempId, { order: 0 }));
    bindRouteRowEvents();
  });

  document.getElementById('seed-routes').addEventListener('click', function () {
    db.collection('popularRoutes').limit(1).get().then(function (snap) {
      if (!snap.empty && !confirm('資料庫已經有路線資料了，確定要再匯入一次嗎？（會產生重複資料）')) return;

      var SEED = [
        {
          titleHant: '富國島 4天3夜', titleSimp: '富国岛 4天3夜', days: '4天3夜', order: 0,
          descHant: 'Safari野生動物園、Grand World水舞秀、VinWonders珍珠樂園或香島跨海纜車＋Aquatopia水上樂園（AB擇一）。',
          descSimp: 'Safari野生动物园、Grand World水舞秀、VinWonders珍珠乐园或香岛跨海缆车＋Aquatopia水上乐园（AB择一）。',
          tagsHant: ['4星酒店', '雙語導遊', '含來回機票'], tagsSimp: ['4星酒店', '双语导游', '含来回机票'],
          priceCNY: 4000, priceVND: null, priceNoteHant: '10人成團／每人含稅', priceNoteSimp: '10人成团／每人含税',
          photoUrl: '',
          detailHant: 'Day1 抵達富國島，專車接機，富國夜市自由活動\nDay2 Safari野生動物園＋Grand World富國大世界（水舞秀）\nDay3 自選行程日（AB二選一）：VinWonders珍珠樂園 或 香島跨海纜車＋Aquatopia水上樂園＋接吻橋\nDay4 酒店自由活動，依航班時間送機\n\n含4星級酒店3晚雙人房、景點門票套票、每日早餐＋特色餐食、中越雙語導遊、旅遊平安保險。',
          detailSimp: 'Day1 抵达富国岛，专车接机，富国夜市自由活动\nDay2 Safari野生动物园＋Grand World富国大世界（水舞秀）\nDay3 自选行程日（AB二选一）：VinWonders珍珠乐园 或 香岛跨海缆车＋Aquatopia水上乐园＋接吻桥\nDay4 酒店自由活动，依航班时间送机\n\n含4星级酒店3晚双人房、景点门票套票、每日早餐＋特色餐食、中越双语导游、旅游平安保险。'
        },
        {
          titleHant: '芽莊．美奈．胡志明市 4天3夜（企業團建）', titleSimp: '芽庄．美奈．胡志明市 4天3夜（企业团建）', days: '4天3夜', order: 1,
          descHant: '芽莊大教堂、占婆塔，美奈白沙丘越野車，胡志明市統一宮、雙層觀光巴士「落日飛車」。',
          descSimp: '芽庄大教堂、占婆塔，美奈白沙丘越野车，胡志明市统一宫、双层观光巴士「落日飞车」。',
          tagsHant: ['企業團建', '4-5星酒店', '含國內段機票'], tagsSimp: ['企业团建', '4-5星酒店', '含国内段机票'],
          priceCNY: 4000, priceVND: null, priceNoteHant: '10人成團／每人含稅', priceNoteSimp: '10人成团／每人含税',
          photoUrl: '',
          detailHant: 'Day1 河內－芽莊：專車接機，芽莊大教堂、占婆塔、五指岩\nDay2 芽莊－美奈－胡志明市：美奈漁村、白沙丘越野車，續車前往胡志明市\nDay3 胡志明市：統一宮、粉紅教堂、中央郵局、書街、雙層觀光巴士「落日飛車」\nDay4 胡志明市－河內：依航班時間送機\n\n含國內段來回機票、4-5星酒店（芽莊1晚、胡志明市2晚）、景點門票套票、6正餐3早餐、中越雙語導遊。',
          detailSimp: 'Day1 河内－芽庄：专车接机，芽庄大教堂、占婆塔、五指岩\nDay2 芽庄－美奈－胡志明市：美奈渔村、白沙丘越野车，续车前往胡志明市\nDay3 胡志明市：统一宫、粉红教堂、中央邮局、书街、双层观光巴士「落日飞车」\nDay4 胡志明市－河内：依航班时间送机\n\n含国内段来回机票、4-5星酒店（芽庄1晚、胡志明市2晚）、景点门票套票、6正餐3早餐、中越双语导游。'
        },
        {
          titleHant: '胡志明市深度慢旅 4天3夜', titleSimp: '胡志明市深度慢旅 4天3夜', days: '4天3夜', order: 2,
          descHant: '全程僅住一間酒店，每日專注單一主要行程，減少往返車程。古芝地道、湄公河三角洲、西貢河游船晚宴。',
          descSimp: '全程仅住一间酒店，每日专注单一主要行程，减少往返车程。古芝地道、湄公河三角洲、西贡河游船晚宴。',
          tagsHant: ['定點深度遊', '單一酒店', '減少奔波'], tagsSimp: ['定点深度游', '单一酒店', '减少奔波'],
          priceCNY: 4299, priceVND: null, priceNoteHant: '10人成團／每人含稅', priceNoteSimp: '10人成团／每人含税',
          photoUrl: '',
          detailHant: 'Day1 抵達胡志明市：專車接機，市區晚餐，范伍佬街或阮惠步行街\nDay2 古芝地道一日遊（含戰時樹薯體驗），西貢河遊船自助晚宴\nDay3 湄公河三角洲一日遊，晚間自由，雙層觀光巴士夜遊\nDay4 市區文化巡禮：統一宮、粉紅教堂、中央郵局、書街、紅教堂，午後送機\n\n全程僅一間4-5星酒店（3晚），含古芝地道、湄公河三角洲行程門票、雙層觀光巴士、特色餐食、中越雙語導遊。',
          detailSimp: 'Day1 抵达胡志明市：专车接机，市区晚餐，范伍佬街或阮惠步行街\nDay2 古芝地道一日游（含战时树薯体验），西贡河游船自助晚宴\nDay3 湄公河三角洲一日游，晚间自由，双层观光巴士夜游\nDay4 市区文化巡礼：统一宫、粉红教堂、中央邮局、书街、红教堂，午后送机\n\n全程仅一间4-5星酒店（3晚），含古芝地道、湄公河三角洲行程门票、双层观光巴士、特色餐食、中越双语导游。'
        },
        {
          titleHant: '吉婆島團建 2天1夜', titleSimp: '吉婆岛团建 2天1夜', days: '2天1夜', order: 3,
          descHant: 'Flamingo Cat Ba Resort入住、吉婆纜車、蘭夏灣遊船、越海村魚療、天然戲水灘、Gala Dinner。',
          descSimp: 'Flamingo Cat Ba Resort入住、吉婆缆车、兰夏湾游船、越海村鱼疗、天然戏水滩、Gala Dinner。',
          tagsHant: ['海島團建', 'Gala Dinner', '蘭夏灣遊船'], tagsSimp: ['海岛团建', 'Gala Dinner', '兰夏湾游船'],
          priceCNY: null, priceVND: 5000000, priceNoteHant: '每人（越南盾）', priceNoteSimp: '每人（越南盾）',
          photoUrl: '',
          detailHant: 'Day1 公司集合出發→海防纜車站→吉婆纜車站（跨海纜車）→自助餐午餐→入住Flamingo Cat Ba Resort→自由戲水／探索→18:30-21:30 Gala Dinner（Opera House 2，5樓）→自由活動（酒店2樓卡拉OK）\nDay2 酒店早餐→集合上車→碼頭→登船→蘭夏灣觀光＋划皮艇體驗（自費）→越海村＋小魚咬腳魚療→船上用餐→天然戲水灘（水上設施自費）→返回碼頭→纜車站出發，返回公司\n\n酒店設施：游泳池、健身房、VR Game Park、溫泉、Spa（8折優惠）、Sky Bar。GALA DINNER超時每30分鐘加收100萬越南盾，最晚不超過23:00。',
          detailSimp: 'Day1 公司集合出发→海防缆车站→吉婆缆车站（跨海缆车）→自助餐午餐→入住Flamingo Cat Ba Resort→自由戏水／探索→18:30-21:30 Gala Dinner（Opera House 2，5楼）→自由活动（酒店2楼卡拉OK）\nDay2 酒店早餐→集合上车→码头→登船→兰夏湾观光＋划皮艇体验（自费）→越海村＋小鱼咬脚鱼疗→船上用餐→天然戏水滩（水上设施自费）→返回码头→缆车站出发，返回公司\n\n酒店设施：游泳池、健身房、VR Game Park、温泉、Spa（8折优惠）、Sky Bar。GALA DINNER超时每30分钟加收100万越南盾，最晚不超过23:00。'
        }
      ];

      var batch = db.batch();
      SEED.forEach(function (route) {
        var ref = db.collection('popularRoutes').doc();
        batch.set(ref, route);
      });
      batch.commit().then(function () { showToast('已匯入4條路線'); loadRoutes2(); });
    });
  });

  /* =========================================================
     首頁輪播管理
     ========================================================= */
  var slidesListEl = document.getElementById('slides-list');

  function slideCardHTML(id, d) {
    d = d || {};
    var active = d.active !== false;
    return (
      '<div class="admin-card" data-id="' + id + '">' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>主題</label><select class="f-theme">' +
          ['dark', 'light', 'navy'].map(function (t) { return '<option value="' + t + '"' + (d.theme === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="admin-field"><label>排序</label><input class="f-order" type="number" value="' + (d.order != null ? d.order : 0) + '"></div>' +
        '<div class="admin-field"><label>上架顯示</label><input class="f-active" type="checkbox"' + (active ? ' checked' : '') + ' style="width:20px;height:20px;margin-top:6px"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>眉標（繁）</label><input class="f-eyebrowHant" value="' + (d.eyebrowHant || '') + '"></div>' +
        '<div class="admin-field"><label>眉標（簡）</label><input class="f-eyebrowSimp" value="' + (d.eyebrowSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>標題（繁，可用&lt;em&gt;強調文字&lt;/em&gt;）</label><input class="f-titleHant" value="' + (d.titleHant || '') + '"></div>' +
        '<div class="admin-field"><label>標題（簡）</label><input class="f-titleSimp" value="' + (d.titleSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>說明文字（繁）</label><input class="f-descHant" value="' + (d.descHant || '') + '"></div>' +
        '<div class="admin-field"><label>說明文字（簡）</label><input class="f-descSimp" value="' + (d.descSimp || '') + '"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>按鈕文字（繁）</label><input class="f-ctaTextHant" value="' + (d.ctaTextHant || '') + '"></div>' +
        '<div class="admin-field"><label>按鈕文字（簡）</label><input class="f-ctaTextSimp" value="' + (d.ctaTextSimp || '') + '"></div>' +
        '<div class="admin-field"><label>按鈕連結</label><input class="f-ctaLink" value="' + (d.ctaLink || '') + '" placeholder="例：fast-track.html 或 https://..."></div>' +
        '<div class="admin-field"><label>外部連結（新分頁開啟）</label><input class="f-ctaExternal" type="checkbox"' + (d.ctaExternal ? ' checked' : '') + ' style="width:20px;height:20px;margin-top:6px"></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>第二按鈕文字（繁，選填）</label><input class="f-cta2TextHant" value="' + (d.cta2TextHant || '') + '"></div>' +
        '<div class="admin-field"><label>第二按鈕文字（簡，選填）</label><input class="f-cta2TextSimp" value="' + (d.cta2TextSimp || '') + '"></div>' +
        '<div class="admin-field"><label>第二按鈕連結（選填）</label><input class="f-cta2Link" value="' + (d.cta2Link || '') + '"></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-save save-slide">儲存</button>' +
        '<button class="btn-delete delete-slide">刪除</button>' +
      '</div>' +
      '</div>'
    );
  }

  function readSlideCard(card) {
    return {
      theme: card.querySelector('.f-theme').value,
      order: parseInt(card.querySelector('.f-order').value, 10) || 0,
      active: card.querySelector('.f-active').checked,
      eyebrowHant: card.querySelector('.f-eyebrowHant').value.trim(),
      eyebrowSimp: card.querySelector('.f-eyebrowSimp').value.trim(),
      titleHant: card.querySelector('.f-titleHant').value.trim(),
      titleSimp: card.querySelector('.f-titleSimp').value.trim(),
      descHant: card.querySelector('.f-descHant').value.trim(),
      descSimp: card.querySelector('.f-descSimp').value.trim(),
      ctaTextHant: card.querySelector('.f-ctaTextHant').value.trim(),
      ctaTextSimp: card.querySelector('.f-ctaTextSimp').value.trim(),
      ctaLink: card.querySelector('.f-ctaLink').value.trim(),
      ctaExternal: card.querySelector('.f-ctaExternal').checked,
      cta2TextHant: card.querySelector('.f-cta2TextHant').value.trim(),
      cta2TextSimp: card.querySelector('.f-cta2TextSimp').value.trim(),
      cta2Link: card.querySelector('.f-cta2Link').value.trim()
    };
  }

  function loadSlides() {
    slidesListEl.innerHTML = '<div class="admin-loading">載入中…</div>';
    db.collection('heroSlides').get().then(function (snap) {
      if (snap.empty) { slidesListEl.innerHTML = '<p class="desc">目前沒有輪播資料，點下方按鈕新增（建議至少做出5張，跟目前網站預設的一致）。</p>'; return; }
      var rows = [];
      snap.forEach(function (doc) { rows.push({ id: doc.id, data: doc.data() }); });
      rows.sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
      slidesListEl.innerHTML = rows.map(function (r) { return slideCardHTML(r.id, r.data); }).join('');
      bindSlideRowEvents();
    });
  }

  function bindSlideRowEvents() {
    slidesListEl.querySelectorAll('.save-slide').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        var data = readSlideCard(card);
        var ref = id.indexOf('new-') === 0 ? db.collection('heroSlides').doc() : db.collection('heroSlides').doc(id);
        ref.set(data).then(function () { showToast('已儲存這張輪播'); loadSlides(); });
      });
    });
    slidesListEl.querySelectorAll('.delete-slide').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.admin-card');
        var id = card.dataset.id;
        if (id.indexOf('new-') === 0) { card.remove(); return; }
        if (!confirm('確定要刪除這張輪播嗎？')) return;
        db.collection('heroSlides').doc(id).delete().then(function () { showToast('已刪除'); loadSlides(); });
      });
    });
  }

  document.getElementById('add-slide-row').addEventListener('click', function () {
    var tempId = 'new-' + Date.now();
    slidesListEl.insertAdjacentHTML('beforeend', slideCardHTML(tempId, { order: 0, active: true, theme: 'dark' }));
    bindSlideRowEvents();
  });

  document.getElementById('seed-slides').addEventListener('click', function () {
    db.collection('heroSlides').limit(1).get().then(function (snap) {
      if (!snap.empty && !confirm('資料庫已經有輪播資料了，確定要再匯入一次嗎？（會產生重複資料）')) return;

      var SEED = [
        {
          order: 0, theme: 'dark', active: true,
          eyebrowHant: 'ShenLong Travel · Vietnam', eyebrowSimp: 'ShenLong Travel · Vietnam',
          titleHant: '人生很難，<em>就來越南</em>。', titleSimp: '人生很难，<em>就来越南</em>。',
          descHant: '升龍，源自河內古名「飛升之龍」——你在越南的專屬靠山。越難辦的事，就越要在越南辦，升龍罩你，體驗什麼叫『升龍活虎』。',
          descSimp: '升龙，源自河内古名「飞升之龙」——你在越南的专属靠山。越难办的事，就越要在越南办，升龙罩你，体验什么叫『升龙活虎』。',
          ctaTextHant: '專治各種難', ctaTextSimp: '专治各种难', ctaLink: 'essential-services.html', ctaExternal: false,
          cta2TextHant: '再來玩大的', cta2TextSimp: '再来玩大的', cta2Link: 'premium-experience.html'
        },
        {
          order: 1, theme: 'dark', active: true,
          eyebrowHant: '越難越行　快速通關', eyebrowSimp: '越难越行　快速通关',
          titleHant: '下機就有人等你——<em>機場快速通關</em>', titleSimp: '下机就有人等你——<em>机场快速通关</em>',
          descHant: 'VIP禮遇通道，免排隊，全越南主要機場皆可預約，商務客、初次赴越、行程緊湊的旅客都適合。',
          descSimp: 'VIP礼遇通道，免排队，全越南主要机场皆可预约，商务客、初次赴越、行程紧凑的旅客都适合。',
          ctaTextHant: '查看快速通關報價', ctaTextSimp: '查看快速通关报价', ctaLink: 'fast-track.html', ctaExternal: false,
          cta2TextHant: '', cta2TextSimp: '', cta2Link: ''
        },
        {
          order: 2, theme: 'light', active: true,
          eyebrowHant: '熱門路線', eyebrowSimp: '热门路线',
          titleHant: '路線都幫你排好了，<em>直接上車就好</em>', titleSimp: '路线都帮你排好了，<em>直接上车就好</em>',
          descHant: '富國島、芽莊美奈胡志明、吉婆島團建⋯⋯精選熱門路線，10人成團即可報價，行程細節一次講清楚。',
          descSimp: '富国岛、芽庄美奈胡志明、吉婆岛团建⋯⋯精选热门路线，10人成团即可报价，行程细节一次讲清楚。',
          ctaTextHant: '查看熱門路線', ctaTextSimp: '查看热门路线', ctaLink: 'popular-routes.html', ctaExternal: false,
          cta2TextHant: '', cta2TextSimp: '', cta2Link: ''
        },
        {
          order: 3, theme: 'dark', active: true,
          eyebrowHant: '越難越行　簽證代辦', eyebrowSimp: '越难越行　签证代办',
          titleHant: '有『簽』有保庇，<em>越南簽證代辦</em>', titleSimp: '有『签』有保庇，<em>越南签证代办</em>',
          descHant: '商務簽、旅遊簽、長期簽，2–3個工作天出簽，成功率99.9%，急件最快1天完成。',
          descSimp: '商务签、旅游签、长期签，2–3个工作日出签，成功率99.9%，急件最快1天完成。',
          ctaTextHant: '查看簽證代辦', ctaTextSimp: '查看签证代办', ctaLink: 'visa.html', ctaExternal: false,
          cta2TextHant: '', cta2TextSimp: '', cta2Link: ''
        },
        {
          order: 4, theme: 'navy', active: true,
          eyebrowHant: '合作夥伴 · Soltech', eyebrowSimp: '合作伙伴 · Soltech',
          titleHant: '出門在外，<em>電永遠不斷</em>', titleSimp: '出门在外，<em>电永远不断</em>',
          descHant: '升龍旅遊客戶專屬合作——Soltech共享充電寶，越南各大景點、機場、商圈都借得到，出門玩不用擔心手機沒電。',
          descSimp: '升龙旅游客户专属合作——Soltech共享充电宝，越南各大景点、机场、商圈都借得到，出门玩不用担心手机没电。',
          ctaTextHant: '前往 Soltech 官網', ctaTextSimp: '前往 Soltech 官网', ctaLink: 'https://soltechvn.com', ctaExternal: true,
          cta2TextHant: '', cta2TextSimp: '', cta2Link: ''
        }
      ];

      var batch = db.batch();
      SEED.forEach(function (slide) {
        var ref = db.collection('heroSlides').doc();
        batch.set(ref, slide);
      });
      batch.commit().then(function () { showToast('已匯入5張輪播'); loadSlides(); });
    });
  });

});
