// Konfigurasi Supabase untuk aplikasi browser.
// Hanya gunakan publishable/anon key. Jangan pernah menaruh service_role/secret key di file ini.
window.APP_CONFIG={
  url:'https://geoedddgvzvqsykuekdw.supabase.co',
  key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnZW9lZGRndnp2cXN5a3Vla2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODM3MjAsImV4cCI6MjEwNTY1OTcyMH0.DKaoJbKparsGc9_WEQ_jefQVJl5raNgPGckbw9UVoNI'
};

document.addEventListener('DOMContentLoaded',()=>{
  ['returns-web.js','bell-notification-rule.js'].forEach((file,i)=>{
    const id='isolated-module-'+i;if(document.getElementById(id))return;
    const s=document.createElement('script');s.id=id;s.src=file+'?v=20260928';s.defer=true;document.head.appendChild(s);
  });
  if(/Electron/i.test(navigator.userAgent||'')){
    const refreshWindowsStockNotifications=async()=>{
      try{
        const raw=localStorage.getItem('tokokasirlussal-auth');
        let token=window.APP_CONFIG.key;
        try{const session=raw?JSON.parse(raw):null;token=session?.access_token||session?.currentSession?.access_token||token}catch(_){ }
        const url=window.APP_CONFIG.url.replace(/\/$/,'')+'/rest/v1/products?select=id,nama,kategori,stok&aktif=eq.true&order=nama.asc';
        const res=await fetch(url,{headers:{apikey:window.APP_CONFIG.key,Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'});
        if(!res.ok)return;
        const products=await res.json();
        if(!Array.isArray(products))return;
        const alerts=products.filter(p=>{
          const stock=Number(p?.stok||0);
          const category=String(p?.kategori||'').trim().toLowerCase();
          return category==='agarillus'?stock<10:stock===0;
        }).sort((a,b)=>Number(a?.stok||0)-Number(b?.stok||0));
        const list=document.getElementById('notificationList'),badge=document.getElementById('notificationBadge'),count=document.getElementById('notificationCount');
        if(badge){badge.textContent=alerts.length>99?'99+':String(alerts.length);badge.classList.toggle('show',alerts.length>0)}
        if(count)count.textContent=String(alerts.length);
        if(list)list.innerHTML=alerts.map(p=>{
          const out=Number(p.stok||0)===0;
          const text=out?'Produk '+p.nama+' habis':'Produk '+p.nama+' stok '+p.stok;
          const safe=text.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
          return '<div class="notify-item '+(out?'danger':'warn')+'"><span>'+(out?'🔴':'🟠')+'</span><b>'+safe+'</b></div>';
        }).join('')||'<div class="notify-empty">Stok aman</div>';
      }catch(_){ }
    };
    window.addEventListener('load',()=>{refreshWindowsStockNotifications();setInterval(refreshWindowsStockNotifications,5000)},{once:true});
  }
});
