// Konfigurasi Supabase untuk aplikasi browser.
// Hanya gunakan publishable/anon key. Jangan pernah menaruh service_role/secret key di file ini.
window.APP_CONFIG={
  url:'https://geoedddgvzvqsykuekdw.supabase.co',
  key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlb2VkZGRndnp2cXN5a3Vla2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODM3MjAsImV4cCI6MjEwNTY1OTcyMH0.DKaoJbKparsGc9_WEQ_jefQVJl5raNgPGckbw9UVoNI'
};

document.addEventListener('DOMContentLoaded',()=>{
  ['returns-web.js','bell-notification-rule.js'].forEach((file,i)=>{
    const id='isolated-module-'+i;if(document.getElementById(id))return;
    const s=document.createElement('script');s.id=id;s.src=file+'?v=20260928';s.defer=true;document.head.appendChild(s);
  });
});
