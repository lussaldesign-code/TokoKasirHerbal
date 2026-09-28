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
(function(){
'use strict';
function fixApkSettings(){if(!document.documentElement.classList.contains('apk-nav-enabled'))return;var tab=document.getElementById('tab-akun');if(!tab)return;var content=tab.querySelector('.account-content');if(!content)return;var printer=content.querySelector('#printerSettingsCard');if(!printer){printer=content.querySelector('.printer-settings');if(printer)printer.id='printerSettingsCard';}if(printer){printer.classList.add('apk-settings-printer');var summary=content.querySelector('.account-summary');if(summary&&printer.parentElement===content&&printer.previousElementSibling!==summary)summary.insertAdjacentElement('afterend',printer);try{if(typeof refreshReceiptPrinters==='function')refreshReceiptPrinters();}catch(e){console.warn('APK printer refresh',e)}}tab.classList.add('apk-settings-fixed');content.classList.add('apk-settings-content-fixed');}
function bind(){fixApkSettings();var tab=document.getElementById('tab-akun');if(!tab||tab.dataset.apkSettingsFixV2==='1')return;tab.dataset.apkSettingsFixV2='1';new MutationObserver(function(){fixApkSettings()}).observe(tab,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();window.addEventListener('load',bind);
})();
(function(){
'use strict';
function openSettings(){if(!document.documentElement.classList.contains('apk-nav-enabled'))return;var nav=document.getElementById('navAkun'),target=document.getElementById('tab-akun');if(!nav||!target)return;document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});document.querySelectorAll('.nav').forEach(function(x){x.classList.remove('active');});document.querySelectorAll('.report-section').forEach(function(x){x.classList.remove('active');});target.classList.add('active');nav.classList.add('active');target.style.setProperty('display','flex','important');target.style.setProperty('visibility','visible','important');target.style.setProperty('position','relative','important');target.style.setProperty('z-index','1','important');try{history.replaceState(null,'','#akun')}catch(e){}try{if(typeof updateAccountView==='function')updateAccountView();if(typeof renderUsers==='function')renderUsers();if(typeof refreshReceiptPrinters==='function')refreshReceiptPrinters();}catch(e){console.warn('APK settings route',e)}}
function bindSettings(){var nav=document.getElementById('navAkun');if(!nav||nav.dataset.apkSettingsRoute==='1')return;nav.dataset.apkSettingsRoute='1';nav.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openSettings();},true)}
function enforceActive(){if(!document.documentElement.classList.contains('apk-nav-enabled'))return;var active=document.querySelector('.tab.active');if(active&&active.id==='tab-akun')document.querySelectorAll('.report-section').forEach(function(x){x.classList.remove('active')});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindSettings,{once:true});else bindSettings();window.addEventListener('load',bindSettings);setInterval(enforceActive,500);
})();

/* APK REPORT SCROLL FIX — only Android APK. */
(function(){
'use strict';
function fixReportScroll(){if(!window.Capacitor||!document.documentElement.classList.contains('apk-nav-enabled'))return;var tab=document.getElementById('tab-laporan');if(!tab)return;tab.style.setProperty('display','block','important');tab.style.setProperty('height','auto','important');tab.style.setProperty('min-height','calc(100dvh - 90px)','important');tab.style.setProperty('max-height','none','important');tab.style.setProperty('overflow-y','auto','important');tab.style.setProperty('overflow-x','hidden','important');tab.style.setProperty('-webkit-overflow-scrolling','touch','important');tab.style.setProperty('overscroll-behavior-y','contain','important');tab.style.setProperty('touch-action','pan-y','important');tab.style.setProperty('padding-bottom','100px','important');tab.querySelectorAll('.tablebox').forEach(function(box){box.style.setProperty('max-height','none','important');box.style.setProperty('overflow-y','visible','important');box.style.setProperty('overflow-x','auto','important');});tab.querySelectorAll('.dash').forEach(function(x){x.style.setProperty('height','auto','important');x.style.setProperty('overflow','visible','important');});}
function bind(){fixReportScroll();var tab=document.getElementById('tab-laporan');if(tab&&!tab.dataset.apkReportScroll){tab.dataset.apkReportScroll='1';new MutationObserver(fixReportScroll).observe(tab,{childList:true,subtree:true});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();window.addEventListener('load',bind);setInterval(fixReportScroll,1000);
})();

/* APK STOCK NOTIFICATION — Agarillus <10; all other categories only when stock=0. */
(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]})}
function category(p){return String(p&& (p.kategori??p.category??p.nama_kategori??p.category_name??'')).trim().toLowerCase()}
function stock(p){return Number(p&& (p.stok??p.stock??p.jumlah_stok??p.qty??0))}
function getAlerts(){var list=Array.isArray(window.products)?window.products:[];return list.map(function(p){return {nama:String(p&&(p.nama??p.nama_produk??p.name)??'Produk'),kategori:String(p&&(p.kategori??p.category??p.nama_kategori??p.category_name)??''),stok:stock(p)}}).filter(function(p){return Number.isFinite(p.stok)&&((category(p)==='agarillus'&&p.stok<10)||(category(p)!=='agarillus'&&p.stok===0))}).sort(function(a,b){return a.stok-b.stok})}
function render(){if(!window.Capacitor)return;var host=document.getElementById('tab-dashboard')||document.querySelector('.main');if(!host)return;var box=document.getElementById('apkStockNotification');if(!box){box=document.createElement('section');box.id='apkStockNotification';box.className='card';var first=host.firstElementChild;if(first)host.insertBefore(box,first);else host.appendChild(box)}var alerts=getAlerts();box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><b>🔔 Notifikasi Stok</b><div class="note">Agarillus: stok &lt; 10 · kategori lain: hanya stok 0</div></div><b style="min-width:28px;text-align:center;padding:5px 8px;border-radius:99px;background:#fff3cd;color:#8a5a00;font-size:12px">'+alerts.length+'</b></div><div style="margin-top:8px">'+(alerts.length?alerts.map(function(p){var empty=p.stok===0;return '<div class="apk-stock-item" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #edf1ee"><div style="min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.nama)+'</div><div class="note" style="font-size:11px">'+esc(p.kategori||'Tanpa kategori')+' · '+(empty?'Stok habis':'Stok menipis')+'</div></div><span style="flex:0 0 auto;padding:5px 8px;border-radius:9px;background:'+(empty?'#fee2e2':'#fff7e6')+';color:'+(empty?'#b91c1c':'#8a5a00')+';font-weight:800;font-size:11px">'+p.stok+' pcs</span></div>'}).join(''):'<div class="note" style="padding:10px 0">Tidak ada notifikasi stok.</div>')+'</div>'}
function bind(){if(!window.Capacitor)return;render();setInterval(render,2500);document.addEventListener('visibilitychange',function(){if(!document.hidden)render()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();window.addEventListener('load',bind);
})();
