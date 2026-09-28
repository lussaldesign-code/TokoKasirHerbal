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

/* APK SETTINGS FIX V2 — use the existing Settings DOM; never duplicate Web controls. */
(function(){
'use strict';
function fixApkSettings(){
  if(!document.documentElement.classList.contains('apk-nav-enabled'))return;
  var tab=document.getElementById('tab-akun');
  if(!tab)return;
  var content=tab.querySelector('.account-content');
  if(!content)return;
  var printer=content.querySelector('#printerSettingsCard');
  if(!printer){printer=content.querySelector('.printer-settings');if(printer)printer.id='printerSettingsCard';}
  if(printer){printer.classList.add('apk-settings-printer');var summary=content.querySelector('.account-summary');if(summary&&printer.parentElement===content&&printer.previousElementSibling!==summary)summary.insertAdjacentElement('afterend',printer);try{if(typeof refreshReceiptPrinters==='function')refreshReceiptPrinters();}catch(e){console.warn('APK printer refresh',e)}}
  tab.classList.add('apk-settings-fixed');content.classList.add('apk-settings-content-fixed');
}
function bind(){fixApkSettings();var tab=document.getElementById('tab-akun');if(!tab||tab.dataset.apkSettingsFixV2==='1')return;tab.dataset.apkSettingsFixV2='1';new MutationObserver(function(){fixApkSettings()}).observe(tab,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();window.addEventListener('load',bind);
})();

/* APK SETTINGS / REPORT ROUTE FIX — Settings always opens Settings, never Reports. */
(function(){
'use strict';
function openSettings(){if(!document.documentElement.classList.contains('apk-nav-enabled'))return;var nav=document.getElementById('navAkun'),target=document.getElementById('tab-akun');if(!nav||!target)return;document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.nav').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.report-section').forEach(function(x){x.classList.remove('active')});target.classList.add('active');nav.classList.add('active');target.style.setProperty('display','flex','important');target.style.setProperty('visibility','visible','important');target.style.setProperty('position','relative','important');target.style.setProperty('z-index','1','important');try{history.replaceState(null,'','#akun')}catch(e){}try{if(typeof updateAccountView==='function')updateAccountView();if(typeof renderUsers==='function')renderUsers();if(typeof refreshReceiptPrinters==='function')refreshReceiptPrinters()}catch(e){console.warn('APK settings route',e)}}
function bindSettings(){var nav=document.getElementById('navAkun');if(!nav||nav.dataset.apkSettingsRoute==='1')return;nav.dataset.apkSettingsRoute='1';nav.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openSettings()},true)}
function enforceActive(){if(!document.documentElement.classList.contains('apk-nav-enabled'))return;var active=document.querySelector('.tab.active');if(active&&active.id==='tab-akun')document.querySelectorAll('.report-section').forEach(function(x){x.classList.remove('active')})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindSettings,{once:true});else bindSettings();window.addEventListener('load',bindSettings);setInterval(enforceActive,500);
})();

/* APK REPORT SCROLL FIX — allow vertical swipe/scroll inside the existing report panel. */
(function(){
'use strict';
function fixReports(){
  if(!document.documentElement.classList.contains('apk-nav-enabled'))return;
  document.querySelectorAll('.report-section').forEach(function(report){
    report.style.setProperty('box-sizing','border-box','important');report.style.setProperty('min-height','0','important');report.style.setProperty('max-height','calc(100dvh - 72px - env(safe-area-inset-bottom))','important');report.style.setProperty('height','calc(100dvh - 72px - env(safe-area-inset-bottom))','important');report.style.setProperty('overflow-y','auto','important');report.style.setProperty('overflow-x','hidden','important');report.style.setProperty('-webkit-overflow-scrolling','touch','important');report.style.setProperty('overscroll-behavior-y','contain','important');report.style.setProperty('touch-action','pan-y','important');report.style.setProperty('padding-bottom','96px','important');
  });
  var main=document.querySelector('body.app-screen .main');if(main){main.style.setProperty('min-height','0','important');main.style.setProperty('overflow','hidden','important');}
}
function bind(){fixReports();var main=document.querySelector('body.app-screen .main');if(main&&!main.dataset.apkReportObserver){main.dataset.apkReportObserver='1';new MutationObserver(fixReports).observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();window.addEventListener('load',bind);setTimeout(fixReports,500);setTimeout(fixReports,1500);
})();

/* APK TAB ISOLATION FIX — hide the existing inactive Account/Settings panel instead of letting it overlay Kasir. */
(function(){
'use strict';
function isolateInactiveTabs(){
  if(!document.documentElement.classList.contains('apk-nav-enabled'))return;
  document.querySelectorAll('body.app-screen .main .tab, body.app-screen .main > section.tab, body.app-screen #tab-akun').forEach(function(tab){
    if(tab.classList.contains('active')){
      tab.style.removeProperty('display');tab.style.removeProperty('visibility');tab.style.removeProperty('opacity');tab.style.removeProperty('pointer-events');
    }else{
      tab.style.setProperty('display','none','important');tab.style.setProperty('visibility','hidden','important');tab.style.setProperty('opacity','0','important');tab.style.setProperty('pointer-events','none','important');
    }
  });
}
function bindIsolation(){
  isolateInactiveTabs();
  var main=document.querySelector('body.app-screen .main');
  if(main&&!main.dataset.apkTabIsolation){main.dataset.apkTabIsolation='1';new MutationObserver(function(){isolateInactiveTabs()}).observe(main,{subtree:true,attributes:true,attributeFilter:['class','style']});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindIsolation,{once:true});else bindIsolation();window.addEventListener('load',bindIsolation);
})();
