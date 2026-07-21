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

});
