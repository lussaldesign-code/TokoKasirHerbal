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


/* APK-ONLY UPDATE SYSTEM
   The APK has its own updater so web/PWA and Windows updater logic are untouched. */
(function(){
'use strict';
const APK_BUILD_VERSION='__APK_VERSION__';
const APK_UPDATE_MANIFEST='apk-update.json';
const nativeUpdater=()=>window.AndroidUpdater&&typeof window.AndroidUpdater.downloadAndInstall==='function';
function parts(v){return String(v||'0').replace(/^v/i,'').split('.').map(x=>parseInt(x,10)||0)}
function newer(a,b){const x=parts(a),y=parts(b);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)}return false}
function toast(msg){if(typeof window.toast==='function')window.toast(msg);else if(typeof window.showToast==='function')window.showToast(msg);else alert(msg)}
function showUpdateDialog(info){
 let m=document.getElementById('apkUpdateDialog');
 if(m)m.remove();
 m=document.createElement('div');m.id='apkUpdateDialog';
 m.innerHTML='<div class="apk-update-card"><div class="apk-update-icon">⬆️</div><h3>Update APK tersedia</h3><p>Versi saat ini <b>v'+APK_BUILD_VERSION+'</b><br>Versi baru <b>v'+info.version+'</b></p><p class="apk-update-note">Tekan Update untuk mengunduh dan memasang perubahan APK. Data akun dan transaksi tidak dihapus.</p><div class="apk-update-actions"><button type="button" id="apkUpdateLater">Nanti</button><button type="button" id="apkUpdateNow">Update</button></div></div>';
 document.body.appendChild(m);
 document.getElementById('apkUpdateLater').onclick=()=>m.remove();
 document.getElementById('apkUpdateNow').onclick=()=>{
   const b=document.getElementById('apkUpdateNow');b.disabled=true;b.textContent='Mengunduh...';
   if(nativeUpdater()){window.AndroidUpdater.downloadAndInstall(String(info.apk));}
   else if(info.apk){window.open(String(info.apk),'_blank');toast('APK dibuka untuk diunduh. Setelah selesai, Android akan meminta konfirmasi pemasangan.')}
   else {toast('Link APK update tidak tersedia.');m.remove()}
 };
}
async function checkApkUpdate(){
 const btn=document.getElementById('checkUpdateBtn');
 if(btn){btn.disabled=true;btn.textContent='⏳ Mengecek...'}
 try{
   const res=await fetch(APK_UPDATE_MANIFEST+'?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
   if(!res.ok)throw new Error('HTTP '+res.status);
   const info=await res.json();
   if(!info?.version||!info?.apk)throw new Error('Manifest APK tidak valid');
   if(newer(info.version,APK_BUILD_VERSION))showUpdateDialog(info);
   else toast('APK sudah versi terbaru (v'+APK_BUILD_VERSION+').');
 }catch(e){console.error('[apk-updater]',e);toast('Gagal mengecek update APK. Periksa koneksi internet.')}
 finally{if(btn){btn.disabled=false;btn.textContent='🔄 Update'}}
}
function bind(){
 if(!window.Capacitor)return;
 document.documentElement.classList.add('apk-v2');
 const btn=document.getElementById('checkUpdateBtn');
 if(btn&&!btn.dataset.apkUpdaterBound){btn.dataset.apkUpdaterBound='1';btn.onclick=checkApkUpdate}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.addEventListener('load',bind);
})();
