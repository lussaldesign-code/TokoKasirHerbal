// Supabase browser configuration.
// Gunakan publishable key / anon key saja. JANGAN pernah menaruh service_role/secret key di sini.
window.APP_CONFIG = {
  url: 'https://geoedddgvzvqsykuekdw.supabase.co',
  key: 'sb_publishable_8-kbY1H5hvOd56kzMhOEdA_wgQ_2iyW'
};

// Username-only kiosk login. Loaded before app.js so it can replace the old email/password flow.
document.write('<script src="kiosk.js"><\\/script>');

// Load UI fixes only after the page body and app.js are ready.
window.addEventListener('load', function(){
  var s=document.createElement('script');
  s.src='ui-fixes.js?v=20260923b';
  document.body.appendChild(s);
});
