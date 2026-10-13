/* APK-only report behavior. Does not alter shared web/Windows source. */
(function () {
  'use strict';
  function initApkReportUi() {
    if (!document.getElementById('reportViewToday') || !document.getElementById('reportViewMonth')) return;
    // Start with both detailed lists closed; summary cards remain visible.
    document.querySelectorAll('.report-view').forEach(function (view) {
      view.classList.remove('active');
      view.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.report-switch-btn').forEach(function (button) {
      button.classList.remove('active');
      button.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.report-switch-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        window.setTimeout(function () {
          document.querySelectorAll('.report-view').forEach(function (view) {
            view.setAttribute('aria-hidden', view.classList.contains('active') ? 'false' : 'true');
          });
          document.querySelectorAll('.report-switch-btn').forEach(function (item) {
            item.setAttribute('aria-selected', item.classList.contains('active') ? 'true' : 'false');
          });
        }, 0);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApkReportUi, { once: true });
  else initApkReportUi();
})();
