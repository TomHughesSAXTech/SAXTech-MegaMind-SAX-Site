/* Placeholder: Chart.js is loaded via CDN (jsdelivr). This file prevents 404s in admin.html. */
if (typeof window !== 'undefined' && window.Chart) {
  // no-op
  console.log('[Admin] chart.js placeholder loaded; using CDN Chart.js');
}