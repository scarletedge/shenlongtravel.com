// 懸浮諮詢按鈕：開關面板
document.addEventListener('DOMContentLoaded', function () {
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
