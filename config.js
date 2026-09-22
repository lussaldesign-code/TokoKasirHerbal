// Supabase browser configuration.
// Gunakan publishable key / anon key saja. JANGAN pernah menaruh service_role/secret key di sini.
window.APP_CONFIG = {
  url: 'https://geoedddgvzvqsykuekdw.supabase.co',
  key: 'sb_publishable_8-kbY1H5hvOd56kzMhOEdA_wgQ_2iyW'
};

// Username-only kiosk login. Loaded before app.js so it can replace the old email/password flow.
document.write('<script src="kiosk.js"><\/script>');

// Load UI fixes after app.js has initialized its global functions.
setTimeout(function(){
  var s=document.createElement('script');
  s.src='ui-fixes.js?v=20260923';
  document.body.appendChild(s);
},0);
