/* APK V2 navigation */
(function(){
'use strict';
function boot(){
 if(!window.Capacitor)return;
 document.documentElement.classList.add('apk-v2');
 const side=document.querySelector('.side'); if(!side||side.dataset.apkV2Ready)return;
 side.dataset.apkV2Ready='1';
 const h=document.createElement('div');h.className='apk-sheet-handle';h.innerHTML='<i></i><span>Geser</span>';side.prepend(h);
 let sx=0,sy=0,lx=0,ly=0,axis=null,drag=false,vertical=false,open=true;
 const setOpen=v=>{open=!!v;side.classList.toggle('apk-sheet-collapsed',!open);side.style.removeProperty('transform');};
 const center=()=>{if(!open)return;const a=side.querySelector('.nav.active');if(a)a.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});};
 side.addEventListener('touchstart',e=>{const t=e.touches&&e.touches[0];if(!t)return;sx=lx=t.clientX;sy=ly=t.clientY;axis=null;drag=true;vertical=!!e.target.closest?.('.apk-sheet-handle');side.classList.add('apk-sheet-dragging')},{passive:true});
 side.addEventListener('touchmove',e=>{if(!drag)return;const t=e.touches&&e.touches[0];if(!t)return;const dx=t.clientX-sx,dy=t.clientY-sy;if(!axis&&Math.hypot(dx,dy)>8){axis=vertical?'y':(Math.abs(dx)>Math.abs(dy)?'x':'y');if(axis==='y')vertical=true;}if(axis==='x'){side.scrollLeft-=t.clientX-lx;lx=t.clientX;return}if(axis==='y'){e.preventDefault();ly=t.clientY;const hh=side.offsetHeight||86,max=Math.max(0,hh-12),base=open?0:max,off=Math.max(0,Math.min(max,base+dy));side.style.transform='translate3d(0,'+off+'px,0')}},{passive:false});
 const end=()=>{if(!drag)return;drag=false;side.classList.remove('apk-sheet-dragging');if(axis==='y'){const dy=ly-sy;if(dy<-28)setOpen(true);else if(dy>28)setOpen(false);else side.style.removeProperty('transform')}axis=null;setTimeout(center,40)};
 side.addEventListener('touchend',end,{passive:true});side.addEventListener('touchcancel',end,{passive:true});
 side.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();side.scrollLeft+=e.deltaY}},{passive:false});
 h.addEventListener('click',()=>setOpen(!open));side.addEventListener('click',e=>{const n=e.target.closest?.('.nav');if(!n)return;if(!open){e.preventDefault();setOpen(true)}else setTimeout(center,40)});
 new MutationObserver(()=>{if(open)center()}).observe(side,{subtree:true,attributes:true,attributeFilter:['class']});
 setTimeout(center,250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('load',boot);
})();
(function(){
'use strict';
function fix(){if(!document.documentElement.classList.contains('apk-v2'))return;const t=document.getElementById('tab-akun');if(!t)return;const c=t.querySelector('.account-content');if(!c)return;t.classList.add('apk-v2-settings');c.classList.add('apk-v2-settings-content');const p=c.querySelector('#printerSettingsCard,.printer-settings');if(p){p.id='printerSettingsCard';p.classList.add('apk-v2-printer')}try{if(typeof refreshReceiptPrinters==='function')refreshReceiptPrinters()}catch(_){} }
function bind(){fix();const t=document.getElementById('tab-akun');if(!t||t.dataset.apkV2Settings)return;t.dataset.apkV2Settings='1';new MutationObserver(fix).observe(t,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();window.addEventListener('load',bind);
})();
(function(){
'use strict';
function addCameraShortcut(){
 if(!document.documentElement.classList.contains('apk-v2'))return;
 const modal=document.getElementById('productModal'), file=document.getElementById('pGambarCamera');
 if(!modal||!file||modal.dataset.apkCameraReady==='1')return;
 modal.dataset.apkCameraReady='1';
 const box=modal.querySelector('.modalbox'); if(!box)return;
 const old=box.querySelector('.photo-actions'); if(old) old.classList.add('apk-camera-actions');
 const btn=document.createElement('button');
 btn.type='button'; btn.className='apk-camera-main'; btn.innerHTML='📷 <span>Ambil Foto Produk</span><small>Kamera perangkat</small>';
 btn.addEventListener('click',()=>file.click());
 const target=box.querySelector('#pGambarPreview');
 if(target&&target.parentNode)target.parentNode.insertBefore(btn,target);
 else box.appendChild(btn);
}
function boot(){addCameraShortcut();const m=document.getElementById('productModal');if(m)new MutationObserver(addCameraShortcut).observe(m,{attributes:true,childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('load',boot);
})();

/* APK STOCK NOTIFICATION V2 — hanya APK, Web/Windows tidak disentuh. */
(function(){
'use strict';
function getStockAlerts(){
  const list=Array.isArray(window.products)?window.products:[];
  return list.map(p=>({
    id:p.id,
    nama:String(p.nama||p.nama_produk||p.name||'Produk'),
    stok:Number(p.stok??p.stock??0)
  })).filter(p=>Number.isFinite(p.stok)&&p.stok<10).sort((a,b)=>a.stok-b.stok);
}
function ensureUi(){
  if(!document.documentElement.classList.contains('apk-v2'))return null;
  let wrap=document.getElementById('apkStockNotification');
  if(wrap)return wrap;
  const host=document.getElementById('tab-dashboard')||document.querySelector('.main');
  if(!host)return null;
  wrap=document.createElement('section');
  wrap.id='apkStockNotification';
  wrap.className='card';
  wrap.style.cssText='margin:0 0 12px;padding:14px;border-radius:16px;border:1px solid #dfe8e2;background:#fff;box-shadow:0 5px 16px rgba(18,59,37,.08);';
  wrap.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><b style="font-size:14px">🔔 Notifikasi Stok</b><div class="note">Produk dengan stok kurang dari 10 ditampilkan di sini.</div></div><b id="apkStockNotificationCount" style="min-width:28px;text-align:center;padding:5px 8px;border-radius:99px;background:#fff3cd;color:#8a5a00;font-size:12px">0</b></div><div id="apkStockNotificationList" style="margin-top:10px"></div>';
  const first=host.firstElementChild;
  if(first&&first.id!=='apkStockNotification')host.insertBefore(wrap,first);else host.appendChild(wrap);
  return wrap;
}
function render(){
  if(!document.documentElement.classList.contains('apk-v2'))return;
  const wrap=ensureUi();if(!wrap)return;
  const alerts=getStockAlerts();
  const count=document.getElementById('apkStockNotificationCount');
  const list=document.getElementById('apkStockNotificationList');
  if(count)count.textContent=String(alerts.length);
  if(!list)return;
  if(!alerts.length){
    list.innerHTML='<div class="note" style="padding:9px 0">Tidak ada produk dengan stok kurang dari 10.</div>';
    return;
  }
  list.innerHTML=alerts.map(p=>{
    const empty=p.stok<=0;
    const label=empty?'Stok habis':'Stok menipis';
    const bg=empty?'#fee2e2':'#fff7e6';
    const fg=empty?'#b91c1c':'#8a5a00';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #edf1ee">'+
      '<div style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(p.nama)+'</b><span class="note">'+label+'</span></div>'+
      '<span style="flex:0 0 auto;padding:5px 8px;border-radius:9px;background:'+bg+';color:'+fg+';font-weight:800;font-size:11px">'+(empty?'0':p.stok)+' pcs</span></div>';
  }).join('');
}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));}
function boot(){
  if(!document.documentElement.classList.contains('apk-v2'))return;
  render();
  setInterval(render,3000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('load',boot);
})();
