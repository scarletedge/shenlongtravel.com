/* =========================================================
   優惠券查詢／歸戶（coupon.html、zh-cn/coupon.html、會員中心）
   - 正式站預設打 https://query.shenlongtravel.com
     （網址帶 ?api=preview 時改打預覽 API）
   - localhost、127.0.0.1、pages.dev 以及其他預覽網域預設打
     https://coupon-preview.shenlong-order-inquiry.pages.dev
   - 只讀查詢：POST /api/coupons/lookup
   - 歸戶：POST /api/coupons/claim（僅在使用者送出表單，或登入後自動歸戶時）
   - 優惠券頁的「登入會員」若走同視窗導向，跳轉前把優惠碼寫進
     sessionStorage.slPendingCouponClaim。回到本頁且已登入時自動歸戶並清掉。
     仍打原本的 claim API，每帳號同款限歸戶 1 次的規則不變。
   ========================================================= */
(function (w, d) {
  var PROD_API = 'https://query.shenlongtravel.com';
  var PREVIEW_API = 'https://coupon-preview.shenlong-order-inquiry.pages.dev';

  var isHans = (d.documentElement.lang || '').toLowerCase().indexOf('hans') !== -1;

  var COPY = {
    loading: isHans ? '正在查询…' : '正在查詢…',
    needClaim: isHans ? '请填写优惠码，以及手机号码或电子邮件。' : '請填寫優惠碼，以及手機號碼或電子郵件。',
    needLookup: isHans ? '请填写手机号码、电子邮件或优惠码。' : '請填寫手機號碼、電子郵件或優惠碼。',
    needCode: isHans ? '请填写优惠码。' : '請填寫優惠碼。',
    badCode: isHans ? '优惠码格式无法辨识，请再核对一次。' : '優惠碼格式無法辨識，請再核對一次。',
    badId: isHans ? '请输入电子邮件，或至少 8 码数字的手机号码。' : '請輸入電子郵件，或至少 8 碼數字的手機號碼。',
    network: isHans ? '连线失败，请稍后再试。' : '連線失敗，請稍後再試。',
    errInvalid: isHans ? '这组资料无法使用，请再确认优惠码与联系方式。' : '這組資料無法使用，請再確認優惠碼與聯絡方式。',
    errExpired: isHans ? '这张优惠券已过期。' : '這張優惠券已過期。',
    errVoid: isHans ? '这张优惠券已作废。' : '這張優惠券已作廢。',
    errNotFound: isHans ? '查无此优惠券，请再确认优惠码。' : '查無此優惠券，請再確認優惠碼。',
    errUnavailable: isHans ? '查询服务暂时忙碌，请稍后再试。' : '查詢服務暫時忙碌，請稍後再試。',
    errGeneric: isHans ? '查询没有完成，请稍后再试。' : '查詢沒有完成，請稍後再試。',
    notFoundCode: isHans ? '查无此优惠码。' : '查無此優惠碼。',
    badQuery: isHans ? '请输入电子邮件、至少 8 码数字的手机号码，或优惠码。' : '請輸入電子郵件、至少 8 碼數字的手機號碼，或優惠碼。',
    scopeLabel: isHans ? '适用范围' : '適用範圍',
    rulesLabel: isHans ? '使用规则' : '使用規則',
    stepSave: isHans ? '输入电话或 Email 归户保存' : '輸入電話或 Email 歸戶保存',
    stepShow: isHans ? '预约任一服务时出示优惠码' : '預約任一服務時出示優惠碼',
    stepPay: isHans ? '结账直接折抵 ' : '結帳直接折抵 ',
    emptyList: isHans ? '这个联系方式目前没有已归户的优惠券。' : '這個聯絡方式目前沒有已歸戶的優惠券。',
    claimedOk: isHans ? '已归户到您留下的联系方式。面额、期限与使用范围如下。' : '已歸戶到您留下的聯絡方式。面額、期限與使用範圍如下。',
    already: isHans ? '每个会员账号同款优惠券限归户 1 次，您已完成归户。' : '每個會員帳號同款優惠券限歸戶 1 次，您已完成歸戶。',
    limitOnce: isHans ? '每个会员账号同款优惠券限归户 1 次' : '每個會員帳號同款優惠券限歸戶 1 次',
    loginClaimOk: isHans ? '已登录并归户成功！已保存至您的会员帐号（' : '已登入並歸戶成功！已保存至您的會員帳號（',
    loginClaimTail: isHans ? '），可前往会员中心查看。' : '），可前往會員中心查看。',
    loginAlready: isHans ? '此帐号已归户过同款优惠券（每个会员账号限归户 1 次），可前往会员中心查看。' : '此帳號已歸戶過同款優惠券（每個會員帳號限歸戶 1 次），可前往會員中心查看。',
    memberCta: isHans ? '前往会员中心查看我的优惠券' : '前往會員中心查看我的優惠券',
    loginLabel: isHans ? '登录会员' : '登入會員',
    claimNow: isHans ? '立即归户' : '立即歸戶',
    boundOk: isHans ? '已绑定到这个 Google 帐号的电子邮件。' : '已綁定到這個 Google 帳號的電子郵件。',
    noEmail: isHans ? '这个 Google 帐号没有电子邮件，无法自动查询。请改用下方手机号码，或前往免密码优惠券页。' : '這個 Google 帳號沒有電子郵件，無法自動查詢。請改用下方手機號碼，或前往免密碼優惠券頁。',
    emailLoading: isHans ? '正在用您的 Google 电子邮件查询已归户的优惠券…' : '正在用您的 Google 電子郵件查詢已歸戶的優惠券…',
    emailEmpty: isHans ? '这个 Google 电子邮件目前没有已归户的优惠券。可在下方输入优惠码绑定，或改用先前领取时的手机号码查询。' : '這個 Google 電子郵件目前沒有已歸戶的優惠券。可在下方輸入優惠碼綁定，或改用先前領取時的手機號碼查詢。',
    expiry: isHans ? '到期日' : '到期日',
    claimedAt: isHans ? '归户时间' : '歸戶時間',
    localTime: isHans ? '当地时间' : '當地時間',
    noMin: isHans ? '无最低消费' : '不設低消',
    minSpend: isHans ? '满额后可使用' : '滿額後可使用',
    noCash: isHans ? '不可兑现' : '不可兌現',
    cashOk: isHans ? '可兑现' : '可兌現',
    once: isHans ? '限用一次' : '限用一次',
    transfer: isHans ? '可转介亲友使用一次' : '可轉介親友使用一次',
    statusActive: isHans ? '可使用' : '可使用',
    statusClaimed: isHans ? '已归户' : '已歸戶',
    statusUsed: isHans ? '已使用' : '已使用',
    statusExpired: isHans ? '已过期' : '已過期',
    statusVoid: isHans ? '已作废' : '已作廢',
    statusUnknown: isHans ? '状态待确认' : '狀態待確認'
  };

  var CURRENCY = {
    CNY: { hant: '元人民幣', hans: '元人民币' },
    TWD: { hant: '元新臺幣', hans: '元新台币' },
    VND: { hant: '越南盾', hans: '越南盾' },
    USD: { hant: '美元', hans: '美元' }
  };

  // 只連結站上真實存在的頁面。訂房／住宿沒有獨立頁，客製行程表單裡有每晚酒店預算。
  var SERVICE_LINKS = [
    { test: /包[車车]|車隊|车队/, hant: '包車／車隊', hans: '包车／车队', href: 'fleet.html' },
    { test: /導遊|导游/, hant: '導遊', hans: '导游', href: 'premium-experience.html#guides' },
    { test: /簽證|签证/, hant: '簽證', hans: '签证', href: 'visa.html' },
    { test: /訂房|订房|住宿/, hant: '訂房／住宿', hans: '订房／住宿', href: 'premium-experience.html#itinerary' },
    { test: /行程/, hant: '客製行程', hans: '定制行程', href: 'premium-experience.html#itinerary' }
  ];

  function apiBase() {
    var host = w.location.hostname;
    var preview = false;
    try { preview = new URLSearchParams(w.location.search).get('api') === 'preview'; } catch (e) { preview = false; }
    if ((host === 'shenlongtravel.com' || host === 'www.shenlongtravel.com') && !preview) return PROD_API;
    return PREVIEW_API;
  }

  function post(path, body) {
    return fetch(apiBase() + path, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try { data = JSON.parse(text); } catch (e) { data = {}; }
        }
        if (!data || typeof data !== 'object') data = {};
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function formatAmount(coupon) {
    var amount = coupon.amount;
    var num = (typeof amount === 'number' || typeof amount === 'string') ? String(amount) : '';
    var unit = CURRENCY[coupon.currency];
    if (unit) return (num ? num + ' ' : '') + (isHans ? unit.hans : unit.hant);
    if (coupon.currency) return (num ? num + ' ' : '') + coupon.currency;
    return num;
  }

  function formatDateOnly(value) {
    if (!value) return '';
    var text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    var date = new Date(text);
    if (isNaN(date.getTime())) return text;
    var shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return shifted.getUTCFullYear() + '-' + pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate());
  }

  function formatClaimedAt(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value || '');
    var shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    var utc7 = shifted.getUTCFullYear() + '-' + pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate()) +
      ' ' + pad(shifted.getUTCHours()) + ':' + pad(shifted.getUTCMinutes()) + '（UTC+7）';
    if (-date.getTimezoneOffset() === 420) return utc7;
    var local = '';
    try {
      local = date.toLocaleString(isHans ? 'zh-CN' : 'zh-TW', { hour12: false });
    } catch (e) {
      local = '';
    }
    return local ? utc7 + '　' + COPY.localTime + ' ' + local : utc7;
  }

  function serviceNames(coupon) {
    var primary = isHans ? coupon.eligibleServicesZhHans : coupon.eligibleServicesZhHant;
    var fallback = isHans ? coupon.eligibleServicesZhHant : coupon.eligibleServicesZhHans;
    var list = Array.isArray(primary) && primary.length ? primary : fallback;
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) { return typeof item === 'string' && item.trim(); });
  }

  function scopeLabels(names) {
    var out = [];
    var seen = {};
    function add(label) {
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push(label);
    }
    names.forEach(function (name) {
      if (/行程/.test(name)) add(isHans ? '定制行程' : '客製行程');
      else if (/訂房|订房|住宿/.test(name)) add(isHans ? '订房／住宿' : '訂房／住宿');
      else if (/導遊|导游/.test(name)) add(isHans ? '导游' : '導遊');
      else if (/簽證|签证/.test(name)) add(isHans ? '签证' : '簽證');
      else if (/包[車车]|車隊|车队/.test(name)) add(isHans ? '包车' : '包車');
      else add(name.trim());
    });
    return out;
  }

  function ruleLabels(coupon) {
    var rules = [];
    if (coupon.minSpend === 0) rules.push(COPY.noMin);
    else if (typeof coupon.minSpend === 'number' && coupon.minSpend > 0) {
      rules.push(COPY.minSpend + ' ' + coupon.minSpend);
    }
    if (coupon.cashable === false) rules.push(COPY.noCash);
    else if (coupon.cashable === true) rules.push(COPY.cashOk);
    if (coupon.singleUse === true) rules.push(COPY.once);
    if (coupon.transferableOnce === true) rules.push(COPY.transfer);
    return rules;
  }

  function factRow(label, parts) {
    var row = el('div', 'voucher-fact');
    row.appendChild(el('span', 'voucher-fact-label', label));
    var value = el('span', 'voucher-fact-value');
    parts.forEach(function (part, index) {
      if (index) value.appendChild(d.createTextNode(' · '));
      value.appendChild(el('span', 'voucher-token', part));
    });
    row.appendChild(value);
    return row;
  }

  function statusMeta(status, claimed) {
    if (status === 'used') return { key: 'used', label: COPY.statusUsed };
    if (status === 'expired') return { key: 'expired', label: COPY.statusExpired };
    if (status === 'void') return { key: 'void', label: COPY.statusVoid };
    if (claimed) return { key: 'claimed', label: COPY.statusClaimed };
    if (status === 'active') return { key: 'active', label: COPY.statusActive };
    return { key: 'unknown', label: COPY.statusUnknown };
  }

  function el(tag, className, text) {
    var node = d.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderVoucher(coupon, opts) {
    opts = opts || {};
    var claimedAt = opts.claimedAt || coupon.claimedAt || '';
    var claimed = !!(opts.claimed || claimedAt);
    var status = opts.status || coupon.status || '';
    var badge = statusMeta(status, claimed);
    var card = el('article', 'voucher');

    var top = el('div', 'voucher-top');
    var main = el('div');
    main.appendChild(el('div', 'voucher-amount', formatAmount(coupon)));
    var title = isHans ? (coupon.titleZhHans || coupon.titleZhHant) : (coupon.titleZhHant || coupon.titleZhHans);
    if (title) main.appendChild(el('div', 'voucher-title', title));
    if (coupon.code) main.appendChild(el('div', 'voucher-code', coupon.code));
    top.appendChild(main);
    top.appendChild(el('span', 'voucher-badge is-' + badge.key, badge.label));
    card.appendChild(top);

    var meta = el('ul', 'voucher-meta');
    if (coupon.expiresAt) {
      var expiry = el('li');
      expiry.appendChild(el('strong', '', COPY.expiry + ' '));
      expiry.appendChild(d.createTextNode(formatDateOnly(coupon.expiresAt)));
      meta.appendChild(expiry);
    }
    if (claimedAt) {
      var when = el('li');
      when.appendChild(el('strong', '', COPY.claimedAt + ' '));
      when.appendChild(d.createTextNode(formatClaimedAt(claimedAt)));
      meta.appendChild(when);
    }
    if (meta.childNodes.length) card.appendChild(meta);

    var scope = scopeLabels(serviceNames(coupon));
    var rules = ruleLabels(coupon);
    if (scope.length || rules.length) {
      var facts = el('div', 'voucher-facts');
      if (scope.length) facts.appendChild(factRow(COPY.scopeLabel, scope));
      if (rules.length) facts.appendChild(factRow(COPY.rulesLabel, rules));
      card.appendChild(facts);
    }
    card.appendChild(el('p', 'voucher-limit', COPY.limitOnce));
    return card;
  }

  function serviceLinks(coupon) {
    var names = serviceNames(coupon);
    var wrap = el('div', 'voucher-services');
    SERVICE_LINKS.forEach(function (item) {
      var hit = names.some(function (name) { return item.test.test(name); });
      if (!hit) return;
      var a = el('a', '', isHans ? item.hans : item.hant);
      a.href = item.href;
      wrap.appendChild(a);
    });
    return wrap;
  }

  function stepItems(coupon) {
    var pay = COPY.stepPay + formatAmount(coupon);
    if (coupon.transferableOnce) pay += isHans ? '（可转介亲友使用一次）' : '（可轉介親友使用一次）';
    return [COPY.stepSave, COPY.stepShow, pay];
  }

  function messageNode(text, kind) {
    return el('p', 'coupon-msg' + (kind === 'err' ? ' is-err' : kind === 'pending' ? ' is-pending' : ''), text);
  }

  function errorText(res) {
    var code = res && res.data ? res.data.error : '';
    if (code === 'invalid') return COPY.errInvalid;
    if (code === 'expired') return COPY.errExpired;
    if (code === 'void') return COPY.errVoid;
    if (code === 'not_found' || (res && res.status === 404)) return COPY.errNotFound;
    if (code === 'unavailable' || (res && (res.status === 429 || res.status === 503))) return COPY.errUnavailable;
    return COPY.errGeneric;
  }

  function clear(node) { if (node) node.textContent = ''; }

  function showMessage(container, text, kind) {
    if (!container) return;
    clear(container);
    if (!text) return;
    container.appendChild(messageNode(text, kind));
  }

  function identifierKind(value) {
    var text = (value || '').trim();
    if (!text) return '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'email';
    var digits = text.replace(/\D/g, '');
    if (digits.length >= 8 && /^[+\d][\d\s().-]*$/.test(text)) return 'phone';
    return 'bad';
  }

  function codeKind(value) {
    var text = (value || '').trim();
    if (!text) return '';
    if (/^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/.test(text)) return text;
    return 'bad';
  }

  function renderLookup(res, container) {
    clear(container);
    if (!res || !res.ok) {
      container.appendChild(messageNode(errorText(res), 'err'));
      return;
    }
    var data = res.data || {};
    if (Array.isArray(data.coupons)) {
      if (!data.coupons.length) {
        container.appendChild(messageNode(COPY.emptyList, ''));
        return;
      }
      var list = el('div', 'coupon-list');
      data.coupons.forEach(function (coupon) {
        if (!coupon || typeof coupon !== 'object') return;
        list.appendChild(renderVoucher(coupon, { claimed: true, claimedAt: coupon.claimedAt, status: coupon.status }));
      });
      container.appendChild(list);
      return;
    }
    if (data.found && data.coupon) {
      var one = el('div', 'coupon-list');
      one.appendChild(renderVoucher(data.coupon, { claimed: false, status: data.coupon.status }));
      container.appendChild(one);
      return;
    }
    container.appendChild(messageNode(COPY.notFoundCode, ''));
  }

  function renderClaim(res, container) {
    clear(container);
    if (!res || !res.ok || !res.data || res.data.ok !== true || !res.data.coupon) {
      container.appendChild(messageNode(errorText(res), 'err'));
      return;
    }
    var data = res.data;
    container.appendChild(messageNode(data.alreadyClaimed ? COPY.already : COPY.claimedOk, ''));
    var list = el('div', 'coupon-list');
    var claim = data.claim || {};
    list.appendChild(renderVoucher(data.coupon, {
      claimed: true,
      claimedAt: claim.claimedAt,
      status: claim.status || data.coupon.status
    }));
    container.appendChild(list);
  }

  function withBusy(form, work) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    return Promise.resolve().then(work).then(function (value) {
      if (btn) btn.disabled = false;
      return value;
    }, function (err) {
      if (btn) btn.disabled = false;
      throw err;
    });
  }

  function lookupBy(body) {
    return post('/api/coupons/lookup', body);
  }

  function claimWith(identifier, code) {
    return post('/api/coupons/claim', { identifier: identifier, code: code });
  }

  function keepLangQuery() {
    var search = w.location.search;
    if (!search) return;
    var links = d.querySelectorAll('.lang-switch a[href]');
    Array.prototype.forEach.call(links, function (a) {
      var href = a.getAttribute('href');
      if (!href || href.indexOf('?') !== -1) return;
      a.setAttribute('href', href + search);
    });
  }

  function prefillCode() {
    var code = '';
    try { code = new URLSearchParams(w.location.search).get('code') || ''; } catch (e) { code = ''; }
    return codeKind(code.trim()) || '';
  }

  function signedInEmail() {
    var user = w.SLMember && SLMember.user;
    return user && user.email ? String(user.email) : '';
  }

  var PENDING_CLAIM_KEY = 'slPendingCouponClaim';

  function rememberPendingClaim(code) {
    try {
      sessionStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify({ code: code }));
    } catch (e) {}
  }

  function readPendingClaim() {
    var raw = '';
    try { raw = sessionStorage.getItem(PENDING_CLAIM_KEY) || ''; } catch (e) { return ''; }
    if (!raw) return '';
    var code = '';
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.code === 'string') code = parsed.code;
    } catch (e) {
      code = '';
    }
    var valid = codeKind(String(code).trim());
    return valid && valid !== 'bad' ? valid : '';
  }

  function clearPendingClaim() {
    try { sessionStorage.removeItem(PENDING_CLAIM_KEY); } catch (e) {}
  }

  function mountPage() {
    var entryForm = d.getElementById('coupon-entry-form');
    var lookupForm = d.getElementById('coupon-lookup-form');
    var preview = d.getElementById('coupon-preview');
    var actions = d.getElementById('coupon-actions');
    if (!entryForm || !lookupForm || !preview || !actions) return;

    var claimTab = d.getElementById('coupon-tab-claim');
    var lookupTab = d.getElementById('coupon-tab-lookup');
    var claimPanel = d.getElementById('coupon-panel-claim');
    var lookupPanel = d.getElementById('coupon-panel-lookup');
    var entryResult = d.getElementById('coupon-entry-result');
    var claimResult = d.getElementById('coupon-claim-result');
    var lookupResult = d.getElementById('coupon-lookup-result');
    var guestClaim = d.getElementById('coupon-guest-claim');
    var claimNow = d.getElementById('coupon-claim-now');
    var loginBtn = d.getElementById('coupon-login');
    var useBlock = d.getElementById('coupon-use');
    var services = d.getElementById('coupon-services');
    var steps = d.getElementById('coupon-steps');
    var codeInput = entryForm.querySelector('[name="code"]');
    var guestInput = guestClaim ? guestClaim.querySelector('[name="identifier"]') : null;
    var activeCode = '';
    var claimAfterLogin = false;
    var claimGeneration = 0;
    var pendingClaimStarted = false;

    function claimPendingIfNeeded(user) {
      if (pendingClaimStarted || !user || !user.email) return;
      var pending = readPendingClaim();
      var code = pending || (claimAfterLogin ? activeCode : '');
      if (!code || codeKind(code) === 'bad') return;
      pendingClaimStarted = true;
      claimAfterLogin = false;
      clearPendingClaim();
      activeCode = code;
      claimTo(user.email, true);
    }

    function selectTab(which) {
      var claim = which !== 'lookup';
      if (claimTab) claimTab.setAttribute('aria-selected', claim ? 'true' : 'false');
      if (lookupTab) lookupTab.setAttribute('aria-selected', claim ? 'false' : 'true');
      if (claimTab) claimTab.tabIndex = claim ? 0 : -1;
      if (lookupTab) lookupTab.tabIndex = claim ? -1 : 0;
      if (claimPanel) claimPanel.hidden = !claim;
      if (lookupPanel) lookupPanel.hidden = claim;
    }

    function showVoucher(coupon, opts) {
      activeCode = coupon.code || activeCode;
      clear(preview);
      preview.appendChild(renderVoucher(coupon, opts || {}));
      actions.hidden = false;
      if (services) {
        clear(services);
        var links = serviceLinks(coupon);
        while (links.firstChild) services.appendChild(links.firstChild);
      }
      if (useBlock) useBlock.hidden = !services || !services.childNodes.length;
      if (steps) {
        clear(steps);
        stepItems(coupon).forEach(function (text, index) {
          steps.appendChild(el('li', '', (index + 1) + '. ' + text));
        });
        steps.hidden = false;
      }
    }

    function hideVoucher() {
      activeCoupon = null;
      actions.hidden = true;
      if (guestClaim) guestClaim.hidden = true;
      if (useBlock) useBlock.hidden = true;
      if (steps) steps.hidden = true;
      clear(preview);
      clear(claimResult);
    }

    function accountBanner(email, already) {
      clear(claimResult);
      var box = el('div', 'coupon-banner');
      var text = already ? COPY.loginAlready : (COPY.loginClaimOk + email + COPY.loginClaimTail);
      box.appendChild(el('p', '', text));
      var link = el('a', 'btn-solid', COPY.memberCta);
      link.href = 'member.html';
      box.appendChild(link);
      claimResult.appendChild(box);
    }

    function applyClaimResult(res, emailForAccount) {
      if (!res || !res.ok || !res.data || res.data.ok !== true || !res.data.coupon) {
        showMessage(claimResult, errorText(res), 'err');
        return;
      }
      var claim = res.data.claim || {};
      showVoucher(res.data.coupon, {
        claimed: true,
        claimedAt: claim.claimedAt,
        status: claim.status || res.data.coupon.status
      });
      if (emailForAccount) accountBanner(emailForAccount, !!res.data.alreadyClaimed);
      else showMessage(claimResult, res.data.alreadyClaimed ? COPY.already : COPY.claimedOk, '');
    }

    function claimTo(identifier, asAccount) {
      var kind = identifierKind(identifier);
      if (!activeCode) {
        showMessage(claimResult, COPY.needCode, 'err');
        return;
      }
      if (kind !== 'email' && kind !== 'phone') {
        showMessage(claimResult, COPY.badId, 'err');
        return;
      }
      showMessage(claimResult, COPY.loading, 'pending');
      var emailForAccount = asAccount ? identifier.trim() : '';
      claimWith(identifier.trim(), activeCode).then(function (res) {
        applyClaimResult(res, emailForAccount);
      }).catch(function () {
        showMessage(claimResult, COPY.network, 'err');
      });
    }

    function verifyCode(raw) {
      var validCode = codeKind(raw);
      if (!String(raw || '').trim()) {
        hideVoucher();
        showMessage(entryResult, COPY.needCode, 'err');
        return;
      }
      if (validCode === 'bad') {
        hideVoucher();
        showMessage(entryResult, COPY.badCode, 'err');
        return;
      }
      showMessage(preview, COPY.loading, 'pending');
      clear(entryResult);
      lookupBy({ code: validCode }).then(function (res) {
        // 同視窗登入回來時，歸戶與網址預填會一起跑。歸戶已開始就不要清掉結果。
        if (pendingClaimStarted) return;
        if (!res.ok || !res.data || !res.data.found || !res.data.coupon) {
          hideVoucher();
          showMessage(entryResult, !res.ok ? errorText(res) : COPY.notFoundCode, 'err');
          return;
        }
        clear(claimResult);
        showVoucher(res.data.coupon, { claimed: false, status: res.data.coupon.status });
      }).catch(function () {
        if (pendingClaimStarted) return;
        hideVoucher();
        showMessage(entryResult, COPY.network, 'err');
      });
    }

    if (claimTab) claimTab.addEventListener('click', function () { selectTab('claim'); });
    if (lookupTab) lookupTab.addEventListener('click', function () { selectTab('lookup'); });

    entryForm.addEventListener('submit', function (event) {
      event.preventDefault();
      verifyCode(codeInput.value);
    });

    if (claimNow) {
      claimNow.addEventListener('click', function () {
        if (!activeCode) {
          showMessage(claimResult, COPY.needCode, 'err');
          return;
        }
        var email = signedInEmail();
        if (email) {
          claimTo(email, true);
          return;
        }
        if (guestClaim) guestClaim.hidden = false;
        var typed = guestInput ? guestInput.value : '';
        if (!String(typed).trim()) {
          if (guestInput) guestInput.focus();
          return;
        }
        claimTo(typed, false);
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', function () {
        if (!activeCode) {
          showMessage(claimResult, COPY.needCode, 'err');
          return;
        }
        var email = signedInEmail();
        if (email) {
          claimTo(email, true);
          return;
        }
        if (!w.SLMember || !SLMember.available || typeof SLMember.signIn !== 'function') {
          showMessage(claimResult, (w.SLMember && SLMember.msg) ? SLMember.msg('unavailable') : COPY.errGeneric, 'err');
          return;
        }
        var validCode = codeKind(activeCode);
        if (!validCode || validCode === 'bad') {
          showMessage(claimResult, COPY.badCode, 'err');
          return;
        }
        var generation = ++claimGeneration;
        claimAfterLogin = true;
        rememberPendingClaim(validCode);
        Promise.resolve(SLMember.signIn()).then(function (result) {
          if (generation !== claimGeneration) return;
          var signedIn = !!(result && result.user && result.user.email) || !!signedInEmail();
          if (!signedIn) {
            claimAfterLogin = false;
            clearPendingClaim();
          }
        }).catch(function () {
          if (generation !== claimGeneration) return;
          claimAfterLogin = false;
          clearPendingClaim();
        });
      });
    }

    if (w.SLMember && typeof SLMember.onChange === 'function') {
      SLMember.onChange(function (user) {
        claimPendingIfNeeded(user);
      });
    }

    lookupForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var raw = lookupForm.querySelector('[name="query"]').value;
      var kind = identifierKind(raw);
      var validCode = codeKind(raw);
      var body = null;
      if (kind === 'email' || kind === 'phone') body = { identifier: raw.trim() };
      else if (validCode && validCode !== 'bad') body = { code: validCode };
      else {
        showMessage(lookupResult, raw.trim() ? COPY.badQuery : COPY.needLookup, 'err');
        return;
      }
      showMessage(lookupResult, COPY.loading, 'pending');
      withBusy(lookupForm, function () {
        return lookupBy(body);
      }).then(function (res) {
        renderLookup(res, lookupResult);
      }).catch(function () {
        showMessage(lookupResult, COPY.network, 'err');
      });
    });

    var fromUrl = prefillCode();
    if (fromUrl && codeInput) {
      codeInput.value = fromUrl;
      activeCode = fromUrl;
      verifyCode(fromUrl);
    }
  }

  function mountMember() {
    var root = d.getElementById('member-coupons');
    if (!root) return;
    var listEl = d.getElementById('member-coupon-list');
    var statusEl = d.getElementById('member-coupon-email-status');
    var claimForm = d.getElementById('member-coupon-claim');
    var phoneForm = d.getElementById('member-coupon-phone');
    var claimResult = d.getElementById('member-coupon-claim-result');
    var phoneResult = d.getElementById('member-coupon-phone-result');
    var email = '';

    function loadEmail(nextEmail) {
      email = (nextEmail || '').trim();
      clear(listEl);
      if (!email || identifierKind(email) !== 'email') {
        if (statusEl) showMessage(statusEl, COPY.noEmail, 'err');
        return;
      }
      if (statusEl) showMessage(statusEl, COPY.emailLoading, 'pending');
      lookupBy({ identifier: email }).then(function (res) {
        if (!res.ok) {
          if (statusEl) showMessage(statusEl, errorText(res), 'err');
          return;
        }
        var coupons = res.data && Array.isArray(res.data.coupons) ? res.data.coupons : [];
        if (statusEl) showMessage(statusEl, coupons.length ? '' : COPY.emailEmpty, '');
        if (statusEl && coupons.length) clear(statusEl);
        clear(listEl);
        coupons.forEach(function (coupon) {
          if (!coupon || typeof coupon !== 'object') return;
          listEl.appendChild(renderVoucher(coupon, { claimed: true, claimedAt: coupon.claimedAt, status: coupon.status }));
        });
      }).catch(function () {
        if (statusEl) showMessage(statusEl, COPY.network, 'err');
      });
    }

    if (w.SLMember && SLMember.available && typeof SLMember.onChange === 'function') {
      SLMember.onChange(function (user) {
        if (user && user.email) loadEmail(user.email);
        else {
          email = '';
          clear(listEl);
          clear(statusEl);
        }
      });
    }

    if (claimForm) {
      var claimInput = claimForm.querySelector('[name="code"]');
      claimForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var validCode = codeKind(claimInput ? claimInput.value : '');
        if (!email || identifierKind(email) !== 'email') {
          showMessage(claimResult, COPY.noEmail, 'err');
          return;
        }
        if (!validCode) {
          showMessage(claimResult, COPY.needCode, 'err');
          return;
        }
        if (validCode === 'bad') {
          showMessage(claimResult, COPY.badCode, 'err');
          return;
        }
        showMessage(claimResult, COPY.loading, 'pending');
        withBusy(claimForm, function () {
          return claimWith(email, validCode);
        }).then(function (res) {
          if (res.ok && res.data && res.data.ok === true && res.data.coupon) {
            showMessage(claimResult, res.data.alreadyClaimed ? COPY.already : COPY.boundOk, '');
            if (!res.data.alreadyClaimed && claimInput) claimInput.value = '';
            loadEmail(email);
          } else {
            renderClaim(res, claimResult);
          }
        }).catch(function () {
          showMessage(claimResult, COPY.network, 'err');
        });
      });
    }

    if (phoneForm) {
      phoneForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var value = phoneForm.querySelector('[name="phone"]').value;
        var kind = identifierKind(value);
        if (kind !== 'phone' && kind !== 'email') {
          showMessage(phoneResult, COPY.badId, 'err');
          return;
        }
        showMessage(phoneResult, COPY.loading, 'pending');
        withBusy(phoneForm, function () {
          return lookupBy({ identifier: value.trim() });
        }).then(function (res) {
          renderLookup(res, phoneResult);
        }).catch(function () {
          showMessage(phoneResult, COPY.network, 'err');
        });
      });
    }
  }

  function boot() {
    keepLangQuery();
    mountPage();
    mountMember();
  }

  w.SLCoupon = {
    apiBase: apiBase,
    lookup: lookupBy,
    claim: claimWith,
    renderVoucher: renderVoucher
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
