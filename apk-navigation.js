/* APK-ONLY navigation gestures. This file is injected only into the Android APK. */
(function(){
'use strict';
function init(){
  var side=document.querySelector('body.app-screen .side') || document.querySelector('.side');
  if(!side || side.dataset.apkNavV3==='1') return;
  document.documentElement.classList.add('apk-nav-enabled');
  side.dataset.apkNavV3='1';
  var handle=document.createElement('div'); handle.className='apk-nav-handle'; handle.setAttribute('aria-label','Tarik menu'); side.appendChild(handle);
  var startX=0,startY=0,prevX=0,prevY=0,lastY=0,axis=null,dragging=false,hidden=false;
  function h(){return side.getBoundingClientRect().height||72}
  function applyHidden(v){hidden=!!v;side.classList.toggle('apk-nav-hidden',hidden);side.style.transform='';}
  function centerActive(){if(hidden)return;var a=side.querySelector('.nav.active');if(a)a.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}
  function start(e){var t=e.touches&&e.touches[0];if(!t)return;startX=prevX=t.clientX;startY=prevY=lastY=t.clientY;axis=null;dragging=true;side.classList.add('apk-nav-dragging');}
  function move(e){if(!dragging)return;var t=e.touches&&e.touches[0];if(!t)return;var dx=t.clientX-prevX,dy=t.clientY-prevY,totalX=t.clientX-startX,totalY=t.clientY-startY;if(!axis&&Math.hypot(totalX,totalY)>7)axis=Math.abs(totalX)>=Math.abs(totalY)?'x':'y';prevX=t.clientX;prevY=t.clientY;lastY=t.clientY;if(axis==='x'){e.preventDefault();side.scrollLeft-=dx;return}if(axis==='y'){e.preventDefault();var offset=hidden?Math.max(0,h()-25):0;var next=Math.max(0,Math.min(h()-25,offset+totalY));side.style.transform='translate3d(0,'+next+'px,0)';}}
  function end(){if(!dragging)return;var dy=lastY-startY;dragging=false;side.classList.remove('apk-nav-dragging');if(axis==='y'){if(dy>35)applyHidden(true);else if(dy<-35)applyHidden(false);else side.style.transform='';}axis=null;setTimeout(centerActive,30);}
  side.addEventListener('touchstart',start,{passive:true});side.addEventListener('touchmove',move,{passive:false});side.addEventListener('touchend',end,{passive:true});side.addEventListener('touchcancel',end,{passive:true});
  side.addEventListener('wheel',function(e){if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();side.scrollLeft+=e.deltaY}},{passive:false});
  new MutationObserver(function(){if(!hidden)centerActive()}).observe(side,{subtree:true,attributes:true,attributeFilter:['class']});
  setTimeout(centerActive,300);setTimeout(centerActive,1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.addEventListener('load',init);
})();

/* APK-ONLY SETTINGS MIRROR — keep Web/Windows source untouched. */
(function(){
'use strict';
function ensureApkSettings(){
  if(!document.documentElement.classList.contains('apk-nav-enabled'))return;
  var tab=document.getElementById('tab-akun');
  if(!tab || tab.dataset.apkSettingsV1==='1')return;
  tab.dataset.apkSettingsV1='1';

  var content=tab.querySelector('.account-content');
  if(!content)return;

  var card=document.createElement('div');
  card.className='apk-printer-settings card';
  card.id='printerSettingsCard';
  card.innerHTML='<div class="apk-printer-head"><div class="apk-printer-icon">🖨️</div><div><b>Pilih Printer</b><small id="printerDetectStatus">Deteksi printer yang tersambung</small></div><button type="button" class="btn secondary apk-printer-refresh" onclick="detectReceiptPrinters(true)" title="Deteksi ulang printer">🔄</button></div>'+
    '<div class="apk-printer-row"><select id="receiptPrinter"><option value="">Pilih printer...</option></select><button type="button" class="btn primary" onclick="testReceiptPrinter()">🖨️ Tes</button></div>'+
    '<div class="apk-printer-types"><span>🧾 Thermal</span><span>🖨️ Printer biasa</span><span>💻 Printer sistem</span></div>'+
    '<div class="note" id="printerSelectedNote">Belum ada printer dipilih.</div>';
  content.appendChild(card);

  setTimeout(function(){
    try{
      if(typeof refreshReceiptPrinters==='function')refreshReceiptPrinters();
    }catch(e){console.warn('APK settings printer',e)}
  },50);
}

function bindApkSettingsObserver(){
  ensureApkSettings();
  var target=document.getElementById('tab-akun');
  if(!target || target.dataset.apkSettingsObserver==='1')return;
  target.dataset.apkSettingsObserver='1';
  new MutationObserver(ensureApkSettings).observe(target,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindApkSettingsObserver,{once:true});
else bindApkSettingsObserver();
window.addEventListener('load',bindApkSettingsObserver);
})();


/* APK SETTINGS FIX V2 — use the existing Settings DOM; never duplicate Web controls. */
(function(){
'use strict';
function fixApkSettings(){
  if(!document.documentElement.classList.contains('apk-nav-enabled'))return;
  var tab=document.getElementById('tab-akun');
  if(!tab)return;
  var content=tab.querySelector('.account-content');
  if(!content)return;

  /* The Web source already contains the printer card. APK must reuse it. */
  var printer=content.querySelector('#printerSettingsCard');
  if(!printer){
    printer=content.querySelector('.printer-settings');
    if(printer)printer.id='printerSettingsCard';
  }
  if(printer){
    printer.classList.add('apk-settings-printer');
    var summary=content.querySelector('.account-summary');
    if(summary && printer.parentElement===content && printer.previousElementSibling!==summary){
      summary.insertAdjacentElement('afterend',printer);
    }
    try{if(typeof refreshReceiptPrinters==='function')refreshReceiptPrinters();}catch(e){console.warn('APK printer refresh',e)}
  }

  tab.classList.add('apk-settings-fixed');
  content.classList.add('apk-settings-content-fixed');
}
function bind(){
  fixApkSettings();
  var tab=document.getElementById('tab-akun');
  if(!tab || tab.dataset.apkSettingsFixV2==='1')return;
  tab.dataset.apkSettingsFixV2='1';
  new MutationObserver(function(){fixApkSettings()}).observe(tab,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.addEventListener('load',bind);
})();
