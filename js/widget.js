// 懸浮諮詢按鈕：開關面板
document.addEventListener('DOMContentLoaded', function () {
  // ===== 語言偵測提示條 =====
  (function () {
    var banner = document.querySelector('.lang-banner');
    if (!banner) return;

    var DISMISS_KEY = 'shenlong-lang-dismissed';
    if (localStorage.getItem(DISMISS_KEY)) return;

    var currentLang = document.documentElement.lang || 'zh-Hant'; // 'zh-Hant' or 'zh-Hans'
    var browserLang = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();

    // 判斷使用者裝置語言偏好的是簡體還是繁體
    var prefersSimplified = browserLang.indexOf('zh-cn') !== -1 || browserLang.indexOf('zh-sg') !== -1 || browserLang === 'zh-hans';
    var prefersTraditional = browserLang.indexOf('zh-tw') !== -1 || browserLang.indexOf('zh-hk') !== -1 || browserLang === 'zh-hant';

    var shouldSuggest = (currentLang === 'zh-Hant' && prefersSimplified) || (currentLang === 'zh-Hans' && prefersTraditional);
    if (!shouldSuggest) return;

    // 計算對應語言版本的網址（root <-> zh-cn 資料夾對應同檔名）
    var path = window.location.pathname;
    var targetHref;
    if (currentLang === 'zh-Hant') {
      var file = path.split('/').pop() || 'index.html';
      targetHref = 'zh-cn/' + file;
    } else {
      targetHref = '../' + (path.split('/').pop() || 'index.html');
    }

    var switchLabel = currentLang === 'zh-Hant' ? '简体中文' : '繁體中文';
    var msgText = currentLang === 'zh-Hant'
      ? '检测到您的设备语言可能是简体中文，是否切换？'
      : '偵測到您的裝置語言可能是繁體中文，要切換嗎？';
    var dismissText = currentLang === 'zh-Hant' ? '不用了' : '不用了';

    banner.innerHTML =
      '<span>' + msgText + '</span>' +
      '<a class="switch-btn" href="' + targetHref + '">' + switchLabel + '</a>' +
      '<button type="button" class="dismiss-btn">' + dismissText + '</button>';

    banner.classList.add('show');

    banner.querySelector('.dismiss-btn').addEventListener('click', function () {
      banner.classList.remove('show');
      localStorage.setItem(DISMISS_KEY, '1');
    });
  })();

  var toggle = document.querySelector('.widget-toggle');
  var panel = document.querySelector('.contact-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', function () {
    var isOpen = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) {
      panel.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // 手機版選單開關
  var menuToggle = document.querySelector('.menu-toggle');
  var menu = document.querySelector('nav.menu');
  if (menuToggle && menu) {
    menuToggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('mobile-open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }
});
