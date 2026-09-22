// Supabase browser configuration.
// Gunakan publishable key / anon key saja. JANGAN pernah menaruh service_role/secret key di sini.
window.APP_CONFIG = {
  url: 'https://geoedddgvzvqsykuekdw.supabase.co',
  key: 'sb_publishable_8-kbY1H5hvOd56kzMhOEdA_wgQ_2iyW'
};

document.write('<script src="kiosk.js"><\/script>');

// Load UI fixes after app.js and the page body are ready.
window.addEventListener('load', function(){
  var s=document.createElement('script');
  s.src='ui-fixes.js?v=20260923c';
  document.body.appendChild(s);
});
