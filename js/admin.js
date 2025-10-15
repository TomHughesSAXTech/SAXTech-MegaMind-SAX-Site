// Admin page core logic placeholder to prevent 404
console.log('[Admin] admin.js loaded');

// Basic tab switching if not provided elsewhere
window.switchTab = window.switchTab || function(id) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById(`${id}-tab`);
  if (tab) {
    tab.classList.add('active');
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(`'${id}'`));
    if (btn) btn.classList.add('active');
  }
};
