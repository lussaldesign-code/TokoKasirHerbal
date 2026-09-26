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
 side.addEventListener('touchmove',e=>{if(!drag)return;const t=e.touches&&e.touches[0];if(!t)return;const dx=t.clientX-sx,dy=t.clientY-sy;if(!axis&&Math.hypot(dx,dy)>8)axis=vertical?'y':(Math.abs(dx)>Math.abs(dy)?'x':'y');if(axis==='x'){side.scrollLeft-=t.clientX-lx;lx=t.clientX;return}if(axis==='y'){e.preventDefault();ly=t.clientY;const hh=side.offsetHeight||86,max=Math.max(0,hh-22),base=open?0:max,off=Math.max(0,Math.min(max,base+dy));side.style.transform='translate3d(0,'+off+'px,0')}},{passive:false});
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