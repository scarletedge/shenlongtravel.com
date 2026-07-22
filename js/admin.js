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
      '<div class="admin-row">' +
        '<div class="admin-field"><label>需求編號</label><input value="' + (d.requestId || '') + '" disabled></div>' +
        '<div class="admin-field"><label>機場</label><input value="' + (d.airportName || '') + '" disabled></div>' +
        '<div class="admin-field"><label>時段</label><input value="' + (d.time === 'night' ? '夜間' : '日間') + '" disabled></div>' +
      '</div>' +
      '<div class="admin-row">' +
        '<div class="admin-field"><label>加購舉牌</label><input value="' + (d.board ? '是' : '否') + '" disabled></div>' +
        '<div class="admin-field"><label>加購排隊協助</label><input value="' + (d.queueHelp ? '是' : '否') + '" disabled></div>' +
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

});
