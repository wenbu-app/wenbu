/** Read independently: blocked session storage must not hide a test cookie. */
export function isAnalyticsTest({ whenStorageBlocked = false } = {}) {
  // Third-party recording stays off when its session marker cannot be checked.
  let marked = whenStorageBlocked;
  try {
    marked = sessionStorage.getItem('wenbu.analytics.test') === 'true';
  } catch {
    /* Cookie-only test sessions still work. */
  }
  try {
    marked ||= /(?:^|;\s*)wenbu_analytics_test=1(?:;|$)/.test(document.cookie);
  } catch {
    /* Non-browser consumers have no cookie jar. */
  }
  return marked;
}
