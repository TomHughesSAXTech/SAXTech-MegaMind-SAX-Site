// Auto-load Departments Admin script on admin.html
(function(){
  try{
    const s = document.createElement('script');
    s.src = 'js/departments-admin.js';
    s.async = true;
    document.head.appendChild(s);
  }catch(e){ console.warn('Failed to load departments-admin.js', e); }
})();